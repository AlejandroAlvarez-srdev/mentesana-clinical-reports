// Devuelve el INFORME del test de 30 preguntas (tercer embudo) para el panel psi.
//
// Sin esto, la promesa de las 5 landings —"entrará con tu informe ya leído"— es
// falsa: el informe se guardaba en encuadre_tests y no había ninguna pantalla
// donde ella lo viera. Este endpoint es lo que la hace verdad.
//
// Mismo patrón y mismas garantías que bienvenida-report:
//   · requirePsicologa (cookie ms_psicologa)
//   · comprobación de ÁMBITO contra Amelia: solo se devuelve el informe de un
//     paciente que sea suyo. Sin eso, cualquier psi podría leer los datos de
//     salud de cualquier paciente cambiando un id en la URL.
//   · match por email de Amelia, con teléfono como respaldo.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";
import type { Informe } from "@/lib/encuadre/scoring";

const sb = createClient(
  process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!,
  process.env.BLOG_SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT = "email, nombre, telefono, angulo, informe, appointment_id, created_at";

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;

  const customerId = Number(new URL(req.url).searchParams.get("customer_id"));
  if (!Number.isFinite(customerId)) {
    return NextResponse.json({ error: "customer_id" }, { status: 400 });
  }

  // ── Ámbito: ¿es paciente de esta psicóloga? ───────────────────────────────
  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const own = await ameliaQuery<{ email: string | null; phone: string | null; firstName: string | null; lastName: string | null }>(
    `SELECT cu.email, cu.phone, cu.firstName, cu.lastName
       FROM ${cb} cb
       JOIN ${ab} a ON a.id = cb.appointmentId
       JOIN ${ub} cu ON cu.id = cb.customerId
      WHERE cb.customerId = ? AND a.providerId = ? LIMIT 1`,
    [customerId, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope" }, { status: 403 });
  const c = own[0];
  const customerName = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || null;

  // ── Buscar el test ────────────────────────────────────────────────────────
  let row: Record<string, unknown> | null = null;
  if (c.email) {
    const { data } = await sb
      .from("encuadre_tests")
      .select(SELECT)
      .ilike("email", c.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = data;
  }
  if (!row && c.phone) {
    const variantes = [
      c.phone,
      String(c.phone).replace(/^\+/, ""),
      String(c.phone).startsWith("+") ? c.phone : `+${c.phone}`,
    ];
    const { data } = await sb
      .from("encuadre_tests")
      .select(SELECT)
      .in("telefono", variantes)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = data;
  }

  if (!row || !row.informe) {
    return NextResponse.json({
      found: false,
      customer_name: customerName,
      hint: "Esta paciente no hizo el test de 30 preguntas, o lo hizo con otro correo.",
    });
  }

  const informe = row.informe as Informe;

  return NextResponse.json({
    found: true,
    customer_name: customerName,
    angulo: (row.angulo as string) ?? null,
    appointment_id: row.appointment_id ?? null,
    created_at: row.created_at,
    informe,
  });
}
