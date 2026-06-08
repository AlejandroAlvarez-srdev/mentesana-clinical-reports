// Detalle de una cita: info Amelia + clinical note (si existe) + historial previo del paciente.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaExec, ameliaTable } from "@/lib/amelia-db";
import { voyageEmbed } from "@/lib/voyage-embed";

const sb = createClient(
  process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!,
  process.env.BLOG_SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Servicios de diagnóstico 9,99€ (ver reference_amelia_attendance). Estas citas
// usan la Historia Clínica Inicial 9.99 estructurada en vez de la HC genérica.
const DIAG_IDS = [8, 11];
const DIAG_FIELD_KEYS = ["edad", "estado_civil", "pais", "ciudad", "motivo_consulta", "anamnesis", "evaluacion_funciones", "impresion_diagnostica", "plan_intervencion", "compromiso"] as const;
const DIAG_LABELS: Record<string, string> = {
  edad: "Edad", estado_civil: "Estado civil", pais: "País", ciudad: "Ciudad",
  motivo_consulta: "Motivo de consulta", anamnesis: "Anamnesis",
  evaluacion_funciones: "Evaluación de funciones psicológicas",
  impresion_diagnostica: "Impresión diagnóstica", plan_intervencion: "Plan de intervención",
  compromiso: "Compromiso",
};

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
    `SELECT a.id appointment_id, a.bookingStart, a.bookingEnd, a.googleMeetUrl, a.providerId, a.serviceId,
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
      // Cita de diagnóstico 9,99€ → usa la HC Inicial 9.99 estructurada.
      is_diagnostico: DIAG_IDS.includes(Number(r.serviceId)),
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

  // Verifica ownership (y trae el nombre del paciente para el embedding RAG)
  const own = await ameliaQuery<any>(
    `SELECT a.bookingStart, cb.customerId, cb.status booking_status,
            cu.firstName customer_fn, cu.lastName customer_ln
       FROM ${ameliaTable("appointments")} a
       LEFT JOIN ${ameliaTable("customer_bookings")} cb ON cb.appointmentId = a.id
       LEFT JOIN ${ameliaTable("users")} cu ON cu.id = cb.customerId
      WHERE a.id = ? AND a.providerId = ? LIMIT 1`,
    [apptId, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope" }, { status: 403 });

  const customer_id = own[0].customerId ? Number(own[0].customerId) : null;
  const patientName = `${own[0].customer_fn ?? ""} ${own[0].customer_ln ?? ""}`.trim();
  const session_date = own[0].bookingStart ? new Date(own[0].bookingStart).toISOString() : new Date().toISOString();

  // TRANSICIÓN 2026-06-02 → 2026-06-09: durante esta semana la psicóloga
  // puede marcar asistencia desde el bloque HC (pills Sí/No). Tras el lunes
  // 9 jun la fuente única vuelve a ser el equipo de soporte vía
  // /api/agent/appointments/[id]/attendance, y se reactiva el gate de
  // booking_status='approved' (ver feedback_hc_gates en memoria).

  // Lock 7 días — jefa de psicólogas autoriza HC viejos.
  const sessionTs = new Date(session_date).getTime();
  const daysSince = (Date.now() - sessionTs) / 86400000;
  if (daysSince > 7) {
    const { data: unlock } = await sb
      .from("hc_unlock_requests")
      .select("status")
      .eq("appointment_id", apptId)
      .maybeSingle();
    if (!unlock || unlock.status !== "approved") {
      return NextResponse.json({
        error: "hc_locked",
        message: "La cita tiene más de 7 días. Necesitas solicitar autorización a la jefa de psicólogas para editar esta historia clínica.",
        days_since_session: Math.floor(daysSince),
        unlock_status: unlock?.status ?? "none",
      }, { status: 423 });
    }
  }

  // Upsert clinical note
  const row: any = {
    appointment_id: apptId,
    provider_id,
    customer_id,
    session_date,
    updated_at: new Date().toISOString(),
  };
  for (const f of ["highlights", "how_went", "patient_state", "intervention", "next_steps", "homework", "red_flags"] as const) {
    if (typeof body[f] === "string") row[f] = body[f].slice(0, 5000);
  }
  if (typeof body.attended === "boolean") row.attended = body.attended;
  // Campos de la HC Inicial 9.99 (identidad + anamnesis…) en JSONB.
  if (body.diag_fields && typeof body.diag_fields === "object") {
    const clean: Record<string, string> = {};
    for (const k of DIAG_FIELD_KEYS) {
      const v = body.diag_fields[k];
      if (typeof v === "string" && v.trim()) clean[k] = v.slice(0, 5000);
    }
    row.diag_fields = Object.keys(clean).length ? clean : null;
  }

  const { error } = await sb.from("psychologist_clinical_notes").upsert(row, { onConflict: "appointment_id,provider_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync attended → Amelia customer_bookings.status (semana transición).
  let amelia_synced = false;
  let amelia_error: string | null = null;
  if (typeof body.attended === "boolean") {
    // Semántica Mente Sana: pending = ASISTIÓ, no-show = NO asistió. (approved =
    // agendada/pendiente, NO asistió — por eso NO usamos 'approved' aquí.)
    const newStatus = body.attended ? "pending" : "no-show";
    try {
      const r = await ameliaExec(
        `UPDATE ${ameliaTable("customer_bookings")} SET status = ? WHERE appointmentId = ? AND status NOT IN ('canceled','rejected')`,
        [newStatus, apptId],
      );
      amelia_synced = r.affectedRows > 0;
      if (!amelia_synced) amelia_error = "Amelia no actualizó (¿canceled/rejected?)";
    } catch (e: any) {
      amelia_error = String(e?.message ?? e).slice(0, 200);
      console.error("[psicologa-appt-put] Amelia sync FAILED for appt", apptId, ":", amelia_error);
    }
  }

  // Embeb la HC para el asistente RAG (match_clinical_notes), incluyendo el
  // nombre del paciente para que la búsqueda por nombre funcione. No bloqueante:
  // si Voyage falla, la HC ya quedó guardada; embedded_at se queda null y un
  // guardado posterior (o el cron embed-clinical-notes) la embebe. Solo embebemos
  // si hay contenido clínico real, no en un guardado de solo-asistencia.
  // En autosave (draft:true) NO embebemos en cada tecla — el cron lo hará luego.
  if (!body.draft) try {
    const { data: full } = await sb
      .from("psychologist_clinical_notes")
      .select("highlights, how_went, patient_state, intervention, next_steps, homework, red_flags, diag_fields")
      .eq("appointment_id", apptId)
      .eq("provider_id", provider_id)
      .maybeSingle();
    const diag = (full?.diag_fields ?? {}) as Record<string, string>;
    const diagHasContent = DIAG_FIELD_KEYS.some((k) => diag[k] && String(diag[k]).trim());
    const hasContent = !!(full && (full.highlights || full.how_went || full.patient_state || full.intervention || full.next_steps || full.homework || full.red_flags || diagHasContent));
    if (hasContent) {
      const text = [
        patientName ? `Paciente: ${patientName}` : "",
        // HC Inicial 9.99 (si aplica): incluimos identidad + anamnesis en el embedding.
        ...DIAG_FIELD_KEYS.map((k) => (diag[k] && String(diag[k]).trim() ? `${DIAG_LABELS[k]}: ${diag[k]}` : "")),
        full!.highlights && `Highlights: ${full!.highlights}`,
        full!.how_went && `Cómo fue la sesión: ${full!.how_went}`,
        full!.patient_state && `Estado del paciente: ${full!.patient_state}`,
        full!.intervention && `Intervención: ${full!.intervention}`,
        full!.next_steps && `Próximos pasos: ${full!.next_steps}`,
        full!.homework && `Tareas: ${full!.homework}`,
        full!.red_flags && `Alertas: ${full!.red_flags}`,
      ].filter(Boolean).join("\n");
      const emb = await voyageEmbed(text, "document");
      if (emb) {
        await sb.from("psychologist_clinical_notes")
          .update({ embedding: emb, patient_name: patientName || null, embedded_at: new Date().toISOString() })
          .eq("appointment_id", apptId)
          .eq("provider_id", provider_id);
      }
    }
  } catch (e: any) {
    console.warn("[hc-embed] fallo embeddings HC appt", apptId, String(e?.message ?? e).slice(0, 200));
  }

  return NextResponse.json({ ok: true, amelia_synced, amelia_error });
}
