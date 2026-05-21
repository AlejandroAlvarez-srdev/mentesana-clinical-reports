// Adjuntos raíz de la tarea (los que la psi agrega al crear/editar la tarea, no a un mensaje específico).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";

async function checkOwnership(taskId: string, providerId: number) {
  const { data } = await sb.from("patient_tasks").select("provider_id").eq("id", taskId).maybeSingle();
  return data && data.provider_id === providerId;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { id: taskId } = await ctx.params;
  if (!(await checkOwnership(taskId, auth.agent.provider_id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const items: { url: string; storage_path?: string; filename: string; mime_type?: string; size_bytes?: number }[] = Array.isArray(body.attachments) ? body.attachments : [body];
  const rows = items.filter(a => a?.url && a?.filename).map(a => ({
    task_id: taskId, message_id: null, url: a.url, storage_path: a.storage_path ?? null,
    filename: a.filename, mime_type: a.mime_type ?? null, size_bytes: a.size_bytes ?? null,
    uploaded_by: "psicologa",
  }));
  if (rows.length === 0) return NextResponse.json({ error: "no_attachments" }, { status: 400 });
  const { data, error } = await sb.from("patient_task_attachments").insert(rows).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attachments: data });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { id: taskId } = await ctx.params;
  if (!(await checkOwnership(taskId, auth.agent.provider_id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const attachmentId = searchParams.get("attachment_id");
  if (!attachmentId) return NextResponse.json({ error: "missing_attachment_id" }, { status: 400 });
  // Solo puede borrar adjuntos subidos por ella (uploaded_by='psicologa')
  await sb.from("patient_task_attachments").delete().eq("id", attachmentId).eq("task_id", taskId).eq("uploaded_by", "psicologa");
  return NextResponse.json({ ok: true });
}
