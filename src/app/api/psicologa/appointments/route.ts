// Citas de la psicóloga autenticada. ?range=today|week|month|all + status_filter.
// Devuelve también si tiene clinical_note ya guardada por cada appt.
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
export const maxDuration = 20;

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;
  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "upcoming";

  let whereTime = "";
  if (range === "today") whereTime = "AND DATE(a.bookingStart) = CURDATE()";
  else if (range === "week") whereTime = "AND a.bookingStart BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)";
  else if (range === "month") whereTime = "AND a.bookingStart BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)";
  else if (range === "upcoming") whereTime = "AND a.bookingStart >= NOW()";
  else if (range === "past") whereTime = "AND a.bookingStart < NOW()";

  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const sv = ameliaTable("services");

  // Semántica Mente Sana: approved+pending=asistió, no-show+rejected=no asistió, canceled=canceló
  // Mostramos todos los status (excepto NULL/desconocidos) para que la psicóloga vea su histórico completo.
  const rows = await ameliaQuery<any>(
    `SELECT a.id appointment_id, a.bookingStart, a.bookingEnd, a.googleMeetUrl, a.serviceId, s.name service_name,
       cb.id booking_id, cb.customerId, cb.status booking_status,
       cu.firstName customer_fn, cu.lastName customer_ln
     FROM ${ab} a
     LEFT JOIN ${cb} cb ON cb.appointmentId = a.id
     LEFT JOIN ${ub} cu ON cu.id = cb.customerId
     LEFT JOIN ${sv} s ON s.id = a.serviceId
     WHERE a.providerId = ?
       AND (cb.status IS NULL OR cb.status IN ('approved','pending','canceled','no-show','rejected'))
       ${whereTime}
     ORDER BY a.bookingStart ${range === "past" ? "DESC" : "ASC"}
     LIMIT 200`,
    [provider_id],
  );

  const apptIds = rows.map((r: any) => r.appointment_id);
  let notesByAppt = new Map<number, any>();
  if (apptIds.length > 0) {
    const { data: notes } = await sb
      .from("psychologist_clinical_notes")
      .select("appointment_id, highlights, how_went, attended, updated_at")
      .eq("provider_id", provider_id)
      .in("appointment_id", apptIds);
    notesByAppt = new Map((notes ?? []).map((n: any) => [n.appointment_id, n]));
  }

  return NextResponse.json({
    appointments: rows.map((r: any) => ({
      appointment_id: r.appointment_id,
      booking_id: r.booking_id,
      booking_start_utc: new Date(r.bookingStart).toISOString(),
      booking_end_utc: r.bookingEnd ? new Date(r.bookingEnd).toISOString() : null,
      google_meet_url: r.googleMeetUrl || null,
      service_id: r.serviceId,
      service_name: r.service_name,
      customer_id: r.customerId,
      // Nombre solo (sin phone/email)
      customer_name: `${r.customer_fn ?? ""} ${r.customer_ln ?? ""}`.trim() || "(sin nombre)",
      booking_status: r.booking_status,
      has_clinical_note: notesByAppt.has(r.appointment_id),
      clinical_highlights: notesByAppt.get(r.appointment_id)?.highlights ?? null,
      attended: notesByAppt.get(r.appointment_id)?.attended ?? null,
    })),
  });
}
