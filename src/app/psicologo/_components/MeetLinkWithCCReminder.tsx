"use client";

// Botón "Meet" para el panel de la psicóloga que, ANTES de abrir el
// link, muestra un modal recordándole activar los subtítulos en español.
//
// Por qué: para que el asistente pueda preparar tu resumen tras la
// sesión, los subtítulos en español tienen que estar activos en Meet.
// Recordatorio en 1 click que evita el olvido más común.
import { useState } from "react";

const PURPLE = "#6A178C";
const GREEN = "#16a34a";

interface Props {
  href: string;
  label?: string;
  variant?: "pill-small" | "pill-large";
}

export default function MeetLinkWithCCReminder({ href, label = "📹 Meet", variant = "pill-small" }: Props) {
  const [open, setOpen] = useState(false);

  function openModal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  function confirm() {
    setOpen(false);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  const small: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "6px 10px", background: `linear-gradient(135deg, ${GREEN}, #22c55e)`,
    color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 800,
    textDecoration: "none", boxShadow: "0 2px 6px rgba(22,163,74,0.25)",
    border: "none", cursor: "pointer", fontFamily: "inherit",
  };
  const large: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14,
    padding: "12px 22px", background: "#fff", color: PURPLE,
    textDecoration: "none", borderRadius: 12, fontSize: 14, fontWeight: 800,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    border: "none", cursor: "pointer", fontFamily: "inherit",
  };

  return (
    <>
      <button onClick={openModal} style={variant === "pill-large" ? large : small} aria-label="Abrir Meet">
        {label}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed", inset: 0, background: "rgba(15,8,25,0.55)",
            backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 18, animation: "ccFadeIn 0.18s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20, padding: 26, maxWidth: 440, width: "100%",
              boxShadow: "0 30px 80px rgba(0,0,0,0.32)",
              animation: "ccPopIn 0.22s cubic-bezier(.22,.61,.36,1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: `linear-gradient(135deg, ${PURPLE} 0%, #8B2FB5 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, color: "#fff", fontWeight: 800, letterSpacing: -0.5,
              }}>CC</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: PURPLE }}>
                  Antes de entrar
                </div>
                <div style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 19, fontWeight: 500, color: "#1a0a1f", letterSpacing: -0.3 }}>
                  Activa los subtítulos en <em style={{ color: PURPLE }}>español</em>
                </div>
              </div>
            </div>

            <p style={{ margin: "0 0 14px", fontSize: 13.5, lineHeight: 1.55, color: "#475569" }}>
              Necesitamos que estén activos para que tu asistente <strong>pueda prepararte el resumen</strong> de la sesión. <span style={{ color: "#16a34a" }}>Todo se anonimiza en tu navegador antes de salir.</span>
            </p>

            {/* Pasos visuales */}
            <ol style={{ margin: "0 0 18px", padding: "12px 16px 12px 32px", background: "#FAF5FF", border: `1px solid ${PURPLE}1f`, borderRadius: 12, fontSize: 13, lineHeight: 1.65, color: "#1a0a1f" }}>
              <li>Entra en Meet (botón verde abajo)</li>
              <li>Click en el icono <strong>“CC”</strong> abajo a la derecha</li>
              <li>Elige <strong>idioma → Español</strong></li>
            </ol>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: "10px 16px", borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)", background: "#fff",
                  color: "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirm}
                style={{
                  padding: "10px 18px", borderRadius: 10, border: "none",
                  background: `linear-gradient(135deg, ${GREEN}, #22c55e)`,
                  color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 6px 14px rgba(22,163,74,0.32)",
                  fontFamily: "inherit",
                }}
              >
                Entendido · abrir Meet →
              </button>
            </div>
          </div>

          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes ccFadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes ccPopIn { from { transform: scale(.94); opacity: 0 } to { transform: scale(1); opacity: 1 } }
          ` }} />
        </div>
      )}
    </>
  );
}
