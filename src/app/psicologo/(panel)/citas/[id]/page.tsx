"use client";

import { use, useEffect, useRef, useState } from "react";
import PatientTasks from "../../../_components/PatientTasks";
import { RichTextarea, renderMarkdown } from "../../../_components/RichTextarea";
import DiagnosticoPDF from "../../../_components/DiagnosticoPDF";
import MeetLinkWithCCReminder from "../../../_components/MeetLinkWithCCReminder";
import Link from "next/link";

const PURPLE = "#6A178C";

type Appt = { appointment_id: number; booking_start_utc: string; booking_end_utc: string | null; service_name: string | null; google_meet_url: string | null; customer_id: number; customer_name: string; booking_status: string; is_diagnostico?: boolean };

// Secciones de la HC Inicial 9.99 (diagnóstico). Orden y etiquetas según el doc oficial.
const DIAG_IDENTITY: [string, string][] = [["edad", "Edad"], ["estado_civil", "Estado civil"], ["pais", "País"], ["ciudad", "Ciudad"]];
const DIAG_SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: "motivo_consulta", label: "Motivo de consulta", hint: "En palabras del usuario (entrecomillado), sintomatología principal y tiempo de evolución." },
  { key: "anamnesis", label: "Anamnesis", hint: "Antecedentes médicos, familiares, psicológicos, sociales y de desarrollo; situación actual y factores desencadenantes/de mantenimiento." },
  { key: "evaluacion_funciones", label: "Evaluación de funciones psicológicas", hint: "Atención, memoria, lenguaje, afecto, pensamiento, juicio y conducta motora observados en sesión." },
  { key: "impresion_diagnostica", label: "Impresión diagnóstica", hint: "Hipótesis clínica preliminar (criterios CIE/DSM)." },
  { key: "plan_intervencion", label: "Plan de intervención", hint: "Metas y objetivos a corto/mediano plazo, técnicas para próximas sesiones." },
  { key: "compromiso", label: "Compromiso", hint: "Tareas acordadas para el usuario entre sesiones." },
];
type Note = { highlights: string | null; how_went: string | null; patient_state: string | null; intervention: string | null; next_steps: string | null; homework: string | null; red_flags: string | null; attended: boolean | null; updated_at: string };
type HistEntry = { appointment_id: number; session_date: string; highlights: string | null; how_went: string | null; attended: boolean | null };

function fmt(iso: string) { return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)); }

// Asistencia derivada del estado real de Amelia cuando la psi aún no marcó nada
// en su nota. Semántica Mente Sana: pending=ASISTIÓ, no-show/rejected=NO asistió,
// approved=agendada/pendiente, canceled=cancelada.
function derivAttended(status?: string): boolean | null {
  if (status === "pending") return true;
  if (status === "no-show" || status === "rejected") return false;
  return null;
}

export default function CitaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [appt, setAppt] = useState<Appt | null>(null);
  const [note, setNote] = useState<Note>({ highlights: "", how_went: "", patient_state: "", intervention: "", next_steps: "", homework: "", red_flags: "", attended: null, updated_at: "" });
  const [diag, setDiag] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/psicologa/appointments/${id}`, { credentials: "include" });
      if (!r.ok) { setErr(r.status === 403 ? "Esta cita no es tuya" : "Error cargando"); return; }
      const d = await r.json();
      setAppt(d.appointment);
      setHistory(d.history ?? []);
      // Si la psi no marcó asistencia en su nota, la derivamos del estado real de
      // Amelia (soporte ya pudo marcarla) → fin de "veo Pendiente aunque asistió".
      const derivedAtt = typeof d.note?.attended === "boolean" ? d.note.attended : derivAttended(d.appointment?.booking_status);
      setNote({ highlights: d.note?.highlights ?? "", how_went: d.note?.how_went ?? "", patient_state: d.note?.patient_state ?? "", intervention: d.note?.intervention ?? "", next_steps: d.note?.next_steps ?? "", homework: d.note?.homework ?? "", red_flags: d.note?.red_flags ?? "", attended: derivedAtt, updated_at: d.note?.updated_at ?? "" });
      if (d.note?.diag_fields && typeof d.note.diag_fields === "object") setDiag(d.note.diag_fields);
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [id]);

  const [locked, setLocked] = useState<{ days: number; unlock_status: string } | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const [requestingUnlock, setRequestingUnlock] = useState(false);

  async function save() {
    setSaving(true); setSaved(false); setLocked(null);
    try {
      const r = await fetch(`/api/psicologa/appointments/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...note, diag_fields: diag, draft: false }) });
      if (r.ok) { setSaved(true); lastSavedRef.current = textKey; setTimeout(() => setSaved(false), 2500); return; }
      if (r.status === 423) {
        const d = await r.json();
        setLocked({ days: d.days_since_session ?? 0, unlock_status: d.unlock_status ?? "none" });
      }
    } finally { setSaving(false); }
  }

  // AUTOSAVE (borrador): persiste lo que va escribiendo sin tener que pulsar
  // Guardar (petición de Gabriela: anotar rápido y completar después). Manda
  // draft:true → no re-embebe en cada tecla; el cron embed-clinical-notes lo hace.
  const lastSavedRef = useRef<string>("");
  const [autoSaving, setAutoSaving] = useState(false);
  const textKey = JSON.stringify([note.highlights, note.how_went, note.patient_state, note.intervention, note.next_steps, note.homework, note.red_flags, diag]);
  useEffect(() => {
    if (loading || note.attended === false) return;
    if (lastSavedRef.current === "") { lastSavedRef.current = textKey; return; } // hidratación inicial
    if (textKey === lastSavedRef.current) return;
    const t = setTimeout(async () => {
      setAutoSaving(true);
      try {
        const r = await fetch(`/api/psicologa/appointments/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...note, diag_fields: diag, draft: true }) });
        if (r.ok) lastSavedRef.current = textKey;
      } catch { /* reintenta en el próximo cambio */ } finally { setAutoSaving(false); }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textKey, loading, note.attended]);

  // Sync rápido de asistencia (sin esperar al Guardar). Esta semana la psi
  // marca asistencia desde su panel; tras 2026-06-09 vuelve a ser solo soporte.
  async function quickSet(attended: boolean) {
    setNote(n => ({ ...n, attended }));
    try {
      await fetch(`/api/psicologa/appointments/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...note, attended }),
      });
    } catch {}
  }

  async function requestUnlock() {
    if (!unlockReason.trim()) { alert("Indica el motivo"); return; }
    setRequestingUnlock(true);
    const r = await fetch("/api/psicologa/hc-unlock", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointment_id: Number(id), reason: unlockReason }) });
    setRequestingUnlock(false);
    if (r.ok) {
      alert("✓ Solicitud enviada al jefe. Recibirás notificación cuando responda.");
      setLocked({ days: locked!.days, unlock_status: "pending" });
      setUnlockReason("");
    } else {
      alert("Error: " + ((await r.json()).message ?? ""));
    }
  }

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: "#888" }}>Cargando…</div>;
  if (err || !appt) return <div style={{ padding: 18, background: "#fef2f2", color: "#991b1b", borderRadius: 10 }}>⚠️ {err ?? "no encontrado"}</div>;

  return (
    <div>
      <Link href="/psicologo/citas" style={{ color: PURPLE, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>← Volver a citas</Link>

      <header style={{ padding: 20, background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", borderRadius: 16, marginTop: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{fmt(appt.booking_start_utc)}</div>
        <h1 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800 }}>{appt.customer_name}</h1>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{appt.service_name ?? "Sesión"}{appt.booking_status === "canceled" && " · CANCELADA"}</div>
        {appt.google_meet_url && (
          <MeetLinkWithCCReminder href={appt.google_meet_url} label="📹 Abrir Google Meet →" variant="pill-large" />
        )}
        {!appt.google_meet_url && appt.booking_status !== "canceled" && (
          <div style={{ display: "inline-block", marginTop: 14, padding: "8px 14px", background: "rgba(245,158,11,0.2)", color: "#fff", borderRadius: 10, fontSize: 12 }}>
            ⏳ Aún sin enlace Meet (Amelia lo genera tras la reserva)
          </div>
        )}
      </header>

      {/* Nav rapida a secciones */}
      <nav style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", padding: 10, background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
        <a href="#historial" style={{ padding: "8px 14px", fontSize: 12.5, fontWeight: 800, borderRadius: 8, background: `${PURPLE}12`, color: PURPLE, textDecoration: "none" }}>📝 Historial clínico</a>
        <a href="#tareas" style={{ padding: "8px 14px", fontSize: 12.5, fontWeight: 800, borderRadius: 8, background: `${PURPLE}12`, color: PURPLE, textDecoration: "none" }}>✅ Tareas paciente</a>
        <a href="#reportar" style={{ padding: "8px 14px", fontSize: 12.5, fontWeight: 800, borderRadius: 8, background: "rgba(220,38,38,0.08)", color: "#991b1b", textDecoration: "none" }}>💬 Reportar al jefe</a>
      </nav>

      {/* PDF Diagnóstico 9,99€ — destacado si es servicio diagnostico o primera sesión */}
      {(appt.service_name?.includes("9,99") || appt.service_name?.includes("9.99") || history.length === 0) && (
        <div style={{ marginBottom: 18 }}>
          <DiagnosticoPDF customerId={appt.customer_id} isFirstSession={history.length === 0} />
        </div>
      )}

      {/* Historial */}
      {history.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, color: "#1a1a2e", margin: "0 0 8px" }}>📚 Sesiones anteriores con {appt.customer_name.split(" ")[0]}</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {history.map(h => (
              <details key={h.appointment_id} style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)" }}>
                <summary style={{ padding: "10px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#1a1a2e", listStyle: "none" }}>
                  <span style={{ color: PURPLE }}>▸</span> {new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", year: "numeric" }).format(new Date(h.session_date))} {h.attended === false && "· ❌ no asistió"}
                  {h.highlights && <span style={{ fontWeight: 500, color: "#666", marginLeft: 8, fontSize: 11.5 }}>· {h.highlights.slice(0, 80)}</span>}
                </summary>
                <div style={{ padding: "0 14px 14px", fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                  {h.highlights && <div style={{ marginBottom: 6 }}><strong>Highlights:</strong> {renderMarkdown(h.highlights)}</div>}
                  {h.how_went && <div><strong>Cómo fue:</strong> {renderMarkdown(h.how_went)}</div>}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      <section id="historial" style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid rgba(0,0,0,0.06)", scrollMarginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: PURPLE, fontWeight: 800 }}>📝 Historial clínico de esta sesión</h2>
          {autoSaving
            ? <span style={{ fontSize: 10.5, color: PURPLE, fontWeight: 700 }}>💾 guardando borrador…</span>
            : note.updated_at && <span style={{ fontSize: 10.5, color: "#888" }}>Guardado hace {fmtRel(note.updated_at)} · se guarda solo</span>}
        </div>

        <div style={{ marginBottom: 14, padding: 12, background: note.attended === null ? "rgba(245,158,11,0.06)" : note.attended === false ? "rgba(220,38,38,0.04)" : "rgba(16,185,129,0.04)", border: `1px ${note.attended === null ? "dashed" : "solid"} ${note.attended === null ? "rgba(245,158,11,0.4)" : note.attended === false ? "rgba(220,38,38,0.25)" : "rgba(16,185,129,0.25)"}`, borderRadius: 10 }}>
          <label style={lbl}>🔑 Paso 1 · ¿Asistió el paciente?</label>
          <div style={{ fontSize: 10.5, color: "#666", marginBottom: 8 }}>
            {note.attended === null && "Marca asistencia primero para desbloquear historial + tareas."}
            {note.attended === true && "✓ Genial, ya puedes rellenar el historial clínico y las tareas debajo."}
            {note.attended === false && "Marcado como no-show. El historial queda bloqueado (no hay sesión que registrar)."}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => void quickSet(true)} style={pillBtn(note.attended === true, "#16a34a")}>✓ Sí, asistió</button>
            <button onClick={() => void quickSet(false)} style={pillBtn(note.attended === false, "#dc2626")}>✗ No asistió</button>
            <button onClick={() => setNote({ ...note, attended: null })} style={pillBtn(note.attended === null, "#888")}>— pendiente</button>
          </div>
        </div>

        {note.attended === false && (
          <div style={{ padding: 18, textAlign: "center", background: "rgba(220,38,38,0.04)", border: "1px dashed rgba(220,38,38,0.3)", borderRadius: 10, color: "#991b1b", fontSize: 13 }}>
            🔒 Historial clínico bloqueado — el paciente no asistió a esta sesión.
            <div style={{ fontSize: 11, marginTop: 4, color: "#7f1d1d" }}>Si te equivocaste, vuelve a marcar "Sí, asistió" arriba para desbloquear.</div>
          </div>
        )}

        {note.attended !== false && (
        <>
        {appt.is_diagnostico && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "inline-block", padding: "3px 10px", background: "rgba(106,23,140,0.1)", color: PURPLE, borderRadius: 999, fontSize: 11, fontWeight: 800, marginBottom: 12 }}>🩺 Historia Clínica Inicial · Diagnóstico 9,99€</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 12 }}>
              {DIAG_IDENTITY.map(([k, label]) => (
                <div key={k}>
                  <label style={lbl}>{label}</label>
                  <input value={diag[k] ?? ""} onChange={e => setDiag(d => ({ ...d, [k]: e.target.value }))} style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            {DIAG_SECTIONS.map(s => (
              <Field key={s.key} label={s.label} hint={s.hint}>
                <RichTextarea value={diag[s.key] ?? ""} onChange={v => setDiag(d => ({ ...d, [s.key]: v }))} minHeight={s.key === "anamnesis" ? 150 : 100} />
              </Field>
            ))}
            <Field label="🚨 Red flags / alertas (si las hubo)">
              <RichTextarea value={note.red_flags ?? ""} onChange={v => setNote({ ...note, red_flags: v })} accentDanger placeholder="Ideación suicida, autoagresión, sospecha de abuso, crisis…" minHeight={72} />
            </Field>
          </div>
        )}
        {!appt.is_diagnostico && (
        <>
        <Field label="✨ Highlights / lo más importante (1-2 frases que recordar)" hint="Para que en próximas sesiones recuerdes lo clave al instante">
          <textarea value={note.highlights ?? ""} onChange={e => setNote({ ...note, highlights: e.target.value })} rows={2} style={ta} placeholder="Ej: avance en límites con su madre; toca consolidar la próxima sesión" />
        </Field>

        <Field label="💬 ¿Cómo ha ido la sesión?" hint="Tu narrativa libre. Usa **negrita**, *cursiva* o viñetas para resaltar (p.ej. resultados de tests)">
          <RichTextarea value={note.how_went ?? ""} onChange={v => setNote({ ...note, how_went: v })} minHeight={130} />
        </Field>

        <Field label="🎭 Estado del paciente">
          <RichTextarea value={note.patient_state ?? ""} onChange={v => setNote({ ...note, patient_state: v })} placeholder="Estado emocional, mood, energía, postura…" />
        </Field>

        <Field label="🛠️ Intervención clínica realizada">
          <RichTextarea value={note.intervention ?? ""} onChange={v => setNote({ ...note, intervention: v })} placeholder="Técnicas usadas, ejercicios, modelo terapéutico aplicado" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="🎯 Plan próxima sesión">
            <RichTextarea value={note.next_steps ?? ""} onChange={v => setNote({ ...note, next_steps: v })} />
          </Field>
          <Field label="📚 Tareas para casa">
            <RichTextarea value={note.homework ?? ""} onChange={v => setNote({ ...note, homework: v })} />
          </Field>
        </div>

        <Field label="🚨 Red flags / alertas (si las hubo)">
          <RichTextarea value={note.red_flags ?? ""} onChange={v => setNote({ ...note, red_flags: v })} accentDanger placeholder="Ideación suicida, autoagresión, sospecha de abuso, crisis…" minHeight={72} />
        </Field>
        </>
        )}

        {locked && (
          <div style={{ marginTop: 14, padding: 16, background: locked.unlock_status === "pending" ? "rgba(217,119,6,0.06)" : "rgba(220,38,38,0.06)", border: `1px solid ${locked.unlock_status === "pending" ? "#d97706" : "#dc2626"}`, borderRadius: 10 }}>
            <strong style={{ fontSize: 13, color: locked.unlock_status === "pending" ? "#92400e" : "#991b1b" }}>🔒 HC bloqueada</strong>
            <p style={{ margin: "4px 0 10px", fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
              Han pasado <strong>{locked.days} días</strong> desde esta cita. Pasados 7 días necesitas autorización del jefe para editar la historia clínica.
            </p>
            {locked.unlock_status === "pending" ? (
              <div style={{ padding: 8, background: "rgba(217,119,6,0.1)", borderRadius: 6, fontSize: 12, color: "#92400e", fontWeight: 700 }}>⏳ Solicitud enviada. Esperando decisión del jefe.</div>
            ) : (
              <>
                <textarea value={unlockReason} onChange={e => setUnlockReason(e.target.value)} rows={2} placeholder="Motivo (ej: estaba enferma esos días, urgencia familiar…)" style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
                <button onClick={requestUnlock} disabled={requestingUnlock} style={{ marginTop: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#fff", background: "#d97706", border: "none", borderRadius: 6, cursor: "pointer", opacity: requestingUnlock ? 0.5 : 1 }}>{requestingUnlock ? "Enviando…" : "📨 Pedir autorización al jefe"}</button>
              </>
            )}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          {saved && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ Guardado</span>}
          <button onClick={() => void save()} disabled={saving} style={{ marginLeft: "auto", padding: "10px 24px", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: saving ? 0.5 : 1 }}>
            {saving ? "Guardando…" : "💾 Guardar historial"}
          </button>
        </div>
        </>
        )}
      </section>

      {/* Tareas para el paciente — solo si asistió */}
      <div id="tareas" style={{ marginBottom: 20, scrollMarginTop: 20 }}>
        {note.attended === true ? (
          <PatientTasks customerId={appt.customer_id} appointmentId={appt.appointment_id} patientFirstName={appt.customer_name.split(" ")[0]} />
        ) : (
          <section style={{ padding: 20, background: note.attended === null ? "rgba(245,158,11,0.04)" : "rgba(220,38,38,0.04)", border: `1px dashed ${note.attended === null ? "rgba(245,158,11,0.3)" : "rgba(220,38,38,0.25)"}`, borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: note.attended === null ? "#92400e" : "#991b1b", marginBottom: 4 }}>
              🔒 Tareas paciente bloqueadas
            </div>
            <p style={{ margin: 0, fontSize: 12, color: note.attended === null ? "#92400e" : "#7f1d1d", lineHeight: 1.5 }}>
              {note.attended === null ? "Marca primero si el paciente asistió arriba 👆 para desbloquear las tareas." : "El paciente no asistió a esta sesión, así que no hay tareas que asignar."}
            </p>
          </section>
        )}
      </div>

      <section id="reportar" style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 12, padding: 14, scrollMarginTop: 20 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#991b1b" }}>
          ¿Algo del paciente que reportar al jefe? <Link href={`/psicologo/quejas?customer_id=${appt.customer_id}&appointment_id=${appt.appointment_id}`} style={{ color: "#dc2626", fontWeight: 700, textDecoration: "underline" }}>Abrir reporte interno →</Link>
        </p>
      </section>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      {hint && <div style={{ fontSize: 10.5, color: "#888", marginBottom: 4 }}>{hint}</div>}
      {children}
    </div>
  );
}

function fmtRel(iso: string): string {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function pillBtn(active: boolean, color: string): React.CSSProperties {
  return { padding: "6px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: active ? `2px solid ${color}` : "1px solid rgba(0,0,0,0.1)", background: active ? color : "#fff", color: active ? "#fff" : "#475569", cursor: "pointer", fontFamily: "inherit" };
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 };
// minHeight más generoso + resize vertical: campos amplios y expandibles para
// las que escriben registros largos (petición de Brenda Castillo).
const ta: React.CSSProperties = { width: "100%", padding: "10px 12px", fontSize: 13, lineHeight: 1.6, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", minHeight: 96 };
