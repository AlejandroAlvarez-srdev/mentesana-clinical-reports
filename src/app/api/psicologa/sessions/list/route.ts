import { NextRequest, NextResponse } from "next/server";
import { getPsicologa } from "@/lib/psicologa-auth";
import { sbBlog } from "@/lib/psicologa-extension";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = await getPsicologa();
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status") || "draft";
  const sb = sbBlog();
  const { data, error } = await sb.from("session_notes")
    .select("id, session_hash, summary_md, raw_excerpt, status, meet_started_at, meet_ended_at, created_at, patient_alias, approved_at")
    .eq("provider_id", p.provider_id).eq("status", status)
    .order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}
