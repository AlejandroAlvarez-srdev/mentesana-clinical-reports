// Psicóloga solicita autorización al jefe para editar HC con >7 días.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { JEFE_EMAILS } from "@/lib/jefe-psi-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const body = await req.json().catch(() => ({}));
  const apptId = Number(body.appointment_id);
  const reason = String(body.reason ?? "").trim().slice(0, 500);
  if (!apptId) return NextResponse.json({ error: "missing_appointment_id" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "missing_reason", message: "Indica el motivo por el que llegas tarde a llenar esta HC." }, { status: 400 });

  // Verifica ownership
  const own = await ameliaQuery<any>(
    `SELECT cb.customerId FROM ${ameliaTable("appointments")} a JOIN ${ameliaTable("customer_bookings")} cb ON cb.appointmentId = a.id WHERE a.id = ? AND a.providerId = ? LIMIT 1`,
    [apptId, auth.agent.provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope" }, { status: 403 });

  const { data, error } = await sb.from("hc_unlock_requests").upsert({
    provider_id: auth.agent.provider_id,
    appointment_id: apptId,
    customer_id: own[0].customerId ?? null,
    reason,
    status: "pending",
  }, { onConflict: "appointment_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificación a las dos líderes
  for (const ref of JEFE_EMAILS) {
    await sb.from("panel_notifications").insert({
      recipient_type: "jefe",
      recipient_ref: ref,
      kind: "hc_unlock_request",
      title: `🔓 Solicitud HC vencida · ${auth.agent.name}`,
      body: `${reason}\n\nCita #${apptId}`,
      link: `/agent/jefe-psicologas/hc-unlocks`,
    });
  }

  return NextResponse.json({ ok: true, request: data });
}

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { searchParams } = new URL(req.url);
  const apptId = Number(searchParams.get("appointment_id"));
  if (!apptId) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { data } = await sb.from("hc_unlock_requests").select("*").eq("appointment_id", apptId).maybeSingle();
  return NextResponse.json({ request: data ?? null });
}
