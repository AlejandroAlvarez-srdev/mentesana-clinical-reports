import { NextRequest, NextResponse } from "next/server";
import { getPsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const p = await getPsicologa(req);
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let avatar_url: string | null = null;
  try {
    const rows = await ameliaQuery<any>(
      `SELECT pictureFullPath, pictureThumbPath FROM ${ameliaTable("users")} WHERE id = ? LIMIT 1`,
      [p.provider_id],
    );
    if (rows.length > 0) avatar_url = rows[0].pictureThumbPath || rows[0].pictureFullPath || null;
  } catch {}
  return NextResponse.json({ profile: { ...p, avatar_url } });
}
