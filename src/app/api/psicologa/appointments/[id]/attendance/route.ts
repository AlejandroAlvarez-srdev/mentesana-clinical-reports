// Marca asistencia rapida desde la lista de citas: upsert clinical_note.attended + sync Amelia.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaExec, ameliaTable } from "@/lib/amelia-db";

const sb = createClient(
  process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!,
  process.env.BLOG_SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;
  const { id } = await ctx.params;
  const apptId = Number(id);
  if (!Number.isFinite(apptId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const body = await req.json().catch(() => ({} as any));
  const attended: boolean | null = body.attended === null ? null : !!body.attended;

  // Ownership
  const own = await ameliaQuery<any>(
    `SELECT a.bookingStart, cb.customerId FROM ${ameliaTable("appointments")} a LEFT JOIN ${ameliaTable("customer_bookings")} cb ON cb.appointmentId = a.id WHERE a.id = ? AND a.providerId = ? LIMIT 1`,
    [apptId, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope" }, { status: 403 });

  // Upsert solo el campo attended (mantiene los otros campos)
  await sb.from("psychologist_clinical_notes").upsert({
    appointment_id: apptId,
    provider_id,
    customer_id: own[0].customerId ? Number(own[0].customerId) : null,
    session_date: own[0].bookingStart ? new Date(own[0].bookingStart).toISOString() : new Date().toISOString(),
    attended,
    updated_at: new Date().toISOString(),
  }, { onConflict: "appointment_id,provider_id" });

  // Sync Amelia
  let amelia_synced = false;
  if (attended !== null) {
    const newStatus = attended ? "approved" : "no-show";
    try {
      const r = await ameliaExec(
        `UPDATE ${ameliaTable("customer_bookings")} SET status = ? WHERE appointmentId = ? AND status NOT IN ('canceled','rejected')`,
        [newStatus, apptId],
      );
      amelia_synced = r.affectedRows > 0;
    } catch { /* opcional */ }
  }
  return NextResponse.json({ ok: true, amelia_synced, attended });
}
