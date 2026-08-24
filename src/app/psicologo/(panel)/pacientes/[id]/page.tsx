"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import PatientTasks from "../../../_components/PatientTasks";
import DiagnosticoPDF from "../../../_components/DiagnosticoPDF";
import BienvenidaMotivos from "../../../_components/BienvenidaMotivos";
import EncuadreInforme from "../../../_components/EncuadreInforme";

const PURPLE = "#6A178C";
const GOLD = "#D4AF37";
type Session = { appointment_id: number; booking_start_utc: string; service_name: string | null; google_meet_url: string | null; booking_status: string };
type Package = { id: number; name: string; start: string | null; end: string | null; total_bookings: number; used_bookings: number; remaining: number };
type Note = { id: string; appointment_id: number; session_date: string; highlights: string | null; how_went: string | null; patient_state: string | null; intervention: string | null; next_steps: string | null; homework: string | null; red_flags: string | null; attended: boolean | null; provider_id?: number | null };

export default function PacienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ patient: { customer_id: number; name: string; first_name: string }; sessions: Session[]; packages: Package[]; notes: Note[]; previous_notes_other_psi?: Note[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/psicologa/patients/${id}`, { credentials: "include" })
      .then(async r => { if (!r.ok) { setErr(r.status === 403 ? "Este paciente no es tuyo" : "Error"); return null; } return r.json(); })
      .then(d => d && setData(d));
  }, [id]);

  if (err) return <div style={{ padding: 18, background: "#fef2f2", color: "#991b1b", borderRadius: 10 }}>⚠️ {err}</div>;
  if (!data) return <div style={{ padding: 30, textAlign: "center", color: "#888" }}>Cargando…</div>;

  return (
    <div>
      <Link href="/psicologo/pacientes" style={{ color: PURPLE, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>← Volver a pacientes</Link>

      <header style={{ padding: 20, background: "#fff", borderRadius: 16, marginTop: 10, marginBottom: 18, border: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22 }}>
            {data.patient.name.split(" ").map(n => n[0] ?? "").join("").slice(0,2).toUpperCase() || "?"}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>{data.patient.name}</h1>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#888" }}>{data.sessions.length} sesiones · {data.notes.length} notas clínicas</p>
            <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "#aaa", fontStyle: "italic" }}>(datos de contacto ocultos por confidencialidad)</p>
          </div>
        </div>
      </header>

      {/* PDF diagnóstico */}
      <div style={{ marginBottom: 18 }}>
        <DiagnosticoPDF customerId={data.patient.customer_id} />
      </div>

      {/* Informe del test de 30 (solo si la paciente viene del tercer embudo) */}
      <EncuadreInforme customerId={data.patient.customer_id} />

      {/* Motivos de la cita de bienvenida (solo aparece si el paciente hizo ese test) */}
      <div style={{ marginBottom: 18 }}>
        <BienvenidaMotivos customerId={data.patient.customer_id} />
      </div>

      {data.packages.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, color: "#1a1a2e", margin: "0 0 8px" }}>🎫 Bonos activos</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {data.packages.map(p => (
              <div key={p.id} style={{ padding: 12, background: "#fff", borderRadius: 10, border: "1px solid rgba(16,185,129,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
                  <strong style={{ fontSize: 13 }}>{p.name}</strong>
                  <span style={{ fontSize: 11, fontWeight: 800, color: p.remaining > 0 ? "#065f46" : "#dc2626" }}>{p.remaining}/{p.total_bookings} restantes</span>
                </div>
                {p.end && <div style={{ fontSize: 10.5, color: "#888", marginTop: 2 }}>vigente hasta {new Date(p.end).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ marginBottom: 18 }}>
        <PatientTasks customerId={data.patient.customer_id} patientFirstName={data.patient.first_name || data.patient.name.split(" ")[0]} />
      </div>

      {(data.previous_notes_other_psi?.length ?? 0) > 0 && (
        <section style={{ marginBottom: 18 }}>
          {/* Banner "hermoso" — gradient morado→oro sutil, borde izquierdo oro,
              acento eyebrow, tipografía serif en H2. Comunica continuidad
              clínica sin agobiar. */}
          <div
            style={{
              position: "relative",
              padding: "18px 20px",
              background: `linear-gradient(135deg, ${PURPLE}0D 0%, ${GOLD}14 100%)`,
              border: `1px solid ${GOLD}55`,
              borderLeft: `4px solid ${GOLD}`,
              borderRadius: 14,
              marginBottom: 12,
              boxShadow: `0 6px 20px rgba(106,23,140,0.06)`,
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 100,
                height: 100,
                background: `radial-gradient(circle, ${GOLD}22, transparent 70%)`,
                borderRadius: "50%",
              }}
            />
            <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  boxShadow: `0 4px 12px rgba(106,23,140,0.25)`,
                }}
              >
                🩺
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, letterSpacing: 1.2, color: GOLD, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>
                  Contexto clínico previo
                </div>
                <h2 style={{ margin: 0, fontSize: 17, color: "#1a1a2e", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 500, lineHeight: 1.25 }}>
                  Este paciente estuvo antes con <em style={{ color: PURPLE }}>otra psicóloga</em>
                </h2>
                <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
                  {data.previous_notes_other_psi!.length} {data.previous_notes_other_psi!.length === 1 ? "sesión documentada" : "sesiones documentadas"} · read-only para continuidad clínica
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {data.previous_notes_other_psi!.map((n) => {
              const transferida = /transferida|heredada/i.test((n.next_steps ?? "") + (n.highlights ?? ""));
              return (
                <details
                  key={n.id}
                  style={{
                    background: "#fff",
                    borderRadius: 10,
                    border: `1px solid ${GOLD}33`,
                    borderLeft: `3px solid ${GOLD}`,
                  }}
                >
                  <summary style={{ padding: "10px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#1a1a2e", listStyle: "none", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: GOLD }}>▸</span>
                    <span>
                      {new Date(n.session_date).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    {n.provider_id && (
                      <span style={{ fontSize: 10, padding: "1px 6px", background: "rgba(106,23,140,0.08)", color: PURPLE, borderRadius: 3, letterSpacing: 0.3, fontWeight: 700 }}>
                        Ps. #{n.provider_id}
                      </span>
                    )}
                    {transferida && (
                      <span style={{ fontSize: 10, padding: "1px 6px", background: `${GOLD}22`, color: "#7a5a00", borderRadius: 3, fontWeight: 700, letterSpacing: 0.3 }}>
                        ✋ TRANSFERIDA
                      </span>
                    )}
                    {n.attended === false && <span style={{ fontSize: 10, padding: "1px 5px", background: "#fee", color: "#991b1b", borderRadius: 3 }}>NO ASISTIÓ</span>}
                    {n.red_flags && <span style={{ fontSize: 10, padding: "1px 5px", background: "rgba(220,38,38,0.14)", color: "#991b1b", borderRadius: 3 }}>🚨 red flag</span>}
                    {n.highlights && <span style={{ fontWeight: 500, color: "#666", marginLeft: 4, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>· {n.highlights}</span>}
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8", fontStyle: "italic", fontWeight: 500 }}>read-only</span>
                  </summary>
                  <div style={{ padding: "0 14px 14px", fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
                    {n.how_went && <Section title="💬 Cómo fue">{n.how_went}</Section>}
                    {n.patient_state && <Section title="🎭 Estado paciente">{n.patient_state}</Section>}
                    {n.intervention && <Section title="🛠️ Intervención">{n.intervention}</Section>}
                    {n.next_steps && <Section title="🎯 Plan próxima">{n.next_steps}</Section>}
                    {n.homework && <Section title="📚 Tareas casa">{n.homework}</Section>}
                    {n.red_flags && <Section title="🚨 Red flags" danger>{n.red_flags}</Section>}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, color: "#1a1a2e", margin: "0 0 8px" }}>📝 Historial clínico</h2>
        {data.notes.length === 0 ? <div style={{ padding: 20, background: "#fff", borderRadius: 10, color: "#aaa", fontSize: 13, textAlign: "center" }}>Aún no has escrito notas clínicas de este paciente.</div> : (
          <div style={{ display: "grid", gap: 6 }}>
            {data.notes.map(n => (
              <details key={n.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)" }}>
                <summary style={{ padding: "10px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#1a1a2e", listStyle: "none", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: PURPLE }}>▸</span>
                  <span>{new Date(n.session_date).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", year: "numeric" })}</span>
                  {n.attended === false && <span style={{ fontSize: 10, padding: "1px 5px", background: "#fee", color: "#991b1b", borderRadius: 3 }}>NO ASISTIÓ</span>}
                  {n.red_flags && <span style={{ fontSize: 10, padding: "1px 5px", background: "rgba(220,38,38,0.14)", color: "#991b1b", borderRadius: 3 }}>🚨 red flag</span>}
                  {n.highlights && <span style={{ fontWeight: 500, color: "#666", marginLeft: 8, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {n.highlights}</span>}
                  <Link href={`/psicologo/citas/${n.appointment_id}`} style={{ marginLeft: "auto", fontSize: 10.5, color: PURPLE, fontWeight: 700 }}>editar →</Link>
                </summary>
                <div style={{ padding: "0 14px 14px", fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
                  {n.how_went && <Section title="💬 Cómo fue">{n.how_went}</Section>}
                  {n.patient_state && <Section title="🎭 Estado paciente">{n.patient_state}</Section>}
                  {n.intervention && <Section title="🛠️ Intervención">{n.intervention}</Section>}
                  {n.next_steps && <Section title="🎯 Plan próxima">{n.next_steps}</Section>}
                  {n.homework && <Section title="📚 Tareas casa">{n.homework}</Section>}
                  {n.red_flags && <Section title="🚨 Red flags" danger>{n.red_flags}</Section>}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16, color: "#1a1a2e", margin: "0 0 8px" }}>📅 Sesiones</h2>
        <div style={{ display: "grid", gap: 4 }}>
          {data.sessions.map(s => (
            <Link key={s.appointment_id} href={`/psicologo/citas/${s.appointment_id}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.04)", fontSize: 12, color: "#1a1a2e", textDecoration: "none" }}>
              <span style={{ fontWeight: 700, color: PURPLE, minWidth: 110 }}>{new Date(s.booking_start_utc).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", year: "numeric" })}</span>
              <span style={{ minWidth: 50, color: "#666" }}>{new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(s.booking_start_utc))}</span>
              <span style={{ flex: 1, color: "#888" }}>{s.service_name}</span>
              {s.booking_status === "canceled" ? <span style={{ fontSize: 9, padding: "1px 5px", background: "#fee", color: "#991b1b", borderRadius: 3, fontWeight: 700 }}>CANC</span> : <span style={{ fontSize: 9, padding: "1px 5px", background: "rgba(16,185,129,0.14)", color: "#065f46", borderRadius: 3, fontWeight: 700 }}>OK</span>}
            </Link>
          ))}
        </div>
      </section>

      <div style={{ marginTop: 24, padding: 12, background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 10 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#991b1b" }}>
          ¿Necesitas reportar algo sobre este paciente al jefe? <Link href={`/psicologo/quejas?customer_id=${data.patient.customer_id}`} style={{ color: "#dc2626", fontWeight: 700, textDecoration: "underline" }}>Abrir reporte interno →</Link>
        </p>
      </div>
    </div>
  );
}

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{ marginBottom: 8, padding: 8, background: danger ? "rgba(220,38,38,0.06)" : "rgba(0,0,0,0.02)", borderRadius: 6, borderLeft: danger ? "3px solid #dc2626" : "3px solid rgba(106,23,140,0.3)" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: danger ? "#991b1b" : PURPLE, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "#1a1a2e", whiteSpace: "pre-line" }}>{children}</div>
    </div>
  );
}
