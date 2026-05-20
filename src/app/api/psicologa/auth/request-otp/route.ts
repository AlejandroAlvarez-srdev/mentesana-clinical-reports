// Envía OTP por email a la psicóloga si su email matchea un provider Amelia visible.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as any);
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // Verifica que el email exista en Amelia como provider visible
  const ub = ameliaTable("users");
  const rows = await ameliaQuery<any>(
    `SELECT id, firstName, lastName, email FROM ${ub} WHERE type='provider' AND status='visible' AND LOWER(email) = LOWER(?) LIMIT 1`,
    [email],
  );
  if (rows.length === 0) {
    // No revelamos si existe o no por seguridad
    return NextResponse.json({ ok: true, message: "Si el email existe te enviamos un código." });
  }

  // Genera OTP 6 dígitos
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await sb.from("psychologist_otp").upsert({ email, code, expires_at: expires, attempts: 0, created_at: new Date().toISOString() }, { onConflict: "email" });

  const firstName = String(rows[0].firstName ?? "").trim();
  const greeting = firstName ? `Hola ${firstName},` : "Hola,";
  const content = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1a0a1f;">${greeting}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#1a0a1f;">Tu código de acceso al panel de Mente Sana:</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;padding:18px 36px;background:linear-gradient(135deg,#6A178C 0%,#8B2FB5 100%);color:#fff;font-size:32px;font-weight:800;letter-spacing:8px;border-radius:14px;font-family:'Inter',sans-serif;">${code}</div>
    </div>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#555;text-align:center;">Caduca en 10 minutos. Si no lo pediste tú, ignora este email.</p>
    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#1a0a1f;font-family:'Caveat',cursive;font-size:18px;color:#6A178C;">Un abrazo,<br>El equipo de Mente Sana</p>
  `;
  const html = emailLayout({ title: "Tu código de acceso · Mente Sana", preheader: `Código ${code}`, content });

  await sendEmail({
    to: email,
    toName: firstName || rows[0].lastName || "Psicóloga",
    subject: `Tu código: ${code}`,
    html,
  });

  return NextResponse.json({ ok: true });
}
