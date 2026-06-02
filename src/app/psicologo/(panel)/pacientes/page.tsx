"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const PURPLE = "#6A178C";

type ActivePkg = { name: string; purchased: string | null; end: string | null; total_bookings: number; used_bookings: number; remaining: number };
type Patient = {
  customer_id: number;
  name: string;
  total_sessions: number;
  first_session: string | null;
  last_session: string | null;
  next_session: string | null;
  notes_count: number;
  active_package: ActivePkg | null;
  total_remaining_sessions: number;
  has_any_package: boolean;
};
type ApiResponse = {
  patients: Patient[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  counts: { all: number; with_package: number; expiring: number };
};
type FilterKey = "all" | "with_package" | "package_expiring";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtNext(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

export default function PacientesPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [counts, setCounts] = useState({ all: 0, with_package: 0, expiring: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");
  const [filter, setFilter] = useState<FilterKey>("all");
  // q con debounce 300ms para no spamear la BD mientras la psi escribe
  const [debouncedQ, setDebouncedQ] = useState("");
  const reqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const myReq = ++reqRef.current;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      filter,
    });
    if (debouncedQ) params.set("q", debouncedQ);
    fetch(`/api/psicologa/patients?${params.toString()}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() as Promise<ApiResponse> : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (myReq !== reqRef.current) return; // request obsoleto
        setPatients(d.patients ?? []);
        setCounts(d.counts ?? { all: 0, with_package: 0, expiring: 0 });
        setTotal(d.total ?? 0);
        setTotalPages(d.total_pages ?? 1);
      })
      .catch(() => { if (myReq === reqRef.current) setPatients([]); })
      .finally(() => { if (myReq === reqRef.current) setLoading(false); });
  }, [page, pageSize, debouncedQ, filter]);

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(total, page * pageSize);

  const pagesToShow = useMemo(() => buildPagination(page, totalPages), [page, totalPages]);

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>👥 Mis pacientes</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
            {counts.all} en total · {counts.with_package} con bono activo · datos de contacto ocultos por confidencialidad
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre…"
            style={{ padding: "8px 12px", fontSize: 13, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, minWidth: 200, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, overflow: "hidden" }}>
            <button onClick={() => setView("table")} style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, border: "none", background: view === "table" ? PURPLE : "#fff", color: view === "table" ? "#fff" : "#475569", cursor: "pointer" }}>📊 Tabla</button>
            <button onClick={() => setView("cards")} style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, border: "none", borderLeft: "1px solid rgba(0,0,0,0.1)", background: view === "cards" ? PURPLE : "#fff", color: view === "cards" ? "#fff" : "#475569", cursor: "pointer" }}>🃏 Tarjetas</button>
          </div>
        </div>
      </header>

      <div className="ms-chip-row" style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <FilterChip active={filter === "all"} onClick={() => { setFilter("all"); setPage(1); }}>Todos ({counts.all})</FilterChip>
        <FilterChip active={filter === "with_package"} onClick={() => { setFilter("with_package"); setPage(1); }} color="#16a34a">🎫 Con bono activo ({counts.with_package})</FilterChip>
        <FilterChip active={filter === "package_expiring"} onClick={() => { setFilter("package_expiring"); setPage(1); }} color="#d97706">⏳ Bono caduca pronto ({counts.expiring})</FilterChip>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#888" }}>
          {total > 0 ? `${showingFrom}–${showingTo} de ${total}` : "—"}
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#666" }}>
          <span>Por página:</span>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: "5px 8px", fontSize: 12, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, background: "#fff", color: "#1a1a2e" }}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {loading && <div style={{ padding: 30, textAlign: "center", color: "#888" }}>Cargando…</div>}
      {!loading && patients.length === 0 && <div style={{ padding: 30, background: "#fff", borderRadius: 12, textAlign: "center", color: "#aaa" }}>Sin pacientes para este filtro.</div>}

      {!loading && patients.length > 0 && view === "table" && (
        <div className="ms-table-scroll" style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
            <thead>
              <tr style={{ background: "rgba(106,23,140,0.05)" }}>
                <Th>Paciente</Th>
                <Th>Bono</Th>
                <Th align="center">Compra</Th>
                <Th align="center">Caduca</Th>
                <Th align="right">Pendientes</Th>
                <Th align="right">Sesiones</Th>
                <Th>Próxima cita</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => {
                const pkg = p.active_package;
                const daysLeft = pkg?.end ? Math.floor((new Date(pkg.end).getTime() - Date.now()) / 86400000) : null;
                const daysColor = daysLeft != null && daysLeft <= 30 ? "#dc2626" : daysLeft != null && daysLeft <= 60 ? "#d97706" : "#475569";
                return (
                  <tr key={p.customer_id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                    <Td>
                      <Link href={`/psicologo/pacientes/${p.customer_id}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1a1a2e" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                          {p.name.split(" ").map(n => n[0] ?? "").join("").slice(0, 2).toUpperCase() || "?"}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: "#888" }}>{p.notes_count} notas</div>
                        </div>
                      </Link>
                    </Td>
                    <Td>{pkg ? <span style={{ fontWeight: 600, color: "#065f46" }}>{pkg.name}</span> : <span style={{ color: "#aaa" }}>sin bono</span>}</Td>
                    <Td align="center">{pkg ? fmtDate(pkg.purchased) : "—"}</Td>
                    <Td align="center">
                      {pkg?.end ? (
                        <div>
                          <div>{fmtDate(pkg.end)}</div>
                          {daysLeft != null && <div style={{ fontSize: 9.5, fontWeight: 700, color: daysColor, marginTop: 2 }}>{daysLeft < 0 ? "caducado" : daysLeft === 0 ? "hoy" : `en ${daysLeft}d`}</div>}
                        </div>
                      ) : "—"}
                    </Td>
                    <Td align="right">
                      {pkg ? <strong style={{ fontSize: 14, color: pkg.remaining === 0 ? "#dc2626" : pkg.remaining <= 1 ? "#d97706" : "#065f46" }}>{pkg.remaining}<span style={{ fontSize: 10, color: "#888", fontWeight: 500 }}>/{pkg.total_bookings}</span></strong> : "—"}
                    </Td>
                    <Td align="right">{p.total_sessions}</Td>
                    <Td>{p.next_session ? <span style={{ color: PURPLE, fontWeight: 700, fontSize: 11.5 }}>{fmtNext(p.next_session)}</span> : <span style={{ color: "#aaa" }}>—</span>}</Td>
                    <Td>
                      <Link href={`/psicologo/pacientes/${p.customer_id}`} style={{ padding: "4px 8px", fontSize: 10.5, fontWeight: 700, background: PURPLE, color: "#fff", borderRadius: 6, textDecoration: "none" }}>→</Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && patients.length > 0 && view === "cards" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {patients.map((p) => (
            <Link key={p.customer_id} href={`/psicologo/pacientes/${p.customer_id}`} style={{ display: "block", padding: 14, background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", textDecoration: "none", color: "#1a1a2e" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>
                  {p.name.split(" ").map(n => n[0] ?? "").join("").slice(0, 2).toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 10.5, color: "#888" }}>{p.total_sessions} sesiones · {p.notes_count} notas</div>
                </div>
              </div>
              {p.active_package && (
                <div style={{ padding: "6px 8px", background: "rgba(16,185,129,0.08)", borderRadius: 6, fontSize: 11, marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, color: "#065f46" }}>🎫 {p.active_package.name}</div>
                  <div style={{ fontSize: 10, color: "#065f46" }}>
                    {p.active_package.remaining}/{p.active_package.total_bookings} restantes
                    {p.active_package.end && ` · vence ${fmtDate(p.active_package.end)}`}
                  </div>
                </div>
              )}
              {p.next_session && (
                <div style={{ fontSize: 11, color: PURPLE, fontWeight: 700, padding: "4px 8px", background: `${PURPLE}10`, borderRadius: 4, marginTop: 4 }}>
                  📅 próxima: {fmtNext(p.next_session)}
                </div>
              )}
              {p.last_session && !p.next_session && (
                <div style={{ fontSize: 10.5, color: "#888", marginTop: 4 }}>última: {fmtDate(p.last_session)}</div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Paginación */}
      {!loading && totalPages > 1 && (
        <nav aria-label="Paginación" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 16, flexWrap: "wrap" }}>
          <PageBtn disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Anterior</PageBtn>
          {pagesToShow.map((n, i) =>
            n === "…" ? (
              <span key={`gap-${i}`} style={{ padding: "6px 8px", fontSize: 12, color: "#aaa" }}>…</span>
            ) : (
              <PageBtn key={n} active={n === page} onClick={() => setPage(n)}>{n}</PageBtn>
            ),
          )}
          <PageBtn disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente →</PageBtn>
        </nav>
      )}
    </div>
  );
}

function buildPagination(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

function PageBtn({ children, onClick, active, disabled }: { children: React.ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: "6px 11px", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
        borderRadius: 6, cursor: disabled ? "default" : "pointer",
        border: active ? `1.5px solid ${PURPLE}` : "1px solid rgba(0,0,0,0.12)",
        background: active ? PURPLE : "#fff",
        color: active ? "#fff" : disabled ? "#cbd5e1" : "#475569",
        minWidth: 36,
      }}
    >{children}</button>
  );
}

function FilterChip({ children, active, onClick, color = PURPLE }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 11px", fontSize: 11.5, fontWeight: 700,
      borderRadius: 999,
      border: active ? `2px solid ${color}` : "1px solid rgba(0,0,0,0.1)",
      background: active ? color : "#fff",
      color: active ? "#fff" : "#475569",
      cursor: "pointer", fontFamily: "inherit",
    }}>{children}</button>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "center" | "right" }) {
  return <th style={{ padding: "10px 12px", textAlign: align, fontSize: 10.5, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>{children}</th>;
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "center" | "right" }) {
  return <td style={{ padding: "10px 12px", textAlign: align, verticalAlign: "middle" }}>{children}</td>;
}
