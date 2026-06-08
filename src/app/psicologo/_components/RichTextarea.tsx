"use client";

// Editor de texto ligero para las HC: toolbar (negrita / cursiva / viñetas) +
// vista previa. Guarda MARKDOWN plano (**negrita**, *cursiva*, "- viñeta"), así
// que es retrocompatible con lo ya escrito y el embedding RAG lo digiere igual.
// Sin dependencias externas — el render es a nodos React (no HTML crudo).
import { useRef, useState } from "react";

const PURPLE = "#6A178C";

// --- Render markdown mínimo a React (negrita, cursiva, viñetas, saltos) ---
function inline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1] != null) out.push(<strong key={k++}>{m[1]}</strong>);
    else out.push(<em key={k++}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function renderMarkdown(text: string | null | undefined): React.ReactNode {
  if (!text) return null;
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${key}`} style={{ margin: "4px 0", paddingLeft: 18 }}>
          {bullets.map((b, i) => <li key={i} style={{ marginBottom: 2 }}>{inline(b)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };
  text.split("\n").forEach((ln, i) => {
    const mb = ln.match(/^\s*[-*]\s+(.*)$/);
    if (mb) { bullets.push(mb[1]); return; }
    flush(String(i));
    if (ln.trim() === "") blocks.push(<div key={`sp-${i}`} style={{ height: 6 }} />);
    else blocks.push(<p key={`p-${i}`} style={{ margin: "2px 0", lineHeight: 1.6 }}>{inline(ln)}</p>);
  });
  flush("end");
  return <>{blocks}</>;
}

const tbBtn: React.CSSProperties = { padding: "3px 9px", fontSize: 12, fontWeight: 800, borderRadius: 6, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", color: "#475569", cursor: "pointer", lineHeight: 1.2 };

export function RichTextarea({
  value, onChange, placeholder, minHeight = 96, accentDanger = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  accentDanger?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function surround(token: string) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    const sel = value.slice(s, e) || "texto";
    const next = value.slice(0, s) + token + sel + token + value.slice(e);
    onChange(next);
    setTimeout(() => { el.focus(); el.selectionStart = s + token.length; el.selectionEnd = s + token.length + sel.length; }, 0);
  }
  function bullets() {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;
    const block = value.slice(s, e) || "elemento";
    const out = block.split("\n").map((l) => (l.trim() ? `- ${l.replace(/^\s*[-*]\s+/, "")}` : l)).join("\n");
    onChange(value.slice(0, s) + out + value.slice(e));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
        <button type="button" onClick={() => surround("**")} title="Negrita" style={tbBtn}><b>B</b></button>
        <button type="button" onClick={() => surround("*")} title="Cursiva" style={tbBtn}><i>I</i></button>
        <button type="button" onClick={bullets} title="Lista con viñetas" style={tbBtn}>• Lista</button>
        <button type="button" onClick={() => setPreview((p) => !p)} title="Vista previa" style={{ ...tbBtn, marginLeft: "auto", color: preview ? "#fff" : PURPLE, background: preview ? PURPLE : "#fff", borderColor: PURPLE }}>
          {preview ? "✎ Editar" : "👁 Vista previa"}
        </button>
      </div>
      {preview ? (
        <div style={{ minHeight, padding: "10px 12px", fontSize: 13, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, background: "#fafafa", color: "#1a1a2e" }}>
          {value.trim() ? renderMarkdown(value) : <span style={{ color: "#aaa", fontStyle: "italic" }}>Nada que previsualizar todavía.</span>}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: "100%", padding: "10px 12px", fontSize: 13, lineHeight: 1.6, border: `1px solid ${accentDanger && value ? "#fecaca" : "rgba(0,0,0,0.1)"}`, borderRadius: 8, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", minHeight }}
        />
      )}
    </div>
  );
}
