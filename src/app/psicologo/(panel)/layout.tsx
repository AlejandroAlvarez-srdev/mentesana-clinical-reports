import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getPsicologa } from "@/lib/psicologa-auth";
import { hasPairedExtension } from "@/lib/psicologa-extension";
import LogoutButton from "../_components/LogoutButton";
import NotificationBell from "@/components/NotificationBell";

// Detección server-side de móvil. La extensión solo existe en Chrome de
// escritorio, así que en móvil ni la pedimos ni la chequeamos: la psi
// puede entrar al panel a ver citas/pacientes/etc. sin fricción.
function isMobileFromUA(ua: string | null): boolean {
  if (!ua) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

export const dynamic = "force-dynamic";

const PURPLE = "#6A178C";

// Nav del panel psicóloga. "Sesiones" (grabaciones de Meet) oculto desde
// 2026-06-01 — la página /psicologo/sesiones sigue accesible por URL directa
// pero ya no aparece en la barra para no llamar la atención al equipo.
const nav = [
  { href: "/psicologo", label: "Inicio", emoji: "🏠" },
  { href: "/psicologo/citas", label: "Mis citas", emoji: "📅" },
  { href: "/psicologo/calendario", label: "Calendario", emoji: "🗓️" },
  { href: "/psicologo/pacientes", label: "Mis pacientes", emoji: "👥" },
  { href: "/psicologo/tareas", label: "Tareas", emoji: "📝" },
  { href: "/psicologo/acompana", label: "Acompaña", emoji: "🌿" },
  { href: "/psicologo/asistente", label: "Asistente", emoji: "🤖" },
  { href: "/psicologo/blog", label: "Blog SEO", emoji: "✍️" },
  { href: "/psicologo/quejas", label: "Reportes al jefe", emoji: "💬" },
];

// Calificación de pacientes (session_reviews · NPS 0-10 → estrellas 0-5).
// Verde ≥4.5, amarillo ≥3.5, rojo por debajo. SIEMPRE visible: sin reviews → 5.0 verde.
async function loadRating(providerId: number): Promise<{ stars: number; count: number; color: string; bg: string }> {
  const DEFAULT = { stars: 5, count: 0, color: "#166534", bg: "#dcfce7" };
  try {
    const { sbBlog } = await import("@/lib/psicologa-extension");
    const { data } = await sbBlog()
      .from("session_reviews")
      .select("nps")
      .eq("provider_id", providerId);
    if (!data || data.length === 0) return DEFAULT;
    const avg = data.reduce((s, r) => s + Number(r.nps), 0) / data.length;
    const stars = Math.round((avg / 2) * 10) / 10; // 0-10 → 0-5, un decimal
    const [color, bg] = stars >= 4.5 ? ["#166534", "#dcfce7"] : stars >= 3.5 ? ["#92400e", "#fef3c7"] : ["#991b1b", "#fee2e2"];
    return { stars, count: data.length, color, bg };
  } catch {
    return DEFAULT;
  }
}

async function loadAvatar(providerId: number): Promise<string | null> {
  try {
    const { ameliaQuery, ameliaTable } = await import("@/lib/amelia-db");
    const rows = await ameliaQuery<any>(`SELECT pictureFullPath, pictureThumbPath FROM ${ameliaTable("users")} WHERE id = ? LIMIT 1`, [providerId]);
    if (rows.length > 0) return rows[0].pictureThumbPath || rows[0].pictureFullPath || null;
  } catch {}
  return null;
}

export default async function PsicologaLayout({ children }: { children: React.ReactNode }) {
  const p = await getPsicologa();
  if (!p) redirect("/psicologo/login");
  // Supervisora sin psi elegida → forzar selección
  if (p.is_supervisor && (!p.provider_id || p.provider_id <= 0)) {
    redirect("/psicologo/elegir-psicologa");
  }
  const h = await headers();
  const isMobile = isMobileFromUA(h.get("user-agent"));
  // Gate one-time: basta con que la psi HAYA pareado la extensión alguna vez
  // (fila no revocada). NO miramos heartbeat fresco: el service worker de Chrome
  // se duerme y, con el gate antiguo (heartbeat 15 min), echaba a la psi al panel
  // de instalar una y otra vez ("me saca / reinstalar" — Marlen, Mónica, Yeris).
  // El uninstall real se detecta porque el pair endpoint revoca la fila vieja.
  if (!p.is_supervisor && !isMobile && !(await hasPairedExtension(p.provider_id))) {
    redirect("/psicologo/instalar-extension");
  }
  const initials = (p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "");
  const avatar = await loadAvatar(p.provider_id);
  const rating = await loadRating(p.provider_id);

  return (
    <div data-panel-psi style={{ minHeight: "100vh", background: "#FFFAF2", fontFamily: "Inter, sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "12px 20px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Link href="/psicologo" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <img src="/images/logo.webp" alt="Mente Sana" style={{ height: 24 }} />
            <small style={{ fontSize: 9, fontWeight: 800, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.5 }}>Panel psicóloga</small>
          </Link>
          <nav style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center", flexWrap: "wrap" }}>
            {nav.map((it) => (
              <Link key={it.href} href={it.href} style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#475569", textDecoration: "none", borderRadius: 8 }}>
                <span style={{ marginRight: 4 }}>{it.emoji}</span> {it.label}
              </Link>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NotificationBell api="/api/psicologa/notifications" />
            {avatar ? (
              <img src={avatar} alt={p.name} title={p.email} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: `2px solid ${PURPLE}` }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }} title={p.email}>
                {initials.toUpperCase() || "P"}
              </div>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>
      {/* Barrita sticky de rendimiento (15px): manuscrita (Caveat), fondo semáforo */}
      <div
        className="font-handwriting"
        style={{
          position: "sticky",
          top: 62,
          zIndex: 45,
          height: 15,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          background: `linear-gradient(90deg, ${rating.color}e6 0%, ${rating.color} 35%, ${rating.color} 65%, ${rating.color}e6 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 8px ${rating.color}33`,
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: 0.3,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
        title={`Tu calificación media de pacientes: ${rating.stars.toFixed(1)}/5`}
      >
        <span style={{ fontSize: 8, opacity: 0.9 }}>✦</span>
        tu calificación: {rating.stars.toFixed(1)} de 5
        <span style={{ fontSize: 8, opacity: 0.9 }}>✦</span>
        {rating.count === 0 ? "aún sin valoraciones" : `${rating.count} ${rating.count === 1 ? "paciente te ha valorado" : "pacientes te han valorado"}`}
        <span style={{ fontSize: 8, opacity: 0.9 }}>✦</span>
      </div>
      {p.is_supervisor && (
        <div style={{ background: "linear-gradient(135deg, #6A178C, #8B2FB5)", color: "#fff", padding: "8px 16px", fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <span><strong style={{ color: "#D4AF37" }}>👁 Modo supervisora</strong> · Estás viendo el panel de <strong>{p.name}</strong></span>
          <a href="/psicologo/elegir-psicologa" style={{ background: "rgba(255,255,255,0.18)", color: "#fff", padding: "4px 12px", borderRadius: 999, textDecoration: "none", fontWeight: 700, fontSize: 11.5 }}>Cambiar psicóloga →</a>
        </div>
      )}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>{children}</main>
      {/* Badge flotante de calificación — burbuja premium fija abajo-izquierda.
          Estrellas pintadas según nota, número con semáforo (verde ≥4.5 ·
          amarillo ≥3.5 · rojo) y animación de entrada. */}
      <div
        className="psi-rating-bubble"
        title={rating.count === 0 ? "Tu calificación de pacientes — empieza en 5.0 y se actualiza con cada valoración" : `Tu calificación media de pacientes: ${rating.stars.toFixed(1)}/5 basada en ${rating.count} ${rating.count === 1 ? "valoración" : "valoraciones"}`}
        style={{
          position: "fixed",
          bottom: 22,
          left: 22,
          zIndex: 90,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 18px 12px 14px",
          borderRadius: 20,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(14px) saturate(1.6)",
          WebkitBackdropFilter: "blur(14px) saturate(1.6)",
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow: `0 18px 44px ${rating.color}38, 0 2px 8px rgba(26,10,31,0.08), inset 0 1px 0 rgba(255,255,255,0.9)`,
          cursor: "default",
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${rating.color} 0%, ${rating.color}bb 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: `0 8px 18px ${rating.color}55`,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M12 2l2.92 6.26 6.58.84-4.84 4.7 1.24 6.6L12 17.27 6.1 20.4l1.24-6.6L2.5 9.1l6.58-.84L12 2z" />
          </svg>
        </span>
        <span style={{ lineHeight: 1 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontSize: 21, fontWeight: 900, color: "#1a0a1f", letterSpacing: "-0.03em" }}>
              {rating.stars.toFixed(1)}
            </span>
            <span style={{ display: "inline-flex", gap: 1.5 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i <= Math.round(rating.stars) ? rating.color : "#e2e0e6"} aria-hidden="true">
                  <path d="M12 2l2.92 6.26 6.58.84-4.84 4.7 1.24 6.6L12 17.27 6.1 20.4l1.24-6.6L2.5 9.1l6.58-.84L12 2z" />
                </svg>
              ))}
            </span>
          </span>
          <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "#8a8595", marginTop: 5, letterSpacing: 0.1 }}>
            {rating.count === 0 ? "Tu calificación · aún sin valoraciones" : `Tu calificación · ${rating.count} ${rating.count === 1 ? "paciente" : "pacientes"}`}
          </span>
        </span>
      </div>
      <style>{`
        .psi-rating-bubble { animation: psi-rating-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both; transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .psi-rating-bubble:hover { transform: translateY(-3px) scale(1.03); }
        @keyframes psi-rating-in { from { opacity: 0; transform: translateY(24px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (max-width: 640px) { .psi-rating-bubble { bottom: 14px !important; left: 14px !important; padding: 9px 14px 9px 11px !important; } }
      `}</style>
      {/* ExtensionWatchdog desactivado 2026-06-01 — generaba demasiados
          falsos positivos echando psicólogas del CRM. Gate único en SSR
          con hasPairedExtension() de arriba: una vez pareada, no se
          revoca por desconexión transitoria. */}
    </div>
  );
}
