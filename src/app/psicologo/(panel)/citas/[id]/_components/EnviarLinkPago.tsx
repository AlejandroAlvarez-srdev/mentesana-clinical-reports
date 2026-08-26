"use client";

// 2 botones en el detalle de la cita para que la psicóloga envíe al paciente,
// por email, el link de pago: primera sesión 9,99€ o Bonos. Pensado para
// convertir tras la Llamada Inmediata.

import { useState } from "react";

const PURPLE = "#6A178C";
const GOLD = "#A67C00";

type Tipo = "diagnostico" | "bonos";

export default function EnviarLinkPago({
  customerId,
  patientFirstName,
}: {
  customerId: number;
  patientFirstName?: string;
}) {
  const [sending, setSending] = useState<Tipo | null>(null);
  const [sent, setSent] = useState<Tipo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar(tipo: Tipo) {
    setSending(tipo);
    setError(null);
    try {
      const r = await fetch("/api/psicologa/enviar-link-pago", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerId, tipo }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.error === "paciente_sin_email" ? "El paciente no tiene email en el sistema." : "No se pudo enviar. Reintenta.");
        return;
      }
      setSent(tipo);
      setTimeout(() => setSent(null), 3500);
    } catch {
      setError("Sin conexión. Reintenta.");
    } finally {
      setSending(null);
    }
  }

  const baseBtn: React.CSSProperties = {
    flex: 1,
    minWidth: 150,
    padding: "12px 18px",
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    border: "none",
    color: "#fff",
    transition: "opacity .15s",
  };

  return (
    <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: PURPLE, marginBottom: 4 }}>💳 Enviar link de pago</div>
      <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 12 }}>
        Se lo mandamos por email a {patientFirstName || "el paciente"} al instante.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => enviar("diagnostico")}
          disabled={!!sending}
          style={{ ...baseBtn, background: `linear-gradient(135deg, ${PURPLE} 0%, #8B2FB5 100%)`, opacity: sending && sending !== "diagnostico" ? 0.5 : 1 }}
        >
          {sending === "diagnostico" ? "Enviando…" : sent === "diagnostico" ? "✓ Enviado" : "Sesión 9,99€"}
        </button>
        <button
          onClick={() => enviar("bonos")}
          disabled={!!sending}
          style={{ ...baseBtn, background: `linear-gradient(135deg, ${GOLD} 0%, #C9A227 100%)`, opacity: sending && sending !== "bonos" ? 0.5 : 1 }}
        >
          {sending === "bonos" ? "Enviando…" : sent === "bonos" ? "✓ Enviado" : "Bonos"}
        </button>
      </div>
      {error && <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>{error}</div>}
    </div>
  );
}
