"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const PURPLE = "#6A178C";
const GOLD = "#D4AF37";

type Post = {
  id: string;
  keyword: string;
  title: string;
  slug: string;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "archived";
  scheduled_for: string | null;
  published_at: string | null;
  hero_url: string | null;
  hero_status: "pending" | "generating" | "ready" | "failed";
  seo_status: "pending" | "generating" | "ready" | "failed";
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<Post["status"], { bg: string; fg: string; label: string }> = {
  draft: { bg: "#f3f4f6", fg: "#374151", label: "Borrador" },
  scheduled: { bg: "#fef3c7", fg: "#92400e", label: "Programado" },
  publishing: { bg: "#dbeafe", fg: "#1e40af", label: "Publicando…" },
  published: { bg: "#dcfce7", fg: "#065f46", label: "Publicado" },
  failed: { bg: "#fee2e2", fg: "#991b1b", label: "Fallido" },
  archived: { bg: "#e5e7eb", fg: "#6b7280", label: "Archivado" },
};

export default function BlogListClient({ initialPosts, psyName }: { initialPosts: Post[]; psyName: string }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/psicologa/blog/drafts", { credentials: "include" });
    const j = await r.json().catch(() => ({}));
    if (Array.isArray(j.posts)) setPosts(j.posts);
    setLoading(false);
  }

  useEffect(() => {
    // Refresh cada 20s para ver cambios de estado (publishing → published, seo, etc.)
    const t = setInterval(refresh, 20_000);
    return () => clearInterval(t);
  }, []);

  const kpis = {
    drafts: posts.filter(p => p.status === "draft").length,
    scheduled: posts.filter(p => p.status === "scheduled").length,
    published: posts.filter(p => p.status === "published").length,
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
      <header style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.02em" }}>
            ✍️ Tu blog SEO
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>Hola {psyName.split(" ")[0]} · escribe artículos optimizados para SEO en pocos pasos.</p>
        </div>
        <Link href="/psicologo/blog/nuevo" style={{
          padding: "11px 18px", background: PURPLE, color: "#fff",
          textDecoration: "none", borderRadius: 10, fontWeight: 700, fontSize: 13,
          boxShadow: `0 6px 18px ${PURPLE}33`,
        }}>+ Nuevo artículo</Link>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
        <Kpi label="BORRADORES" value={kpis.drafts} color="#374151" bg="#f3f4f6" />
        <Kpi label="PROGRAMADOS" value={kpis.scheduled} color="#92400e" bg="#fef3c7" />
        <Kpi label="PUBLICADOS" value={kpis.published} color="#065f46" bg="#dcfce7" />
      </div>

      {loading && <p style={{ color: "#888", fontSize: 12 }}>Actualizando…</p>}

      {posts.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", background: "#fff", borderRadius: 14, border: "1px dashed rgba(106,23,140,0.2)" }}>
          <p style={{ fontSize: 14, color: "#666", margin: 0 }}>Aún no tienes artículos. Empieza por darle a <strong style={{ color: PURPLE }}>+ Nuevo artículo</strong>.</p>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {posts.map((p) => {
          const s = STATUS_LABEL[p.status];
          return (
            <div key={p.id} style={{ padding: 14, background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {p.hero_url ? (
                <img src={p.hero_url} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 80, height: 60, background: `linear-gradient(135deg, ${PURPLE}22, ${GOLD}22)`, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📝</div>
              )}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ padding: "3px 8px", borderRadius: 6, background: s.bg, color: s.fg, fontSize: 10.5, fontWeight: 800 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: "#888" }}>kw: <code style={{ background: "#f5f5f7", padding: "1px 6px", borderRadius: 4 }}>{p.keyword}</code></span>
                  {p.status === "published" && p.seo_status === "ready" && <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 5, background: "#dcfce7", color: "#065f46", fontWeight: 700 }}>SEO ✓</span>}
                  {p.status === "published" && p.seo_status === "pending" && <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 5, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>SEO generando…</span>}
                </div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>{p.title}</h3>
                <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#888" }}>
                  /blog/{p.slug} · actualizado {new Date(p.updated_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {p.status === "published" ? (
                  <a href={`/blog/${p.slug}`} target="_blank" rel="noopener" style={btnSecondary}>Ver →</a>
                ) : (
                  <Link href={`/psicologo/blog/${p.id}`} style={btnSecondary}>Editar →</Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ padding: 14, background: bg, borderRadius: 10 }}>
      <div style={{ fontSize: 10.5, color, fontWeight: 800, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  padding: "8px 14px", background: "#fff", color: PURPLE,
  border: `1.5px solid ${PURPLE}`, borderRadius: 8,
  fontWeight: 700, fontSize: 12.5, cursor: "pointer", textDecoration: "none",
};
