import { redirect } from "next/navigation";
import Link from "next/link";
import { getPsicologa } from "@/lib/psicologa-auth";
import LogoutButton from "../_components/LogoutButton";
import NotificationBell from "@/components/NotificationBell";

export const dynamic = "force-dynamic";

const PURPLE = "#6A178C";

const nav = [
  { href: "/psicologo", label: "Inicio", emoji: "🏠" },
  { href: "/psicologo/citas", label: "Mis citas", emoji: "📅" },
  { href: "/psicologo/calendario", label: "Calendario", emoji: "🗓️" },
  { href: "/psicologo/pacientes", label: "Mis pacientes", emoji: "👥" },
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
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>{children}</main>
    </div>
  );
}
