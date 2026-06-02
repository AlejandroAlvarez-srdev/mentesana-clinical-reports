"use client";

// Banner persistente en la entrada del panel psicóloga recordando que
// SIEMPRE debe activar los subtítulos en español en Meet antes de
// empezar la sesión. Sin CC, el asistente no puede prepararte el
// resumen del informe después.
//
// Diseño: tono cálido morado/oro, dismissable de forma persistente
// (sessionStorage) — si la psi lo cierra en una visita reaparece la
// próxima vez para no perder el hábito.
import { useEffect, useState } from "react";

const PURPLE = "#6A178C";
const GOLD = "#D4AF37";
const KEY = "ms_cc_banner_dismissed_v1";

export default function CCAlwaysOnBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);
  if (!visible) return null;

  function dismiss() {
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    setVisible(false);
  }

  return (
    <div
      role="note"
      aria-label="Recordatorio: activa los subtítulos en Meet"
      style={{
        background: `linear-gradient(135deg, ${PURPLE} 0%, #4f1273 100%)`,
        color: "#fff",
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: `0 10px 30px ${PURPLE}33`,
        position: "relative",
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 10,
          background: "rgba(255,255,255,0.14)",
          border: `1px solid ${GOLD}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: 14, letterSpacing: -0.5, color: GOLD,
          flexShrink: 0,
        }}
      >CC</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 15, fontWeight: 500, letterSpacing: -0.2, lineHeight: 1.2 }}>
          Siempre activa los subtítulos en <em style={{ color: GOLD, fontStyle: "normal" }}>Español</em> al abrir Meet
        </div>
        <div style={{ fontSize: 12, opacity: 0.88, marginTop: 3, lineHeight: 1.4 }}>
          Necesario para que tu asistente <strong>te prepare el resumen</strong> de la sesión. <span style={{ opacity: 0.85 }}>Todos los datos se anonimizan en tu navegador.</span>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Cerrar recordatorio"
        style={{
          background: "rgba(255,255,255,0.14)",
          border: "none",
          color: "#fff",
          width: 28, height: 28, borderRadius: 8,
          fontSize: 16, fontWeight: 700, cursor: "pointer",
          fontFamily: "inherit",
          flexShrink: 0,
        }}
      >✕</button>
    </div>
  );
}
