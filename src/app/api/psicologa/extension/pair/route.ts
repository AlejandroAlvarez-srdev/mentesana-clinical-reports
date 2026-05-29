// La EXTENSIÓN llama aquí con el código de 6 dígitos visto en el navegador.
// Devuelve un device_token (Bearer) que la extensión persiste y usa en heartbeat/ingest.
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { issueDeviceToken, sbBlog } from "@/lib/psicologa-extension";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as any);
  const code = String(body.code ?? "").trim();
  const version = String(body.version ?? "").slice(0, 32);
  const user_agent = String(body.user_agent ?? "").slice(0, 500);
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "bad_code" }, { status: 400, headers: CORS });

  const sb = sbBlog();
  const { data: pair } = await sb
    .from("psicologa_extension_pairings")
    .select("*").eq("code", code).maybeSingle();
  if (!pair) return NextResponse.json({ error: "invalid_code" }, { status: 400, headers: CORS });
  if (pair.consumed_at) return NextResponse.json({ error: "code_used" }, { status: 400, headers: CORS });
  if (new Date(pair.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "code_expired" }, { status: 400, headers: CORS });

  const device_id = crypto.randomUUID();
  const token = issueDeviceToken(pair.provider_id, device_id);

  await sb.from("psicologa_extensions").insert({
    provider_id: pair.provider_id, device_id, version, user_agent,
  });
  await sb.from("psicologa_extension_pairings").update({ consumed_at: new Date().toISOString() }).eq("code", code);

  return NextResponse.json({ ok: true, device_token: token, provider_id: pair.provider_id }, { headers: CORS });
}
