// Aviso a la psicóloga (y a las líderes) de que hay un resumen de sesión PAGADO esperando
// su aprobación en /psicologo/resumenes. Antes el cron lo generaba y nadie se enteraba
// (caso [paciente] 02-oct: 3 días parado, la paciente reclamó dos veces).
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/emails/send";
import { emailLayout } from "@/lib/emails/layout";
import { JEFE_EMAILS } from "@/lib/jefe-psi-auth";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://mentesanapsicologia.com";
const LINK = `${SITE}/psicologo/resumenes`;

export interface ResumenPendiente {
  id: string; provider_id: number | null; patient_name: string | null; patient_email: string | null;
  status: string; session_date?: string | null; alert_reason?: string | null; generated_at?: string | null;
}

async function emailDeProvider(providerId: number | null): Promise<string | null> {
  if (!providerId) return null;
  try {
    const { ameliaQuery, ameliaTable } = await import("@/lib/amelia-db");
    const rows = await ameliaQuery<{ email: string | null }>(`SELECT email FROM ${ameliaTable("users")} WHERE id = ? LIMIT 1`, [providerId]);
    return rows[0]?.email?.trim().toLowerCase() || null;
  } catch { return null; }
}

const fmtFecha = (iso: string | null | undefined) => iso ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long" }).format(new Date(iso)) : "";

export async function notificarResumenPendiente(sb: SupabaseClient, o: ResumenPendiente, modo: "nuevo" | "recordatorio"): Promise<{ psi: string | null; emails: number }> {
  const psi = await emailDeProvider(o.provider_id);
  const paciente = o.patient_name || o.patient_email || "una paciente";
  const fecha = fmtFecha(o.session_date);
  const revision = o.status === "needs_review";
  const title = modo === "nuevo"
    ? `📝 Resumen pendiente de aprobar · ${paciente}`
    : `⏰ Sigue pendiente: resumen de ${paciente}`;
  const body = `${paciente} ha pagado el resumen de su sesión${fecha ? ` del ${fecha}` : ""} y lo está esperando. ${revision ? `Marcado para REVISIÓN: ${o.alert_reason ?? "posible contenido sensible"}. ` : ""}Revísalo y pulsa "Aprobar y enviar" en tu panel.`;

  const destinatarios = new Set<string>();
  if (psi) destinatarios.add(psi);
  // Líderes: siempre si requiere revisión o es recordatorio; si no hay email de la psi, también.
  if (revision || modo === "recordatorio" || !psi) JEFE_EMAILS.forEach((e) => destinatarios.add(e));

  if (psi) {
    await sb.from("panel_notifications").insert({
      recipient_type: "psicologa", recipient_ref: psi, kind: modo === "nuevo" ? "resumen_pending" : "resumen_pending_reminder",
      title, body, link: "/psicologo/resumenes",
    }).then(() => {}, () => {});
  }

  let emails = 0;
  for (const to of destinatarios) {
    const content = `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#1a0a1f;">${modo === "nuevo" ? "Hay un resumen de sesión pagado esperando tu aprobación:" : "Este resumen de sesión sigue pendiente de aprobar y la paciente ya ha preguntado por él:"}</p>
      <div style="padding:16px;background:rgba(106,23,140,0.05);border-left:4px solid #6A178C;border-radius:8px;margin-bottom:16px;">
        <strong style="font-size:16px;color:#6A178C;">${esc(paciente)}</strong>
        <p style="margin:6px 0 0;font-size:13px;color:#475569;">Sesión${fecha ? ` del ${esc(fecha)}` : ""} · ${revision ? "⚠️ requiere revisión: " + esc(o.alert_reason ?? "posible contenido sensible") : "sin alertas clínicas"}</p>
      </div>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#1a0a1f;">El PDF ya está generado a partir de tu historia clínica. Solo tienes que leerlo y pulsar <strong>Aprobar y enviar</strong>; le llega a la paciente al momento.</p>
      <a href="${LINK}" style="display:inline-block;padding:12px 22px;background:linear-gradient(135deg,#6A178C,#8B2FB5);color:#fff;text-decoration:none;border-radius:10px;font-weight:800;">Revisar y aprobar →</a>`;
    const r = await sendEmail({ to, subject: `[Mente Sana] ${title}`, html: emailLayout({ title, preheader: body, content }) });
    if (r.success) emails++;
  }
  const stamp = new Date().toISOString();
  await sb.from("resumen_orders").update(modo === "nuevo" ? { notified_at: stamp, last_reminder_at: stamp } : { last_reminder_at: stamp }).eq("id", o.id);
  return { psi, emails };
}

function esc(s: string): string { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
