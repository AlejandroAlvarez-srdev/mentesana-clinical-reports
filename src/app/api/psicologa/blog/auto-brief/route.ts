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
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

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

  // 1) Recoger TODAS las keywords ya utilizadas en el blog (legacy + nuevas).
  //    Es la única forma de garantizar que cada artículo tiene keyword única.
  //    Como Claude tiene context window grande, podemos pasar miles sin problema.
  const sb = psyBlogSb();
  const { data: recent } = await sb
    .from(BLOG_TABLE)
    .select("keyword, title, slug")
    .not("keyword", "is", null)
    .order("publish_date", { ascending: false })
    .limit(2000); // cubre ~5 años de operación a 1 post/día

  // También cogemos los slugs (sin keyword) de la tabla legacy — son señal
  // de qué se ha cubierto históricamente aunque no esté la keyword guardada.
  const { data: legacySlugs } = await sb
    .from(BLOG_TABLE)
    .select("slug, title")
    .is("keyword", null)
    .order("publish_date", { ascending: false })
    .limit(500);

  const usedKeywords = Array.from(new Set((recent ?? []).map(r => r.keyword?.toLowerCase().trim()).filter(Boolean))).join(", ");
  const usedTitles = (recent ?? []).slice(0, 20).map(r => r.title).filter(Boolean).join(" | ");
  const legacyTitles = (legacySlugs ?? []).slice(0, 40).map(r => r.title).filter(Boolean).join(" | ");

  const psiName = agent.first_name || agent.name.split(" ")[0];

  // 2) Sacar especialidad de la psicóloga desde Amelia (note + description).
  let especialidad = "";
  let bio = "";
  try {
    const rows = await ameliaQuery<{ note: string | null; description: string | null }>(
      `SELECT note, description FROM ${ameliaTable("users")} WHERE id = ? LIMIT 1`,
      [agent.provider_id],
    );
    if (rows.length > 0) {
      especialidad = (rows[0].note ?? "").trim().slice(0, 400);
      bio = (rows[0].description ?? "").trim().slice(0, 600);
    }
  } catch { /* best-effort */ }

  const perfilBlock = (especialidad || bio)
    ? `\nPERFIL DE LA PSICÓLOGA (úsalo para que la keyword encaje con su expertise):
Nombre: ${psiName}
${especialidad ? `Especialidades declaradas: ${especialidad}\n` : ""}${bio ? `Bio profesional: ${bio}\n` : ""}`
    : "";

  const prompt = `Eres SEO senior y editor jefe del blog de Mente Sana Psicología (mentesanapsicologia.com).

Vas a darle a la psicóloga ${psiName} un encargo concreto: keyword + título para que escriba un artículo de blog SEO.
${perfilBlock}
Reglas:
- Keyword: long-tail (3-5 palabras), enfocada a pacientes hispanohablantes en España buscando ayuda psicológica.
- DEBE alinearse con la especialidad de la psicóloga (si no la tenemos, opta por temáticas generales).
- Volumen de búsqueda medio (no muy nicho, no super competitivo).
- Temáticas válidas: ansiedad, depresión, autoestima, relaciones, duelo, estrés laboral, crianza, decisiones vitales, hábitos, mindfulness, terapia online.
- NO uses keywords ya utilizadas (te las paso abajo).
- Título: 50-65 caracteres, contiene la keyword o variación, promete valor concreto, sin clickbait.
- Outline: 3-5 puntos breves que la psicóloga debe cubrir en el cuerpo, en línea con su enfoque clínico.

Keywords ya usadas en el blog (NO repetir ni dar variaciones casi idénticas):
${usedKeywords || "(ninguna aún)"}

Títulos recientes de psicólogas (no te parezcas):
${usedTitles || "(ninguno aún)"}

Títulos legacy del blog (más antiguos, evita repetir tema aunque la formulación sea distinta):
${legacyTitles || "(ninguno)"}

Responde SOLO con JSON válido:
{
  "keyword": "...",
  "title": "...",
  "outline": ["Punto 1...", "Punto 2...", "Punto 3..."],
  "rationale": "Una frase explicando por qué este tema tiene tracción SEO Y por qué encaja con la especialidad de esta psicóloga"
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
