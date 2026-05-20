import { NextRequest, NextResponse } from "next/server";
import { getPsicologa } from "@/lib/psicologa-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const p = await getPsicologa(req);
  if (!p) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ profile: p });
}
