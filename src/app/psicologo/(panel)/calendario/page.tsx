"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MeetLinkWithCCReminder from "../../_components/MeetLinkWithCCReminder";

const PURPLE = "#6A178C";
type Appt = { appointment_id: number; booking_start_utc: string; customer_name: string; service_name: string | null; google_meet_url: string | null; has_clinical_note: boolean; booking_status: string };

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

export default function CalendarioPage() {
  const [month, setMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [data, setData] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  // Detalle del día — drawer con lista de citas + botón Meet con
  // recordatorio de subtítulos
  const [dayDetail, setDayDetail] = useState<{ key: string; date: Date; appts: Appt[] } | null>(null);

  useEffect(() => {
    setLoading(true);
    // pedimos un rango más amplio y filtramos en cliente
    fetch("/api/psicologa/appointments?range=upcoming", { credentials: "include" })
      .then(r => r.ok ? r.json() : { appointments: [] })
      .then(d => setData(d.appointments ?? []))
      .finally(() => setLoading(false));
    fetch("/api/psicologa/appointments?range=past", { credentials: "include" })
      .then(r => r.ok ? r.json() : { appointments: [] })
      .then(d => setData(prev => [...prev, ...(d.appointments ?? [])]));
  }, []);

  // Build month grid
  const first = new Date(month.year, month.month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // lunes=0
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const cells: { date: Date | null }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(month.year, month.month, d) });

  const byDay = new Map<string, Appt[]>();
  for (const a of data) {
    const d = new Date(a.booking_start_utc);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(a);
  }

  const today = new Date();
  const isToday = (d: Date) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  return (
    <div>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>🗓️ Calendario</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 })} style={navBtn}>←</button>
          <strong style={{ fontSize: 16, color: PURPLE, textTransform: "capitalize", minWidth: 160, textAlign: "center" }}>{MONTHS[month.month]} {month.year}</strong>
          <button onClick={() => setMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 })} style={navBtn}>→</button>
          <button onClick={() => { const d = new Date(); setMonth({ year: d.getFullYear(), month: d.getMonth() }); }} style={{ ...navBtn, background: PURPLE, color: "#fff", border: "none" }}>Hoy</button>
        </div>
      </header>

      <div style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
          {WEEKDAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: "#888", padding: "4px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((c, i) => {
            if (!c.date) return <div key={i} />;
            const key = `${c.date.getFullYear()}-${String(c.date.getMonth()+1).padStart(2,"0")}-${String(c.date.getDate()).padStart(2,"0")}`;
            const appts = (byDay.get(key) ?? []).filter(a => a.booking_status !== "canceled");
            const dayDate = c.date;
            const hasAppts = appts.length > 0;
            return (
              <button
                key={i}
                onClick={() => hasAppts && setDayDetail({ key, date: dayDate, appts })}
                disabled={!hasAppts}
                style={{ minHeight: 90, padding: 6, background: isToday(dayDate) ? `${PURPLE}15` : "#fafafa", borderRadius: 8, border: isToday(dayDate) ? `2px solid ${PURPLE}` : "1px solid rgba(0,0,0,0.04)", textAlign: "left", cursor: hasAppts ? "pointer" : "default", fontFamily: "inherit", transition: "transform .12s" }}
                aria-label={hasAppts ? `Ver ${appts.length} citas del ${dayDate.getDate()}` : `${dayDate.getDate()} sin citas`}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: isToday(dayDate) ? PURPLE : "#475569", marginBottom: 4 }}>{dayDate.getDate()}</div>
                <div style={{ display: "grid", gap: 2 }}>
                  {appts.slice(0, 3).map(a => {
                    const hr = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(a.booking_start_utc));
                    return (
                      <div key={a.appointment_id} style={{ padding: "2px 4px", background: a.has_clinical_note ? "rgba(16,185,129,0.15)" : `${PURPLE}10`, borderRadius: 4, fontSize: 9.5, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${hr} ${a.customer_name}`}>
                        <strong>{hr}</strong> {a.customer_name.split(" ")[0]}
                      </div>
                    );
                  })}
                  {appts.length > 3 && <div style={{ fontSize: 9, color: "#888", textAlign: "center" }}>+{appts.length - 3}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div style={{ marginTop: 12, color: "#888", fontSize: 12 }}>Cargando citas…</div>}

      {/* DRAWER del detalle del día — lista de citas con Meet + CC reminder */}
      {dayDetail && <DayDrawer detail={dayDetail} onClose={() => setDayDetail(null)} />}
    </div>
  );
}

function DayDrawer({ detail, onClose }: { detail: { key: string; date: Date; appts: Appt[] }; onClose: () => void }) {
  const dayLabel = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(detail.date);
  const sorted = [...detail.appts].sort((a, b) => new Date(a.booking_start_utc).getTime() - new Date(b.booking_start_utc).getTime());

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,8,25,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9998, display: "flex", justifyContent: "center", alignItems: "flex-end", animation: "ccFadeIn 0.18s ease-out" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: 22, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -20px 80px rgba(0,0,0,0.25)" }}
      >
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: PURPLE }}>Detalle del día</div>
            <h2 style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 20, fontWeight: 500, margin: "4px 0 0", color: "#1a0a1f", textTransform: "capitalize" }}>{dayLabel}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>{sorted.length} {sorted.length === 1 ? "cita" : "citas"}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "rgba(0,0,0,0.05)", border: "none", color: "#475569", width: 32, height: 32, borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </header>

        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map((a) => {
            const hr = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(a.booking_start_utc));
            return (
              <div key={a.appointment_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "#fafafa", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 50 }}>
                  <strong style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 18, color: PURPLE, letterSpacing: -0.5, lineHeight: 1 }}>{hr}</strong>
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a0a1f" }}>{a.customer_name}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{a.service_name ?? "Sesión"}{a.has_clinical_note ? " · ✓ HC" : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {a.google_meet_url && <MeetLinkWithCCReminder href={a.google_meet_url} />}
                  <Link href={`/psicologo/citas/${a.appointment_id}`} onClick={onClose} style={{ padding: "6px 10px", background: PURPLE, color: "#fff", borderRadius: 8, fontSize: 11, fontWeight: 800, textDecoration: "none" }}>Ver →</Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes ccFadeIn { from { opacity: 0 } to { opacity: 1 } }" }} />
    </div>
  );
}

const navBtn: React.CSSProperties = { padding: "6px 12px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", color: "#475569", cursor: "pointer", fontFamily: "inherit" };
