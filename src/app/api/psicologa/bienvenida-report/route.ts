// Devuelve los MOTIVOS de la cita de bienvenida del paciente para el panel psi.
// Match: email Amelia → bienvenida_reservas.email (phone como fallback).
// Recompone scores (5 ejes) y resuelve el enunciado de las respuestas abiertas.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";
import { getAnguloContent, scoreTestAnswers, type AnguloBienvenida } from "@/data/bienvenida-catalogo";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID: AnguloBienvenida[] = ["burnout", "autoestima", "duelo", "limites", "ansiedad"];
type RespItem = { pregunta_idx: number; opciones_elegidas: number[]; texto?: string | null };

const SELECT = "appointment_id, angulo, angulo_reclasifica, email, name, phone, respuestas, motivo_asistir, expectativa, report_url, report_generated, created_at";

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;
  const customerId = Number(new URL(req.url).searchParams.get("customer_id"));
  if (!Number.isFinite(customerId)) return NextResponse.json({ error: "customer_id" }, { status: 400 });

  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const own = await ameliaQuery<{ email: string | null; phone: string | null; firstName: string | null; lastName: string | null }>(
    `SELECT cu.email, cu.phone, cu.firstName, cu.lastName
     FROM ${cb} cb JOIN ${ab} a ON a.id = cb.appointmentId
     JOIN ${ub} cu ON cu.id = cb.customerId
     WHERE cb.customerId = ? AND a.providerId = ? LIMIT 1`,
    [customerId, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope" }, { status: 403 });
  const c = own[0];

  let row: Record<string, unknown> | null = null;
  if (c.email) {
    const { data } = await sb.from("bienvenida_reservas").select(SELECT).ilike("email", c.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    row = data;
  }
  if (!row && c.phone) {
    const variants = [c.phone, String(c.phone).replace(/^\+/, ""), String(c.phone).startsWith("+") ? c.phone : `+${c.phone}`];
    const { data } = await sb.from("bienvenida_reservas").select(SELECT).in("phone", variants).order("created_at", { ascending: false }).limit(1).maybeSingle();
    row = data;
  }

  const customerName = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || null;
  if (!row) return NextResponse.json({ found: false, customer_name: customerName, hint: "Este paciente no hizo el test de la cita de bienvenida o usó otro email." });

  const angulo = (VALID.includes(row.angulo as AnguloBienvenida) ? row.angulo : "ansiedad") as AnguloBienvenida;
  const content = getAnguloContent(angulo);
  const respuestas: RespItem[] = Array.isArray(row.respuestas) ? (row.respuestas as RespItem[]) : [];
  const scoring = scoreTestAnswers(angulo, respuestas.map((r) => ({ pregunta_idx: r.pregunta_idx, opciones_elegidas: r.opciones_elegidas ?? [] })));
  const rawMax = Math.max(...VALID.map((k) => scoring.scores[k] || 0), 0.001);
  const scores_pct: Record<string, number> = {};
  for (const k of VALID) scores_pct[k] = Math.round(((scoring.scores[k] || 0) / rawMax) * 100);
  const abiertas = respuestas
    .filter((r) => typeof r.texto === "string" && (r.texto as string).trim().length > 0)
    .map((r) => ({ prompt: content?.preguntas[r.pregunta_idx]?.fraseCompletaPrompt ?? content?.preguntas[r.pregunta_idx]?.pregunta ?? "Respuesta del paciente", texto: (r.texto as string).trim() }));

  return NextResponse.json({
    found: true,
    customer_name: customerName,
    report: {
      appointment_id: row.appointment_id,
      angulo, angulo_label: content?.label ?? angulo,
      angulo_reclasifica: (row.angulo_reclasifica as string) || null,
      motivo_asistir: (row.motivo_asistir as string) || null,
      expectativa: (row.expectativa as string) || null,
      abiertas,
      scores_pct,
      crisis: scoring.crisisDetectada,
      report_url: (row.report_url as string) || null,
      report_generated: !!row.report_generated,
      created_at: row.created_at,
    },
  });
}
