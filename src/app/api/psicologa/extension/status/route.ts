// Consulta interna (página /psicologo/instalar-extension hace polling).
// Devuelve dos flags:
//   active → heartbeat reciente (HEARTBEAT_WINDOW_MS)
//   paired → existe fila no revocada en psicologa_extensions
// La página de instalar usa `paired` (más rápido — true en cuanto la psi
// pega el código), no `active` (que tarda hasta el primer heartbeat).
import { NextResponse } from "next/server";
import { getPsicologa } from "@/lib/psicologa-auth";
import { isExtensionActive, hasPairedExtension } from "@/lib/psicologa-extension";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const p = await getPsicologa();
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [active, paired] = await Promise.all([
    isExtensionActive(p.provider_id),
    hasPairedExtension(p.provider_id),
  ]);
  return NextResponse.json({ active, paired });
}
