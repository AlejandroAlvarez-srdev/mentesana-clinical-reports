// Lista de pacientes únicos de la psicóloga. PII oculta (no phone, no email completo).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

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

  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");

  // Customers con al menos 1 booking aprobada con esta psicóloga
  const rows = await ameliaQuery<any>(
    `SELECT DISTINCT cb.customerId,
       u.firstName, u.lastName,
       (SELECT COUNT(*) FROM ${cb} cb2 JOIN ${ab} a2 ON a2.id=cb2.appointmentId WHERE cb2.customerId = cb.customerId AND a2.providerId = ? AND cb2.status='approved') total_sessions,
       (SELECT MAX(a3.bookingStart) FROM ${cb} cb3 JOIN ${ab} a3 ON a3.id=cb3.appointmentId WHERE cb3.customerId = cb.customerId AND a3.providerId = ? AND cb3.status='approved') last_session,
       (SELECT MIN(a4.bookingStart) FROM ${cb} cb4 JOIN ${ab} a4 ON a4.id=cb4.appointmentId WHERE cb4.customerId = cb.customerId AND a4.providerId = ? AND cb4.status='approved') first_session,
       (SELECT MIN(a5.bookingStart) FROM ${cb} cb5 JOIN ${ab} a5 ON a5.id=cb5.appointmentId WHERE cb5.customerId = cb.customerId AND a5.providerId = ? AND cb5.status IN ('approved','pending') AND a5.bookingStart >= NOW()) next_session
     FROM ${cb} cb
     JOIN ${ab} a ON a.id = cb.appointmentId
     JOIN ${ub} u ON u.id = cb.customerId
     WHERE a.providerId = ? AND cb.status IN ('approved','pending')
     ORDER BY total_sessions DESC, last_session DESC
     LIMIT 500`,
    [provider_id, provider_id, provider_id, provider_id, provider_id],
  );

  // Cuenta de notas clínicas escritas por esta psi para cada customer
  const custIds = rows.map((r: any) => Number(r.customerId)).filter(Boolean);
  let notesCount = new Map<number, number>();
  if (custIds.length > 0) {
    const { data: notes } = await sb
      .from("psychologist_clinical_notes")
      .select("customer_id")
      .eq("provider_id", provider_id)
      .in("customer_id", custIds);
    for (const n of notes ?? []) {
      notesCount.set(Number(n.customer_id), (notesCount.get(Number(n.customer_id)) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    patients: rows.map((r: any) => ({
      customer_id: r.customerId,
      // Nombre completo sí, pero NO email NI phone
      name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "(sin nombre)",
      total_sessions: Number(r.total_sessions ?? 0),
      first_session: r.first_session ? new Date(r.first_session).toISOString() : null,
      last_session: r.last_session ? new Date(r.last_session).toISOString() : null,
      next_session: r.next_session ? new Date(r.next_session).toISOString() : null,
      notes_count: notesCount.get(Number(r.customerId)) ?? 0,
    })),
  });
}
