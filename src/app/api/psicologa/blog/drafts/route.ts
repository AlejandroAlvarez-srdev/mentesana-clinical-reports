// GET /api/psicologa/blog/drafts → lista (todos los posts de la psi, cualquier status)
// POST /api/psicologa/blog/drafts → crea o actualiza borrador (idempotente por keyword)
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb, slugify, draftDedupKey, contentHash, ensureUniqueSlug } from "@/lib/psy-blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const sb = psyBlogSb();
  const { data, error } = await sb
    .from("psy_blog_posts")
    .select("id, keyword, title, slug, status, scheduled_for, published_at, hero_url, hero_status, seo_status, created_at, updated_at")
    .eq("provider_id", auth.agent.provider_id)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { agent } = auth;

  const body = await req.json().catch(() => ({}));
  const keyword = String(body.keyword ?? "").trim();
  const title = String(body.title ?? "").trim();
  const bodyMd = String(body.body_md ?? "");
  const scheduledFor = typeof body.scheduled_for === "string" && body.scheduled_for ? body.scheduled_for : null;

  if (!keyword || !title) return NextResponse.json({ error: "keyword_and_title_required" }, { status: 400 });

  const sb = psyBlogSb();
  const dedupKey = draftDedupKey(agent.provider_id, keyword);

  // Idempotencia 2: si ya hay un draft/scheduled con la misma keyword, actualizamos en lugar de duplicar.
  const existing = await sb
    .from("psy_blog_posts")
    .select("id, slug, status")
    .eq("draft_dedup_key", dedupKey)
    .in("status", ["draft", "scheduled"])
    .maybeSingle();

  const baseSlug = slugify(title);
  const slug = await ensureUniqueSlug(baseSlug, existing.data?.id ?? null);
  const cHash = contentHash(title, bodyMd);

  const payload = {
    provider_id: agent.provider_id,
    author_email: agent.email,
    author_name: agent.name,
    keyword,
    title,
    slug,
    body_md: bodyMd,
    draft_dedup_key: dedupKey,
    content_hash: cHash,
    status: scheduledFor ? "scheduled" : "draft",
    scheduled_for: scheduledFor,
  };

  if (existing.data?.id) {
    const upd = await sb.from("psy_blog_posts").update(payload).eq("id", existing.data.id).select().single();
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, post: upd.data, created: false });
  }
  const ins = await sb.from("psy_blog_posts").insert(payload).select().single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, post: ins.data, created: true });
}
