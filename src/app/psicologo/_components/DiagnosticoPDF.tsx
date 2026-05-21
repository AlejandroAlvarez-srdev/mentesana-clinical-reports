"use client";

import { useEffect, useState } from "react";

const PURPLE = "#6A178C";

type Test = {
  id: number;
  report_url: string | null;
  report_generated: boolean;
  perfil_tipo: string | null;
  perfil_nombre: string | null;
  perfil_urgencia: string | null;
  expectations: any;
  scores: any;
  paid: boolean;
  paid_at: string | null;
  matched_psychologist: string | null;
  created_at: string;
};

type Resp = { found: boolean; customer_name?: string | null; hint?: string; test?: Test };

export default function DiagnosticoPDF({ customerId, isFirstSession }: { customerId: number; isFirstSession?: boolean }) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/psicologa/diagnostico-pdf?customer_id=${customerId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <div style={{ padding: 12, color: "#888", fontSize: 12 }}>Buscando informe diagnóstico…</div>;
  if (!data) return null;

  if (!data.found) {
    return (
      <section style={{ padding: 14, background: "rgba(245,158,11,0.04)", border: "1px dashed rgba(245,158,11,0.3)", borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>📋 Sin informe diagnóstico 9,99€</div>
        <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
          {data.hint ?? "Este paciente no hizo el diagnóstico inicial."}
        </p>
      </section>
    );
  }

  const t = data.test!;
  const urgenciaColor = t.perfil_urgencia === "alta" ? "#dc2626" : t.perfil_urgencia === "media" ? "#d97706" : "#0e7490";

  return (
    <section style={{ background: "linear-gradient(135deg, rgba(106,23,140,0.06), rgba(139,47,181,0.04))", border: `2px solid ${PURPLE}33`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: PURPLE, fontWeight: 800 }}>📋 Informe diagnóstico 9,99€</h3>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888" }}>
            Test del paciente {isFirstSession && <strong style={{ color: PURPLE }}>· léelo antes de esta primera sesión</strong>}
          </p>
        </div>
        {t.report_url && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <a href={t.report_url} target="_blank" rel="noreferrer" style={{ padding: "9px 16px", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", textDecoration: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 800, boxShadow: "0 2px 8px rgba(106,23,140,0.25)" }}>
              📄 Abrir PDF
            </a>
            <SendPdfButton customerId={customerId} />
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
        {t.perfil_nombre && (
          <Card label="Perfil">
            <div style={{ fontSize: 13, fontWeight: 700, color: PURPLE }}>{t.perfil_nombre}</div>
            {t.perfil_tipo && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{t.perfil_tipo}</div>}
          </Card>
        )}
        {t.perfil_urgencia && (
          <Card label="Urgencia">
            <div style={{ fontSize: 14, fontWeight: 800, color: urgenciaColor, textTransform: "uppercase" }}>{t.perfil_urgencia}</div>
          </Card>
        )}
        {t.matched_psychologist && (
          <Card label="Match recomendado">
            <div style={{ fontSize: 12, color: "#1a1a2e", fontWeight: 600 }}>{t.matched_psychologist}</div>
          </Card>
        )}
        {t.paid_at && (
          <Card label="Pagado">
            <div style={{ fontSize: 12, color: "#065f46", fontWeight: 700 }}>✓ {new Date(t.paid_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</div>
          </Card>
        )}
      </div>

      {t.expectations && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11.5, color: PURPLE, cursor: "pointer", fontWeight: 700 }}>📝 Lo que espera de la terapia (sus palabras)</summary>
          <div style={{ marginTop: 6, padding: 10, background: "#fff", borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, color: "#1a1a2e", whiteSpace: "pre-line" }}>
            {typeof t.expectations === "string" ? t.expectations : JSON.stringify(t.expectations, null, 2)}
          </div>
        </details>
      )}

      {t.scores && typeof t.scores === "object" && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11.5, color: PURPLE, cursor: "pointer", fontWeight: 700 }}>📊 Puntuaciones del test</summary>
          <div style={{ marginTop: 6, padding: 10, background: "#fff", borderRadius: 8, fontSize: 11.5, color: "#475569", fontFamily: "ui-monospace, monospace" }}>
            {Object.entries(t.scores).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px dashed rgba(0,0,0,0.05)" }}>
                <span>{k}</span>
                <strong>{String(v)}</strong>
              </div>
            ))}
          </div>
        </details>
      )}

      {!t.report_generated && (
        <div style={{ marginTop: 10, padding: 8, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, fontSize: 11, color: "#92400e" }}>
          ⚠️ El PDF aún no está generado (puede tardar unos minutos tras el pago).
        </div>
      )}
    </section>
  );
}

function SendPdfButton({ customerId }: { customerId: number }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  async function send() {
    if (!confirm("¿Reenviar el informe diagnóstico al correo del paciente?")) return;
    setBusy(true); setSent(null);
    const r = await fetch("/api/psicologa/send-pdf", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId }) });
    setBusy(false);
    if (!r.ok) { alert("Error: " + ((await r.json()).message ?? "")); return; }
    const d = await r.json();
    setSent(d.sent_to);
    setTimeout(() => setSent(null), 5000);
  }
  return (
    <>
      <button onClick={send} disabled={busy} style={{ padding: "9px 16px", background: "#fff", color: PURPLE, border: `2px solid ${PURPLE}`, borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
        {busy ? "Enviando…" : "📧 Enviar PDF al paciente"}
      </button>
      {sent && <span style={{ display: "inline-flex", alignItems: "center", padding: "9px 12px", background: "rgba(16,185,129,0.14)", color: "#065f46", borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>✓ Enviado a {sent}</span>}
    </>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 10, background: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}
