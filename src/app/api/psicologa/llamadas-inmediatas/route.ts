// GET /api/psicologa/llamadas-inmediatas
//
// Lo consulta (polling) el banner del panel de psicólogas. Devuelve las
// Llamadas Inmediatas (serviceId 300) que la psicóloga logueada tiene EN CURSO
// ahora mismo (empezaron y aún no han terminado) para avisarla "tienes una cita
// AHORA, entra ya" con el enlace de Meet.
import { NextResponse } from "next/server";
import { getPsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const p = await getPsicologa();
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const cu = ameliaTable("users");

  const rows = await ameliaQuery<{
    appointmentId: number;
    meetUrl: string | null;
    start: string;
    pFirst: string | null;
    pLast: string | null;
  }>(
    `SELECT a.id AS appointmentId, a.googleMeetUrl AS meetUrl, a.bookingStart AS start,
            c.firstName AS pFirst, c.lastName AS pLast
       FROM ${ab} a
       JOIN ${cb} b ON b.appointmentId = a.id
       JOIN ${cu} c ON c.id = b.customerId AND c.type = 'customer'
      WHERE a.providerId = ?
        AND a.serviceId = 300
        AND LOWER(a.status) NOT IN ('canceled','cancelled','rejected')
        AND a.bookingStart <= NOW()
        AND a.bookingEnd > NOW()
      ORDER BY a.bookingStart DESC
      LIMIT 3`,
    [p.provider_id],
  );

  const llamadas = rows.map((r) => ({
    id: Number(r.appointmentId),
    patientName: `${r.pFirst || ""} ${r.pLast || ""}`.trim() || "Un paciente",
    meetUrl: r.meetUrl || null,
    start: r.start,
  }));

  return NextResponse.json({ llamadas });
}
