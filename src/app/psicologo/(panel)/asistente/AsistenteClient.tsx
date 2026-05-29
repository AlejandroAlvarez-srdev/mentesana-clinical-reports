"use client";
import { useState } from "react";

const PURPLE = "#6A178C";

type Msg = { role: "user" | "assistant"; text: string; sources?: any[] };

export default function AsistenteClient() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    const question = q.trim(); if (!question) return;
    setQ(""); setLoading(true);
    setMsgs(m => [...m, { role: "user", text: question }]);
    try {
      const r = await fetch("/api/rag/sessions/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const j = await r.json();
      setMsgs(m => [...m, { role: "assistant", text: j.answer || j.error || "Sin respuesta", sources: j.sources }]);
    } catch { setMsgs(m => [...m, { role: "assistant", text: "Error de red" }]); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: PURPLE, marginBottom: 6 }}>Asistente Mente Sana</h1>
      <p style={{ color: "#64748B", fontSize: 13, marginBottom: 18 }}>Pregúntame sobre tus sesiones aprobadas. Solo accedo a tus notas — nadie más las ve.</p>

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {msgs.length === 0 && (
          <div style={{ background: "#FAF5FF", padding: 16, borderRadius: 10, color: "#475569", fontSize: 13 }}>
            <b>Ideas para preguntar:</b>
            <ul style={{ marginTop: 6, marginBottom: 0 }}>
              <li>"¿Qué hablé con María la última vez?"</li>
              <li>"Lista pacientes con ansiedad social que hayan probado exposición."</li>
              <li>"Resume la evolución de Carlos en las últimas 4 sesiones."</li>
            </ul>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ background: m.role === "user" ? "#F5F3FF" : "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: m.role === "user" ? PURPLE : "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.role === "user" ? "Tú" : "Asistente"}</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>{m.text}</div>
            {m.sources && m.sources.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", color: "#64748B", fontSize: 11 }}>{m.sources.length} fuente(s)</summary>
                <ul style={{ fontSize: 11, color: "#475569" }}>
                  {m.sources.map((s: any) => <li key={s.id}>{s.patient_alias || s.session_hash?.slice(0, 8)} — {new Date(s.created_at).toLocaleDateString()} (sim {(s.similarity ?? 0).toFixed(2)})</li>)}
                </ul>
              </details>
            )}
          </div>
        ))}
        {loading && <div style={{ color: "#64748B", fontSize: 13 }}>Pensando…</div>}
      </div>

      <div style={{ display: "flex", gap: 8, position: "sticky", bottom: 16, background: "#FFFAF2", padding: 8 }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") ask(); }} placeholder="Pregunta algo sobre tus sesiones…" style={{ flex: 1, padding: 12, border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14 }} />
        <button onClick={ask} disabled={loading} style={{ padding: "12px 20px", background: PURPLE, color: "#fff", border: 0, borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Preguntar</button>
      </div>
    </div>
  );
}
