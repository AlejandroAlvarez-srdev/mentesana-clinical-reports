"use client";

import { useEffect, useRef, useState } from "react";

const PURPLE = "#6A178C";

type Task = { id: string; title: string; description: string | null; due_date: string | null; status: "pending" | "done" | "dismissed"; created_at: string; sent_to_patient_at: string | null };
type Attachment = { id: string; task_id: string; message_id: string | null; url: string; filename: string; mime_type: string | null; size_bytes: number | null; uploaded_by: "psicologa" | "patient"; uploaded_at: string };
type Message = { id: string; task_id: string; author: "psicologa" | "patient"; body: string | null; created_at: string; read_at: string | null };

export default function PatientTasks({ customerId, appointmentId, patientFirstName }: { customerId: number; appointmentId?: number; patientFirstName?: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [counts, setCounts] = useState<Record<string, { attachments: number; messages: number; unread_from_patient: number }>>({});
  const [openTask, setOpenTask] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ customer_id: String(customerId) });
    const r = await fetch(`/api/psicologa/patient-tasks?${params}`, { credentials: "include" });
    if (r.ok) {
      const d = await r.json();
      setTasks(d.tasks ?? []);
      // Carga counts en paralelo
      const map: Record<string, any> = {};
      await Promise.all((d.tasks ?? []).map(async (t: Task) => {
        const mr = await fetch(`/api/psicologa/patient-tasks/${t.id}/messages`, { credentials: "include" });
        if (mr.ok) {
          const md = await mr.json();
          map[t.id] = {
            attachments: (md.attachments ?? []).length,
            messages: (md.messages ?? []).length,
            unread_from_patient: (md.messages ?? []).filter((m: Message) => m.author === "patient" && !m.read_at).length,
          };
        }
      }));
      setCounts(map);
    }
    setLoading(false);
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [customerId]);

  const uploadFile = uploadTaskFile;

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/psicologa/patient-tasks", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, appointment_id: appointmentId, title, description, due_date: dueDate || null }),
      });
      if (!r.ok) { setSaving(false); return; }
      const { task } = await r.json();

      // Sube los archivos pendientes y los liga a la tarea (raíz, no a un mensaje)
      if (pendingFiles.length > 0 && task?.id) {
        const uploaded: any[] = [];
        for (const f of pendingFiles) {
          const u = await uploadFile(task.id, f);
          if (u) uploaded.push(u);
        }
        if (uploaded.length > 0) {
          await fetch(`/api/psicologa/patient-tasks/${task.id}/attachments`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attachments: uploaded }) });
        }
      }
      setTitle(""); setDescription(""); setDueDate(""); setPendingFiles([]); setShowForm(false);
      void load();
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
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, color: "#888", fontWeight: 700 }}>Fecha objetivo (opcional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ ...inp, width: 160 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "inline-block", padding: "6px 10px", background: "#fff", border: `1px dashed ${PURPLE}`, borderRadius: 6, fontSize: 11.5, fontWeight: 700, color: PURPLE, cursor: "pointer" }}>
              📎 Adjuntar archivos
              <input type="file" multiple onChange={e => setPendingFiles(Array.from(e.target.files ?? []))} style={{ display: "none" }} />
            </label>
            {pendingFiles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {pendingFiles.map((f, i) => (
                  <span key={i} style={{ padding: "3px 8px", background: "rgba(106,23,140,0.1)", color: PURPLE, borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>{f.name} <button onClick={() => setPendingFiles(pendingFiles.filter((_, j) => j !== i))} style={{ marginLeft: 4, background: "none", border: "none", color: PURPLE, cursor: "pointer" }}>×</button></span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <button onClick={() => { setShowForm(false); setTitle(""); setDescription(""); setDueDate(""); setPendingFiles([]); }} style={btnGhost}>Cancelar</button>
            <button onClick={() => void create()} disabled={!title.trim() || saving} style={{ ...btnPrim, opacity: !title.trim() || saving ? 0.5 : 1 }}>{saving ? "Subiendo…" : "Añadir tarea"}</button>
          </div>
        </div>
      )}

      {loading && <div style={{ color: "#888", fontSize: 12, padding: 8 }}>Cargando…</div>}
      {!loading && tasks.length === 0 && !showForm && <div style={{ padding: 18, color: "#aaa", fontSize: 12, textAlign: "center", fontStyle: "italic" }}>Sin tareas todavía. Añade alguna después de la sesión 🌿</div>}

      {pending.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          {pending.map(t => <TaskRow key={t.id} t={t} counts={counts[t.id]} open={openTask === t.id} onOpen={() => setOpenTask(openTask === t.id ? null : t.id)} onToggle={() => void toggle(t)} onDelete={() => void del(t.id)} onReload={load} uploadFile={uploadFile} />)}
        </div>
      )}
      {done.length > 0 && (
        <details>
          <summary style={{ fontSize: 11, color: "#888", cursor: "pointer", fontWeight: 700, marginBottom: 6 }}>✓ {done.length} completadas</summary>
          <div style={{ display: "grid", gap: 6 }}>
            {done.map(t => <TaskRow key={t.id} t={t} counts={counts[t.id]} open={openTask === t.id} onOpen={() => setOpenTask(openTask === t.id ? null : t.id)} onToggle={() => void toggle(t)} onDelete={() => void del(t.id)} onReload={load} uploadFile={uploadFile} />)}
          </div>
        </details>
      )}
    </section>
  );
}

function TaskRow({ t, counts, open, onOpen, onToggle, onDelete, onReload, uploadFile }: { t: Task; counts?: { attachments: number; messages: number; unread_from_patient: number }; open: boolean; onOpen: () => void; onToggle: () => void; onDelete: () => void; onReload: () => void; uploadFile: (taskId: string, file: File) => Promise<any> }) {
  const done = t.status === "done";
  const unread = counts?.unread_from_patient ?? 0;
  return (
    <div style={{ background: done ? "rgba(0,0,0,0.02)" : "#fff", border: `1px solid ${done ? "rgba(0,0,0,0.05)" : unread > 0 ? "#16a34a" : "rgba(0,0,0,0.08)"}`, borderRadius: 10, opacity: done ? 0.7 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 10 }}>
        <input type="checkbox" checked={done} onChange={onToggle} style={{ marginTop: 3, width: 18, height: 18, accentColor: PURPLE, cursor: "pointer" }} />
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={onOpen}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", textDecoration: done ? "line-through" : "none" }}>{t.title}</div>
          {t.description && <div style={{ fontSize: 11.5, color: "#666", marginTop: 2, lineHeight: 1.4, whiteSpace: "pre-line" }}>{t.description}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 10, color: "#888", flexWrap: "wrap", alignItems: "center" }}>
            {t.due_date && <span style={{ color: PURPLE, fontWeight: 700 }}>📅 {new Date(t.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>}
            {t.sent_to_patient_at && <span style={{ color: "#065f46", fontWeight: 700 }}>📨 enviada</span>}
            {counts && counts.attachments > 0 && <span style={{ color: "#0891b2", fontWeight: 700 }}>📎 {counts.attachments}</span>}
            {counts && counts.messages > 0 && <span style={{ color: "#475569", fontWeight: 700 }}>💬 {counts.messages}</span>}
            {unread > 0 && <span style={{ padding: "1px 6px", background: "#16a34a", color: "#fff", borderRadius: 4, fontWeight: 800, fontSize: 9.5 }}>✉️ {unread} nuevo{unread > 1 ? "s" : ""}</span>}
            <span>creada {new Date(t.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
          </div>
        </div>
        <button onClick={onDelete} title="Borrar" style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
      </div>
      {open && <TaskThread taskId={t.id} onChange={onReload} uploadFile={uploadFile} />}
    </div>
  );
}

// Subidor reutilizable (lo usa también el panel central de Tareas).
export async function uploadTaskFile(taskId: string, file: File): Promise<{ url: string; storage_path: string; filename: string; mime_type: string; size_bytes: number } | null> {
  const r = await fetch(`/api/psicologa/patient-tasks/${taskId}/upload`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name }) });
  if (!r.ok) return null;
  const { signedUrl, path, publicUrl } = await r.json();
  const up = await fetch(signedUrl, { method: "PUT", body: file, headers: { "x-upsert": "true", "Content-Type": file.type || "application/octet-stream" } });
  if (!up.ok) return null;
  return { url: publicUrl, storage_path: path, filename: file.name, mime_type: file.type, size_bytes: file.size };
}

export function TaskThread({ taskId, onChange, uploadFile = uploadTaskFile }: { taskId: string; onChange: () => void; uploadFile?: (taskId: string, file: File) => Promise<any> }) {
  const [data, setData] = useState<{ messages: Message[]; attachments: Attachment[] } | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const r = await fetch(`/api/psicologa/patient-tasks/${taskId}/messages`, { credentials: "include" });
    if (r.ok) setData(await r.json());
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [taskId]);

  async function send() {
    if (!body.trim() && files.length === 0) return;
    setSending(true);
    try {
      const uploaded: any[] = [];
      for (const f of files) {
        const u = await uploadFile(taskId, f);
        if (u) uploaded.push(u);
      }
      await fetch(`/api/psicologa/patient-tasks/${taskId}/messages`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, attachments: uploaded }),
      });
      setBody(""); setFiles([]); if (fileInputRef.current) fileInputRef.current.value = "";
      await load(); onChange();
    } finally { setSending(false); }
  }

  if (!data) return <div style={{ padding: 10, color: "#888", fontSize: 11 }}>Cargando thread…</div>;

  const rootAttachments = data.attachments.filter(a => !a.message_id);

  return (
    <div style={{ padding: "0 12px 12px", borderTop: "1px dashed rgba(0,0,0,0.06)" }}>
      {rootAttachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0" }}>
          <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, alignSelf: "center" }}>📎 Adjuntos tarea:</span>
          {rootAttachments.map(a => (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{ padding: "3px 8px", background: a.uploaded_by === "patient" ? "rgba(16,163,74,0.1)" : "rgba(106,23,140,0.08)", color: a.uploaded_by === "patient" ? "#065f46" : PURPLE, borderRadius: 4, fontSize: 10.5, fontWeight: 600, textDecoration: "none" }}>
              {a.uploaded_by === "patient" ? "🟢" : "📄"} {a.filename}
            </a>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 6, maxHeight: 280, overflowY: "auto", padding: "6px 0" }}>
        {data.messages.length === 0 && <div style={{ padding: 8, color: "#aaa", fontSize: 11, fontStyle: "italic", textAlign: "center" }}>Aún sin mensajes. Escribe el primero abajo.</div>}
        {data.messages.map(m => {
          const isPsi = m.author === "psicologa";
          const msgAtts = data.attachments.filter(a => a.message_id === m.id);
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: isPsi ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "85%", padding: 8, background: isPsi ? "rgba(106,23,140,0.08)" : "rgba(16,163,74,0.08)", borderRadius: 8, fontSize: 12 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: isPsi ? PURPLE : "#065f46", letterSpacing: 0.3, marginBottom: 3 }}>{isPsi ? "TÚ" : "PACIENTE"} · {new Date(m.created_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                {m.body && <div style={{ color: "#1a1a2e", whiteSpace: "pre-line", lineHeight: 1.4 }}>{m.body}</div>}
                {msgAtts.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {msgAtts.map(a => <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{ padding: "2px 6px", background: "#fff", borderRadius: 3, fontSize: 10, color: PURPLE, fontWeight: 600, textDecoration: "none" }}>📎 {a.filename}</a>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "flex-start", paddingTop: 8 }}>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Responder al paciente…" rows={2} style={{ ...inp, flex: 1, resize: "vertical", fontSize: 12 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ padding: "5px 8px", background: "#fff", border: "1px dashed rgba(0,0,0,0.15)", borderRadius: 5, fontSize: 11, fontWeight: 700, color: "#475569", cursor: "pointer", textAlign: "center" }}>
            📎
            <input ref={fileInputRef} type="file" multiple onChange={e => setFiles(Array.from(e.target.files ?? []))} style={{ display: "none" }} />
          </label>
          <button onClick={() => void send()} disabled={(!body.trim() && files.length === 0) || sending} style={{ ...btnPrim, padding: "5px 10px", fontSize: 11, opacity: (!body.trim() && files.length === 0) || sending ? 0.5 : 1 }}>{sending ? "…" : "Enviar"}</button>
        </div>
      </div>
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
          {files.map((f, i) => <span key={i} style={{ padding: "2px 6px", background: "rgba(0,0,0,0.04)", borderRadius: 3, fontSize: 10 }}>{f.name}</span>)}
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" };
const btnPrim: React.CSSProperties = { padding: "7px 14px", fontSize: 12, fontWeight: 800, borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", cursor: "pointer", fontFamily: "inherit" };
const btnGhost: React.CSSProperties = { padding: "7px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", color: "#475569", cursor: "pointer", fontFamily: "inherit" };
