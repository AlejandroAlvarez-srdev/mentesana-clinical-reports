// Envía las tareas pendientes de un paciente por email (vía Brevo).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";
import { sendEmail } from "@/lib/emails/send";
import { emailLayout } from "@/lib/emails/layout";

const sb = createClient(
  process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!,
  process.env.BLOG_SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id, name: providerName } = auth.agent;
  const body = await req.json().catch(() => ({}) as any);
  const customer_id = Number(body.customer_id);
  if (!Number.isFinite(customer_id)) return NextResponse.json({ error: "customer_id" }, { status: 400 });

  // Verifica ownership: customer ha tenido sesión con esta psi
  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const own = await ameliaQuery<any>(
    `SELECT cu.firstName, cu.lastName, cu.email FROM ${cb} cb JOIN ${ab} a ON a.id=cb.appointmentId JOIN ${ub} cu ON cu.id=cb.customerId WHERE cb.customerId=? AND a.providerId=? LIMIT 1`,
    [customer_id, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope" }, { status: 403 });
  const cust = own[0];
  if (!cust.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cust.email)) {
    return NextResponse.json({ error: "no_email", message: "El paciente no tiene email válido en Amelia" }, { status: 400 });
  }

  // Tareas pending del paciente con esta psi
  const { data: tasks } = await sb.from("patient_tasks").select("id, title, description, due_date")
    .eq("provider_id", provider_id).eq("customer_id", customer_id).eq("status", "pending")
    .order("created_at", { ascending: true });
  if (!tasks || tasks.length === 0) return NextResponse.json({ error: "no_pending_tasks" }, { status: 400 });

  const firstName = String(cust.firstName ?? "").trim().split(" ")[0] || "";
  const greeting = firstName ? `Hola ${esc(firstName)},` : "Hola,";
  const intro = String(body.intro_text ?? "").slice(0, 1000) || "Te dejo aquí las tareas que comentamos en sesión. No hay prisa: a tu ritmo y con cariño.";

  const listHtml = tasks.map((t) => `
    <li style="margin-bottom:12px;padding:12px;background:rgba(106,23,140,0.04);border-radius:10px;border-left:3px solid #6A178C;">
      <div style="font-weight:700;color:#1a0a1f;font-size:15px;margin-bottom:4px;">${esc(t.title)}</div>
      ${t.description ? `<div style="font-size:13px;color:#555;line-height:1.5;">${esc(t.description)}</div>` : ""}
      ${t.due_date ? `<div style="font-size:11px;color:#6A178C;margin-top:6px;font-weight:600;">📅 Para antes del ${new Date(t.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</div>` : ""}
    </li>
  `).join("");

  const content = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1a0a1f;font-weight:500;">${greeting}</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#1a0a1f;">${esc(intro)}</p>
    <h3 style="margin:0 0 12px;font-family:'Playfair Display',Georgia,serif;font-size:20px;font-weight:500;color:#6A178C;">Tus tareas de esta sesión</h3>
    <ul style="list-style:none;padding:0;margin:0;">${listHtml}</ul>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#666;font-style:italic;">Si tienes cualquier duda o quieres compartir cómo te están sentando estas tareas, escríbeme cuando quieras 💜</p>
    <p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:#1a0a1f;font-family:'Caveat',cursive;font-size:22px;color:#6A178C;">Un abrazo,<br>${esc(providerName)}</p>
  `;
  const html = emailLayout({ title: "Tus tareas — Mente Sana", preheader: `${tasks.length} tarea${tasks.length === 1 ? "" : "s"} para esta semana`, content });

  const result = await sendEmail({
    to: cust.email,
    toName: `${cust.firstName ?? ""} ${cust.lastName ?? ""}`.trim() || "Paciente",
    subject: `Tus tareas — sesión con ${providerName}`,
    html,
  });
  if (!result.success) return NextResponse.json({ error: result.error ?? "send_failed" }, { status: 502 });

  // Marca enviadas
  const ids = tasks.map((t) => t.id);
  await sb.from("patient_tasks").update({ sent_to_patient_at: new Date().toISOString() }).in("id", ids);

  return NextResponse.json({ ok: true, sent: tasks.length, recipient_masked: cust.email.replace(/(^.{2}).+(@.+$)/, "$1***$2") });
}
