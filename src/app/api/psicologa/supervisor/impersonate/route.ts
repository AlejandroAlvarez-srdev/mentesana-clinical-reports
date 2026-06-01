// Impersonar una psicóloga desde la sesión de líder. Emite una nueva
// cookie ms_psicologa con el provider_id elegido pero conserva los
// flags is_supervisor + original_email para que el panel sepa que es
// una líder viendo a una psi, no la psi real.
import { NextRequest, NextResponse } from "next/server";
import { getPsicologa, issuePsicologaSession, psicologaCookieOptions, type PsicologaProfile } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const me = await getPsicologa(req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.is_supervisor) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { provider_id?: number };
  const providerId = Number(body.provider_id);
  if (!providerId || !Number.isFinite(providerId)) {
    return NextResponse.json({ error: "missing_provider_id" }, { status: 400 });
  }

  const rows = await ameliaQuery<{ id: number; firstName: string | null; lastName: string | null; email: string | null }>(
    `SELECT id, firstName, lastName, email FROM ${ameliaTable("users")} WHERE type='provider' AND status='visible' AND id=? LIMIT 1`,
    [providerId],
  );
  if (rows.length === 0) return NextResponse.json({ error: "provider_not_found" }, { status: 404 });
  const p = rows[0];

  const profile: PsicologaProfile = {
    provider_id: Number(p.id),
    email: p.email ?? me.original_email ?? me.email,
    name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || `#${p.id}`,
    first_name: p.firstName ?? "",
    last_name: p.lastName ?? "",
    is_supervisor: true,
    original_email: me.original_email ?? me.email,
  };

  const { value, maxAge } = issuePsicologaSession(profile);
  const res = NextResponse.json({ ok: true, profile });
  const opts = psicologaCookieOptions(maxAge);
  res.cookies.set({ ...opts, value });
  return res;
}

// Reset → volver a modo "ninguna psi" para que el supervisor elija otra
export async function DELETE(req: NextRequest) {
  const me = await getPsicologa(req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.is_supervisor) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const leaderEmail = me.original_email ?? me.email;
  const leaderName = leaderEmail.startsWith("lidermentesana") ? "Lead B" : "Lead A";
  const profile: PsicologaProfile = {
    provider_id: 0,
    email: leaderEmail,
    name: `${leaderName} (líder)`,
    first_name: leaderName,
    last_name: "(líder)",
    is_supervisor: true,
    original_email: leaderEmail,
  };
  const { value, maxAge } = issuePsicologaSession(profile);
  const res = NextResponse.json({ ok: true });
  const opts = psicologaCookieOptions(maxAge);
  res.cookies.set({ ...opts, value });
  return res;
}
