"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AttendanceQuick from "../_components/AttendanceQuick";
import WelcomeBanner from "../_components/WelcomeBanner";
import MyTasks from "@/components/MyTasks";

const PURPLE = "#6A178C";
const DIAGNOSTICO_IDS = [8, 11];

type Appt = {
  appointment_id: number;
  booking_start_utc: string;
  customer_name: string;
  service_id: number;
  service_name: string | null;
  google_meet_url: string | null;
  has_clinical_note: boolean;
  attended: boolean | null;
  booking_status: string;
};

function fmtHr(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
function fmtDay(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "short" }).format(new Date(iso));
}

export default function DashboardPage() {
  const [today, setToday] = useState<Appt[]>([]);
  const [week, setWeek] = useState<Appt[]>([]);
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/psicologa/appointments?range=today", { credentials: "include" }).then(r => r.ok ? r.json() : { appointments: [] }),
      fetch("/api/psicologa/appointments?range=week", { credentials: "include" }).then(r => r.ok ? r.json() : { appointments: [] }),
      fetch("/api/psicologa/whoami", { credentials: "include" }).then(r => r.ok ? r.json() : { profile: null }),
    ]).then(([t, w, who]) => {
      setToday(t.appointments ?? []);
      setWeek(w.appointments ?? []);
      setFirstName(who.profile?.first_name ?? who.profile?.name?.split(" ")[0] ?? "");
    }).finally(() => setLoading(false));
  }, []);

  const todayActive = today.filter(a => a.booking_status !== "canceled");
  const diagnosticosToday = todayActive.filter(a => DIAGNOSTICO_IDS.includes(a.service_id)).length;
  const pendingNotes = week.filter(a => !a.has_clinical_note && new Date(a.booking_start_utc) < new Date() && a.booking_status === "approved").length;
  const nextAppt = todayActive
    .map(a => ({ ...a, _ts: new Date(a.booking_start_utc).getTime() }))
    .filter(a => a._ts > Date.now())
    .sort((a, b) => a._ts - b._ts)[0] ?? null;

  return (
    <div>
      <WelcomeBanner firstName={firstName} todayCount={todayActive.length} diagnosticosToday={diagnosticosToday} nextAppt={nextAppt as any} />

      <MyTasks api="/api/psicologa/tasks" />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 22 }}>
        <Kpi label="📅 Hoy" value={today.length} color={PURPLE} />
        <Kpi label="📆 Esta semana" value={week.length} color="#0891b2" />
        <Kpi label="📝 Notas pendientes" value={pendingNotes} color={pendingNotes > 0 ? "#dc2626" : "#888"} sub={pendingNotes > 0 ? "rellena tras sesión" : "todo al día"} />
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 18, color: "#1a1a2e", margin: "0 0 10px" }}>📅 Hoy</h2>
        {loading && <div style={{ color: "#888" }}>Cargando…</div>}
        {!loading && today.length === 0 && <div style={{ padding: 24, background: "#fff", borderRadius: 12, color: "#888", fontSize: 13, textAlign: "center" }}>Sin citas hoy. Disfruta del descanso 🌿</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {today.map(a => <ApptCard key={a.appointment_id} a={a} />)}
        </div>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ fontSize: 18, color: "#1a1a2e", margin: 0 }}>📆 Próximos 7 días</h2>
          <Link href="/psicologo/citas" style={{ color: PURPLE, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ver todas →</Link>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {week.slice(0, 6).map(a => <ApptCard key={a.appointment_id} a={a} showDay />)}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div style={{ padding: 14, background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ApptCard({ a, showDay = false }: { a: Appt; showDay?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap" }}>
      <Link href={`/psicologo/citas/${a.appointment_id}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flex: 1, minWidth: 200 }}>
        <div style={{ minWidth: 60 }}>
          {showDay && <div style={{ fontSize: 10, color: "#888", textTransform: "capitalize" }}>{fmtDay(a.booking_start_utc)}</div>}
          <div style={{ fontSize: 16, fontWeight: 800, color: PURPLE }}>{fmtHr(a.booking_start_utc)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{a.customer_name}</div>
          <div style={{ fontSize: 11, color: "#666" }}>{a.service_name ?? "Sesión"}</div>
        </div>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {a.google_meet_url && (
          <a href={a.google_meet_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 12px", background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 800, textDecoration: "none", boxShadow: "0 2px 6px rgba(22,163,74,0.25)" }}>📹 Meet</a>
        )}
        <AttendanceQuick appointmentId={a.appointment_id} initial={a.attended ?? null} compact />
        <Link href={`/psicologo/citas/${a.appointment_id}`} title={a.has_clinical_note ? "Ver/editar nota clínica" : "✍️ Escribir nota clínica"} style={{ fontSize: 11, padding: "5px 10px", background: a.has_clinical_note ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)", color: a.has_clinical_note ? "#065f46" : "#92400e", borderRadius: 8, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap", border: a.has_clinical_note ? "1px solid rgba(16,185,129,0.3)" : "1px dashed rgba(245,158,11,0.4)" }}>
          {a.has_clinical_note ? "✓ Nota" : "✍️ + Nota"}
        </Link>
      </div>
    </div>
  );
}
