import { redirect } from "next/navigation";
import { getPsicologa } from "@/lib/psicologa-auth";
import ElegirPsicologaClient from "./ElegirPsicologaClient";

export const dynamic = "force-dynamic";

export default async function ElegirPsicologaPage() {
  const p = await getPsicologa();
  if (!p) redirect("/psicologo/login");
  if (!p.is_supervisor) redirect("/psicologo");
  const leaderName = p.first_name || "Líder";
  return <ElegirPsicologaClient leaderName={leaderName} leaderEmail={p.original_email ?? p.email} />;
}
