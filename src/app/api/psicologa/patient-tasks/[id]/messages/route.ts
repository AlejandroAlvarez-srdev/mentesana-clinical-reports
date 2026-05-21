// Thread psi ↔ paciente. GET lista + marca leídas las del paciente. POST manda mensaje (+attachments).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";

async function checkOwnership(taskId: string, providerId: number) {
  const { data } = await sb.from("patient_tasks").select("provider_id").eq("id", taskId).maybeSingle();
  return data && data.provider_id === providerId;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { id: taskId } = await ctx.params;
  if (!(await checkOwnership(taskId, auth.agent.provider_id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [{ data: messages }, { data: attachments }] = await Promise.all([
    sb.from("patient_task_messages").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
    sb.from("patient_task_attachments").select("*").eq("task_id", taskId).order("uploaded_at", { ascending: true }),
  ]);

  // Marca como leídas las del paciente (ya las vimos)
  await sb.from("patient_task_messages").update({ read_at: new Date().toISOString() }).eq("task_id", taskId).eq("author", "patient").is("read_at", null);

  return NextResponse.json({ messages: messages ?? [], attachments: attachments ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { id: taskId } = await ctx.params;
  if (!(await checkOwnership(taskId, auth.agent.provider_id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const bodyText = String(body.body ?? "").trim().slice(0, 5000);
  const attachments: { url: string; storage_path?: string; filename: string; mime_type?: string; size_bytes?: number }[] = Array.isArray(body.attachments) ? body.attachments : [];
  if (!bodyText && attachments.length === 0) return NextResponse.json({ error: "empty_message" }, { status: 400 });

  // Inserta mensaje
  const { data: msg, error: msgErr } = await sb.from("patient_task_messages").insert({
    task_id: taskId, author: "psicologa", body: bodyText || null,
  }).select("*").single();
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  // Inserta adjuntos vinculados al mensaje (si vienen)
  if (attachments.length > 0) {
    const rows = attachments.map(a => ({
      task_id: taskId, message_id: msg.id, url: a.url, storage_path: a.storage_path ?? null,
      filename: a.filename, mime_type: a.mime_type ?? null, size_bytes: a.size_bytes ?? null,
      uploaded_by: "psicologa",
    }));
    await sb.from("patient_task_attachments").insert(rows);
  }

  return NextResponse.json({ message: msg });
}
