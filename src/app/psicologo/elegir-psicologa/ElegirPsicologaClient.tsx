"use client";

import { useEffect, useMemo, useState } from "react";

const PURPLE = "#6A178C";

type Provider = { id: number; name: string; email: string | null; avatar: string | null };

export default function ElegirPsicologaClient({ leaderName, leaderEmail }: { leaderName: string; leaderEmail: string }) {
  const [list, setList] = useState<Provider[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/psicologa/supervisor/providers", { credentials: "include" });
        if (!r.ok) { setErr("No autorizado"); return; }
        const d = await r.json();
        setList(d.providers ?? []);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((p) => p.name.toLowerCase().includes(s) || (p.email ?? "").toLowerCase().includes(s));
  }, [q, list]);

  async function impersonate(provider_id: number) {
    const r = await fetch("/api/psicologa/supervisor/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider_id }),
    });
    if (!r.ok) { alert("Error al cambiar"); return; }
    window.location.href = "/psicologo";
  }

  async function logout() {
    await fetch("/api/psicologa/auth/verify-otp", { method: "DELETE", credentials: "include" });
    window.location.href = "/psicologo/login";
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #2d0e3e 0%, #6A178C 50%, #FFFAF2 100%)", padding: "40px 16px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <header style={{ background: "#fff", borderRadius: 20, padding: "20px 24px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: PURPLE }}>👁 Modo supervisora</div>
            <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 500, fontSize: 22, margin: "4px 0 2px", color: "#1a0a1f" }}>Hola {leaderName}</h1>
            <div style={{ fontSize: 12, color: "#666" }}>Elige qué psicóloga quieres ver. Lo verás todo igual que ella en su panel.</div>
            <div style={{ fontSize: 10.5, color: "#999", marginTop: 4 }}>Entrada: {leaderEmail}</div>
          </div>
          <button onClick={() => void logout()} style={{ background: "transparent", border: "1px solid rgba(220,38,38,0.5)", color: "#dc2626", padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Salir</button>
        </header>

        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.12)" }}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o email…" autoFocus
            style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, marginBottom: 16, fontFamily: "inherit", boxSizing: "border-box" }} />
          {err && <div style={{ padding: 10, background: "#fef2f2", color: "#991b1b", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>⚠️ {err}</div>}
          {loading ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "#999", fontSize: 13 }}>Cargando psicólogas…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "#999", fontSize: 13 }}>Ninguna coincide con la búsqueda.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {filtered.map((p) => (
                <button key={p.id} onClick={() => void impersonate(p.id)}
                  style={{ background: "#FFFAF2", border: `1px solid rgba(106,23,140,0.12)`, borderRadius: 14, padding: "14px 12px", textAlign: "center", cursor: "pointer", transition: "transform .12s, box-shadow .12s", fontFamily: "inherit" }}
                  onMouseOver={(e) => { e.currentTarget.style.boxShadow = `0 12px 30px rgba(106,23,140,0.15)`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}>
                  {p.avatar ? (
                    <img src={p.avatar} alt={p.name} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", margin: "0 auto 8px", display: "block", border: `2px solid ${PURPLE}` }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, margin: "0 auto 8px" }}>
                      {p.name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase() || "?"}
                    </div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1a0a1f", lineHeight: 1.25, marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{p.id}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
