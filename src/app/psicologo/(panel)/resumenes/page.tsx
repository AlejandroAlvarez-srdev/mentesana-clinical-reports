"use client";
import { useCallback, useEffect, useState } from "react";

const PURPLE = "#6A178C";

type Row = {
  id: string;
  paciente: string | null;
  patient_email: string | null;
  product: string;
  status: string;
  alert: boolean;
  alert_reason: string | null;
  session_date: string | null;
  sent_at: string | null;
  preview_url: string | null;
};

function fmt(d: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }); } catch { return ""; }
}

export default function ResumenesPage() {
  const [pendientes, setPendientes] = useState<Row[]>([]);
  const [enviados, setEnviados] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/psicologa/resumenes", { credentials: "include" });
      const j = await r.json();
      setPendientes(j.pendientes ?? []);
      setEnviados(j.enviados ?? []);
    } catch { setMsg("No se pudo cargar."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const aprobar = async (id: string) => {
    if (busy) return;
    setBusy(id); setMsg(null);
    try {
      const r = await fetch("/api/psicologa/resumenes/approve", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (r.ok && j.ok) { setMsg(`✅ Enviado a ${j.sent_to ?? "la paciente"}`); await load(); }
      else setMsg(`⚠️ ${j.message || j.error || "No se pudo enviar"}`);
    } catch { setMsg("⚠️ Error de red"); }
    setBusy(null);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: PURPLE, margin: "4px 0 4px" }}>📄 Resúmenes de sesión</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginTop: 0, maxWidth: 720 }}>
        Cuando un paciente compra su resumen, se genera aquí automáticamente desde la sesión.
        <strong> Revísalo y apruébalo</strong> para que le llegue por email. Nada se envía sin tu OK.
      </p>

      {msg && <div style={{ background: "#F3ECF9", color: PURPLE, padding: "10px 14px", borderRadius: 8, fontSize: 14, margin: "10px 0", fontWeight: 600 }}>{msg}</div>}

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Cargando…</p>
      ) : pendientes.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #e2d9ec", borderRadius: 12, padding: 28, textAlign: "center", color: "#94a3b8" }}>
          No tienes resúmenes pendientes de aprobar. 🎉
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {pendientes.map((r) => (
            <div key={r.id} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 14, padding: 16, boxShadow: "0 2px 10px rgba(26,10,31,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#1a1a2e" }}>{r.paciente || r.patient_email}</div>
                  <div style={{ fontSize: 12.5, color: "#64748b" }}>Sesión del {fmt(r.session_date)} · {r.patient_email}</div>
                </div>
                {r.alert && (
                  <span title={r.alert_reason || ""} style={{ background: "#FEF2F2", color: "#b91c1c", border: "1px solid #fecaca", padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 800 }}>
                    ⚠️ Revisar con cuidado
                  </span>
                )}
                <button onClick={() => setOpenId(openId === r.id ? null : r.id)} style={{ background: "#F3ECF9", color: PURPLE, border: "none", padding: "9px 14px", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {openId === r.id ? "Ocultar PDF" : "Ver PDF"}
                </button>
                <button onClick={() => aprobar(r.id)} disabled={busy === r.id} style={{ background: busy === r.id ? "#a78bba" : PURPLE, color: "#fff", border: "none", padding: "9px 16px", borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: busy === r.id ? "wait" : "pointer" }}>
                  {busy === r.id ? "Enviando…" : "Aprobar y enviar ✉️"}
                </button>
              </div>
              {r.alert && r.alert_reason && (
                <div style={{ marginTop: 8, background: "#FEF2F2", color: "#7f1d1d", borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
                  <strong>Nota para ti (no aparece en el PDF):</strong> {r.alert_reason}
                </div>
              )}
              {openId === r.id && r.preview_url && (
                <iframe src={r.preview_url} title={`Resumen ${r.paciente}`} style={{ width: "100%", height: 620, border: "1px solid #eee", borderRadius: 8, marginTop: 12 }} />
              )}
            </div>
          ))}
        </div>
      )}

      {enviados.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#64748b", margin: "0 0 8px" }}>Enviados recientemente</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {enviados.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 10, padding: "9px 14px", fontSize: 13 }}>
                <span style={{ color: "#16a34a" }}>✅</span>
                <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{r.paciente || r.patient_email}</span>
                <span style={{ color: "#94a3b8" }}>· sesión {fmt(r.session_date)}</span>
                <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 12 }}>enviado {fmt(r.sent_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
