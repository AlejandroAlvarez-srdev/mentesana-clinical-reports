// DESHABILITADO 2026-06-01: La asistencia ya NO la marcan las psicólogas.
// Política: solo el equipo de asistencia (admin/soporte/auditor) lo decide
// vía /api/agent/appointments/[id]/attendance, y la psi solo lo ve. Esto
// evita conflictos entre lo que la psi anota y lo que admin ve en CRM.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return NextResponse.json(
    {
      error: "deprecated",
      message: "La asistencia la marca el equipo de soporte. Si necesitas corregir una cita, contáctalos por WhatsApp.",
    },
    { status: 403 },
  );
}
