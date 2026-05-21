"use client";

import { useEffect, useState } from "react";

const PURPLE = "#6A178C";

type Task = { id: string; title: string; description: string | null; due_date: string | null; status: "pending" | "done" | "dismissed"; created_at: string; sent_to_patient_at: string | null };

export default function PatientTasks({ customerId, appointmentId, patientFirstName }: { customerId: number; appointmentId?: number; patientFirstName?: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ customer_id: String(customerId) });
    const r = await fetch(`/api/psicologa/patient-tasks?${params}`, { credentials: "include" });
    if (r.ok) setTasks((await r.json()).tasks ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [customerId]);

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/psicologa/patient-tasks", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, appointment_id: appointmentId, title, description, due_date: dueDate || null }),
      });
      if (r.ok) { setTitle(""); setDescription(""); setDueDate(""); setShowForm(false); void load(); }
    } finally { setSaving(false); }
  }

  async function toggle(t: Task) {
    const next = t.status === "done" ? "pending" : "done";
    await fetch(`/api/psicologa/patient-tasks/${t.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    void load();
  }
  async function del(id: string) {
    if (!confirm("¿Borrar tarea?")) return;
    await fetch(`/api/psicologa/patient-tasks/${id}`, { method: "DELETE", credentials: "include" });
    void load();
  }
  async function sendByEmail() {
    if (!confirm(`Enviar las tareas pendientes al paciente por email?`)) return;
    setSendingEmail(true);
    try {
      const r = await fetch("/api/psicologa/patient-tasks/send-email", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId }) });
      const d = await r.json();
      if (r.ok) { alert(`✅ ${d.sent} tareas enviadas a ${d.recipient_masked}`); void load(); }
      else alert("❌ " + (d.message ?? d.error));
    } finally { setSendingEmail(false); }
  }

  const pending = tasks.filter(t => t.status === "pending");
  const done = tasks.filter(t => t.status === "done");

  return (
    <section style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: PURPLE, fontWeight: 800 }}>📝 Tareas para {patientFirstName ?? "el paciente"}</h3>
        <div style={{ display: "flex", gap: 6 }}>
          {pending.length > 0 && (
            <button onClick={() => void sendByEmail()} disabled={sendingEmail} style={{ padding: "6px 12px", fontSize: 11.5, fontWeight: 700, borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: "#065f46", cursor: "pointer", opacity: sendingEmail ? 0.5 : 1 }}>
              {sendingEmail ? "Enviando…" : `📨 Enviar por email (${pending.length})`}
            </button>
          )}
          {!showForm && <button onClick={() => setShowForm(true)} style={{ padding: "6px 12px", fontSize: 11.5, fontWeight: 800, borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", cursor: "pointer" }}>+ Nueva tarea</button>}
        </div>
      </div>

      {showForm && (
        <div style={{ padding: 12, background: "rgba(106,23,140,0.04)", borderRadius: 10, marginBottom: 12, border: `1px dashed ${PURPLE}44` }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Diario emocional 3 veces al día" autoFocus style={{ ...inp, marginBottom: 8 }} />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción / instrucciones (opcional)" rows={3} style={{ ...inp, resize: "vertical", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#888", fontWeight: 700 }}>Fecha objetivo (opcional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ ...inp, width: 160 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <button onClick={() => { setShowForm(false); setTitle(""); setDescription(""); setDueDate(""); }} style={btnGhost}>Cancelar</button>
            <button onClick={() => void create()} disabled={!title.trim() || saving} style={{ ...btnPrim, opacity: !title.trim() || saving ? 0.5 : 1 }}>{saving ? "Añadiendo…" : "Añadir tarea"}</button>
          </div>
        </div>
      )}

      {loading && <div style={{ color: "#888", fontSize: 12, padding: 8 }}>Cargando…</div>}
      {!loading && tasks.length === 0 && !showForm && <div style={{ padding: 18, color: "#aaa", fontSize: 12, textAlign: "center", fontStyle: "italic" }}>Sin tareas todavía. Añade alguna después de la sesión 🌿</div>}

      {pending.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          {pending.map(t => <TaskRow key={t.id} t={t} onToggle={() => void toggle(t)} onDelete={() => void del(t.id)} />)}
        </div>
      )}
      {done.length > 0 && (
        <details>
          <summary style={{ fontSize: 11, color: "#888", cursor: "pointer", fontWeight: 700, marginBottom: 6 }}>✓ {done.length} completadas</summary>
          <div style={{ display: "grid", gap: 6 }}>
            {done.map(t => <TaskRow key={t.id} t={t} onToggle={() => void toggle(t)} onDelete={() => void del(t.id)} />)}
          </div>
        </details>
      )}
    </section>
  );
}

function TaskRow({ t, onToggle, onDelete }: { t: Task; onToggle: () => void; onDelete: () => void }) {
  const done = t.status === "done";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 10, background: done ? "rgba(0,0,0,0.02)" : "#fff", border: `1px solid ${done ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.08)"}`, borderRadius: 10, opacity: done ? 0.6 : 1 }}>
      <input type="checkbox" checked={done} onChange={onToggle} style={{ marginTop: 3, width: 18, height: 18, accentColor: PURPLE, cursor: "pointer" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", textDecoration: done ? "line-through" : "none" }}>{t.title}</div>
        {t.description && <div style={{ fontSize: 11.5, color: "#666", marginTop: 2, lineHeight: 1.4, whiteSpace: "pre-line" }}>{t.description}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 10, color: "#888", flexWrap: "wrap" }}>
          {t.due_date && <span style={{ color: PURPLE, fontWeight: 700 }}>📅 {new Date(t.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>}
          {t.sent_to_patient_at && <span style={{ color: "#065f46", fontWeight: 700 }}>📨 enviada</span>}
          <span>creada {new Date(t.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
        </div>
      </div>
      <button onClick={onDelete} title="Borrar" style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" };
const btnPrim: React.CSSProperties = { padding: "7px 14px", fontSize: 12, fontWeight: 800, borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", cursor: "pointer", fontFamily: "inherit" };
const btnGhost: React.CSSProperties = { padding: "7px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", color: "#475569", cursor: "pointer", fontFamily: "inherit" };
