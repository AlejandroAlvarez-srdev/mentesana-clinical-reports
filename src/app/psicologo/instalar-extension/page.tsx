import { redirect } from "next/navigation";
import { getPsicologa } from "@/lib/psicologa-auth";
import { isExtensionActive } from "@/lib/psicologa-extension";
import InstalarExtensionClient from "./InstalarExtensionClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page({ searchParams }: { searchParams: Promise<{ force?: string; reparear?: string }> }) {
  const p = await getPsicologa();
  if (!p) redirect("/psicologo/login");
  const sp = await searchParams;
  const force = sp.force === "1" || sp.reparear === "1";
  // Si la extensión está activa (heartbeat reciente) y NO viene con ?force=1,
  // redirigimos al panel. Con ?force=1 (botón "re-vincular") permitimos
  // generar código aunque haya una versión vieja paireada.
  if (!force && (await isExtensionActive(p.provider_id))) redirect("/psicologo");
  return <InstalarExtensionClient name={p.first_name || p.name} forced={force} />;
}
