// POST /api/psicologa/blog/publish { post_id }
// Pipeline sobre blog_articles (mismo registro, solo cambia status).
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb, BLOG_TABLE, contentHash, publishIdempotencyKey, generateBlogHero, buildHeroPrompt } from "@/lib/psy-blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { agent } = auth;

  const body = await req.json().catch(() => ({}));
  const postId = Number(body.post_id);
  if (!Number.isFinite(postId)) return NextResponse.json({ error: "post_id_required" }, { status: 400 });

  const sb = psyBlogSb();
  const fetched = await sb.from(BLOG_TABLE).select("*").eq("id", postId).maybeSingle();
  if (fetched.error || !fetched.data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const post = fetched.data;
  if (post.provider_id !== agent.provider_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const cHash = contentHash(post.title, post.body_md ?? "");
  const idemKey = publishIdempotencyKey(agent.provider_id, cHash);

  if (post.status === "published") return NextResponse.json({ ok: true, post, idempotent: "already_published" });
  if (post.status === "publishing") return NextResponse.json({ ok: true, post, idempotent: "in_progress" });

  const dupe = await sb
    .from(BLOG_TABLE)
    .select("id, slug, status")
    .eq("publish_idempotency_key", idemKey)
    .neq("id", postId)
    .maybeSingle();
  if (dupe.data?.id) return NextResponse.json({ ok: true, idempotent: "dedup_by_content", duplicate_of: dupe.data });

  const lockRes = await sb
    .from(BLOG_TABLE)
    .update({
      status: "publishing",
      content_hash: cHash,
      publish_idempotency_key: idemKey,
      hero_status: "generating",
      hero_prompt: buildHeroPrompt(post.title),
      publish_attempts: (post.publish_attempts ?? 0) + 1,
    })
    .eq("id", postId)
    .in("status", ["draft", "scheduled"])
    .select()
    .maybeSingle();
  if (!lockRes.data) return NextResponse.json({ error: "lock_failed_concurrent_state", current_status: post.status }, { status: 409 });

  let heroUrl: string | null = null;
  let heroError: string | null = null;
  try {
    heroUrl = await generateBlogHero(buildHeroPrompt(post.title), lockRes.data.slug);
  } catch (e) {
    heroError = (e as Error).message.slice(0, 240);
  }

  const final = await sb
    .from(BLOG_TABLE)
    .update({
      status: "published",
      publish_date: new Date().toISOString(),
      hero_image: heroUrl,
      og_image: heroUrl,
      hero_image_alt: post.title,
      hero_status: heroUrl ? "ready" : "failed",
      hero_error: heroError,
      seo_status: "pending",
    })
    .eq("id", postId)
    .select()
    .single();
  if (final.error) return NextResponse.json({ error: final.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, post: final.data });
}
