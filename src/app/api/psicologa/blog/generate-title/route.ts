// POST /api/psicologa/blog/generate-title { keyword }
// Devuelve 3 títulos SEO + sugerencias de slug para la psicóloga.
// La IA SOLO genera títulos — el cuerpo del post lo escribe ella.
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { slugify } from "@/lib/psy-blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ANTHROPIC_KEY = (process.env.ANTHROPIC_API_KEY ?? "").replace(/[^\x20-\x7E]/g, "").trim();
const MODEL = "claude-haiku-4-5-20251001";

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;

  const body = await req.json().catch(() => ({}));
  const keyword = String(body.keyword ?? "").trim().slice(0, 120);
  if (!keyword) return NextResponse.json({ error: "keyword_required" }, { status: 400 });
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: "ai_not_configured" }, { status: 500 });

  const prompt = `Eres SEO senior de Mente Sana Psicología (mentesanapsicologia.com). Te paso una keyword. Devuelve 3 títulos para un artículo de blog optimizados para SEO + CTR humano (no clickbait barato).

Reglas:
- Hispanohablantes adultos buscando psicología online en España.
- 50–65 caracteres cada uno (Google muestra ~60).
- Incluye la keyword o variación natural dentro de los primeros 40 caracteres.
- Tono profesional, cálido, sin emojis, sin signos exclamativos múltiples.
- Variedad: uno informativo, uno con número/listado, uno con pregunta o promesa concreta.
- NO uses "tips", "trucos", "10 cosas que…". Sí "guía", "señales", "cuándo", "cómo", "por qué".
- Cero menciones a productos, sin nombrar la marca.

Keyword: "${keyword}"

Responde SOLO con JSON válido en este formato exacto:
{"titles":["…","…","…"]}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) {
    const detail = await r.text();
    return NextResponse.json({ error: "claude_failed", status: r.status, detail: detail.slice(0, 200) }, { status: 502 });
  }
  const j = await r.json();
  const text: string = j.content?.[0]?.text ?? "";
  let titles: string[] = [];
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] ?? text);
    titles = Array.isArray(parsed.titles) ? parsed.titles.filter((t: unknown) => typeof t === "string").slice(0, 3) : [];
  } catch {
    return NextResponse.json({ error: "claude_parse_failed", raw: text.slice(0, 300) }, { status: 502 });
  }
  if (titles.length === 0) return NextResponse.json({ error: "no_titles_returned", raw: text.slice(0, 300) }, { status: 502 });

  const slugs = titles.map(slugify);
  return NextResponse.json({ titles, slug_suggestions: slugs });
}
