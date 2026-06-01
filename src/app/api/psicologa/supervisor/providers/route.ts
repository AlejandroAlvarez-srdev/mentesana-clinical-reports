// Lista de psicólogas para que una líder elija a quién impersonar.
// Solo accesible si la sesión actual tiene is_supervisor=true.
import { NextRequest, NextResponse } from "next/server";
import { getPsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const me = await getPsicologa(req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.is_supervisor) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const ub = ameliaTable("users");
  const rows = await ameliaQuery<{
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    pictureThumbPath: string | null;
  }>(
    `SELECT id, firstName, lastName, email, pictureThumbPath
       FROM ${ub}
      WHERE type='provider' AND status='visible'
      ORDER BY firstName, lastName`,
  );

  return NextResponse.json({
    providers: rows.map((r) => ({
      id: Number(r.id),
      name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || r.email || `#${r.id}`,
      email: r.email,
      avatar: r.pictureThumbPath,
    })),
  });
}
