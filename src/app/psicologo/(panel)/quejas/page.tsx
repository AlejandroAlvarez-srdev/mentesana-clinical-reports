"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const PURPLE = "#6A178C";
type Attachment = { url: string; filename: string; mime_type?: string | null; size_bytes?: number | null };
type Complaint = { id: string; subject: string; description: string | null; severity: string; status: string; admin_response: string | null; created_at: string; resolved_at: string | null; attachments?: Attachment[] | null };

async function uploadReportFile(file: File): Promise<Attachment | null> {
  const r = await fetch("/api/psicologa/complaints/upload", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name }) });
  if (!r.ok) return null;
  const { signedUrl, publicUrl } = await r.json();
  const up = await fetch(signedUrl, { method: "PUT", body: file, headers: { "x-upsert": "true", "Content-Type": file.type || "application/octet-stream" } });
  if (!up.ok) return null;
  return { url: publicUrl, filename: file.name, mime_type: file.type, size_bytes: file.size };
}

const SEV_META: Record<string, { color: string; emoji: string }> = {
  baja: { color: "#64748b", emoji: "ℹ️" },
  media: { color: "#d97706", emoji: "🟡" },
  alta: { color: "#dc2626", emoji: "🔥" },
  urgente: { color: "#991b1b", emoji: "🚨" },
};
const STATUS_META: Record<string, { color: string; label: string }> = {
  open: { color: "#0891b2", label: "Abierta" },
  reviewing: { color: "#d97706", label: "Revisando" },
  resolved: { color: "#16a34a", label: "Resuelta" },
  dismissed: { color: "#888", label: "Descartada" },
};

function QuejasInner() {
  const sp = useSearchParams();
  const cidParam = sp.get("customer_id");
  const apptParam = sp.get("appointment_id");
  const [showForm, setShowForm] = useState(!!cidParam);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"baja" | "media" | "alta" | "urgente">("media");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/psicologa/complaints", { credentials: "include" });
    if (r.ok) setList((await r.json()).complaints ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function submit() {
    if (!subject.trim()) return;
    setSaving(true);
    try {
      const uploaded: Attachment[] = [];
      for (const f of files) { const u = await uploadReportFile(f); if (u) uploaded.push(u); }
      const r = await fetch("/api/psicologa/complaints", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, severity, attachments: uploaded, customer_id: cidParam ? Number(cidParam) : null, appointment_id: apptParam ? Number(apptParam) : null }),
      });
      if (r.ok) {
        setSubject(""); setDescription(""); setSeverity("media"); setFiles([]);
        setShowForm(false);
        void load();
      }
    } finally { setSaving(false); }
  }

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>💬 Reportes al jefe</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>Comunícate de forma privada con el jefe de psicólogas sobre cualquier tema</p>
        </div>
        {!showForm && <button onClick={() => setShowForm(true)} style={{ padding: "8px 16px", background: PURPLE, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ Nuevo reporte</button>}
      </header>

      {showForm && (
        <section style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 18, border: `2px solid ${PURPLE}33` }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: PURPLE }}>✍️ Nuevo reporte interno</h3>
          {cidParam && <div style={{ padding: 8, background: "rgba(106,23,140,0.06)", borderRadius: 6, fontSize: 11.5, color: PURPLE, marginBottom: 10 }}>Asociado al paciente #{cidParam}{apptParam && ` · cita #${apptParam}`}</div>}
          <Field label="Asunto"><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ej: paciente con conducta agresiva en sesión" style={inp} /></Field>
          <Field label="Descripción"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} placeholder="Cuenta libremente lo que necesites comunicar al jefe. Confidencial." style={{ ...inp, resize: "vertical", minHeight: 120 }} /></Field>
          <Field label="Severidad">
            <div style={{ display: "flex", gap: 4 }}>
              {(["baja", "media", "alta", "urgente"] as const).map(s => (
                <button key={s} onClick={() => setSeverity(s)} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: severity === s ? `2px solid ${SEV_META[s].color}` : "1px solid rgba(0,0,0,0.1)", background: severity === s ? SEV_META[s].color : "#fff", color: severity === s ? "#fff" : "#475569", cursor: "pointer", textTransform: "capitalize" }}>
                  {SEV_META[s].emoji} {s}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Adjuntos (opcional)">
            <label style={{ display: "inline-block", padding: "6px 12px", background: "#fff", border: `1px dashed ${PURPLE}`, borderRadius: 6, fontSize: 11.5, fontWeight: 700, color: PURPLE, cursor: "pointer" }}>
              📎 Adjuntar archivos
              <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files ?? []))} style={{ display: "none" }} />
            </label>
            {files.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {files.map((f, i) => (
                  <span key={i} style={{ padding: "3px 8px", background: "rgba(106,23,140,0.1)", color: PURPLE, borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>{f.name} <button onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ marginLeft: 4, background: "none", border: "none", color: PURPLE, cursor: "pointer" }}>×</button></span>
                ))}
              </div>
            )}
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "8px 14px", background: "#fff", color: "#475569", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
            <button onClick={() => void submit()} disabled={!subject.trim() || saving} style={{ padding: "8px 18px", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", opacity: !subject.trim() || saving ? 0.5 : 1 }}>{saving ? "Enviando…" : "📨 Enviar al jefe"}</button>
          </div>
        </section>
      )}

      {loading && <div style={{ padding: 30, textAlign: "center", color: "#888" }}>Cargando…</div>}
      {!loading && list.length === 0 && !showForm && <div style={{ padding: 30, background: "#fff", borderRadius: 12, color: "#aaa", fontSize: 13, textAlign: "center" }}>Sin reportes. Puedes abrir uno cuando lo necesites.</div>}

      <div style={{ display: "grid", gap: 10 }}>
        {list.map(c => {
          const sev = SEV_META[c.severity] ?? SEV_META.media;
          const st = STATUS_META[c.status] ?? STATUS_META.open;
          return (
            <div key={c.id} style={{ padding: 14, background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", borderLeft: `4px solid ${sev.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <strong style={{ fontSize: 14, color: "#1a1a2e" }}>{sev.emoji} {c.subject}</strong>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", background: `${st.color}20`, color: st.color, borderRadius: 4 }}>{st.label}</span>
                  <span style={{ fontSize: 10.5, color: "#888" }}>{new Date(c.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
                </div>
              </div>
              {c.description && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>{c.description}</p>}
              {c.attachments && c.attachments.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {c.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ padding: "3px 8px", background: "rgba(106,23,140,0.08)", color: PURPLE, borderRadius: 4, fontSize: 10.5, fontWeight: 600, textDecoration: "none" }}>📎 {a.filename}</a>
                  ))}
                </div>
              )}
              {c.admin_response && (
                <div style={{ marginTop: 10, padding: 10, background: "rgba(106,23,140,0.04)", borderRadius: 8, borderLeft: `3px solid ${PURPLE}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: PURPLE, textTransform: "uppercase", marginBottom: 3 }}>Respuesta del jefe</div>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#1a1a2e" }}>{c.admin_response}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{label}</label>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontFamily: "inherit", boxSizing: "border-box" };

export default function QuejasPage() {
  return <Suspense fallback={<div style={{ padding: 30, textAlign: "center", color: "#888" }}>Cargando…</div>}><QuejasInner /></Suspense>;
}
