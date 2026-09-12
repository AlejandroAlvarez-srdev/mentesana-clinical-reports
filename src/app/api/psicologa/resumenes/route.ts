// Listado de resúmenes pendientes de aprobación para la psicóloga logueada.
// Devuelve solo los de SUS pacientes (provider_id); las líderes ven todos.
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { blogClient, signedUrl } from "@/lib/resumen/generate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id, is_supervisor } = auth.agent;

  const sb = blogClient();
  let q = sb.from("resumen_orders")
    .select("id, patient_name, patient_email, product, status, alert, alert_reason, session_date, report_path, sent_at, created_at, content")
    .in("status", ["pending_approval", "needs_review", "sent"])
    .order("created_at", { ascending: false }).limit(60);
  if (!is_supervisor) q = q.eq("provider_id", provider_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = await Promise.all((data ?? []).map(async (o) => ({
    id: o.id,
    patient_name: o.patient_name,
    patient_email: o.patient_email,
    product: o.product,
    status: o.status,
    alert: o.alert,
    alert_reason: o.alert_reason,
    session_date: o.session_date,
    sent_at: o.sent_at,
    created_at: o.created_at,
    paciente: (o.content as { paciente?: string } | null)?.paciente ?? o.patient_name,
    preview_url: o.report_path ? await signedUrl(sb, o.report_path, 3600) : null,
  })));

  return NextResponse.json({ ok: true, pendientes: rows.filter((r) => r.status !== "sent"), enviados: rows.filter((r) => r.status === "sent") });
}
