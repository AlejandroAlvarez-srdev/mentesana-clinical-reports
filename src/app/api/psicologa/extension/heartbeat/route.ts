// Ping cada 5 min desde la extensión. Cors abierto: la extensión corre en *.google.com.
import { NextRequest, NextResponse } from "next/server";
import { sbBlog, verifyDeviceToken } from "@/lib/psicologa-extension";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const v = verifyDeviceToken(token);
  if (!v) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });

  const sb = sbBlog();
  const { error } = await sb
    .from("psicologa_extensions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("provider_id", v.providerId).eq("device_id", v.deviceId).is("revoked_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json({ ok: true }, { headers: CORS });
}
