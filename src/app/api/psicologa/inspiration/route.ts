// Daily pack para psicóloga: frase del día + últimos blogs + podcast shorts/episodios.
// Los shorts y episodios son los mismos que se publican en /podcast (canónico).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";

// Episodios del podcast (espejo de /components/PodcastContent.tsx)
const PODCAST_EPISODES = [
  { id: "VG2UNvJ7crI", title: "Episodio 03 — Nuevo capítulo", description: "Último episodio del podcast de Mente Sana — una conversación honesta sobre lo que nadie se atreve a decir en voz alta." },
  { id: "jCgV05U5-ZE", title: "Episodio 02 — Romper el ciclo", description: "Cómo identificar patrones que se repiten y dar el primer paso para soltarlos desde la conciencia." },
  { id: "Yzd-vieMGH8", title: "Episodio 01 — Conversación íntima", description: "Una conversación profunda sobre vulnerabilidad, sanación y los procesos internos que nos hacen crecer." },
];

// Shorts del podcast (espejo de /components/PodcastContent.tsx)
const PODCAST_SHORTS = [
  { id: "XENzdDhMnDo", title: "Nuevo short — momento destacado" },
  { id: "iRzVF3Z0icI", title: "Short — momento destacado" },
  { id: "rErU4GeQBVM", title: "Lo que nadie te dijo sobre la ansiedad" },
  { id: "cAOxDTDzy-0", title: "El error que cometemos al sanar" },
  { id: "Dlv9-La1c4I", title: "Cuando el cuerpo grita lo que callas" },
  { id: "VHK-jGtlXow", title: "Soltar no es olvidar" },
  { id: "2uD8jHT6nOs", title: "El verdadero amor propio" },
  { id: "AffgTZOJbgc", title: "Aprender a estar en pausa" },
];

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;

  // Frase del día: determinística por fecha → misma frase para todas las psis ese día
  const { data: quotes } = await sb.from("psi_inspirational_quotes").select("*").eq("active", true);
  let quote = null;
  if (quotes && quotes.length > 0) {
    const dayIdx = Math.floor(Date.now() / 86400000);
    quote = quotes[dayIdx % quotes.length];
  }

  // Últimos 6 blogs publicados
  const { data: blogs } = await sb.from("blog_articles").select("slug, title, subtitle, category, hero_image, publish_date, read_time, author").order("publish_date", { ascending: false, nullsFirst: false }).limit(6);

  return NextResponse.json({
    quote,
    blogs: (blogs ?? []).map(b => ({ slug: b.slug, title: b.title, subtitle: b.subtitle, category: b.category, hero_image: b.hero_image, publish_date: b.publish_date, read_time: b.read_time, author: b.author, url: `https://mentesanapsicologia.com/blog/${b.slug}` })),
    episodes: PODCAST_EPISODES.map(ep => ({
      id: ep.id,
      title: ep.title,
      description: ep.description,
      embed_url: `https://www.youtube.com/embed/${ep.id}`,
      watch_url: `https://www.youtube.com/watch?v=${ep.id}`,
      thumbnail_url: `https://img.youtube.com/vi/${ep.id}/hqdefault.jpg`,
    })),
    shorts: PODCAST_SHORTS.map(s => ({
      id: s.id,
      title: s.title,
      embed_url: `https://www.youtube.com/embed/${s.id}`,
      watch_url: `https://www.youtube.com/shorts/${s.id}`,
      thumbnail_url: `https://img.youtube.com/vi/${s.id}/hqdefault.jpg`,
    })),
  });
}
