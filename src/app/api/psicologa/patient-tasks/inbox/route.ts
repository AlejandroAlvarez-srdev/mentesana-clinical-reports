// Bandeja central de tareas de la psicóloga: TODAS sus tareas (de todos los
// pacientes) con nombre del paciente, contador de respuestas sin leer y última
// actividad del paciente. Una sola pasada (sin el N+1 del componente por-paciente).
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

  const { data: tasks } = await sb
    .from("patient_tasks")
    .select("id, customer_id, appointment_id, title, description, due_date, status, created_at, sent_to_patient_at")
    .eq("provider_id", provider_id)
    .order("created_at", { ascending: false })
    .limit(300);
  const list = tasks ?? [];
  if (list.length === 0) return NextResponse.json({ tasks: [] });

  const taskIds = list.map((t) => t.id);

  // Mensajes de todas las tareas → unread + última actividad del paciente por tarea.
  const { data: msgs } = await sb
    .from("patient_task_messages")
    .select("task_id, author, read_at, created_at")
    .in("task_id", taskIds);
  const agg = new Map<string, { unread: number; total: number; lastPatientAt: string | null }>();
  for (const m of msgs ?? []) {
    const a = agg.get(m.task_id) ?? { unread: 0, total: 0, lastPatientAt: null };
    a.total++;
    if (m.author === "patient") {
      if (!m.read_at) a.unread++;
      if (!a.lastPatientAt || m.created_at > a.lastPatientAt) a.lastPatientAt = m.created_at;
    }
    agg.set(m.task_id, a);
  }

  // Nombres de pacientes (Amelia) en bloque.
  const cids = [...new Set(list.map((t) => t.customer_id).filter(Boolean))] as number[];
  const nameMap = new Map<number, string>();
  if (cids.length) {
    const rows = await ameliaQuery<any>(
      `SELECT id, firstName, lastName FROM ${ameliaTable("users")} WHERE id IN (${cids.map(() => "?").join(",")})`,
      cids,
    );
    for (const u of rows) nameMap.set(Number(u.id), `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim());
  }

  const enriched = list.map((t) => {
    const a = agg.get(t.id) ?? { unread: 0, total: 0, lastPatientAt: null };
    return {
      ...t,
      patient_name: t.customer_id ? nameMap.get(Number(t.customer_id)) || "(paciente)" : "(sin paciente)",
      unread_from_patient: a.unread,
      message_count: a.total,
      last_patient_at: a.lastPatientAt,
    };
  });

  // Orden: primero las que tienen respuesta sin leer, luego por actividad reciente del paciente.
  enriched.sort((x, y) => {
    const xu = x.unread_from_patient > 0 ? 1 : 0;
    const yu = y.unread_from_patient > 0 ? 1 : 0;
    if (xu !== yu) return yu - xu;
    const xa = x.last_patient_at ?? x.created_at;
    const ya = y.last_patient_at ?? y.created_at;
    return ya < xa ? -1 : ya > xa ? 1 : 0;
  });

  return NextResponse.json({
    tasks: enriched,
    unread_total: enriched.reduce((n, t) => n + (t.unread_from_patient > 0 ? 1 : 0), 0),
  });
}
