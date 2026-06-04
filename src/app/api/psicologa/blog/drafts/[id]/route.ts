// PATCH → actualizar borrador
// DELETE → archivar (no borra)
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb, BLOG_TABLE, slugify, contentHash, ensureUniqueSlug, mdToContentBlocks } from "@/lib/psy-blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownPost(req: NextRequest, id: number) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return { err: auth };
  const sb = psyBlogSb();
  const { data, error } = await sb.from(BLOG_TABLE).select("*").eq("id", id).maybeSingle();
  if (error || !data) return { err: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (data.provider_id !== auth.agent.provider_id) return { err: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { agent: auth.agent, post: data, sb };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const res = await ownPost(req, numId);
  if ("err" in res) return res.err;
  const { post, sb } = res;
  if (post.status === "published" || post.status === "publishing") {
    return NextResponse.json({ error: "cannot_edit_published" }, { status: 409 });
  }
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    update.title = body.title.trim();
    const newSlug = await ensureUniqueSlug(slugify(body.title.trim()), numId);
    update.slug = newSlug;
  }
  if (typeof body.body_md === "string") {
    update.body_md = body.body_md;
    update.content = mdToContentBlocks(body.body_md);
    update.word_count = body.body_md.split(/\s+/).filter(Boolean).length;
    update.read_time = Math.max(2, Math.ceil((update.word_count as number) / 220));
  }
  if (typeof body.keyword === "string" && body.keyword.trim()) update.keyword = body.keyword.trim();
  if (typeof body.scheduled_for === "string" || body.scheduled_for === null) {
    update.scheduled_for = body.scheduled_for;
    update.status = body.scheduled_for ? "scheduled" : "draft";
  }
  if (update.title !== undefined || update.body_md !== undefined) {
    const title = (update.title as string) ?? post.title;
    const md = (update.body_md as string) ?? post.body_md ?? "";
    update.content_hash = contentHash(title, md);
  }
  const upd = await sb.from(BLOG_TABLE).update(update).eq("id", numId).select().single();
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, post: upd.data });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const res = await ownPost(req, numId);
  if ("err" in res) return res.err;
  const { post, sb } = res;
  const upd = await sb.from(BLOG_TABLE).update({ status: "archived" }).eq("id", numId);
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, archived_id: post.id });
}
