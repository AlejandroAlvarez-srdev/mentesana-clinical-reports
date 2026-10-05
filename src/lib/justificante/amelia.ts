// Busca en Amelia la sesión ASISTIDA que justifica el documento.
// Asistió = customer_bookings.status = 'pending' (semántica Mente Sana; lo marca soporte).
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

export interface SesionAsistida {
  appointment_id: number;
  start_utc: Date;
  duration_min: number;
  provider_name: string;
  service_name: string;
  customer_id: number;
  customer_name: string;
  customer_email: string | null;
  attended_count: number;
  first_attended_utc: Date | null;
}

const toDate = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  if (!v) return null;
  const str = String(v);
  const d = new Date(/^\d{4}-\d{2}-\d{2} /.test(str) ? str.replace(" ", "T") + "Z" : str);
  return Number.isNaN(d.getTime()) ? null : d;
};
const digits = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "");

/**
 * Última sesión asistida del contacto (por email o teléfono), o la cita concreta si se
 * pasa `appointmentId`. `desdeDias` acota hacia atrás (por defecto 21 días).
 */
export async function buscarSesionAsistida(opts: { email?: string | null; phone?: string | null; appointmentId?: number | null; desdeDias?: number }): Promise<SesionAsistida | null> {
  const ub = ameliaTable("users"), ab = ameliaTable("appointments"), cb = ameliaTable("customer_bookings"), sv = ameliaTable("services");
  const email = (opts.email ?? "").trim().toLowerCase();
  const last9 = digits(opts.phone).slice(-9);
  const wheres: string[] = []; const params: unknown[] = [];
  if (email) { wheres.push("LOWER(u.email) = ?"); params.push(email); }
  if (last9.length === 9) { wheres.push("RIGHT(REPLACE(REPLACE(REPLACE(u.phone,' ',''),'+',''),'-',''), 9) = ?"); params.push(last9); }
  if (!wheres.length) return null;

  const custs = await ameliaQuery<{ id: number; firstName: string | null; lastName: string | null; email: string | null }>(
    `SELECT id, firstName, lastName, email FROM ${ub} u WHERE u.type='customer' AND (${wheres.join(" OR ")}) ORDER BY id DESC LIMIT 5`, params);
  if (!custs.length) return null;
  const ids = custs.map((c) => c.id);
  const ph = ids.map(() => "?").join(",");

  const sesWhere = opts.appointmentId
    ? `a.id = ? AND cb.status IN ('pending','approved')`
    : `cb.status = 'pending' AND a.bookingStart <= NOW() AND a.bookingStart >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
  const sesParams: unknown[] = opts.appointmentId ? [...ids, opts.appointmentId] : [...ids, opts.desdeDias ?? 21];
  const rows = await ameliaQuery<{ appointment_id: number; bookingStart: unknown; duration: number | null; service_name: string | null; pfn: string | null; pln: string | null; customerId: number }>(
    `SELECT a.id appointment_id, a.bookingStart, s.duration, s.name service_name, pu.firstName pfn, pu.lastName pln, cb.customerId
       FROM ${cb} cb
       JOIN ${ab} a ON a.id = cb.appointmentId
       LEFT JOIN ${sv} s ON s.id = a.serviceId
       LEFT JOIN ${ub} pu ON pu.id = a.providerId
      WHERE cb.customerId IN (${ph}) AND ${sesWhere}
      ORDER BY a.bookingStart DESC LIMIT 1`, sesParams);
  const r = rows[0];
  if (!r) return null;
  const start = toDate(r.bookingStart);
  if (!start) return null;

  const agg = await ameliaQuery<{ n: number; first_at: unknown }>(
    `SELECT COUNT(DISTINCT a.id) n, MIN(a.bookingStart) first_at
       FROM ${cb} cb JOIN ${ab} a ON a.id = cb.appointmentId
      WHERE cb.customerId IN (${ph}) AND cb.status = 'pending' AND a.bookingStart <= NOW()`, ids);
  const c = custs.find((x) => x.id === r.customerId) ?? custs[0];
  return {
    appointment_id: Number(r.appointment_id),
    start_utc: start,
    duration_min: Math.max(15, Math.round(Number(r.duration ?? 3000) / 60)),
    provider_name: `${r.pfn ?? ""} ${r.pln ?? ""}`.trim() || "Psicóloga del equipo",
    service_name: r.service_name ?? "Sesión de psicoterapia",
    customer_id: c.id,
    customer_name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
    customer_email: c.email,
    attended_count: Number(agg[0]?.n ?? 0),
    first_attended_utc: toDate(agg[0]?.first_at),
  };
}
