// POST /api/psicologa/blog/auto-brief
// La IA decide TODO: keyword SEO + título + outline. La psicóloga solo escribe el cuerpo.
//
// Para evitar duplicados, antes de pedir a Claude le pasamos:
//   1) Las últimas 30 keywords usadas por blog_articles (legacy + nuevos)
//   2) Los borradores en progreso de esta misma psicóloga
//
// Claude devuelve una keyword nueva relevante para SEO en psicología online España.
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb, BLOG_TABLE } from "@/lib/psy-blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ANTHROPIC_KEY = (process.env.ANTHROPIC_API_KEY ?? "").replace(/[^\x20-\x7E]/g, "").trim();
const MODEL = "claude-haiku-4-5-20251001";

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { agent } = auth;
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: "ai_not_configured" }, { status: 500 });

  // 1) Recoger keywords ya utilizadas (últimas 30) — evita duplicados
  const sb = psyBlogSb();
  const { data: recent } = await sb
    .from(BLOG_TABLE)
    .select("keyword, title")
    .not("keyword", "is", null)
    .order("publish_date", { ascending: false })
    .limit(30);
  const usedKeywords = (recent ?? []).map(r => r.keyword).filter(Boolean).join(", ");
  const usedTitles = (recent ?? []).slice(0, 10).map(r => r.title).filter(Boolean).join(" | ");

  const psiName = agent.first_name || agent.name.split(" ")[0];

  const prompt = `Eres SEO senior y editor jefe del blog de Mente Sana Psicología (mentesanapsicologia.com).

Vas a darle a la psicóloga ${psiName} un encargo concreto: keyword + título para que escriba un artículo de blog SEO.

Reglas:
- Keyword: long-tail (3-5 palabras), enfocada a pacientes hispanohablantes en España buscando ayuda psicológica.
- Volumen de búsqueda medio (no muy nicho, no super competitivo).
- Temáticas válidas: ansiedad, depresión, autoestima, relaciones, duelo, estrés laboral, crianza, decisiones vitales, hábitos, mindfulness, terapia online.
- NO uses keywords ya utilizadas (te las paso abajo).
- Título: 50-65 caracteres, contiene la keyword o variación, promete valor concreto, sin clickbait.
- Outline: 3-5 puntos breves que la psicóloga debe cubrir en el cuerpo.

Keywords ya usadas (NO repetir):
${usedKeywords || "(ninguna aún)"}

Títulos recientes para que evites parecerte:
${usedTitles || "(ninguno aún)"}

Responde SOLO con JSON válido:
{
  "keyword": "...",
  "title": "...",
  "outline": ["Punto 1...", "Punto 2...", "Punto 3..."],
  "rationale": "Una frase explicando por qué este tema tiene tracción SEO ahora"
}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      temperature: 0.85,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) {
    const detail = await r.text();
    return NextResponse.json({ error: "claude_failed", status: r.status, detail: detail.slice(0, 200) }, { status: 502 });
  }
  const j = await r.json();
  const text: string = j.content?.[0]?.text ?? "";
  let parsed: { keyword?: string; title?: string; outline?: string[]; rationale?: string } = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match?.[0] ?? text);
  } catch {
    return NextResponse.json({ error: "claude_parse_failed", raw: text.slice(0, 300) }, { status: 502 });
  }
  if (!parsed.keyword || !parsed.title) {
    return NextResponse.json({ error: "incomplete_brief", parsed }, { status: 502 });
  }

  return NextResponse.json({
    keyword: parsed.keyword.trim(),
    title: parsed.title.trim(),
    outline: Array.isArray(parsed.outline) ? parsed.outline.slice(0, 6) : [],
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
  });
}
