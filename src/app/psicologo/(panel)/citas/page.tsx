"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AttendanceQuick from "../../_components/AttendanceQuick";

const PURPLE = "#6A178C";
type Appt = { appointment_id: number; booking_start_utc: string; customer_name: string; service_name: string | null; google_meet_url: string | null; has_clinical_note: boolean; attended: boolean | null; booking_status: string; clinical_highlights: string | null };

export default function CitasPage() {
  const [range, setRange] = useState<"upcoming" | "today" | "week" | "past">("upcoming");
  const [data, setData] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/psicologa/appointments?range=${range}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { appointments: [] })
      .then(d => setData(d.appointments ?? []))
      .finally(() => setLoading(false));
  }, [range]);

  // Group by day
  const grouped = new Map<string, Appt[]>();
  for (const a of data) {
    const day = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(a.booking_start_utc));
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(a);
  }

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>📅 Mis citas</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {[["upcoming", "Próximas"], ["today", "Hoy"], ["week", "7 días"], ["past", "Pasadas"]].map(([k, l]) => (
            <button key={k} onClick={() => setRange(k as any)} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: range === k ? `2px solid ${PURPLE}` : "1px solid rgba(0,0,0,0.1)", background: range === k ? PURPLE : "#fff", color: range === k ? "#fff" : "#475569", cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </header>

      {loading && <div style={{ padding: 30, textAlign: "center", color: "#888" }}>Cargando…</div>}
      {!loading && data.length === 0 && <div style={{ padding: 30, background: "#fff", borderRadius: 12, color: "#888", fontSize: 13, textAlign: "center" }}>Sin citas en este rango.</div>}

      {Array.from(grouped.entries()).map(([day, ss]) => (
        <section key={day} style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>{new Date(ss[0].booking_start_utc).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" })}</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {ss.map(a => {
              const hr = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(a.booking_start_utc));
              return (
                <div key={a.appointment_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#fff", borderRadius: 12, border: a.booking_status === "canceled" ? "1px dashed #fecaca" : "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap" }}>
                  <Link href={`/psicologo/citas/${a.appointment_id}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flex: 1, minWidth: 200 }}>
                    <div style={{ minWidth: 50, fontSize: 16, fontWeight: 800, color: PURPLE }}>{hr}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{a.customer_name}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{a.service_name ?? "Sesión"}{a.booking_status === "canceled" && " · CANCELADA"}</div>
                      {a.clinical_highlights && <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic", marginTop: 3 }}>📝 {a.clinical_highlights.slice(0, 120)}</div>}
                    </div>
                  </Link>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {a.google_meet_url && (
                      <a href={a.google_meet_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 10px", background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 800, textDecoration: "none", boxShadow: "0 2px 6px rgba(22,163,74,0.25)" }}>📹 Meet</a>
                    )}
                    {a.booking_status !== "canceled" && (
                      <AttendanceQuick appointmentId={a.appointment_id} initial={a.attended ?? null} compact />
                    )}
                    <Link href={`/psicologo/citas/${a.appointment_id}`} title={a.has_clinical_note ? "Ver/editar nota clínica" : "✍️ Escribir nota clínica"} style={{ fontSize: 11, padding: "5px 10px", background: a.has_clinical_note ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)", color: a.has_clinical_note ? "#065f46" : "#92400e", borderRadius: 8, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap", border: a.has_clinical_note ? "1px solid rgba(16,185,129,0.3)" : "1px dashed rgba(245,158,11,0.4)" }}>
                      {a.has_clinical_note ? "✓ Nota" : "✍️ + Nota"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
