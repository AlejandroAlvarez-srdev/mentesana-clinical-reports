// POST /api/psicologa/blog/publish { post_id }
// Pipeline sobre blog_articles (mismo registro, solo cambia status).
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb, BLOG_TABLE, contentHash, publishIdempotencyKey, generateBlogHero, buildHeroPrompt, mdToContentBlocks } from "@/lib/psy-blog";
import { polishBlogMarkdown } from "@/lib/blog-polish";

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

  // Polish del body_md: añade estructura markdown (## ### - > **) sin tocar palabras.
  // Best-effort: si falla, publica tal cual.
  let polishedBody = post.body_md ?? "";
  try {
    const polished = await polishBlogMarkdown(polishedBody);
    if (polished && polished !== polishedBody) polishedBody = polished;
  } catch (e) { console.warn("[publish] polish failed:", (e as Error).message); }
  const polishedBlocks = mdToContentBlocks(polishedBody);

  const final = await sb
    .from(BLOG_TABLE)
    .update({
      status: "published",
      publish_date: new Date().toISOString(),
      body_md: polishedBody,
      content: polishedBlocks,
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

  // Marcar la keyword del universo como 'published' y enlazarla con este post.
  if (post.keyword) {
    await sb.from("blog_keyword_universe").update({
      status: "published",
      post_id: postId,
      lock_expires_at: null,
    }).eq("keyword", post.keyword);
  }

  // Invalida cache de Next/Vercel para que el post sea visible YA en /blog
  // (sin esto, ISR tarda hasta 10 min en regenerar y los visitantes ven 404 si
  // alguien intentó la URL antes de publicarse).
  try {
    revalidatePath(`/blog/${final.data.slug}`);
    revalidatePath("/blog");
  } catch (e) {
    console.warn("[publish] revalidate failed (non-fatal):", (e as Error).message);
  }

  return NextResponse.json({ ok: true, post: final.data });
}
