"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PURPLE = "#6A178C";
const GOLD = "#D4AF37";

type Step = "brief" | "body" | "review";

export default function NewPostClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("brief");
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [outline, setOutline] = useState<string[]>([]);
  const [rationale, setRationale] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);

  const fetchBrief = useCallback(async () => {
    setBriefLoading(true); setError(null);
    try {
      const r = await fetch("/api/psicologa/blog/auto-brief", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "error_ia"); return; }
      setKeyword(j.keyword ?? "");
      setTitle(j.title ?? "");
      setOutline(Array.isArray(j.outline) ? j.outline : []);
      setRationale(j.rationale ?? "");
    } finally { setBriefLoading(false); }
  }, []);

  // Al entrar al wizard la IA decide keyword + título inmediatamente.
  useEffect(() => { void fetchBrief(); }, [fetchBrief]);

  async function saveDraft(opts?: { schedule?: boolean }) {
    if (!keyword.trim() || !title.trim()) return;
    setLoading(true); setError(null);
    try {
      const payload: Record<string, unknown> = { keyword, title, body_md: bodyMd };
      if (opts?.schedule && scheduledFor) payload.scheduled_for = new Date(scheduledFor).toISOString();
      const r = await fetch("/api/psicologa/blog/drafts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "error_guardar"); return; }
      setSavedDraftId(j.post.id);
      return j.post.id as string;
    } finally { setLoading(false); }
  }

  async function publishNow() {
    const id = savedDraftId ?? (await saveDraft());
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/psicologa/blog/publish", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: id }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "error_publicar"); return; }
      router.push("/psicologo/blog");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Link href="/psicologo/blog" style={{ color: PURPLE, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>← Volver</Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>Nuevo artículo</h1>
      </header>

      <ProgressBar step={step} />

      {error && (
        <div style={{ padding: 10, marginBottom: 14, background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 13, border: "1px solid #fecaca" }}>❌ {error}</div>
      )}

      {step === "brief" && (
        <div style={card}>
          <Label>1. Tu encargo de hoy</Label>
          <Hint>La IA elige la keyword y el título para que el artículo posicione bien. Tú escribes el cuerpo. Si no te convence el tema, dale a <strong>🎲 Otro tema</strong>.</Hint>

          {briefLoading && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ display: "inline-block", width: 26, height: 26, border: `3px solid ${PURPLE}22`, borderTopColor: PURPLE, borderRadius: "50%", animation: "ms-spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 13, color: "#666", marginTop: 12 }}>Generando tu encargo SEO…</p>
              <style>{`@keyframes ms-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!briefLoading && keyword && (
            <>
              <div style={{ padding: 18, background: `linear-gradient(135deg, ${PURPLE}06, ${GOLD}06)`, border: `1px solid ${PURPLE}22`, borderRadius: 12, marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: GOLD, fontWeight: 800, letterSpacing: 0.4, margin: 0, textTransform: "uppercase" }}>
                  ★ Keyword SEO asignada
                </p>
                <p style={{ fontSize: 18, color: PURPLE, fontWeight: 700, margin: "6px 0 14px", fontFamily: "ui-monospace, monospace" }}>
                  {keyword}
                </p>
                <p style={{ fontSize: 11, color: GOLD, fontWeight: 800, letterSpacing: 0.4, margin: 0, textTransform: "uppercase" }}>
                  Título sugerido
                </p>
                <h2 style={{ fontSize: 22, color: "#1a1a2e", fontWeight: 800, margin: "6px 0 0", letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                  {title}
                </h2>
                {rationale && (
                  <p style={{ fontSize: 12, color: "#666", marginTop: 14, fontStyle: "italic", lineHeight: 1.5 }}>
                    💡 {rationale}
                  </p>
                )}
              </div>

              {outline.length > 0 && (
                <div style={{ padding: 14, background: "#fafafa", borderRadius: 10, marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: PURPLE, fontWeight: 800, letterSpacing: 0.4, margin: "0 0 8px", textTransform: "uppercase" }}>
                    Guion sugerido (te lo damos hecho)
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#1a1a2e", lineHeight: 1.7 }}>
                    {outline.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}

              <details style={{ marginBottom: 14 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#666", fontWeight: 600 }}>
                  ¿Quieres editar el título manualmente?
                </summary>
                <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...input, marginTop: 8 }} />
              </details>

              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                <button onClick={fetchBrief} disabled={briefLoading} style={secondaryBtn(briefLoading)}>
                  🎲 Otro tema
                </button>
                <button onClick={() => setStep("body")} disabled={!title.trim()} style={primaryBtn(!title.trim())}>
                  Empezar a escribir →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === "body" && (
        <div style={card}>
          <p style={{ fontSize: 11, color: GOLD, fontWeight: 800, letterSpacing: 0.4, margin: 0, textTransform: "uppercase" }}>
            ★ KW: <span style={{ color: PURPLE, fontFamily: "ui-monospace, monospace" }}>{keyword}</span>
          </p>
          <h2 style={{ fontSize: 20, color: "#1a1a2e", fontWeight: 800, margin: "4px 0 16px", letterSpacing: "-0.02em" }}>{title}</h2>

          {outline.length > 0 && (
            <details style={{ marginBottom: 14, padding: 10, background: "#fafafa", borderRadius: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: PURPLE, fontWeight: 700 }}>📋 Ver guion sugerido</summary>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "#1a1a2e", lineHeight: 1.6 }}>
                {outline.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </details>
          )}

          <Label>2. Escribe el cuerpo del artículo</Label>
          <Hint>Markdown soportado: <code>**negrita**</code>, <code>## títulos</code>, <code>- listas</code>, <code>[texto](url)</code>. La IA NUNCA tocará tu contenido.</Hint>
          <textarea
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            rows={20}
            placeholder={`## Introducción\n\nEmpieza explicando el problema desde tu experiencia clínica.\n\n## ${outline[0] ?? "Primer punto del guion"}\n\n...`}
            style={{ ...input, fontFamily: "ui-monospace, monospace", minHeight: 380, resize: "vertical" }}
          />
          <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>{bodyMd.split(/\s+/).filter(Boolean).length} palabras</p>

          <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <button onClick={() => setStep("brief")} style={secondaryBtn(false)}>← Cambiar tema</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => saveDraft()} disabled={!title.trim() || loading} style={secondaryBtn(!title.trim() || loading)}>
                {loading ? "Guardando…" : savedDraftId ? "Guardado ✓" : "💾 Guardar borrador"}
              </button>
              <button onClick={() => setStep("review")} disabled={!title.trim() || bodyMd.length < 100} style={primaryBtn(!title.trim() || bodyMd.length < 100)}>
                Revisar y publicar →
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "review" && (
        <div style={card}>
          <Label>3. Revisa antes de publicar</Label>
          <div style={{ padding: 16, background: "#fafafa", borderRadius: 10, marginTop: 8 }}>
            <p style={{ fontSize: 11, color: GOLD, fontWeight: 800, letterSpacing: 0.4, margin: 0 }}>KEYWORD · {keyword.toUpperCase()}</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 22, color: "#1a1a2e", fontWeight: 800 }}>{title}</h2>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#888" }}>{bodyMd.split(/\s+/).filter(Boolean).length} palabras · {Math.ceil(bodyMd.split(/\s+/).filter(Boolean).length / 220)} min lectura</p>
          </div>
          <Hint style={{ marginTop: 16 }}>Al publicar: (1) se genera una imagen de portada con IA, (2) el artículo se publica en /blog/{title ? title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) : "..."}, (3) en unos minutos un cron genera meta-description, og y schema Article.</Hint>

          <div style={{ marginTop: 14, padding: 12, background: `${PURPLE}06`, borderRadius: 10, border: `1px dashed ${PURPLE}33` }}>
            <Label>O programar publicación</Label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              style={{ ...input, marginTop: 6 }}
            />
            <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0" }}>Hora local del navegador.</p>
            <button onClick={() => saveDraft({ schedule: true })} disabled={!scheduledFor || loading} style={{ ...secondaryBtn(!scheduledFor || loading), marginTop: 8, width: "100%" }}>
              📅 Programar
            </button>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "space-between" }}>
            <button onClick={() => setStep("body")} style={secondaryBtn(false)}>← Volver al editor</button>
            <button onClick={publishNow} disabled={loading} style={primaryBtn(loading)}>
              {loading ? "Publicando…" : "🚀 Publicar ahora"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ step }: { step: Step }) {
  const steps: Step[] = ["brief", "body", "review"];
  const idx = steps.indexOf(step);
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= idx ? PURPLE : "rgba(0,0,0,0.08)", transition: "background 0.2s" }} />
      ))}
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
const Hint = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p style={{ fontSize: 12.5, color: "#666", margin: "0 0 10px", lineHeight: 1.5, ...style }}>{children}</p>
);
