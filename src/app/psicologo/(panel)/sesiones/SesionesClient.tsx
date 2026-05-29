"use client";
import { useEffect, useState } from "react";

const PURPLE = "#6A178C";

type Note = {
  id: string; session_hash: string; summary_md: string; raw_excerpt: string;
  status: string; meet_started_at: string | null; meet_ended_at: string | null;
  created_at: string; patient_alias: string | null; approved_at: string | null;
};

export default function SesionesClient() {
  const [tab, setTab] = useState<"draft" | "approved">("draft");
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{ summary_md: string; patient_alias: string } | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/psicologa/sessions/list?status=${tab}`, { cache: "no-store" });
    const j = await r.json();
    setNotes(j.notes ?? []); setLoading(false);
  }
  useEffect(() => { load(); }, [tab]);

  const current = notes.find(n => n.id === open);

  async function save(approve: boolean) {
    if (!current || !edit) return;
    await fetch(`/api/psicologa/sessions/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary_md: edit.summary_md, patient_alias: edit.patient_alias, ...(approve ? { status: "approved" } : {}) }),
    });
    setOpen(null); setEdit(null); load();
  }

  async function discard() {
    if (!current) return;
    if (!confirm("¿Descartar esta sesión? No se indexará al asistente.")) return;
    await fetch(`/api/psicologa/sessions/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "discarded" }) });
    setOpen(null); load();
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: PURPLE, marginBottom: 16 }}>Sesiones grabadas</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("draft")} style={tabStyle(tab === "draft")}>Pendientes revisión</button>
        <button onClick={() => setTab("approved")} style={tabStyle(tab === "approved")}>Aprobadas (en RAG)</button>
      </div>

      {loading ? <div>Cargando…</div> : notes.length === 0 ? (
        <div style={{ background: "#fff", padding: 28, borderRadius: 12, textAlign: "center", color: "#64748B" }}>
          {tab === "draft" ? "Cuando termines una sesión de Meet, aparecerá aquí para que la revises antes de aprobarla." : "No tienes sesiones aprobadas todavía."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {notes.map(n => (
            <button key={n.id} onClick={() => { setOpen(n.id); setEdit({ summary_md: n.summary_md, patient_alias: n.patient_alias ?? "" }); }}
              style={{ textAlign: "left", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>{n.patient_alias || `Sesión ${n.session_hash.slice(0, 8)}`}</b>
                <small style={{ color: "#64748B" }}>{new Date(n.created_at).toLocaleString()}</small>
              </div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 6, maxHeight: 40, overflow: "hidden" }}>{n.summary_md.split("\n").slice(0, 3).join(" · ")}</div>
            </button>
          ))}
        </div>
      )}

      {current && edit && (
        <div onClick={() => { setOpen(null); setEdit(null); }} style={modalBg}>
          <div onClick={e => e.stopPropagation()} style={modalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ color: PURPLE, margin: 0 }}>Revisar resumen</h2>
              <button onClick={() => { setOpen(null); setEdit(null); }} style={{ background: "transparent", border: 0, fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <label style={lbl}>Alias del paciente (solo tú lo ves)</label>
            <input value={edit.patient_alias} onChange={e => setEdit({ ...edit, patient_alias: e.target.value })} placeholder="Ej. María (Madrid, ansiedad)" style={inp} />
            <label style={lbl}>Resumen clínico (Markdown — edítalo si hace falta)</label>
            <textarea value={edit.summary_md} onChange={e => setEdit({ ...edit, summary_md: e.target.value })} style={{ ...inp, minHeight: 260, fontFamily: "monospace", fontSize: 13 }} />
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", color: "#64748B", fontSize: 12 }}>Ver excerpt anonimizado de la sesión</summary>
              <pre style={{ background: "#F9FAFB", padding: 10, borderRadius: 8, fontSize: 11, whiteSpace: "pre-wrap", marginTop: 8 }}>{current.raw_excerpt}</pre>
            </details>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={discard} style={{ ...btn, background: "#fff", color: "#EF4444", border: "1px solid #EF4444" }}>Descartar</button>
              <button onClick={() => save(false)} style={{ ...btn, background: "#fff", color: PURPLE, border: `1px solid ${PURPLE}` }}>Guardar borrador</button>
              <button onClick={() => save(true)} style={{ ...btn, background: PURPLE, color: "#fff" }}>Aprobar e indexar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const tabStyle = (active: boolean) => ({ padding: "8px 14px", borderRadius: 8, border: `1px solid ${active ? PURPLE : "#E5E7EB"}`, background: active ? PURPLE : "#fff", color: active ? "#fff" : "#475569", fontWeight: 600, cursor: "pointer", fontSize: 13 });
const modalBg = { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 };
const modalCard = { background: "#fff", borderRadius: 12, padding: 24, maxWidth: 720, width: "100%", maxHeight: "90vh", overflowY: "auto" as const };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginTop: 10, marginBottom: 4 };
const inp = { width: "100%", padding: 10, border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, boxSizing: "border-box" as const };
const btn = { padding: "10px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 };
