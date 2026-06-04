// GET → lista posts (drafts + scheduled + published) de esta psicóloga.
// POST → crea/actualiza borrador (idempotente por keyword).
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb, BLOG_TABLE, slugify, draftDedupKey, contentHash, ensureUniqueSlug, mdToContentBlocks } from "@/lib/psy-blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const sb = psyBlogSb();
  const { data, error } = await sb
    .from(BLOG_TABLE)
    .select("id, keyword, title, slug, status, scheduled_for, publish_date, hero_image, hero_status, seo_status, created_at, updated_at")
    .eq("provider_id", auth.agent.provider_id)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Adapter al shape que espera la UI (que pintaba "psy_blog_posts")
  const posts = (data ?? []).map((r) => ({
    id: r.id,
    keyword: r.keyword,
    title: r.title,
    slug: r.slug,
    status: r.status,
    scheduled_for: r.scheduled_for,
    published_at: r.publish_date,
    hero_url: r.hero_image,
    hero_status: r.hero_status,
    seo_status: r.seo_status,
    created_at: r.created_at ?? r.publish_date,
    updated_at: r.updated_at ?? r.publish_date,
  }));
  return NextResponse.json({ posts });
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

  const existing = await sb
    .from(BLOG_TABLE)
    .select("id, slug, status")
    .eq("draft_dedup_key", dedupKey)
    .in("status", ["draft", "scheduled"])
    .maybeSingle();

  const baseSlug = slugify(title);
  const slug = await ensureUniqueSlug(baseSlug, existing.data?.id ?? null);
  const cHash = contentHash(title, bodyMd);
  const blocks = mdToContentBlocks(bodyMd);
  const wordCount = bodyMd.split(/\s+/).filter(Boolean).length;

  const payload = {
    provider_id: agent.provider_id,
    author_email: agent.email,
    author: agent.name,
    author_role: "Psicóloga colegiada",
    category: "Psicología",
    keyword,
    title,
    slug,
    subtitle: "",
    body_md: bodyMd,
    content: blocks,
    word_count: wordCount,
    read_time: Math.max(2, Math.ceil(wordCount / 220)),
    draft_dedup_key: dedupKey,
    content_hash: cHash,
    status: scheduledFor ? "scheduled" : "draft",
    scheduled_for: scheduledFor,
    hero_status: "pending",
    seo_status: "pending",
  };

  if (existing.data?.id) {
    const upd = await sb.from(BLOG_TABLE).update(payload).eq("id", existing.data.id).select().single();
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, post: upd.data, created: false });
  }
  const ins = await sb.from(BLOG_TABLE).insert({ ...payload, publish_date: new Date().toISOString() }).select().single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, post: ins.data, created: true });
}
