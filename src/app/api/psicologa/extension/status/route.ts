// Consulta interna (página /psicologo/instalar-extension hace polling para detectar la primera vinculación).
import { NextResponse } from "next/server";
import { getPsicologa } from "@/lib/psicologa-auth";
import { isExtensionActive } from "@/lib/psicologa-extension";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const p = await getPsicologa();
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ active: await isExtensionActive(p.provider_id) });
}
