"use client";

import { useEffect, useState } from "react";
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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtNext(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

export default function PacientesPage() {
  const [data, setData] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");
  const [filter, setFilter] = useState<"all" | "with_package" | "package_expiring">("all");

  useEffect(() => {
    fetch("/api/psicologa/patients", { credentials: "include" })
      .then(r => r.ok ? r.json() : { patients: [] })
      .then(d => setData(d.patients ?? []))
      .finally(() => setLoading(false));
  }, []);

  let filtered = data;
  if (q.trim()) filtered = filtered.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  if (filter === "with_package") filtered = filtered.filter(p => p.active_package != null);
  if (filter === "package_expiring") filtered = filtered.filter(p => p.active_package?.end && new Date(p.active_package.end).getTime() - Date.now() < 30 * 86400000);

  const withActivePackage = data.filter(p => p.active_package != null).length;
  const expiringPackages = data.filter(p => p.active_package?.end && new Date(p.active_package.end).getTime() - Date.now() < 30 * 86400000).length;

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>👥 Mis pacientes</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
            {data.length} pacientes · {withActivePackage} con bono activo · datos de contacto ocultos por confidencialidad
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre…" style={{ padding: "8px 12px", fontSize: 13, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, minWidth: 200, fontFamily: "inherit" }} />
          <div style={{ display: "flex", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, overflow: "hidden" }}>
            <button onClick={() => setView("table")} style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, border: "none", background: view === "table" ? PURPLE : "#fff", color: view === "table" ? "#fff" : "#475569", cursor: "pointer" }}>📊 Tabla</button>
            <button onClick={() => setView("cards")} style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, border: "none", borderLeft: "1px solid rgba(0,0,0,0.1)", background: view === "cards" ? PURPLE : "#fff", color: view === "cards" ? "#fff" : "#475569", cursor: "pointer" }}>🃏 Tarjetas</button>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todos ({data.length})</FilterChip>
        <FilterChip active={filter === "with_package"} onClick={() => setFilter("with_package")} color="#16a34a">🎫 Con bono activo ({withActivePackage})</FilterChip>
        <FilterChip active={filter === "package_expiring"} onClick={() => setFilter("package_expiring")} color="#d97706">⏳ Bono caduca pronto ({expiringPackages})</FilterChip>
      </div>

      {loading && <div style={{ padding: 30, textAlign: "center", color: "#888" }}>Cargando…</div>}
      {!loading && filtered.length === 0 && <div style={{ padding: 30, background: "#fff", borderRadius: 12, textAlign: "center", color: "#aaa" }}>Sin pacientes para este filtro.</div>}

      {!loading && filtered.length > 0 && view === "table" && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
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
              {filtered.map(p => {
                const pkg = p.active_package;
                const daysLeft = pkg?.end ? Math.floor((new Date(pkg.end).getTime() - Date.now()) / 86400000) : null;
                const daysColor = daysLeft != null && daysLeft <= 30 ? "#dc2626" : daysLeft != null && daysLeft <= 60 ? "#d97706" : "#475569";
                return (
                  <tr key={p.customer_id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                    <Td>
                      <Link href={`/psicologo/pacientes/${p.customer_id}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1a1a2e" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                          {p.name.split(" ").map(n => n[0] ?? "").join("").slice(0,2).toUpperCase() || "?"}
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

      {!loading && filtered.length > 0 && view === "cards" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {filtered.map(p => (
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
    </div>
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
