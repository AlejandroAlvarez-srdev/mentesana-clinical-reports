// La psicóloga envía el PDF de la cita de bienvenida al correo del paciente con
// 1 click. Si el PDF aún no existe, lo genera al vuelo (/api/generate-bienvenida-pdf).
// Match customer Amelia → bienvenida_reservas por email (phone como fallback).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { sendEmail, reportDeliveryEmail } from "@/lib/emails";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SELECT = "appointment_id, email, name, angulo, report_url";

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;

  const body = await req.json().catch(() => ({}));
  const customerId = Number(body.customer_id);
  if (!customerId) return NextResponse.json({ error: "missing_customer_id" }, { status: 400 });

  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const own = await ameliaQuery<{ email: string | null; phone: string | null }>(
    `SELECT cu.email, cu.phone FROM ${cb} cb JOIN ${ab} a ON a.id = cb.appointmentId
     JOIN ${ub} cu ON cu.id = cb.customerId WHERE cb.customerId = ? AND a.providerId = ? LIMIT 1`,
    [customerId, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope", message: "No tienes este paciente asignado." }, { status: 403 });
  const c = own[0];

  let row: { appointment_id: number; email: string | null; name: string | null; angulo: string | null; report_url: string | null } | null = null;
  if (c.email) {
    const { data } = await sb.from("bienvenida_reservas").select(SELECT).ilike("email", c.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    row = data;
  }
  if (!row && c.phone) {
    const variants = [c.phone, String(c.phone).replace(/^\+/, ""), String(c.phone).startsWith("+") ? c.phone : `+${c.phone}`];
    const { data } = await sb.from("bienvenida_reservas").select(SELECT).in("phone", variants).order("created_at", { ascending: false }).limit(1).maybeSingle();
    row = data;
  }
  if (!row) return NextResponse.json({ error: "test_not_found", message: "Este paciente no tiene test de cita de bienvenida." }, { status: 404 });
  if (!row.email) return NextResponse.json({ error: "no_email", message: "Falta el email del paciente." }, { status: 400 });

  // Genera el PDF al vuelo si aún no existe.
  let reportUrl = row.report_url;
  if (!reportUrl) {
    try {
      const gen = await fetch(`${req.nextUrl.origin}/api/generate-bienvenida-pdf`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: row.appointment_id }),
      });
      const gd = await gen.json().catch(() => ({}));
      reportUrl = gd?.url ?? null;
    } catch (e) {
      console.error("[send-bienvenida-pdf] gen:", e instanceof Error ? e.message : e);
    }
  }
  if (!reportUrl) return NextResponse.json({ error: "pdf_failed", message: "No se pudo generar el PDF de bienvenida." }, { status: 500 });

  let pdfBase64 = "";
  try {
    const pdfRes = await fetch(reportUrl);
    if (!pdfRes.ok) throw new Error(`pdf fetch ${pdfRes.status}`);
    pdfBase64 = Buffer.from(await pdfRes.arrayBuffer()).toString("base64");
  } catch (e) {
    return NextResponse.json({ error: "pdf_download_failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  const { subject, html } = reportDeliveryEmail({
    name: row.name ?? "",
    perfilNombre: "Cita de bienvenida",
    psychologistName: auth.agent.name,
    scheduledDate: "", scheduledTime: "",
  });

  await sendEmail({
    to: row.email, toName: row.name ?? "", subject, html,
    attachments: [{ name: "informe-cita-bienvenida-mente-sana.pdf", content: pdfBase64 }],
  });

  await sb.from("bienvenida_reservas").update({ report_email_sent_at: new Date().toISOString() }).eq("appointment_id", row.appointment_id).then(() => {}, () => {});
  await sb.from("panel_notifications").insert({
    recipient_type: "psicologa", recipient_ref: auth.agent.email, kind: "pdf_sent",
    title: `📧 PDF bienvenida enviado a ${row.name ?? row.email}`, body: `Reenviado desde tu panel a ${row.email}`,
  }).then(() => {}, () => {});

  return NextResponse.json({ ok: true, sent_to: row.email });
}
