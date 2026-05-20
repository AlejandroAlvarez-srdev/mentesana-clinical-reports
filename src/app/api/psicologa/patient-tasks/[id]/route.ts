import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

const sb = createClient(
  process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!,
  process.env.BLOG_SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}) as any);
  const patch: any = {};
  if (typeof body.title === "string") patch.title = body.title.slice(0, 200);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 2000);
  if (body.due_date !== undefined) patch.due_date = body.due_date || null;
  if (["pending","done","dismissed"].includes(body.status)) {
    patch.status = body.status;
    patch.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing" }, { status: 400 });
  const { error } = await sb.from("patient_tasks").update(patch).eq("id", id).eq("provider_id", auth.agent.provider_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { id } = await ctx.params;
  const { error } = await sb.from("patient_tasks").delete().eq("id", id).eq("provider_id", auth.agent.provider_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
