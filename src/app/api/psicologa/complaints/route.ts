// Lista quejas propias + crear nueva queja al jefe.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

const sb = createClient(
  process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!,
  process.env.BLOG_SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { data } = await sb
    .from("psychologist_complaints")
    .select("*")
    .eq("provider_id", auth.agent.provider_id)
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ complaints: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const body = await req.json().catch(() => ({}) as any);
  const subject = String(body.subject ?? "").trim();
  const description = String(body.description ?? "").trim();
  const severity = ["baja", "media", "alta", "urgente"].includes(body.severity) ? body.severity : "media";
  const customer_id = body.customer_id ?? null;
  const appointment_id = body.appointment_id ?? null;
  if (!subject || subject.length < 4) return NextResponse.json({ error: "subject_required" }, { status: 400 });
  const { data, error } = await sb
    .from("psychologist_complaints")
    .insert({
      provider_id: auth.agent.provider_id,
      customer_id, appointment_id,
      subject: subject.slice(0, 200),
      description: description.slice(0, 4000) || null,
      severity, status: "open",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ complaint: data });
}
