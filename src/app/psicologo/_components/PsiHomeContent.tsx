"use client";

// Contenido valioso para la psicóloga: anuncios CEO/jefe + frase del día + blogs + studio shorts + acceso al chat IA.
import { useEffect, useState } from "react";
import Link from "next/link";

const PURPLE = "#6A178C";

type Ann = { id: string; kind: string; title: string; body: string | null; image_url: string | null; link_url: string | null; link_label: string | null; priority: string; pinned: boolean; published_at: string; read: boolean; author_name: string | null };
type Inspiration = {
  quote: { text: string; author: string | null; category: string | null } | null;
  blogs: { slug: string; title: string; subtitle: string | null; category: string | null; hero_image: string | null; publish_date: string | null; read_time: string | null; author: string | null; url: string }[];
  shorts: { id: string; hook: string | null; video_url: string | null; image_url: string | null; brief: string | null }[];
};

const KIND_STYLE: Record<string, { color: string; label: string }> = {
  news: { color: "#0891b2", label: "📰 Noticia" },
  announcement: { color: PURPLE, label: "📣 Aviso" },
  quote: { color: "#d97706", label: "✨ Frase" },
  celebration: { color: "#16a34a", label: "🎉 Celebración" },
  training: { color: "#7c3aed", label: "🎓 Formación" },
  reminder: { color: "#dc2626", label: "⏰ Recordatorio" },
};

export default function PsiHomeContent() {
  const [anns, setAnns] = useState<Ann[]>([]);
  const [insp, setInsp] = useState<Inspiration | null>(null);

  useEffect(() => {
    fetch("/api/psicologa/announcements", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(d => { if (d) setAnns(d.announcements ?? []); });
    fetch("/api/psicologa/inspiration", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(setInsp);
  }, []);

  async function markRead(id: string) {
    await fetch("/api/psicologa/announcements", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setAnns(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  }

  return (
    <>
      {/* Frase del día */}
      {insp?.quote && (
        <section style={{ marginTop: 22, marginBottom: 22, padding: 24, background: `linear-gradient(135deg, ${PURPLE}, #8B2FB5, #C040E0)`, borderRadius: 18, color: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -10, fontSize: 140, opacity: 0.1, lineHeight: 1 }}>"</div>
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, opacity: 0.85, marginBottom: 8 }}>✨ FRASE DEL DÍA</div>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, fontStyle: "italic", fontWeight: 600 }}>"{insp.quote.text}"</p>
            {insp.quote.author && <p style={{ margin: "10px 0 0", fontSize: 12.5, opacity: 0.9 }}>— {insp.quote.author}</p>}
          </div>
        </section>
      )}

      {/* Acompaña chat IA */}
      <Link href="/psicologo/acompana" style={{ display: "block", padding: 18, background: "linear-gradient(135deg, #1a0a1f 0%, #2D0F44 100%)", borderRadius: 14, marginBottom: 22, color: "#fff", textDecoration: "none", border: "1px solid rgba(252, 211, 77, 0.25)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, fontSize: 110, opacity: 0.1 }}>🌿</div>
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-block", padding: "3px 10px", background: "rgba(252, 211, 77, 0.15)", border: "1px solid rgba(252, 211, 77, 0.3)", borderRadius: 999, fontSize: 10, fontWeight: 900, color: "#FCD34D", letterSpacing: 1.2, marginBottom: 8 }}>🤖 ASISTENTE IA CONFIDENCIAL</div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>🌿 Acompaña — espacio para ti</h3>
          <p style={{ margin: "6px 0 8px", fontSize: 13, opacity: 0.92, lineHeight: 1.5, maxWidth: 640 }}>Una IA entrenada psicológicamente para acompañarte cuando una sesión te deja tocada, dudas con un caso o necesitas pensar en voz alta. Confidencial — solo tú ves tus conversaciones.</p>
          <span style={{ display: "inline-block", padding: "7px 14px", background: "rgba(252, 211, 77, 0.2)", color: "#FCD34D", borderRadius: 8, fontSize: 12, fontWeight: 800 }}>Hablar con Acompaña →</span>
        </div>
      </Link>

      {/* Anuncios CEO/jefe */}
      {anns.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 900, color: "#1a1a2e", textTransform: "uppercase", letterSpacing: 0.5 }}>📢 Avisos y novedades</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {anns.map(a => {
              const style = KIND_STYLE[a.kind] ?? KIND_STYLE.news;
              const isUnread = !a.read;
              const isUrgent = a.priority === "urgent";
              return (
                <div key={a.id} onClick={() => !a.read && void markRead(a.id)} style={{ padding: 14, background: "#fff", borderRadius: 12, borderLeft: `4px solid ${style.color}`, boxShadow: isUnread ? `0 2px 8px ${style.color}22` : "none", cursor: "pointer", position: "relative" }}>
                  {isUnread && <span style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, background: style.color, borderRadius: "50%" }} />}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {a.image_url && <img src={a.image_url} alt="" style={{ width: 90, height: 70, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9.5, padding: "2px 6px", background: `${style.color}15`, color: style.color, borderRadius: 4, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>{style.label}</span>
                        {a.pinned && <span style={{ fontSize: 9.5, padding: "2px 6px", background: "rgba(217,119,6,0.14)", color: "#92400e", borderRadius: 4, fontWeight: 800 }}>📌</span>}
                        {isUrgent && <span style={{ fontSize: 9.5, padding: "2px 6px", background: "#dc2626", color: "#fff", borderRadius: 4, fontWeight: 800 }}>URGENTE</span>}
                      </div>
                      <strong style={{ fontSize: 14, color: "#1a1a2e" }}>{a.title}</strong>
                      {a.body && <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "#475569", lineHeight: 1.5, whiteSpace: "pre-line" }}>{a.body}</p>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{a.author_name ?? "Admin"} · {new Date(a.published_at).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</span>
                        {a.link_url && <a href={a.link_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ padding: "5px 12px", background: style.color, color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 800, textDecoration: "none" }}>{a.link_label || "Ver →"}</a>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Blogs Mente Sana */}
      {insp?.blogs && insp.blogs.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 900, color: "#1a1a2e", textTransform: "uppercase", letterSpacing: 0.5 }}>📚 Últimos artículos Mente Sana</h3>
            <a href="https://mentesanapsicologia.com/blog" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: PURPLE, textDecoration: "none", fontWeight: 700 }}>Ver blog completo →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {insp.blogs.map(b => (
              <a key={b.slug} href={b.url} target="_blank" rel="noreferrer" style={{ display: "block", background: "#fff", borderRadius: 12, overflow: "hidden", textDecoration: "none", color: "#1a1a2e", border: "1px solid rgba(0,0,0,0.06)" }}>
                {b.hero_image && <img src={b.hero_image} alt={b.title} style={{ width: "100%", height: 110, objectFit: "cover" }} />}
                <div style={{ padding: 12 }}>
                  {b.category && <div style={{ fontSize: 9.5, fontWeight: 800, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{b.category}</div>}
                  <strong style={{ fontSize: 13, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.title}</strong>
                  {b.subtitle && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#666", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.subtitle}</p>}
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>{b.read_time ?? "5 min"} · {b.publish_date ? new Date(b.publish_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Studio shorts (vídeos de Mente Sana) */}
      {insp?.shorts && insp.shorts.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 900, color: "#1a1a2e", textTransform: "uppercase", letterSpacing: 0.5 }}>🎥 Shorts inspiradores Mente Sana</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {insp.shorts.slice(0, 4).map(s => (
              <div key={s.id} style={{ background: "#000", borderRadius: 12, overflow: "hidden", aspectRatio: "9/16", maxHeight: 280, position: "relative" }}>
                {s.video_url ? <video src={s.video_url} controls poster={s.image_url ?? undefined} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : s.image_url ? <img src={s.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                {s.hook && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 8, background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)", color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.3, maxHeight: 80, overflow: "hidden" }}>{s.hook.slice(0, 80)}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
