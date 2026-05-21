// Daily pack para psicóloga: frase del día + últimos blogs + studio shorts.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";

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

  // Últimos studio shorts (videos generados con captioned_url)
  const { data: shorts } = await sb.from("studio_jobs").select("id, hook, captioned_url, video_url, image_url, brief, created_at").not("captioned_url", "is", null).order("created_at", { ascending: false }).limit(6);

  return NextResponse.json({
    quote,
    blogs: (blogs ?? []).map(b => ({ slug: b.slug, title: b.title, subtitle: b.subtitle, category: b.category, hero_image: b.hero_image, publish_date: b.publish_date, read_time: b.read_time, author: b.author, url: `https://mentesanapsicologia.com/blog/${b.slug}` })),
    shorts: (shorts ?? []).map(s => ({ id: s.id, hook: s.hook, video_url: s.captioned_url || s.video_url, image_url: s.image_url, brief: s.brief, created_at: s.created_at })),
  });
}
