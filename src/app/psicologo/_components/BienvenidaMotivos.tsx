"use client";

import { useEffect, useState } from "react";

const GREEN = "#1B7C4A";
const PURPLE = "#6A178C";

type Report = {
  appointment_id: number;
  angulo: string; angulo_label: string; angulo_reclasifica: string | null;
  motivo_asistir: string | null; expectativa: string | null;
  abiertas: { prompt: string; texto: string }[];
  scores_pct: Record<string, number>;
  crisis: boolean;
  report_url: string | null; report_generated: boolean;
  created_at: string;
};
type Resp = { found: boolean; customer_name?: string | null; hint?: string; report?: Report };

export default function BienvenidaMotivos({ customerId, isFirstSession }: { customerId: number; isFirstSession?: boolean }) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/psicologa/bienvenida-report?customer_id=${customerId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Resp | null) => {
        if (cancelled) return;
        setData(d);
        if (d?.report?.report_url) {
          setReportUrl(d.report.report_url);
        } else if (d?.found && d.report?.appointment_id) {
          // Self-heal: si la reserva existe pero el PDF no se generó (reservas
          // previas al auto-gen o si falló en /reserve), lo generamos al vuelo
          // en cuanto la psi abre la ficha — sin que tenga que clickar nada.
          fetch("/api/generate-bienvenida-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointment_id: d.report.appointment_id }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((g: { url?: string } | null) => { if (!cancelled && g?.url) setReportUrl(g.url); })
            .catch(() => {});
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) return <div style={{ padding: 12, color: "#888", fontSize: 12 }}>Buscando cita de bienvenida…</div>;
  if (!data || !data.found) return null; // si no hizo el test de bienvenida, no ocupamos espacio

  const r = data.report!;
  const sorted = Object.entries(r.scores_pct).sort((a, b) => b[1] - a[1]);

  async function generar(openAfter: boolean) {
    setGenBusy(true);
    try {
      const res = await fetch("/api/generate-bienvenida-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointment_id: r.appointment_id }) });
      const d = await res.json().catch(() => ({}));
      if (d?.url) { setReportUrl(d.url); if (openAfter) window.open(d.url, "_blank", "noopener,noreferrer"); }
      else alert("No se pudo generar el PDF.");
    } finally { setGenBusy(false); }
  }

  return (
    <section style={{ background: "linear-gradient(135deg, rgba(27,124,74,0.06), rgba(27,124,74,0.03))", border: `2px solid ${GREEN}33`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: GREEN, fontWeight: 800 }}>🌱 Cita de bienvenida · {r.angulo_label}</h3>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888" }}>
            Test del paciente {isFirstSession && <strong style={{ color: GREEN }}>· léelo antes de esta primera sesión</strong>}
            {r.angulo_reclasifica && <span> · el test apunta más a <strong>{r.angulo_reclasifica}</strong></span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {reportUrl ? (
            <a href={reportUrl} target="_blank" rel="noreferrer" style={{ padding: "9px 16px", background: `linear-gradient(135deg, ${GREEN}, #2ea16a)`, color: "#fff", textDecoration: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 800, boxShadow: "0 2px 8px rgba(27,124,74,0.25)" }}>📄 Abrir PDF</a>
          ) : (
            <button onClick={() => generar(true)} disabled={genBusy} style={{ padding: "9px 16px", background: "#fff", color: GREEN, border: `2px solid ${GREEN}`, borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: "pointer", opacity: genBusy ? 0.5 : 1 }}>{genBusy ? "Generando…" : "📄 Generar y ver PDF"}</button>
          )}
          <SendPdfButton customerId={customerId} />
        </div>
      </div>

      {r.crisis && (
        <div style={{ marginBottom: 12, padding: 10, background: "#FEF2F2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#991b1b", fontWeight: 700 }}>
          ⚠️ El test marcó una señal de riesgo. Explora estado de ánimo y seguridad al abrir · recurso 024.
        </div>
      )}

      {r.motivo_asistir && (
        <Block label="📝 Por qué pide ayuda ahora (sus palabras)">{r.motivo_asistir}</Block>
      )}
      {r.expectativa && (
        <Block label="🎯 Qué espera de la terapia">{r.expectativa}</Block>
      )}
      {r.abiertas.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11.5, color: GREEN, cursor: "pointer", fontWeight: 700 }}>💬 Respuestas abiertas del test ({r.abiertas.length})</summary>
          <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
            {r.abiertas.map((a, i) => (
              <div key={i} style={{ padding: 10, background: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 3 }}>{a.prompt}</div>
                <div style={{ fontSize: 12.5, color: "#1a1a2e", lineHeight: 1.5, fontStyle: "italic" }}>&ldquo;{a.texto}&rdquo;</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {sorted.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11.5, color: GREEN, cursor: "pointer", fontWeight: 700 }}>📊 Mapa emocional del test</summary>
          <div style={{ marginTop: 6, padding: 10, background: "#fff", borderRadius: 8, display: "grid", gap: 6 }}>
            {sorted.map(([k, v]) => (
              <div key={k}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                  <span style={{ textTransform: "capitalize", color: "#475569", fontWeight: 600 }}>{k}</span>
                  <strong style={{ color: GREEN }}>{v}%</strong>
                </div>
                <div style={{ height: 6, background: "rgba(27,124,74,0.12)", borderRadius: 3 }}>
                  <div style={{ height: 6, width: `${v}%`, background: GREEN, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: GREEN, marginBottom: 4 }}>{label}</div>
      <div style={{ padding: 12, background: "#fff", borderRadius: 8, borderLeft: `3px solid ${GREEN}`, fontSize: 13, lineHeight: 1.55, color: "#1a1a2e", whiteSpace: "pre-line" }}>{children}</div>
    </div>
  );
}

function SendPdfButton({ customerId }: { customerId: number }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  async function send() {
    if (!confirm("¿Enviar el informe de la cita de bienvenida al correo del paciente?")) return;
    setBusy(true); setSent(null);
    const r = await fetch("/api/psicologa/send-bienvenida-pdf", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId }) });
    setBusy(false);
    if (!r.ok) { alert("Error: " + ((await r.json().catch(() => ({}))).message ?? "")); return; }
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
