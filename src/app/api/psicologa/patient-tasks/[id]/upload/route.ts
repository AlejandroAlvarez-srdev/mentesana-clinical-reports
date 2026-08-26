// Devuelve signed URL para que la psi suba un archivo a Storage.
// Luego se llama a /attachments para registrar la entry en BD.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

// ⚠️ NEXT_PUBLIC_BLOG_SUPABASE_URL trae un salto de línea (\n) en el env; si no
// se limpia, se incrusta en la publicUrl del anexo y la URL queda rota (no
// cargan los adjuntos). Quitamos TODO whitespace.
const BLOG_URL = (process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL ?? "").replace(/\s/g, "");
const sb = createClient(BLOG_URL, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
const BUCKET = "mentesana-patient-tasks";
const PUBLIC_BASE = `${BLOG_URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}`;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { id: taskId } = await ctx.params;

  // Verifica ownership
  const { data: task } = await sb.from("patient_tasks").select("provider_id").eq("id", taskId).maybeSingle();
  if (!task || task.provider_id !== auth.agent.provider_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const filename = String(body.filename ?? "").slice(0, 200);
  if (!filename) return NextResponse.json({ error: "missing_filename" }, { status: 400 });
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${taskId}/psi/${Date.now()}_${sanitized}`;

  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    path,
    publicUrl: `${PUBLIC_BASE}/${path}`,
  });
}
