// Detalle de una cita: info Amelia + clinical note (si existe) + historial previo del paciente.
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

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;
  const { id } = await ctx.params;
  const apptId = Number(id);
  if (!Number.isFinite(apptId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const sv = ameliaTable("services");

  const rows = await ameliaQuery<any>(
    `SELECT a.id appointment_id, a.bookingStart, a.bookingEnd, a.googleMeetUrl, a.providerId,
       s.name service_name, s.duration service_duration,
       cb.id booking_id, cb.customerId, cb.status booking_status,
       cu.firstName customer_fn, cu.lastName customer_ln
     FROM ${ab} a
     LEFT JOIN ${sv} s ON s.id = a.serviceId
     LEFT JOIN ${cb} cb ON cb.appointmentId = a.id
     LEFT JOIN ${ub} cu ON cu.id = cb.customerId
     WHERE a.id = ? LIMIT 1`,
    [apptId],
  );
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const r = rows[0];
  if (Number(r.providerId) !== Number(provider_id)) {
    return NextResponse.json({ error: "out_of_scope" }, { status: 403 });
  }

  // Clinical note actual
  const { data: note } = await sb
    .from("psychologist_clinical_notes")
    .select("*")
    .eq("appointment_id", apptId)
    .eq("provider_id", provider_id)
    .maybeSingle();

  // Historial previo del mismo paciente con esta psicóloga
  let history: any[] = [];
  if (r.customerId) {
    const { data: prev } = await sb
      .from("psychologist_clinical_notes")
      .select("appointment_id, session_date, highlights, how_went, attended")
      .eq("provider_id", provider_id)
      .eq("customer_id", r.customerId)
      .neq("appointment_id", apptId)
      .order("session_date", { ascending: false })
      .limit(10);
    history = prev ?? [];
  }

  return NextResponse.json({
    appointment: {
      appointment_id: r.appointment_id,
      booking_id: r.booking_id,
      booking_start_utc: new Date(r.bookingStart).toISOString(),
      booking_end_utc: r.bookingEnd ? new Date(r.bookingEnd).toISOString() : null,
      service_name: r.service_name,
      service_duration: r.service_duration,
      google_meet_url: r.googleMeetUrl || null,
      customer_id: r.customerId,
      customer_name: `${r.customer_fn ?? ""} ${r.customer_ln ?? ""}`.trim() || "(sin nombre)",
      booking_status: r.booking_status,
    },
    note,
    history,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;
  const { id } = await ctx.params;
  const apptId = Number(id);
  if (!Number.isFinite(apptId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const body = await req.json().catch(() => ({}) as any);

  // Verifica ownership + lee asistencia canónica (Amelia)
  const own = await ameliaQuery<any>(
    `SELECT a.bookingStart, cb.customerId, cb.status booking_status
       FROM ${ameliaTable("appointments")} a
       LEFT JOIN ${ameliaTable("customer_bookings")} cb ON cb.appointmentId = a.id
      WHERE a.id = ? AND a.providerId = ? LIMIT 1`,
    [apptId, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope" }, { status: 403 });

  const customer_id = own[0].customerId ? Number(own[0].customerId) : null;
  const session_date = own[0].bookingStart ? new Date(own[0].bookingStart).toISOString() : new Date().toISOString();
  const bookingStatus = String(own[0].booking_status || "").toLowerCase();

  // Gate de asistencia: el HC solo se puede editar si asistencia/admin marcó
  // 'approved'. Cualquier otro estado (pending, no-show, canceled, rejected)
  // mantiene el HC bloqueado. La psi NO decide asistencia.
  if (bookingStatus !== "approved") {
    return NextResponse.json({
      error: "attendance_not_confirmed",
      message: "El historial clínico se desbloquea cuando el equipo de soporte marca la sesión como asistida.",
      booking_status: bookingStatus || null,
    }, { status: 423 });
  }

  // Lock 7 días: HC solo editables 7 días tras la cita, salvo autorización del jefe.
  const sessionTs = new Date(session_date).getTime();
  const daysSince = (Date.now() - sessionTs) / 86400000;
  if (daysSince > 7) {
    const { data: unlock } = await sb.from("hc_unlock_requests").select("status").eq("appointment_id", apptId).maybeSingle();
    if (!unlock || unlock.status !== "approved") {
      return NextResponse.json({
        error: "hc_locked",
        message: "La cita tiene más de 7 días. Necesitas solicitar autorización al jefe de psicólogos para editar esta historia clínica.",
        days_since_session: Math.floor(daysSince),
        unlock_status: unlock?.status ?? "none",
      }, { status: 423 }); // Locked
    }
  }

  // Upsert clinical note (sin tocar 'attended' — fuente de verdad es Amelia
  // vía endpoint de asistencia del equipo de soporte). Si el cliente manda
  // 'attended' lo ignoramos silenciosamente.
  const row: any = {
    appointment_id: apptId,
    provider_id,
    customer_id,
    session_date,
    attended: true, // gate ya verificó booking_status='approved'
    updated_at: new Date().toISOString(),
  };
  for (const f of ["highlights", "how_went", "patient_state", "intervention", "next_steps", "homework", "red_flags"] as const) {
    if (typeof body[f] === "string") row[f] = body[f].slice(0, 5000);
  }

  const { error } = await sb.from("psychologist_clinical_notes").upsert(row, { onConflict: "appointment_id,provider_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
