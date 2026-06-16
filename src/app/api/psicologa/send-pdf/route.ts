// Psicóloga reenvía el PDF diagnóstico al correo del paciente con 1 click.
// Reusa la plantilla reportDeliveryEmail (misma que admin/send-report-email).
// Match customer Amelia → diagnostico_tests por email (luego phone como fallback).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { sendEmail, reportDeliveryEmail } from "@/lib/emails";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;

  const body = await req.json().catch(() => ({}));
  const customerId = Number(body.customer_id);
  if (!customerId) return NextResponse.json({ error: "missing_customer_id" }, { status: 400 });

  // 1) Verifica ownership Amelia + saca email/phone del paciente
  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const own = await ameliaQuery<any>(
    `SELECT cu.email, cu.phone, cu.firstName, cu.lastName
     FROM ${cb} cb JOIN ${ab} a ON a.id = cb.appointmentId
     JOIN ${ub} cu ON cu.id = cb.customerId
     WHERE cb.customerId = ? AND a.providerId = ? LIMIT 1`,
    [customerId, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope", message: "No tienes este paciente asignado." }, { status: 403 });
  const c = own[0];

  // 2) Localiza el test diagnóstico (email primero, phone fallback)
  let row: any = null;
  if (c.email) {
    const { data } = await sb
      .from("diagnostico_tests")
      .select("id, user_email, user_name, report_url, perfil_nombre, matched_psychologist, scheduled_date, scheduled_time")
      .ilike("user_email", c.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = data;
  }
  if (!row && c.phone) {
    const variants = [c.phone, String(c.phone).replace(/^\+/, ""), String(c.phone).startsWith("+") ? c.phone : `+${c.phone}`];
    const { data } = await sb
      .from("diagnostico_tests")
      .select("id, user_email, user_name, report_url, perfil_nombre, matched_psychologist, scheduled_date, scheduled_time")
      .in("user_phone", variants)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = data;
  }

  if (!row) return NextResponse.json({ error: "test_not_found", message: "Este paciente no tiene informe diagnóstico." }, { status: 404 });
  if (!row.report_url) return NextResponse.json({ error: "pdf_not_ready", message: "El PDF aún no se ha generado." }, { status: 400 });
  if (!row.user_email) return NextResponse.json({ error: "no_email", message: "Falta el email del paciente." }, { status: 400 });

  // Descarga el PDF
  let pdfBase64 = "";
  try {
    const pdfRes = await fetch(row.report_url);
    if (!pdfRes.ok) throw new Error(`pdf fetch ${pdfRes.status}`);
    const buf = Buffer.from(await pdfRes.arrayBuffer());
    pdfBase64 = buf.toString("base64");
  } catch (e: any) {
    return NextResponse.json({ error: "pdf_download_failed", message: String(e.message ?? e) }, { status: 500 });
  }

  const { subject, html } = reportDeliveryEmail({
    name: row.user_name ?? "",
    perfilNombre: row.perfil_nombre ?? "",
    psychologistName: row.matched_psychologist ?? auth.agent.name,
    scheduledDate: row.scheduled_date ?? "",
    scheduledTime: row.scheduled_time ?? "",
  });

  await sendEmail({
    to: row.user_email,
    toName: row.user_name ?? "",
    subject,
    html,
    attachments: [{ name: "informe-diagnostico-mente-sana.pdf", content: pdfBase64 }],
  });

  // Log para auditoría
  await sb.from("panel_notifications").insert({
    recipient_type: "psicologa",
    recipient_ref: auth.agent.email,
    kind: "pdf_sent",
    title: `📧 PDF reenviado a ${row.user_name ?? row.user_email}`,
    body: `Reenviado desde tu panel a ${row.user_email}`,
  });

  return NextResponse.json({ ok: true, sent_to: row.user_email });
}
