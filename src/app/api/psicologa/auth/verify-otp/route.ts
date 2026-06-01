import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";
import { issuePsicologaSession, PSICOLOGA_COOKIE_NAME, psicologaCookieOptions, type PsicologaProfile } from "@/lib/psicologa-auth";
import { isJefeEmail } from "@/lib/jefe-psi-auth";

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
  const code = String(body.code ?? "").trim();
  if (!email || !code) return NextResponse.json({ error: "missing" }, { status: 400 });

  const { data: otp } = await sb.from("psychologist_otp").select("*").eq("email", email).maybeSingle();
  if (!otp) return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
  if (new Date(otp.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "expired" }, { status: 400 });
  if (otp.attempts >= 5) return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  if (otp.code !== code) {
    await sb.from("psychologist_otp").update({ attempts: otp.attempts + 1 }).eq("email", email);
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  // OK — borra OTP usado
  await sb.from("psychologist_otp").delete().eq("email", email);

  // Líder → modo supervisor (sin provider_id, debe elegir a quién ver)
  if (isJefeEmail(email)) {
    const leaderName = email.startsWith("lidermentesana") ? "Lead B" : "Lead A";
    const profile: PsicologaProfile = {
      provider_id: 0,
      email,
      name: `${leaderName} (líder)`,
      first_name: leaderName,
      last_name: "(líder)",
      is_supervisor: true,
      original_email: email,
    };
    const { value, maxAge } = issuePsicologaSession(profile);
    const res = NextResponse.json({ ok: true, profile, redirect: "/psicologo/elegir-psicologa" });
    const opts = psicologaCookieOptions(maxAge);
    res.cookies.set({ ...opts, value });
    return res;
  }

  // Carga provider Amelia (psicóloga normal)
  const rows = await ameliaQuery<any>(
    `SELECT id, firstName, lastName, email FROM ${ameliaTable("users")} WHERE type='provider' AND status='visible' AND LOWER(email) = LOWER(?) LIMIT 1`,
    [email],
  );
  if (rows.length === 0) return NextResponse.json({ error: "provider_not_found" }, { status: 404 });
  const p = rows[0];
  const profile: PsicologaProfile = {
    provider_id: Number(p.id),
    email: p.email,
    name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email,
    first_name: p.firstName ?? "",
    last_name: p.lastName ?? "",
  };

  const { value, maxAge } = issuePsicologaSession(profile);
  const res = NextResponse.json({ ok: true, profile });
  const opts = psicologaCookieOptions(maxAge);
  res.cookies.set({ ...opts, value });
  return res;
}

export async function DELETE(req: NextRequest) {
  // Logout
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: PSICOLOGA_COOKIE_NAME, value: "", path: "/", maxAge: 0 });
  return res;
}
