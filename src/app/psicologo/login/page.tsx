"use client";

import { useState } from "react";

const PURPLE = "#6A178C";

export default function PsicologaLoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function requestOtp() {
    if (!email.trim()) return;
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/psicologa/auth/request-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!r.ok) { setErr("Error enviando código"); return; }
      setStep("code");
    } finally { setLoading(false); }
  }
  async function verifyOtp() {
    if (!code.trim()) return;
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/psicologa/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error === "invalid_code" ? "Código incorrecto" : d.error === "expired" ? "Código expirado, pide otro" : d.error === "too_many_attempts" ? "Demasiados intentos, espera" : "Error verificando"); return; }
      window.location.href = "/psicologo";
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #2d0e3e 0%, #6A178C 50%, #FFFAF2 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/images/logo.webp" alt="Mente Sana" style={{ height: 28, marginBottom: 8 }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: PURPLE, margin: "0 0 4px" }}>Panel psicóloga</h1>
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>{step === "email" ? "Te enviaremos un código por email" : `Código enviado a ${email}`}</p>
        </div>
        {err && <div style={{ padding: 10, background: "#fef2f2", color: "#991b1b", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>⚠️ {err}</div>}
        {step === "email" && (
          <>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu email@gmail.com" autoFocus
              style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, marginBottom: 10, fontFamily: "inherit", boxSizing: "border-box" }}
              onKeyDown={(e) => { if (e.key === "Enter") void requestOtp(); }} />
            <button onClick={() => void requestOtp()} disabled={loading || !email.trim()}
              style={{ width: "100%", padding: 12, background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: loading || !email.trim() ? 0.5 : 1 }}>
              {loading ? "Enviando…" : "Enviar código"}
            </button>
          </>
        )}
        {step === "code" && (
          <>
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))} placeholder="6 dígitos" autoFocus
              style={{ width: "100%", padding: "14px", fontSize: 20, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, marginBottom: 10, fontFamily: "ui-monospace, monospace", letterSpacing: 8, textAlign: "center", boxSizing: "border-box" }}
              onKeyDown={(e) => { if (e.key === "Enter") void verifyOtp(); }} />
            <button onClick={() => void verifyOtp()} disabled={loading || code.length !== 6}
              style={{ width: "100%", padding: 12, background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: loading || code.length !== 6 ? 0.5 : 1, marginBottom: 8 }}>
              {loading ? "Verificando…" : "Entrar"}
            </button>
            <button onClick={() => { setStep("email"); setCode(""); setErr(null); }} style={{ background: "transparent", border: "none", color: PURPLE, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}>← cambiar email</button>
          </>
        )}
        <p style={{ fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 18 }}>Solo psicólogas registradas en Amelia. Si tu email no funciona contacta admin.</p>
      </div>
    </div>
  );
}
