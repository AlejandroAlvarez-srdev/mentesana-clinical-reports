"use client";
import { useEffect, useRef, useState } from "react";

const PURPLE = "#6A178C";
const GOLD = "#C5A572";
// Chrome Web Store (canal oficial — auto-update). El ZIP queda como
// fallback secundario para casos extremos (Chrome sin store, modo dev).
const EXTENSION_WEBSTORE_URL = process.env.NEXT_PUBLIC_PSICOLOGA_EXTENSION_WEBSTORE_URL
  || "https://chromewebstore.google.com/detail/mente-sana-%E2%80%94-asistente-me/idiokgdfhladphbdfpkiedfboghkicfh";
const EXTENSION_ZIP_URL = process.env.NEXT_PUBLIC_PSICOLOGA_EXTENSION_URL
  || "https://your-project.supabase.co/storage/v1/object/public/mentesana-app/mentesana-meet-ext.zip";

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

  // Polling: detectamos el emparejamiento por la creación de la fila en
  // psicologa_extensions (paired=true), no por el primer heartbeat
  // (active=true) que puede tardar hasta 60s. Apenas la psi pega el
  // código en la extensión, el backend inserta la fila y este poll lo
  // pilla en máximo 4s.
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/psicologa/extension/status", { cache: "no-store" });
        const j = (await r.json()) as { active?: boolean; paired?: boolean };
        if (j.paired || j.active) {
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
          <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>Hola {name} 👋 — para acceder a tu panel necesitas instalar la extensión Mente Sana en tu navegador.</p>
        </div>

        {detected ? (
          <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#15803D" }}>✓ Extensión detectada</div>
            <div style={{ color: "#166534", fontSize: 13, marginTop: 4 }}>Redirigiendo a tu panel…</div>
          </div>
        ) : (
          <>
            <ol style={{ paddingLeft: 22, color: "#334155", fontSize: 14, lineHeight: 1.7 }}>
              <li>Pulsa <b>“Instalar desde Chrome Web Store”</b> abajo. Se abrirá la tienda de Chrome.</li>
              <li>Click en <b>“Añadir a Chrome”</b> y confirma <b>“Agregar extensión”</b>.</li>
              <li>Fija la extensión a la barra (icono del puzzle 🧩 → chincheta) y haz click en su icono.</li>
              <li>Pega el <b>código de 6 dígitos</b> que ves abajo. Esta página avanzará sola al panel.</li>
            </ol>

            <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
              <a href={EXTENSION_WEBSTORE_URL} target="_blank" rel="noopener noreferrer"
                style={{ background: PURPLE, color: "#fff", padding: "14px 26px", borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 15, display: "inline-flex", alignItems: "center", gap: 10, boxShadow: `0 10px 30px ${PURPLE}33` }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                Instalar desde Chrome Web Store
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
              <b>¿Por qué es obligatoria?</b> La extensión es la pieza que conecta tu navegador con tu asistente Mente Sana en el panel. <b>Todos los datos se anonimizan en tu navegador antes de salir</b> (sin nombres, sin DNI, sin teléfonos) — nunca enviamos audio ni vídeo. Sin la extensión el asistente no puede ayudarte después de cada sesión y, por seguridad, el panel queda bloqueado.
            </div>

            <details style={{ marginTop: 16, fontSize: 11, color: "#94a3b8" }}>
              <summary style={{ cursor: "pointer", userSelect: "none" }}>¿Problemas con Chrome Web Store? Instala manualmente</summary>
              <p style={{ marginTop: 10, lineHeight: 1.6 }}>
                Solo para Chrome empresarial sin acceso al store. Pasos: <a href={EXTENSION_ZIP_URL} download style={{ color: PURPLE, fontWeight: 700 }}>descarga el ZIP</a>, descomprímelo, abre <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3, fontFamily: "monospace" }}>chrome://extensions</code>, activa <b>Modo de desarrollador</b> y pulsa <b>Cargar descomprimida</b>.
              </p>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
