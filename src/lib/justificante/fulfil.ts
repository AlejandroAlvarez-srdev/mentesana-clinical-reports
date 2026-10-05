// Orquestación del justificante de asistencia (8,99 €):
//   pago (webhook) → fila en justificantes_asistencia → si ya hay sesión asistida en
//   Amelia: PDF + email ahora; si no (lo pagan ANTES de la cita): queda pending + tarea
//   a soporte, y se cumple solo cuando soporte marca la asistencia (hook en
//   /api/agent/appointments/[id]/attendance) o por el cron /api/cron/justificantes-fulfill.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/emails/send";
import { createPanelTask, markTaskDone } from "@/lib/panel-tasks";
import { buscarSesionAsistida, type SesionAsistida } from "./amelia";
import { buildJustificanteData, renderJustificantePDF } from "./pdf";
import { emailJustificante } from "./email";

const TABLE = "justificantes_asistencia";
// Quién recibe la tarea cuando el pago llega antes de la sesión.
const TASK_ASSIGNEE = (process.env.JUSTIFICANTE_TASK_ASSIGNEE || "cto@example.com").trim().toLowerCase();

export interface JustificanteRow {
  id: string; stripe_session_id: string; email: string | null; phone: string | null; name: string | null;
  paid_at: string | null; amount_cents: number | null; status: "pending" | "sending" | "sent" | "error";
  appointment_id: number | null; attempts: number; task_id: string | null;
}

export function blogClient(): SupabaseClient {
  return createClient(
    (process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL ?? "").replace(/\n/g, "").trim(),
    (process.env.BLOG_SUPABASE_SERVICE_KEY ?? "").replace(/\n/g, "").trim(),
    { auth: { persistSession: false } },
  );
}

const fmtMadrid = (d: Date) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const nombreArchivo = (s: SesionAsistida) => `Justificante-asistencia-Mente-Sana-${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(s.start_utc)}.pdf`;

/** Genera el PDF y lo envía por email. No toca la tabla. */
export async function generarYEnviar(sesion: SesionAsistida, destino: { email: string; nombre?: string | null }): Promise<{ ok: boolean; error?: string; codigo: string }> {
  const data = buildJustificanteData({
    paciente: destino.nombre?.trim() || sesion.customer_name,
    sessionStart: sesion.start_utc,
    durationMin: sesion.duration_min,
    psicologa: sesion.provider_name,
    firstSession: sesion.first_attended_utc,
    attendedCount: sesion.attended_count,
    appointmentId: sesion.appointment_id,
  });
  const pdf = await renderJustificantePDF(data);
  const mail = emailJustificante({ nombre: data.paciente, fechaLarga: data.fechaSesionLarga, psicologa: sesion.provider_name });
  const r = await sendEmail({
    to: destino.email, toName: data.paciente, subject: mail.subject, html: mail.html, replyTo: "hola@mentesanapsicologia.com",
    attachments: [{ name: nombreArchivo(sesion), content: pdf.toString("base64") }],
  });
  return { ok: r.success, error: r.error, codigo: data.codigo };
}

/**
 * Intenta cumplir una fila: busca sesión asistida (la cita indicada o la última en la
 * ventana), envía y marca `sent`. Claim atómico pending→sending para no enviar dos veces.
 */
export async function intentarCumplir(row: JustificanteRow, opts: { appointmentId?: number | null; sb?: SupabaseClient } = {}): Promise<{ sent: boolean; reason?: string }> {
  const sb = opts.sb ?? blogClient();
  const email = (row.email ?? "").trim().toLowerCase();
  if (!email) return { sent: false, reason: "sin_email" };

  const sesion = await buscarSesionAsistida({ email, phone: row.phone, appointmentId: opts.appointmentId ?? null, desdeDias: 21 });
  if (!sesion) return { sent: false, reason: "sin_sesion_asistida" };
  // La sesión debe ser posterior al pago menos 7 días (si pagó por una sesión concreta
  // reciente, vale; una sesión de hace un mes con pago de hoy no es la que justifica).
  if (row.paid_at && sesion.start_utc.getTime() < Date.parse(row.paid_at) - 7 * 86_400_000) return { sent: false, reason: "sesion_anterior_al_pago" };

  const claim = await sb.from(TABLE).update({ status: "sending", attempts: (row.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq("id", row.id).in("status", ["pending", "error"]).select("id").maybeSingle();
  if (claim.error || !claim.data) return { sent: false, reason: "claim_perdido" };

  const r = await generarYEnviar(sesion, { email, nombre: row.name });
  if (!r.ok) {
    await sb.from(TABLE).update({ status: "error", send_error: (r.error ?? "send_failed").slice(0, 300), updated_at: new Date().toISOString() }).eq("id", row.id);
    return { sent: false, reason: r.error ?? "send_failed" };
  }
  await sb.from(TABLE).update({
    status: "sent", sent_at: new Date().toISOString(), send_error: null,
    appointment_id: sesion.appointment_id, session_at: sesion.start_utc.toISOString(), provider_name: sesion.provider_name,
    verification_code: r.codigo, updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (row.task_id) { try { await markTaskDone(row.task_id); } catch { /* best-effort */ } }
  return { sent: true };
}

/** Webhook de Stripe: registra el pago y lo cumple si ya hay sesión asistida; si no, tarea a soporte. */
export async function registrarJustificantePagado(p: { stripeSessionId: string; email: string | null; phone: string | null; name: string | null; paidAt: Date; amountCents: number }): Promise<{ sent: boolean; pending: boolean; reason?: string }> {
  const sb = blogClient();
  const ins = await sb.from(TABLE).upsert({
    stripe_session_id: p.stripeSessionId, email: p.email?.toLowerCase() ?? null, phone: p.phone, name: p.name,
    paid_at: p.paidAt.toISOString(), amount_cents: p.amountCents, status: "pending",
  }, { onConflict: "stripe_session_id", ignoreDuplicates: true });
  if (ins.error) throw new Error(`justificantes_asistencia upsert: ${ins.error.message}`);
  const { data: row } = await sb.from(TABLE).select("*").eq("stripe_session_id", p.stripeSessionId).maybeSingle();
  if (!row) return { sent: false, pending: false, reason: "fila_no_encontrada" };
  if (row.status === "sent") return { sent: true, pending: false };

  const r = await intentarCumplir(row as JustificanteRow, { sb });
  if (r.sent) return { sent: true, pending: false };

  // Pagó antes de la sesión (o Amelia no responde): queda pendiente + aviso a soporte.
  if (!row.task_id) {
    try {
      const task = await createPanelTask({
        title: `📄 Justificante de asistencia pendiente · ${p.name || p.email || "paciente"}`,
        description: `Pagó el justificante (8,99 €) el ${fmtMadrid(p.paidAt)} y aún no tiene sesión asistida registrada en Amelia (motivo: ${r.reason}). Se enviará solo al marcar su asistencia en "Citas de hoy". Si ya asistió, marca la asistencia o reenvíalo desde el inbox. Contacto: ${p.email ?? "-"} · ${p.phone ?? "-"}.`,
        assignee_type: "agent", assignee_ref: TASK_ASSIGNEE, assigned_by_email: "sistema@mentesanapsicologia.com",
        priority: "high", due_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), related_panel: "justificante", related_id: row.id,
      });
      await sb.from(TABLE).update({ task_id: task.id, send_error: r.reason ?? null, updated_at: new Date().toISOString() }).eq("id", row.id);
    } catch (e) { console.error("[justificante] tarea soporte:", e instanceof Error ? e.message : e); }
  }
  return { sent: false, pending: true, reason: r.reason };
}

/** Hook de asistencia: al marcar asistió, cumple los justificantes pendientes de ese contacto. */
export async function cumplirPendientesParaContacto(p: { email?: string | null; phone?: string | null; appointmentId?: number | null }): Promise<number> {
  const sb = blogClient();
  const ors: string[] = [];
  const email = (p.email ?? "").trim().toLowerCase();
  const last9 = (p.phone ?? "").replace(/\D/g, "").slice(-9);
  if (email) ors.push(`email.ilike.${email}`);
  if (last9.length === 9) ors.push(`phone.ilike.*${last9}`);
  if (!ors.length) return 0;
  const { data } = await sb.from(TABLE).select("*").in("status", ["pending", "error"]).or(ors.join(",")).order("paid_at", { ascending: false }).limit(5);
  let n = 0;
  for (const row of (data ?? []) as JustificanteRow[]) {
    const r = await intentarCumplir(row, { appointmentId: p.appointmentId ?? null, sb });
    if (r.sent) n++;
  }
  return n;
}

/** Cron: reintenta los pendientes/errores de los últimos 60 días. */
export async function cumplirPendientes(limit = 20): Promise<{ revisados: number; enviados: number; detalle: { id: string; email: string | null; reason?: string }[] }> {
  const sb = blogClient();
  const desde = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data } = await sb.from(TABLE).select("*").in("status", ["pending", "error"]).gte("paid_at", desde).lt("attempts", 50).order("paid_at", { ascending: true }).limit(limit);
  const rows = (data ?? []) as JustificanteRow[];
  const detalle: { id: string; email: string | null; reason?: string }[] = [];
  let enviados = 0;
  for (const row of rows) {
    try {
      const r = await intentarCumplir(row, { sb });
      if (r.sent) enviados++; else detalle.push({ id: row.id, email: row.email, reason: r.reason });
    } catch (e) { detalle.push({ id: row.id, email: row.email, reason: e instanceof Error ? e.message : String(e) }); }
  }
  return { revisados: rows.length, enviados, detalle };
}
