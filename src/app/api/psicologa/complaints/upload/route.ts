// Genera una signed upload URL para adjuntar archivos a un reporte al jefe.
// Sube al bucket público mentesana-reports bajo el provider_id de la psi.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL || "").trim();
const sb = createClient(SUPABASE_URL, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

const BUCKET = "mentesana-reports";
const PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const body = await req.json().catch(() => ({}) as any);
  const filename = String(body.filename ?? "archivo").trim();
  const sanitized = filename.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const path = `${auth.agent.provider_id}/${Date.now()}_${sanitized}`;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "sign_failed" }, { status: 500 });
  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path, publicUrl: `${PUBLIC_BASE}/${path}` });
}
