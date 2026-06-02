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
  { href: "/psicologo/acompana", label: "Acompaña", emoji: "🌿" },
  { href: "/psicologo/asistente", label: "Asistente", emoji: "🤖" },
  { href: "/psicologo/quejas", label: "Reportes al jefe", emoji: "💬" },
];

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
  // Gate de UNA VEZ: la psi tiene que parear la extensión una primera
  // vez para acceder al panel. Después YA NO la echamos del CRM aunque
  // la ext deje de hacer heartbeat (Chrome MV3 duerme los service
  // workers, wifi flaky, etc — genera demasiados falsos positivos).
  // El control de calidad de las grabaciones se hace por otro lado.
  if (!p.is_supervisor && !isMobile && !(await hasPairedExtension(p.provider_id))) {
    redirect("/psicologo/instalar-extension");
  }
  const initials = (p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "");
  const avatar = await loadAvatar(p.provider_id);

  return (
    <div style={{ minHeight: "100vh", background: "#FFFAF2", fontFamily: "Inter, sans-serif" }}>
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
      {p.is_supervisor && (
        <div style={{ background: "linear-gradient(135deg, #6A178C, #8B2FB5)", color: "#fff", padding: "8px 16px", fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <span><strong style={{ color: "#D4AF37" }}>👁 Modo supervisora</strong> · Estás viendo el panel de <strong>{p.name}</strong></span>
          <a href="/psicologo/elegir-psicologa" style={{ background: "rgba(255,255,255,0.18)", color: "#fff", padding: "4px 12px", borderRadius: 999, textDecoration: "none", fontWeight: 700, fontSize: 11.5 }}>Cambiar psicóloga →</a>
        </div>
      )}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>{children}</main>
      {/* ExtensionWatchdog desactivado 2026-06-01 — generaba demasiados
          falsos positivos echando psicólogas del CRM. Gate único en SSR
          con hasPairedExtension() de arriba: una vez pareada, no se
          revoca por desconexión transitoria. */}
    </div>
  );
}
