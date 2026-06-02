import { redirect } from "next/navigation";
import { getPsicologa } from "@/lib/psicologa-auth";
import { isExtensionActive } from "@/lib/psicologa-extension";
import InstalarExtensionClient from "./InstalarExtensionClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  const p = await getPsicologa();
  if (!p) redirect("/psicologo/login");
  // Coherente con el gate del panel: si la extensión está activa
  // (heartbeat en últimas 12h), redirige al panel. Si lleva más tiempo
  // dormida o nunca pareó, la dejamos aquí para que pegue el código.
  if (await isExtensionActive(p.provider_id)) redirect("/psicologo");
  return <InstalarExtensionClient name={p.first_name || p.name} />;
}
