// Devuelve el test del ACOMPAÑANTE (embudo 9,99 € de las landings de
// acompañamiento) para el panel de la psicóloga.
//
// Existe por lo mismo que su gemelo de encuadre: la pantalla de oferta promete
// que "llega con tus respuestas leídas". Sin un sitio donde ella las lea, esa
// frase sería publicidad y no un hecho.
//
// Mismas garantías que encuadre-report:
//   · requirePsicologa (cookie ms_psicologa)
//   · comprobación de ÁMBITO contra Amelia: sólo se devuelve el test de quien
//     es paciente suya. Sin eso, cambiar un id en la URL destaparía datos de
//     salud de cualquiera.
//
// Aquí, además, se devuelven las respuestas ABIERTAS tal cual las escribió.
// Son lo más útil de los 50 minutos: lo que no dice ninguna escala.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";
import { PREGUNTAS_ACOMP, conPersona, generoDe, personaDe } from "@/data/acompanamiento/test";
import type { Informe } from "@/lib/acompanamiento/scoring";

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

  const customerId = Number(new URL(req.url).searchParams.get("customer_id"));
  if (!Number.isFinite(customerId)) {
    return NextResponse.json({ error: "customer_id" }, { status: 400 });
  }

  // ── Ámbito: ¿es paciente de esta psicóloga? ───────────────────────────────
  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const own = await ameliaQuery<{ email: string | null; firstName: string | null; lastName: string | null }>(
    `SELECT cu.email, cu.firstName, cu.lastName
       FROM ${cb} cb
       JOIN ${ab} a ON a.id = cb.appointmentId
       JOIN ${ub} cu ON cu.id = cb.customerId
      WHERE cb.customerId = ? AND a.providerId = ? LIMIT 1`,
    [customerId, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope" }, { status: 403 });
  const c = own[0];
  const customerName = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || null;

  if (!c.email) return NextResponse.json({ found: false, customer_name: customerName });

  const { data: row } = await sb
    .from("acompanamiento_tests")
    .select("variante, fase, respuestas, informe, created_at")
    .ilike("email", c.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row || !row.informe) {
    return NextResponse.json({
      found: false,
      customer_name: customerName,
      hint: "No hizo el test de acompañamiento, o lo hizo con otro correo.",
    });
  }

  const variante = (row.variante as string) ?? "acompanamiento-familiar";
  const respuestas = (row.respuestas ?? {}) as Record<string, unknown>;
  const gp = generoDe(respuestas["x_genero_p"]);

  // Las abiertas, con su enunciado, para que se lean sin descifrar ids.
  const abiertas = PREGUNTAS_ACOMP.filter((p) => p.tipo === "abierta")
    .map((p) => ({
      pregunta: conPersona(p.texto, variante, gp),
      respuesta: typeof respuestas[p.id] === "string" ? (respuestas[p.id] as string).trim() : "",
    }))
    .filter((x) => x.respuesta.length > 0);

  return NextResponse.json({
    found: true,
    customer_name: customerName,
    variante,
    persona: personaDe(variante, gp),
    created_at: row.created_at,
    informe: row.informe as Informe,
    abiertas,
  });
}
