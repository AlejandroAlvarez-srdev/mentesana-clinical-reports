// Genera un código de 6 dígitos para emparejar la extensión.
// Lo llama la PÁGINA web (psicóloga logueada). La extensión consume el código en /pair.
import { NextRequest, NextResponse } from "next/server";
import { getPsicologa } from "@/lib/psicologa-auth";
import { generatePairingCode, sbBlog } from "@/lib/psicologa-extension";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const p = await getPsicologa();
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = sbBlog();
  const code = generatePairingCode();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await sb.from("psicologa_extension_pairings").delete().eq("provider_id", p.provider_id);
  const { error } = await sb.from("psicologa_extension_pairings").insert({
    code, provider_id: p.provider_id, expires_at,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ code, expires_at });
}
