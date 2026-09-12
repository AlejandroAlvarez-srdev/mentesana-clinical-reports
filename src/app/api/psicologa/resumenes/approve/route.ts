// La psicóloga aprueba y ENVÍA el resumen al paciente (1 clic). Verifica que el
// pedido es de SU paciente (provider_id) antes de enviar. Adjunta el PDF por Brevo.
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { sendEmail } from "@/lib/emails";
import { blogClient, signedUrl } from "@/lib/resumen/generate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function emailHtml(nombre: string, fechaSesion: string) {
  const first = (nombre || "").split(" ")[0] || "";
  return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;max-width:560px;margin:0 auto;line-height:1.5">
  <p style="font-size:16px">Hola ${first},</p>
  <p>Te compartimos el <strong>resumen de tu última sesión</strong>${fechaSesion ? ` (${fechaSesion})` : ""}, preparado especialmente para ti.</p>
  <p>Recoge lo que trabajasteis, tus <strong>aprendizajes clave</strong> y algunas <strong>propuestas concretas para esta semana</strong>. Te recomendamos guardarlo y volver a leerlo entre sesiones.</p>
  <p>Lo tienes <strong>adjunto en PDF</strong>. Cualquier duda, respóndenos a este correo.</p>
  <p style="margin-top:22px">Un abrazo,<br><strong>Equipo de Mente Sana Psicología</strong></p>
  <p style="font-size:12px;color:#8a8a97;border-top:1px solid #eee;padding-top:10px;margin-top:20px">Documento confidencial de uso terapéutico, dirigido a la paciente. Mente Sana Psicología.</p>
</div>`;
}

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id, is_supervisor, email: psiEmail } = auth.agent;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const sb = blogClient();
  const { data: o } = await sb.from("resumen_orders")
    .select("id, provider_id, patient_email, patient_name, status, report_path, sent_at, content")
    .eq("id", id).maybeSingle();
  if (!o) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!is_supervisor && o.provider_id !== provider_id) {
    return NextResponse.json({ error: "out_of_scope", message: "Este resumen no es de tu paciente." }, { status: 403 });
  }
  if (o.status === "sent") return NextResponse.json({ ok: true, already: true });
  if (!["pending_approval", "needs_review"].includes(o.status)) {
    return NextResponse.json({ error: "bad_status", message: `Estado ${o.status}` }, { status: 409 });
  }
  if (!o.patient_email) return NextResponse.json({ error: "no_email" }, { status: 400 });
  if (!o.report_path) return NextResponse.json({ error: "no_pdf" }, { status: 400 });

  // claim para evitar doble envío
  const { data: claimed } = await sb.from("resumen_orders")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", o.status).select("id").maybeSingle();
  if (!claimed) return NextResponse.json({ ok: true, already: true });

  try {
    const url = await signedUrl(sb, o.report_path, 300);
    if (!url) throw new Error("no signed url");
    const pdfRes = await fetch(url);
    if (!pdfRes.ok) throw new Error(`pdf fetch ${pdfRes.status}`);
    const content = Buffer.from(await pdfRes.arrayBuffer()).toString("base64");

    const c = (o.content as { paciente?: string; fechaSesion?: string } | null) ?? {};
    await sendEmail({
      to: o.patient_email, toName: c.paciente || o.patient_name || "",
      replyTo: "hola@mentesanapsicologia.com",
      subject: "Tu resumen de sesión · Mente Sana Psicología",
      html: emailHtml(c.paciente || o.patient_name || "", c.fechaSesion || ""),
      attachments: [{ name: "Resumen-de-sesion-Mente-Sana.pdf", content }],
    });

    await sb.from("resumen_orders").update({
      status: "sent", sent_at: new Date().toISOString(), approved_by: psiEmail, updated_at: new Date().toISOString(),
    }).eq("id", id);
    await sb.from("panel_notifications").insert({
      recipient_type: "psicologa", recipient_ref: psiEmail, kind: "resumen_sent",
      title: `📧 Resumen enviado a ${o.patient_name || o.patient_email}`, body: `Aprobado y enviado a ${o.patient_email}`,
    }).then(() => {}, () => {});

    return NextResponse.json({ ok: true, sent_to: o.patient_email });
  } catch (e) {
    await sb.from("resumen_orders").update({ status: o.status, updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ error: "send_failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
