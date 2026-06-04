// POST /api/psicologa/blog/publish { post_id }
// Pipeline:
//   1. Lock optimista: status draft|scheduled → publishing (idempotente: si ya publishing/published, devolvemos el row tal cual).
//   2. Calcula publish_idempotency_key (psy_id|content_hash). Si ya existe otra fila con esa key → devolvemos esa.
//   3. Higgsfield genera hero con prompt auto desde el título.
//   4. Status → published, published_at = now.
//   5. SEO se rellena más tarde por el cron blog-seo-postpublish.
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb, contentHash, publishIdempotencyKey, generateBlogHero, buildHeroPrompt } from "@/lib/psy-blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { agent } = auth;

  const body = await req.json().catch(() => ({}));
  const postId = String(body.post_id ?? "").trim();
  if (!postId) return NextResponse.json({ error: "post_id_required" }, { status: 400 });

  const sb = psyBlogSb();
  const fetched = await sb.from("psy_blog_posts").select("*").eq("id", postId).maybeSingle();
  if (fetched.error || !fetched.data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const post = fetched.data;
  if (post.provider_id !== agent.provider_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Idempotencia 3: hash del contenido. Si la psi hace doble-click, devolvemos
  // el resultado anterior sin reintentar Higgsfield.
  const cHash = contentHash(post.title, post.body_md);
  const idemKey = publishIdempotencyKey(agent.provider_id, cHash);

  if (post.status === "published") {
    return NextResponse.json({ ok: true, post, idempotent: "already_published" });
  }
  if (post.status === "publishing") {
    return NextResponse.json({ ok: true, post, idempotent: "in_progress" });
  }

  // Buscar si ya existe OTRO post con el mismo idem key (mismo contenido publicado antes).
  const dupe = await sb
    .from("psy_blog_posts")
    .select("id, slug, status")
    .eq("publish_idempotency_key", idemKey)
    .neq("id", postId)
    .maybeSingle();
  if (dupe.data?.id) {
    return NextResponse.json({ ok: true, idempotent: "dedup_by_content", duplicate_of: dupe.data });
  }

  // Lock con CAS: solo movemos a publishing si seguimos en draft|scheduled.
  const lockRes = await sb
    .from("psy_blog_posts")
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
  if (!lockRes.data) {
    return NextResponse.json({ error: "lock_failed_concurrent_state", current_status: post.status }, { status: 409 });
  }

  // Generar hero — best-effort: si falla, el post se publica sin hero y un cron lo reintenta.
  let heroUrl: string | null = null;
  let heroError: string | null = null;
  try {
    heroUrl = await generateBlogHero(buildHeroPrompt(post.title), lockRes.data.slug);
  } catch (e) {
    heroError = (e as Error).message.slice(0, 240);
  }

  const final = await sb
    .from("psy_blog_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      hero_url: heroUrl,
      hero_status: heroUrl ? "ready" : "failed",
      hero_error: heroError,
    })
    .eq("id", postId)
    .select()
    .single();
  if (final.error) return NextResponse.json({ error: final.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, post: final.data });
}
