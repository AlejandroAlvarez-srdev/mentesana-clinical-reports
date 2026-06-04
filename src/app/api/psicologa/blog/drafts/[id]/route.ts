// PATCH /api/psicologa/blog/drafts/[id] → actualizar borrador
// DELETE → archivar (no borra físicamente para preservar SEO)
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb, slugify, contentHash, ensureUniqueSlug } from "@/lib/psy-blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownPost(req: NextRequest, id: string) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return { err: auth };
  const sb = psyBlogSb();
  const { data, error } = await sb.from("psy_blog_posts").select("*").eq("id", id).maybeSingle();
  if (error || !data) return { err: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (data.provider_id !== auth.agent.provider_id) return { err: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { agent: auth.agent, post: data, sb };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await ownPost(req, id);
  if ("err" in res) return res.err;
  const { post, sb } = res;
  if (post.status === "published" || post.status === "publishing") {
    return NextResponse.json({ error: "cannot_edit_published" }, { status: 409 });
  }
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    update.title = body.title.trim();
    const newSlug = await ensureUniqueSlug(slugify(body.title.trim()), id);
    update.slug = newSlug;
  }
  if (typeof body.body_md === "string") update.body_md = body.body_md;
  if (typeof body.keyword === "string" && body.keyword.trim()) update.keyword = body.keyword.trim();
  if (typeof body.scheduled_for === "string" || body.scheduled_for === null) {
    update.scheduled_for = body.scheduled_for;
    update.status = body.scheduled_for ? "scheduled" : "draft";
  }
  if ((update.title || update.body_md) && (update.title !== undefined || update.body_md !== undefined)) {
    const title = (update.title as string) ?? post.title;
    const md = (update.body_md as string) ?? post.body_md;
    update.content_hash = contentHash(title, md);
  }
  const upd = await sb.from("psy_blog_posts").update(update).eq("id", id).select().single();
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, post: upd.data });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await ownPost(req, id);
  if ("err" in res) return res.err;
  const { post, sb } = res;
  // No borramos posts publicados — solo los archivamos para preservar la URL.
  const upd = await sb.from("psy_blog_posts").update({ status: "archived" }).eq("id", id);
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, archived_id: post.id });
}
