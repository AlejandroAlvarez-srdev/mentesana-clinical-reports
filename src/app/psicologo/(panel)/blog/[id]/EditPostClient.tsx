"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PURPLE = "#6A178C";

interface Post {
  id: string;
  keyword: string;
  title: string;
  slug: string;
  body_md: string;
  status: string;
  scheduled_for: string | null;
  hero_url: string | null;
}

export default function EditPostClient({ post }: { post: Post }) {
  const router = useRouter();
  const [title, setTitle] = useState(post.title);
  const [bodyMd, setBodyMd] = useState(post.body_md);
  const [scheduledFor, setScheduledFor] = useState(post.scheduled_for ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function save(opts?: { schedule?: boolean; clearSchedule?: boolean }) {
    setLoading(true); setError(null);
    try {
      const payload: Record<string, unknown> = { title, body_md: bodyMd };
      if (opts?.schedule && scheduledFor) payload.scheduled_for = new Date(scheduledFor).toISOString();
      if (opts?.clearSchedule) payload.scheduled_for = null;
      const r = await fetch(`/api/psicologa/blog/drafts/${post.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "error"); return; }
      setSavedAt(new Date().toLocaleTimeString("es-ES"));
    } finally { setLoading(false); }
  }

  async function publishNow() {
    await save();
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/psicologa/blog/publish", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "error_publicar"); return; }
      router.push("/psicologo/blog");
    } finally { setLoading(false); }
  }

  async function archive() {
    if (!confirm("¿Archivar este borrador? Podrás recuperarlo desde soporte.")) return;
    const r = await fetch(`/api/psicologa/blog/drafts/${post.id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) router.push("/psicologo/blog");
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Link href="/psicologo/blog" style={{ color: PURPLE, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>← Volver</Link>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1a1a2e", flex: 1 }}>Editar artículo</h1>
        {savedAt && <span style={{ fontSize: 11, color: "#065f46", fontWeight: 600 }}>✓ Guardado {savedAt}</span>}
      </header>

      <p style={{ fontSize: 11.5, color: "#666", margin: "0 0 10px" }}>
        Keyword: <code style={{ background: "#f5f5f7", padding: "2px 8px", borderRadius: 4, color: PURPLE }}>{post.keyword}</code>
        {" · "}slug: <code style={{ background: "#f5f5f7", padding: "2px 8px", borderRadius: 4 }}>/{post.slug}</code>
      </p>

      {error && <div style={{ padding: 10, marginBottom: 14, background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>❌ {error}</div>}

      <div style={card}>
        <Label>Título</Label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} />

        <div style={{ height: 14 }} />

        <Label>Cuerpo (markdown)</Label>
        <textarea value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} rows={20} style={{ ...input, fontFamily: "ui-monospace, monospace", minHeight: 380, resize: "vertical" }} />
        <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>{bodyMd.split(/\s+/).filter(Boolean).length} palabras</p>

        <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button onClick={archive} style={{ ...secondaryBtn(false), borderColor: "#fecaca", color: "#991b1b" }}>🗑️ Archivar</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => save()} disabled={loading} style={secondaryBtn(loading)}>💾 Guardar</button>
            <button onClick={publishNow} disabled={loading || bodyMd.length < 100} style={primaryBtn(loading || bodyMd.length < 100)}>
              🚀 Publicar ahora
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14, padding: 12, background: `${PURPLE}06`, borderRadius: 10, border: `1px dashed ${PURPLE}33` }}>
          <Label>Programar para fecha</Label>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <input
              type="datetime-local"
              value={scheduledFor ? new Date(scheduledFor).toISOString().slice(0, 16) : ""}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              style={{ ...input, flex: 1, minWidth: 200 }}
            />
            <button onClick={() => save({ schedule: true })} disabled={!scheduledFor || loading} style={secondaryBtn(!scheduledFor || loading)}>📅 Programar</button>
            {post.status === "scheduled" && (
              <button onClick={() => { setScheduledFor(""); save({ clearSchedule: true }); }} style={secondaryBtn(false)}>Cancelar programación</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 22, border: "1px solid rgba(0,0,0,0.05)" };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const primaryBtn = (d: boolean): React.CSSProperties => ({
  padding: "11px 18px", borderRadius: 8, border: "none",
  background: d ? "rgba(0,0,0,0.06)" : PURPLE, color: d ? "#888" : "#fff",
  fontSize: 13, fontWeight: 700, cursor: d ? "default" : "pointer",
});
const secondaryBtn = (d: boolean): React.CSSProperties => ({
  padding: "11px 16px", borderRadius: 8, border: `1.5px solid ${d ? "rgba(0,0,0,0.1)" : PURPLE}`,
  background: "#fff", color: d ? "#888" : PURPLE,
  fontSize: 13, fontWeight: 700, cursor: d ? "default" : "pointer",
});
const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11, fontWeight: 800, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{children}</div>
);
