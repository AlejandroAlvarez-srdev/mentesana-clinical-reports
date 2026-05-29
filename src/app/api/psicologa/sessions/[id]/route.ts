// PATCH: editar summary_md, patient_alias, aprobar o descartar.
// La aprobación re-embebe el resumen (la psicóloga puede haberlo editado).
import { NextRequest, NextResponse } from "next/server";
import { getPsicologa } from "@/lib/psicologa-auth";
import { sbBlog } from "@/lib/psicologa-extension";
import { voyageEmbed } from "@/lib/voyage-embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const p = await getPsicologa();
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}) as any);
  const sb = sbBlog();

  const { data: row } = await sb.from("session_notes").select("provider_id, summary_md").eq("id", id).maybeSingle();
  if (!row || row.provider_id !== p.provider_id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch: Record<string, any> = {};
  if (typeof body.summary_md === "string") patch.summary_md = body.summary_md;
  if (typeof body.patient_alias === "string") patch.patient_alias = body.patient_alias.slice(0, 60);
  if (body.status === "approved") {
    patch.status = "approved";
    patch.approved_at = new Date().toISOString();
    const finalText = typeof body.summary_md === "string" ? body.summary_md : row.summary_md;
    patch.embedding = await voyageEmbed(finalText, "document");
  } else if (body.status === "discarded") {
    patch.status = "discarded";
  }

  const { error } = await sb.from("session_notes").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const p = await getPsicologa();
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = sbBlog();
  const { data: row } = await sb.from("session_notes").select("provider_id").eq("id", id).maybeSingle();
  if (!row || row.provider_id !== p.provider_id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await sb.from("session_notes").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
