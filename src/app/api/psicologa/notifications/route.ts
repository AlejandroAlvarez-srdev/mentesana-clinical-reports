import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { data } = await sb.from("panel_notifications").select("*").eq("recipient_type", "psicologa").eq("recipient_ref", auth.agent.email).order("created_at", { ascending: false }).limit(30);
  return NextResponse.json({ notifications: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const body = await req.json().catch(() => ({}));
  if (body.id) await sb.from("panel_notifications").update({ read_at: new Date().toISOString() }).eq("id", body.id).eq("recipient_ref", auth.agent.email);
  else await sb.from("panel_notifications").update({ read_at: new Date().toISOString() }).eq("recipient_type", "psicologa").eq("recipient_ref", auth.agent.email).is("read_at", null);
  return NextResponse.json({ ok: true });
}
