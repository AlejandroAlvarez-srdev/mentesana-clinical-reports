"use client";
import { useEffect, useRef, useState } from "react";

const PURPLE = "#6A178C";
const GOLD = "#C5A572";
const code = { background: "#F3F4F6", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: 12 } as const;
const EXTENSION_URL = process.env.NEXT_PUBLIC_PSICOLOGA_EXTENSION_URL || "/extensions/mentesana-meet-ext.zip";

export default function InstalarExtensionClient({ name }: { name: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function genCode() {
    setLoading(true);
    try {
      const r = await fetch("/api/psicologa/extension/pair-code", { method: "POST" });
      const j = await r.json();
      if (j.code) { setCode(j.code); setExpiresAt(j.expires_at); }
    } finally { setLoading(false); }
  }

  useEffect(() => { genCode(); }, []);

  // Polling: si la extensión emparejó y empezó a heartbeat, recarga al panel.
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/psicologa/extension/status", { cache: "no-store" });
        const j = await r.json();
        if (j.active) {
          setDetected(true);
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => { window.location.href = "/psicologo"; }, 1200);
        }
      } catch {}
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #FFFAF2 0%, #F3E8FF 100%)", padding: "40px 20px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: "#fff", borderRadius: 16, padding: 36, boxShadow: "0 8px 30px rgba(106,23,140,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/images/logo.webp" alt="Mente Sana" style={{ height: 32 }} />
          <h1 style={{ fontSize: 26, fontWeight: 800, color: PURPLE, marginTop: 16, marginBottom: 6 }}>Instala la extensión Mente Sana</h1>
          <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>Hola {name} 👋 — para acceder a tu panel necesitas tener instalada la extensión que captura y resume tus sesiones de Google Meet.</p>
        </div>

        {detected ? (
          <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#15803D" }}>✓ Extensión detectada</div>
            <div style={{ color: "#166534", fontSize: 13, marginTop: 4 }}>Redirigiendo a tu panel…</div>
          </div>
        ) : (
          <>
            <ol style={{ paddingLeft: 22, color: "#334155", fontSize: 14, lineHeight: 1.7 }}>
              <li><b>Descarga el ZIP</b> con el botón de abajo y <b>descomprímelo</b> en una carpeta (botón derecho → "Extraer").</li>
              <li>Abre Chrome y escribe en la barra de direcciones: <code style={code}>chrome://extensions</code></li>
              <li>Arriba a la derecha activa el <b>"Modo de desarrollador"</b>.</li>
              <li>Pulsa <b>"Cargar descomprimida"</b> y selecciona la carpeta que extrajiste.</li>
              <li>Fija la extensión a la barra (icono del puzzle 🧩 → chincheta) y haz click en su icono.</li>
              <li>Pega el <b>código de 6 dígitos</b> que ves abajo. Esta página avanzará sola al panel.</li>
            </ol>

            <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
              <a href={EXTENSION_URL} download style={{ background: PURPLE, color: "#fff", padding: "12px 22px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
                ⬇ Descargar extensión (.zip)
              </a>
            </div>

            <div style={{ background: "#FAF5FF", border: `2px dashed ${PURPLE}`, borderRadius: 12, padding: 24, textAlign: "center", marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: PURPLE, letterSpacing: 1.5, textTransform: "uppercase" }}>Tu código de vinculación</div>
              <div style={{ fontSize: 44, fontWeight: 800, color: PURPLE, letterSpacing: 8, marginTop: 8, fontFamily: "monospace" }}>
                {code ?? "------"}
              </div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>Caduca en 10 minutos.</div>
              <button onClick={genCode} disabled={loading} style={{ marginTop: 12, background: "transparent", color: PURPLE, border: `1px solid ${PURPLE}`, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {loading ? "..." : "Generar nuevo código"}
              </button>
            </div>

            <div style={{ marginTop: 24, padding: 14, background: "#FFFBEB", border: `1px solid ${GOLD}`, borderRadius: 8, fontSize: 12, color: "#78350F" }}>
              <b>¿Por qué es obligatoria?</b> La extensión transcribe tus sesiones de Meet, las anonimiza en tu navegador y genera un resumen clínico que TÚ revisas antes de aprobar. Sin ella el asistente RAG no funciona y, por seguridad, el panel queda bloqueado.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
