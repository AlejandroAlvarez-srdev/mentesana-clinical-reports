// CRUD tareas para pacientes. GET filtra por customer_id o appointment_id.
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
  const { provider_id } = auth.agent;
  const url = new URL(req.url);
  const customer_id = url.searchParams.get("customer_id");
  const appointment_id = url.searchParams.get("appointment_id");

  let q = sb.from("patient_tasks").select("*").eq("provider_id", provider_id).order("created_at", { ascending: false }).limit(200);
  if (customer_id) q = q.eq("customer_id", Number(customer_id));
  if (appointment_id) q = q.eq("appointment_id", Number(appointment_id));
  const { data } = await q;
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const body = await req.json().catch(() => ({}) as any);
  const { customer_id, appointment_id, title, description, due_date } = body;
  if (!customer_id || !title || String(title).trim().length < 2) {
    return NextResponse.json({ error: "customer_id y title requeridos" }, { status: 400 });
  }
  const { data, error } = await sb.from("patient_tasks").insert({
    provider_id: auth.agent.provider_id,
    customer_id: Number(customer_id),
    appointment_id: appointment_id ? Number(appointment_id) : null,
    title: String(title).slice(0, 200),
    description: description ? String(description).slice(0, 2000) : null,
    due_date: due_date || null,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
