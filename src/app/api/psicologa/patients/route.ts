// Lista de pacientes de la psicóloga. PII oculta (sin phone/email).
// Incluye paquetes asignados a esta psi: fecha compra, fecha fin, sesiones used/restantes.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

const sb = createClient(
  process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!,
  process.env.BLOG_SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;

  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const pc = ameliaTable("packages_to_customers");
  const pcs = ameliaTable("packages_customers_to_services");
  const pks = ameliaTable("packages");

  // Semántica Mente Sana: approved+pending=asistió, no-show+rejected=no asistió
  const rows = await ameliaQuery<any>(
    `SELECT DISTINCT cb.customerId,
       u.firstName, u.lastName,
       (SELECT COUNT(*) FROM ${cb} cb2 JOIN ${ab} a2 ON a2.id=cb2.appointmentId WHERE cb2.customerId = cb.customerId AND a2.providerId = ? AND cb2.status IN ('approved','pending')) total_sessions,
       (SELECT MAX(a3.bookingStart) FROM ${cb} cb3 JOIN ${ab} a3 ON a3.id=cb3.appointmentId WHERE cb3.customerId = cb.customerId AND a3.providerId = ? AND cb3.status IN ('approved','pending')) last_session,
       (SELECT MIN(a4.bookingStart) FROM ${cb} cb4 JOIN ${ab} a4 ON a4.id=cb4.appointmentId WHERE cb4.customerId = cb.customerId AND a4.providerId = ? AND cb4.status IN ('approved','pending')) first_session,
       (SELECT MIN(a5.bookingStart) FROM ${cb} cb5 JOIN ${ab} a5 ON a5.id=cb5.appointmentId WHERE cb5.customerId = cb.customerId AND a5.providerId = ? AND cb5.status IN ('approved','pending') AND a5.bookingStart >= NOW()) next_session
     FROM ${cb} cb
     JOIN ${ab} a ON a.id = cb.appointmentId
     JOIN ${ub} u ON u.id = cb.customerId
     WHERE a.providerId = ? AND cb.status IN ('approved','pending')
     ORDER BY total_sessions DESC, last_session DESC
     LIMIT 500`,
    [provider_id, provider_id, provider_id, provider_id, provider_id],
  );

  const custIds = rows.map((r: any) => Number(r.customerId)).filter(Boolean);
  const packagesByCust = new Map<number, any[]>();

  if (custIds.length > 0) {
    const pkgRows = await ameliaQuery<any>(
      `SELECT p.id package_customer_id, p.customerId, p.status, p.purchased, p.start, p.end,
         pk.name package_name,
         pcs.id pcs_id, pcs.bookingsCount total_bookings,
         (SELECT COUNT(*) FROM ${cb} cb_u WHERE cb_u.packageCustomerServiceId = pcs.id AND cb_u.status IN ('approved','pending')) used_bookings
       FROM ${pc} p
       JOIN ${pcs} pcs ON pcs.packageCustomerId = p.id
       JOIN ${pks} pk ON pk.id = p.packageId
       WHERE p.customerId IN (${custIds.join(",")})
         AND pcs.providerId = ?
       ORDER BY p.purchased DESC`,
      [provider_id],
    );
    for (const pr of pkgRows) {
      const cid = Number(pr.customerId);
      if (!packagesByCust.has(cid)) packagesByCust.set(cid, []);
      const total = Number(pr.total_bookings ?? 0);
      const used = Number(pr.used_bookings ?? 0);
      const remaining = Math.max(0, total - used);
      const expired = pr.end != null && new Date(pr.end) < new Date();
      packagesByCust.get(cid)!.push({
        package_customer_id: pr.package_customer_id,
        pcs_id: pr.pcs_id,
        package_name: pr.package_name,
        status: pr.status,
        purchased: pr.purchased ? new Date(pr.purchased).toISOString() : null,
        start: pr.start ? new Date(pr.start).toISOString() : null,
        end: pr.end ? new Date(pr.end).toISOString() : null,
        total_bookings: total,
        used_bookings: used,
        remaining,
        expired,
        active: pr.status === "approved" && !expired && remaining > 0,
      });
    }
  }

  const notesCount = new Map<number, number>();
  if (custIds.length > 0) {
    const { data: notes } = await sb
      .from("psychologist_clinical_notes")
      .select("customer_id")
      .eq("provider_id", provider_id)
      .in("customer_id", custIds);
    for (const n of notes ?? []) {
      notesCount.set(Number(n.customer_id), (notesCount.get(Number(n.customer_id)) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    patients: rows.map((r: any) => {
      const cid = Number(r.customerId);
      const packages = packagesByCust.get(cid) ?? [];
      const activePackage = packages.find((p) => p.active);
      const totalRemaining = packages.reduce((s, p) => s + (p.active ? p.remaining : 0), 0);
      return {
        customer_id: cid,
        name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "(sin nombre)",
        total_sessions: Number(r.total_sessions ?? 0),
        first_session: r.first_session ? new Date(r.first_session).toISOString() : null,
        last_session: r.last_session ? new Date(r.last_session).toISOString() : null,
        next_session: r.next_session ? new Date(r.next_session).toISOString() : null,
        notes_count: notesCount.get(cid) ?? 0,
        packages,
        active_package: activePackage ? {
          name: activePackage.package_name,
          purchased: activePackage.purchased,
          end: activePackage.end,
          total_bookings: activePackage.total_bookings,
          used_bookings: activePackage.used_bookings,
          remaining: activePackage.remaining,
        } : null,
        total_remaining_sessions: totalRemaining,
        has_any_package: packages.length > 0,
      };
    }),
  });
}
