// Detalle de paciente: sesiones (Amelia) + notas clínicas (nuestras). PII oculta.
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
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const pc = ameliaTable("packages_to_customers");
  const pcs = ameliaTable("packages_customers_to_services");
  const pks = ameliaTable("packages");

  // Verifica que este customer ha tenido al menos 1 booking con esta psi
  const own = await ameliaQuery<any>(
    `SELECT 1 FROM ${cb} cb JOIN ${ab} a ON a.id = cb.appointmentId WHERE cb.customerId = ? AND a.providerId = ? LIMIT 1`,
    [customerId, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope" }, { status: 403 });

  // Customer (sin phone ni email completo)
  const cust = await ameliaQuery<any>(
    `SELECT firstName, lastName FROM ${ub} WHERE id = ? LIMIT 1`,
    [customerId],
  );
  if (cust.length === 0) return NextResponse.json({ error: "customer_not_found" }, { status: 404 });

  // Sesiones con ESTA psi
  const sessions = await ameliaQuery<any>(
    `SELECT a.id appointment_id, a.bookingStart, a.bookingEnd, a.googleMeetUrl,
       cb.id booking_id, cb.status booking_status,
       s.name service_name
     FROM ${ab} a
     JOIN ${cb} cb ON cb.appointmentId = a.id
     LEFT JOIN ${ameliaTable("services")} s ON s.id = a.serviceId
     WHERE cb.customerId = ? AND a.providerId = ?
     ORDER BY a.bookingStart DESC LIMIT 100`,
    [customerId, provider_id],
  );

  // Bonos activos del paciente (puede tener con otras psi también pero respetamos lo de su agenda)
  // Filtramos por pcs.providerId para que el total/usadas sean SOLO la parte del
  // bono asignada a ESTA psi (igual que el listado de pacientes). Sin el filtro,
  // se sumaba el bono completo entre todas las psi y un bono de 8 salía 10.
  const packages = await ameliaQuery<any>(
    `SELECT p.id, pk.name, p.start, p.end, p.status,
       (SELECT SUM(pcs.bookingsCount) FROM ${pcs} pcs WHERE pcs.packageCustomerId = p.id AND pcs.providerId = ?) total_bookings,
       (SELECT COUNT(*) FROM ${cb} cb2 JOIN ${pcs} pcs2 ON pcs2.id = cb2.packageCustomerServiceId WHERE pcs2.packageCustomerId = p.id AND pcs2.providerId = ? AND cb2.status IN ('approved','pending')) used_bookings
     FROM ${pc} p JOIN ${pks} pk ON pk.id = p.packageId
     WHERE p.customerId = ? AND p.status = 'approved' AND (p.end IS NULL OR p.end >= NOW())
     ORDER BY p.purchased DESC LIMIT 10`,
    [provider_id, provider_id, customerId],
  );

  // Notas clínicas
  const { data: notes } = await sb
    .from("psychologist_clinical_notes")
    .select("*")
    .eq("provider_id", provider_id)
    .eq("customer_id", customerId)
    .order("session_date", { ascending: false });

  return NextResponse.json({
    patient: {
      customer_id: customerId,
      name: `${cust[0].firstName ?? ""} ${cust[0].lastName ?? ""}`.trim() || "(sin nombre)",
      first_name: cust[0].firstName ?? "",
      // NO email NO phone
    },
    sessions: sessions.map((s: any) => ({
      appointment_id: s.appointment_id,
      booking_start_utc: new Date(s.bookingStart).toISOString(),
      service_name: s.service_name,
      google_meet_url: s.googleMeetUrl || null,
      booking_status: s.booking_status,
    })),
    packages: packages.map((p: any) => ({
      id: p.id,
      name: p.name,
      start: p.start ? new Date(p.start).toISOString() : null,
      end: p.end ? new Date(p.end).toISOString() : null,
      total_bookings: Number(p.total_bookings ?? 0),
      used_bookings: Number(p.used_bookings ?? 0),
      remaining: Math.max(0, Number(p.total_bookings ?? 0) - Number(p.used_bookings ?? 0)),
    })),
    notes: notes ?? [],
  });
}
