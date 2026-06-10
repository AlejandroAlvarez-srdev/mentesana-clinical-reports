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

  // La columna version solo se escribía al parear, así que un auto-update del
  // Web Store era invisible (filas decían 0.1.0 corriendo 0.3.x). Si la extensión
  // manda su versión en el heartbeat, la persistimos — con eso medimos la
  // propagación real antes de bajar HEARTBEAT_WINDOW_MS.
  const body = await req.json().catch(() => ({}) as any);
  const version = typeof body.version === "string" && body.version.trim() ? body.version.trim().slice(0, 32) : null;
  const patch: Record<string, string> = { last_seen_at: new Date().toISOString() };
  if (version) patch.version = version;

  const sb = sbBlog();
  const { error } = await sb
    .from("psicologa_extensions")
    .update(patch)
    .eq("provider_id", v.providerId).eq("device_id", v.deviceId).is("revoked_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json({ ok: true }, { headers: CORS });
}
