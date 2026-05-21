"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const PURPLE = "#6A178C";

type Conv = { id: string; title: string | null; created_at: string; updated_at: string };
type Msg = { role: "user" | "assistant"; content: string; created_at?: string };

export default function AcompanaPage() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadConvs = () => fetch("/api/psicologa/therapy-chat", { credentials: "include" }).then(r => r.ok ? r.json() : { conversations: [] }).then(d => setConvs(d.conversations ?? []));
  useEffect(() => { void loadConvs(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function openConv(id: string) {
    setCurrentId(id); setMessages([]);
    const r = await fetch(`/api/psicologa/therapy-chat?conv=${id}`, { credentials: "include" });
    if (r.ok) { const d = await r.json(); setMessages(d.messages ?? []); }
  }
  function newChat() { setCurrentId(null); setMessages([]); setInput(""); }

  async function send() {
    if (!input.trim() || busy) return;
    const msg = input.trim(); setInput("");
    setMessages(m => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const r = await fetch("/api/psicologa/therapy-chat", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, conversation_id: currentId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? d.error);
      if (d.conversation_id && !currentId) setCurrentId(d.conversation_id);
      setMessages(m => [...m, { role: "assistant", content: d.answer }]);
      loadConvs();
    } catch (e: any) {
      setMessages(m => [...m, { role: "assistant", content: `⚠️ ${String(e.message ?? e)}` }]);
    } finally { setBusy(false); }
  }
  async function deleteConv(id: string) {
    if (!confirm("¿Borrar esta conversación?")) return;
    await fetch(`/api/psicologa/therapy-chat?conv=${id}`, { method: "DELETE", credentials: "include" });
    if (id === currentId) newChat();
    loadConvs();
  }

  const suggestions = [
    "Hoy tuve una sesión que me dejó tocada. ¿Puedo contarte qué pasó?",
    "Tengo una paciente con ideación suicida leve y dudo del encuadre.",
    "Llevo semanas durmiendo mal, me cuesta dejar atrás los casos.",
    "¿Cómo manejo la contratransferencia con un paciente al que no soporto?",
  ];

  return (
    <div>
      <Link href="/psicologo" style={{ color: PURPLE, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>← Mi panel</Link>

      <header style={{ marginTop: 14, marginBottom: 18, padding: 18, background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", borderRadius: 16, position: "relative", overflow: "hidden" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>🌿 Acompaña</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.92, maxWidth: 700, lineHeight: 1.5 }}>Tu espacio confidencial. Una psicóloga IA entrenada para acompañarte cuando tienes un caso difícil, te sientes agotada o necesitas pensar en voz alta. No reemplaza terapia, sí complementa.</p>
        <p style={{ margin: "10px 0 0", fontSize: 11, opacity: 0.75 }}>🔒 Todas tus conversaciones se guardan solo para ti. Nadie más las ve.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 12, alignItems: "stretch" }}>
        <aside style={{ background: "#fff", borderRadius: 12, padding: 10, border: "1px solid rgba(0,0,0,0.06)", maxHeight: 600, overflow: "auto" }}>
          <button onClick={newChat} style={{ width: "100%", padding: 10, background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 800, cursor: "pointer", marginBottom: 8 }}>+ Nueva conversación</button>
          <div style={{ display: "grid", gap: 2 }}>
            {convs.length === 0 && <div style={{ padding: 12, fontSize: 11, color: "#aaa", textAlign: "center" }}>Sin conversaciones aún.</div>}
            {convs.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", borderRadius: 6, background: currentId === c.id ? PURPLE : "transparent", color: currentId === c.id ? "#fff" : "#1a1a2e" }}>
                <button onClick={() => openConv(c.id)} style={{ flex: 1, padding: "8px 10px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5 }}>{c.title ?? "Sin título"}</button>
                <button onClick={() => deleteConv(c.id)} style={{ padding: "0 6px", background: "transparent", border: "none", color: currentId === c.id ? "rgba(255,255,255,0.7)" : "#cbd5e1", cursor: "pointer", fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        </aside>

        <main style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", height: 600 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {messages.length === 0 && (
              <div>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666", fontStyle: "italic" }}>Empieza cuando quieras. Puedes contarme un caso, cómo te sientes, una duda profesional, lo que sea.</p>
                <div style={{ display: "grid", gap: 6 }}>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => setInput(s)} style={{ padding: 10, background: "rgba(106,23,140,0.04)", border: `1px solid ${PURPLE}22`, borderRadius: 8, fontSize: 12.5, color: "#1a1a2e", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", padding: "10px 14px", background: m.role === "user" ? `linear-gradient(135deg, ${PURPLE}, #8B2FB5)` : "rgba(0,0,0,0.04)", color: m.role === "user" ? "#fff" : "#1a1a2e", borderRadius: 12, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-line" }}>{m.content}</div>
              </div>
            ))}
            {busy && <div style={{ padding: 8, color: PURPLE, fontSize: 12 }}>🌿 Escribiendo…</div>}
            <div ref={endRef} />
          </div>
          <footer style={{ padding: 12, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 8 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={2} placeholder="Escribe lo que necesites contar…" style={{ flex: 1, padding: 10, fontSize: 13.5, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, fontFamily: "inherit", resize: "none" }} disabled={busy} />
            <button onClick={() => void send()} disabled={busy || !input.trim()} style={{ padding: "10px 18px", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: busy || !input.trim() ? "not-allowed" : "pointer", opacity: busy || !input.trim() ? 0.5 : 1 }}>Enviar</button>
          </footer>
        </main>
      </div>
    </div>
  );
}
