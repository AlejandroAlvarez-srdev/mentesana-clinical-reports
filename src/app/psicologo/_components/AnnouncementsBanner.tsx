"use client";

// Banner de anuncios de la jefa de psicólogas en la entrada del panel.
// Muestra los anuncios no leídos. La psi los marca como leídos al
// cerrar / al hacer click en CTA. Se ordena por pinned y prioridad.
//
// Fuente: /api/psicologa/announcements (incluye pinned, priority,
// link_url, link_label, image_url, kind).
import { useEffect, useState } from "react";

const PURPLE = "#6A178C";
const GOLD = "#D4AF37";

type Ann = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  priority: "low" | "normal" | "high" | "urgent" | string;
  pinned: boolean;
  published_at: string;
  author_name: string | null;
  read: boolean;
};

const KIND_META: Record<string, { emoji: string; tone: string }> = {
  news:         { emoji: "📰", tone: "#0891b2" },
  announcement: { emoji: "📣", tone: PURPLE },
  quote:        { emoji: "✨", tone: "#d97706" },
  celebration:  { emoji: "🎉", tone: "#16a34a" },
  training:     { emoji: "🎓", tone: "#7c3aed" },
  reminder:     { emoji: "⏰", tone: "#dc2626" },
};
const PRIORITY_TONE: Record<string, string> = {
  urgent: "#dc2626",
  high:   "#d97706",
  normal: PURPLE,
  low:    "#64748b",
};

export default function AnnouncementsBanner() {
  const [items, setItems] = useState<Ann[]>([]);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/psicologa/announcements", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { announcements: [] }))
      .then((d: { announcements: Ann[] }) => {
        const unread = (d.announcements ?? []).filter((a) => !a.read);
        // Pinned primero, luego prioridad urgent > high > normal > low
        const rank = (p: string) => ({ urgent: 0, high: 1, normal: 2, low: 3 }[p as "urgent" | "high" | "normal" | "low"] ?? 2);
        unread.sort((a, b) => Number(b.pinned) - Number(a.pinned) || rank(a.priority) - rank(b.priority));
        setItems(unread);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function markRead(id: string) {
    try {
      await fetch("/api/psicologa/announcements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch { /* offline -> ignoramos, igualmente se quita del state */ }
    setItems((prev) => {
      const next = prev.filter((a) => a.id !== id);
      setIdx((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  }

  if (!loaded || items.length === 0) return null;
  const a = items[idx];
  const kind = KIND_META[a.kind] ?? KIND_META.announcement;
  const tone = a.priority === "urgent" || a.priority === "high" ? PRIORITY_TONE[a.priority] : kind.tone;

  return (
    <div
      role="region"
      aria-label="Anuncios del equipo"
      style={{
        background: `linear-gradient(135deg, ${tone} 0%, #1a0a1f 110%)`,
        color: "#fff",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        boxShadow: `0 12px 36px ${tone}33`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decoración suave */}
      <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}22 0%, transparent 70%)` }} />

      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span aria-hidden style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{kind.emoji}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
              {a.pinned && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: GOLD, background: "rgba(255,255,255,0.12)", padding: "1px 6px", borderRadius: 4 }}>📌 Pin</span>}
              {a.priority === "urgent" && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", background: "#fff", color: "#dc2626", padding: "1px 6px", borderRadius: 4 }}>Urgente</span>}
              {a.author_name && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>· {a.author_name}</span>}
            </div>
            <h3 style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 17, fontWeight: 500, margin: 0, lineHeight: 1.2, letterSpacing: -0.3 }}>{a.title}</h3>
            {a.body && <p style={{ fontSize: 13, opacity: 0.92, margin: "5px 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{a.body}</p>}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
          {a.link_url && (
            <a
              href={a.link_url}
              target={a.link_url.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={() => void markRead(a.id)}
              style={{ padding: "8px 14px", background: "#fff", color: tone, borderRadius: 999, fontWeight: 800, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              {a.link_label ?? "Ver más"}
            </a>
          )}
          <button
            onClick={() => void markRead(a.id)}
            aria-label="Marcar como leído"
            style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >✕</button>
        </div>
      </div>

      {items.length > 1 && (
        <div style={{ position: "relative", display: "flex", justifyContent: "center", gap: 5, marginTop: 12 }}>
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Ver anuncio ${i + 1}`}
              style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 999, background: i === idx ? "#fff" : "rgba(255,255,255,0.4)", border: "none", padding: 0, cursor: "pointer", transition: "width .2s" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
