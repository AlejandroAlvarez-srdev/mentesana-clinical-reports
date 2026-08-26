// POST /api/psicologa/enviar-link-pago
//
// La psicóloga, desde el detalle de la cita, envía al paciente por email el link
// de pago: primera sesión 9,99€ (diagnóstico) o Bonos. Sobre todo para convertir
// tras una Llamada Inmediata. Auth: sesión de psicóloga (getPsicologa).
import { NextRequest, NextResponse } from "next/server";
import { getPsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";
import { sendEmail } from "@/lib/emails/send";
import { linkPagoEmail, type TipoPago } from "@/emails/link-pago-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const p = await getPsicologa();
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    customerId?: number;
    tipo?: string;
  };
  const customerId = Number(body.customerId);
  const tipo = body.tipo === "bonos" ? "bonos" : "diagnostico";
  if (!customerId || Number.isNaN(customerId)) {
    return NextResponse.json({ error: "customerId_invalido" }, { status: 400 });
  }

  // Resolver email + nombre del paciente en Amelia.
  const rows = await ameliaQuery<{ firstName: string | null; lastName: string | null; email: string | null }>(
    `SELECT firstName, lastName, email FROM ${ameliaTable("users")} WHERE id = ? AND type = 'customer' LIMIT 1`,
    [customerId],
  );
  const c = rows[0];
  if (!c?.email) return NextResponse.json({ error: "paciente_sin_email" }, { status: 404 });

  const nombre = `${c.firstName || ""} ${c.lastName || ""}`.trim();
  const psiName = p.name || `${p.first_name || ""} ${p.last_name || ""}`.trim();

  const { subject, html } = linkPagoEmail({ nombre, tipo: tipo as TipoPago, psiName });
  const sent = await sendEmail({ to: c.email, subject, html, toName: nombre, fromName: psiName });
  if (!sent.success) return NextResponse.json({ ok: false, error: sent.error ?? "email_fallo" }, { status: 502 });

  return NextResponse.json({ ok: true, tipo, to: c.email });
}
