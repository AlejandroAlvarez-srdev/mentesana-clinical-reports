// La psicóloga ve los anuncios dirigidos a ella + marca leídos.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const providerId = auth.agent.provider_id;

  const { data: anns } = await sb.from("psi_announcements")
    .select("*")
    .eq("archived", false)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(50);

  const filtered = (anns ?? []).filter(a => a.target === "all" || (Array.isArray(a.target_provider_ids) && a.target_provider_ids.includes(providerId)));

  // Reads
  const ids = filtered.map(a => a.id);
  let readSet = new Set<string>();
  if (ids.length > 0) {
    const { data: reads } = await sb.from("psi_announcement_reads").select("announcement_id").eq("provider_id", providerId).in("announcement_id", ids);
    readSet = new Set((reads ?? []).map(r => r.announcement_id));
  }

  return NextResponse.json({
    announcements: filtered.map(a => ({ ...a, read: readSet.has(a.id) })),
    unread_count: filtered.filter(a => !readSet.has(a.id)).length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const body = await req.json().catch(() => ({}));
  const id = body.id;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  await sb.from("psi_announcement_reads").upsert({ announcement_id: id, provider_id: auth.agent.provider_id });
  return NextResponse.json({ ok: true });
}
