// Lista paginada de pacientes de la psicóloga. PII oculta (sin phone/email).
//
// Query params:
//   page      (1-based, default 1)
//   pageSize  (default 20, max 100)
//   q         (búsqueda LIKE en firstName+lastName)
//   filter    ('all' | 'with_package' | 'package_expiring')
//
// Optimizaciones vs la versión anterior:
//   - Una sola query principal con GROUP BY en lugar de 4 subqueries
//     correlacionadas. En psis con 300+ pacientes esto pasa de >10s
//     a sub-segundo.
//   - LIMIT/OFFSET en SQL: solo enriquecemos paquetes/notas de los
//     pacientes de la página actual.
//   - Conteos globales para los chips se devuelven aparte para no
//     romper la UX.
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

interface PatientRow {
  customerId: number;
  firstName: string | null;
  lastName: string | null;
  total_sessions: number;
  first_session: string | null;
  last_session: string | null;
  next_session: string | null;
}

interface PackageRow {
  package_customer_id: number;
  customerId: number;
  status: string;
  purchased: string | null;
  start: string | null;
  end: string | null;
  package_name: string;
  pcs_id: number;
  total_bookings: number;
  used_bookings: number;
}

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));
  const q = (url.searchParams.get("q") ?? "").trim();
  const filter = (url.searchParams.get("filter") ?? "all") as "all" | "with_package" | "package_expiring";

  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const pc = ameliaTable("packages_to_customers");
  const pcs = ameliaTable("packages_customers_to_services");
  const pks = ameliaTable("packages");

  const params: (number | string)[] = [provider_id];
  let whereSearch = "";
  if (q) {
    whereSearch = " AND (LOWER(CONCAT(u.firstName,' ',u.lastName)) LIKE ?)";
    params.push(`%${q.toLowerCase()}%`);
  }
  // Filtros que requieren EXISTS contra packages
  let whereFilter = "";
  if (filter === "with_package") {
    whereFilter = ` AND EXISTS (
      SELECT 1 FROM ${pc} pc1
      JOIN ${pcs} pcs1 ON pcs1.packageCustomerId = pc1.id
      WHERE pc1.customerId = u.id AND pcs1.providerId = ? AND pc1.status = 'approved'
        AND (pc1.end IS NULL OR pc1.end > NOW())
    )`;
    params.push(provider_id);
  } else if (filter === "package_expiring") {
    whereFilter = ` AND EXISTS (
      SELECT 1 FROM ${pc} pc1
      JOIN ${pcs} pcs1 ON pcs1.packageCustomerId = pc1.id
      WHERE pc1.customerId = u.id AND pcs1.providerId = ? AND pc1.status = 'approved'
        AND pc1.end IS NOT NULL AND pc1.end > NOW() AND pc1.end <= DATE_ADD(NOW(), INTERVAL 30 DAY)
    )`;
    params.push(provider_id);
  }

  // 1) Query principal — GROUP BY (mucho más rápido que 4 subqueries correlacionadas)
  const baseWhere = `WHERE a.providerId = ? AND cb.status IN ('approved','pending')${whereSearch}${whereFilter}`;

  const rows = await ameliaQuery<PatientRow>(
    `SELECT u.id AS customerId,
            u.firstName, u.lastName,
            COUNT(*) AS total_sessions,
            MIN(a.bookingStart) AS first_session,
            MAX(a.bookingStart) AS last_session,
            MIN(CASE WHEN a.bookingStart >= NOW() THEN a.bookingStart ELSE NULL END) AS next_session
       FROM ${cb} cb
       JOIN ${ab} a ON a.id = cb.appointmentId
       JOIN ${ub} u ON u.id = cb.customerId
       ${baseWhere}
       GROUP BY u.id, u.firstName, u.lastName
       ORDER BY total_sessions DESC, last_session DESC
       LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );

  // 2) Total de pacientes (sin LIMIT) para paginación
  const totalRow = await ameliaQuery<{ total: number }>(
    `SELECT COUNT(DISTINCT u.id) AS total
       FROM ${cb} cb
       JOIN ${ab} a ON a.id = cb.appointmentId
       JOIN ${ub} u ON u.id = cb.customerId
       ${baseWhere}`,
    params,
  );
  const total = Number(totalRow[0]?.total ?? 0);

  // 3) Conteos globales para los chips (independientes del filtro/búsqueda actual)
  //    Una sola query con COUNT(CASE WHEN ...) para no hacer 3 round trips.
  const countParams: number[] = [provider_id, provider_id, provider_id];
  const counts = await ameliaQuery<{ all_count: number; with_pkg_count: number; expiring_count: number }>(
    `SELECT
        COUNT(DISTINCT u.id) AS all_count,
        COUNT(DISTINCT CASE WHEN EXISTS (
          SELECT 1 FROM ${pc} p1 JOIN ${pcs} pcs1 ON pcs1.packageCustomerId = p1.id
          WHERE p1.customerId = u.id AND pcs1.providerId = ? AND p1.status='approved'
            AND (p1.end IS NULL OR p1.end > NOW())
        ) THEN u.id END) AS with_pkg_count,
        COUNT(DISTINCT CASE WHEN EXISTS (
          SELECT 1 FROM ${pc} p2 JOIN ${pcs} pcs2 ON pcs2.packageCustomerId = p2.id
          WHERE p2.customerId = u.id AND pcs2.providerId = ? AND p2.status='approved'
            AND p2.end IS NOT NULL AND p2.end > NOW() AND p2.end <= DATE_ADD(NOW(), INTERVAL 30 DAY)
        ) THEN u.id END) AS expiring_count
       FROM ${cb} cb
       JOIN ${ab} a ON a.id = cb.appointmentId
       JOIN ${ub} u ON u.id = cb.customerId
      WHERE a.providerId = ? AND cb.status IN ('approved','pending')`,
    countParams,
  );

  const custIds = rows.map((r) => Number(r.customerId)).filter(Boolean);
  const packagesByCust = new Map<number, ReturnType<typeof mapPackage>[]>();

  if (custIds.length > 0) {
    const pkgRows = await ameliaQuery<PackageRow>(
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
      packagesByCust.get(cid)!.push(mapPackage(pr));
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

  const patients = rows.map((r) => {
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
  });

  return NextResponse.json({
    patients,
    page,
    page_size: pageSize,
    total,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
    counts: {
      all: Number(counts[0]?.all_count ?? 0),
      with_package: Number(counts[0]?.with_pkg_count ?? 0),
      expiring: Number(counts[0]?.expiring_count ?? 0),
    },
  });
}

function mapPackage(pr: PackageRow) {
  const total = Number(pr.total_bookings ?? 0);
  const used = Number(pr.used_bookings ?? 0);
  const remaining = Math.max(0, total - used);
  const expired = pr.end != null && new Date(pr.end) < new Date();
  return {
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
  };
}
