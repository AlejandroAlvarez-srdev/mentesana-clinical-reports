// POST /api/psicologa/blog/auto-brief
// Garantía total de no-repetición: la keyword se selecciona ATÓMICAMENTE
// de la tabla blog_keyword_universe (status='available'), pasa a status='in_progress'
// con un lock de 30 min. Si la psi no publica en ese tiempo, otro cron la libera.
//
// Para que el match sea bueno, mapeamos la "note" / "description" de Amelia
// a las categorías del universo (ansiedad, depresion, relaciones, etc.).
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb } from "@/lib/psy-blog";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ANTHROPIC_KEY = (process.env.ANTHROPIC_API_KEY ?? "").replace(/[^\x20-\x7E]/g, "").trim();
const MODEL = "claude-haiku-4-5-20251001";

// Categorías del universo curado. El mapping a las notes/desc de Amelia es
// por keyword match — si la psi tiene "ansiedad" en su perfil, recibirá una de
// esas keywords con prioridad.
const ALL_CATEGORIES = ["ansiedad", "depresion", "relaciones", "autoestima", "duelo", "estres", "crianza", "tcc", "decisiones"] as const;
type Category = typeof ALL_CATEGORIES[number];

// Marcadores que buscamos en la note/desc para asignar categoría.
const CATEGORY_HINTS: Record<Category, string[]> = {
  ansiedad: ["ansiedad", "panico", "fobia", "tac", "tag"],
  depresion: ["depresion", "depresivo", "estado de animo", "estados anímicos", "anímico"],
  relaciones: ["pareja", "relacion", "vinculo", "dependencia emocional", "duelo amoroso", "ruptura"],
  autoestima: ["autoestima", "autoconcepto", "autoimagen", "identidad", "compla"],
  duelo: ["duelo", "perdida", "muerte", "fallec", "luto"],
  estres: ["estres", "burnout", "agotamiento", "carga laboral", "fatiga laboral"],
  crianza: ["crianza", "infantil", "niño", "niña", "adolescente", "famili", "maternal", "paternal"],
  tcc: ["tcc", "cognitivo", "conductual", "cognitiva", "act", "mindfulness", "tercera generacion"],
  decisiones: ["decision", "crecimiento", "proyecto", "vocacion", "vocacional", "existencia", "proposito"],
};

function inferCategories(blob: string): Category[] {
  const text = blob.toLowerCase();
  const found: Category[] = [];
  for (const cat of ALL_CATEGORIES) {
    if (CATEGORY_HINTS[cat].some((h) => text.includes(h))) found.push(cat);
  }
  return found;
}

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { agent } = auth;
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: "ai_not_configured" }, { status: 500 });

  const sb = psyBlogSb();

  // Si la psi viene del botón "🎲 Otro tema", libera la keyword anterior antes
  // de pedir una nueva — así no se queda bloqueada 30 min sin necesidad.
  const body = await req.json().catch(() => ({}));
  const releaseKeywordId = Number(body?.release_keyword_id);
  if (Number.isFinite(releaseKeywordId) && releaseKeywordId > 0) {
    await sb.from("blog_keyword_universe")
      .update({ status: "available", assigned_provider_id: null, assigned_at: null, lock_expires_at: null })
      .eq("id", releaseKeywordId)
      .eq("assigned_provider_id", agent.provider_id)
      .eq("status", "in_progress");
  }

  // 1) Perfil de la psicóloga desde Amelia
  let especialidad = "";
  let bio = "";
  try {
    const rows = await ameliaQuery<{ note: string | null; description: string | null }>(
      `SELECT note, description FROM ${ameliaTable("users")} WHERE id = ? LIMIT 1`,
      [agent.provider_id],
    );
    if (rows.length > 0) {
      especialidad = (rows[0].note ?? "").trim();
      bio = (rows[0].description ?? "").trim();
    }
  } catch { /* best-effort */ }
  const psiName = agent.first_name || agent.name.split(" ")[0];

  // 2) Inferir categorías según el perfil. Si no detectamos ninguna, todas valen.
  const inferred = inferCategories(`${especialidad} ${bio}`);
  const preferredCats = inferred.length > 0 ? inferred : [...ALL_CATEGORIES];

  // 3) Liberar locks expirados antes de seleccionar (evita zombis)
  await sb.from("blog_keyword_universe")
    .update({ status: "available", assigned_provider_id: null, assigned_at: null, lock_expires_at: null })
    .eq("status", "in_progress")
    .lt("lock_expires_at", new Date().toISOString());

  // 4) Seleccionar UNA keyword atómicamente.
  //    Estrategia: SELECT en categorías preferidas → si nada, en todas.
  //    Usamos update con returning para garantizar atomicidad.
  async function tryLock(categories: Category[]): Promise<{ id: number; keyword: string; category: string } | null> {
    // SELECT random de las disponibles en estas categorías
    const sel = await sb.from("blog_keyword_universe")
      .select("id, keyword, category")
      .eq("status", "available")
      .in("category", categories)
      .limit(20);
    if (!sel.data || sel.data.length === 0) return null;
    // Random pick
    const pick = sel.data[Math.floor(Math.random() * sel.data.length)];
    // CAS update — solo si sigue available
    const lock = await sb.from("blog_keyword_universe")
      .update({
        status: "in_progress",
        assigned_provider_id: agent.provider_id,
        assigned_at: new Date().toISOString(),
        lock_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      })
      .eq("id", pick.id)
      .eq("status", "available")
      .select("id, keyword, category")
      .maybeSingle();
    return lock.data ?? null;
  }

  let assigned = await tryLock(preferredCats);
  if (!assigned && preferredCats.length < ALL_CATEGORIES.length) {
    // Fallback: todas las categorías
    assigned = await tryLock([...ALL_CATEGORIES]);
  }
  if (!assigned) {
    return NextResponse.json({
      error: "no_keywords_available",
      hint: "El universo de keywords está agotado. Pídele al CTO que cargue más en blog_keyword_universe.",
    }, { status: 409 });
  }

  // 5) Pedir a Claude SOLO título + outline + rationale.
  const perfilBlock = (especialidad || bio)
    ? `\nPerfil de la psicóloga:
Nombre: ${psiName}
${especialidad ? `Especialidades: ${especialidad}\n` : ""}${bio ? `Bio: ${bio.slice(0, 500)}\n` : ""}`
    : "";

  const prompt = `Eres SEO senior y editor jefe del blog de Mente Sana Psicología (mentesanapsicologia.com).

Te asigno una keyword YA decidida del universo curado. Tú generas título + outline para que la psicóloga ${psiName} escriba el artículo.

KEYWORD ASIGNADA (NO la cambies, NO la reformules): "${assigned.keyword}"
Categoría: ${assigned.category}
${perfilBlock}
Reglas:
- Título: 50-65 caracteres, contiene la keyword o variación natural, promete valor concreto, sin clickbait.
- Outline: 4-6 puntos breves que la psicóloga debe cubrir en el cuerpo, alineados con su enfoque clínico si tenemos perfil.
- Rationale: una frase explicando por qué esta keyword encaja con su expertise.

Responde SOLO con JSON:
{
  "title": "...",
  "outline": ["...", "...", "..."],
  "rationale": "..."
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
    // Liberar la keyword si Claude falla
    await sb.from("blog_keyword_universe")
      .update({ status: "available", assigned_provider_id: null, assigned_at: null, lock_expires_at: null })
      .eq("id", assigned.id);
    return NextResponse.json({ error: "claude_failed", status: r.status }, { status: 502 });
  }
  const j = await r.json();
  const text: string = j.content?.[0]?.text ?? "";
  let parsed: { title?: string; outline?: string[]; rationale?: string } = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match?.[0] ?? text);
  } catch {
    await sb.from("blog_keyword_universe")
      .update({ status: "available", assigned_provider_id: null, assigned_at: null, lock_expires_at: null })
      .eq("id", assigned.id);
    return NextResponse.json({ error: "claude_parse_failed", raw: text.slice(0, 300) }, { status: 502 });
  }
  if (!parsed.title) {
    await sb.from("blog_keyword_universe")
      .update({ status: "available", assigned_provider_id: null, assigned_at: null, lock_expires_at: null })
      .eq("id", assigned.id);
    return NextResponse.json({ error: "no_title_returned" }, { status: 502 });
  }

  // Garantía de título único: si el título choca con un blog_articles existente
  // (case-insensitive, trim), pedimos a Claude que reformule. Hasta 3 intentos.
  let finalTitle = parsed.title.trim();
  let titleAttempts = 0;
  while (titleAttempts < 3) {
    const collision = await sb.from("blog_articles")
      .select("id")
      .ilike("title", finalTitle)
      .neq("status", "archived")
      .limit(1);
    if (!collision.data || collision.data.length === 0) break;
    // Pedir reformulación
    const reform = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        temperature: 0.95,
        messages: [{
          role: "user",
          content: `El título "${finalTitle}" ya existe en otro post. Reformúlalo manteniendo la keyword "${assigned.keyword}" pero con un ángulo distinto. Solo devuelve el nuevo título, sin comillas ni explicaciones, 50-65 caracteres.`,
        }],
      }),
    });
    if (!reform.ok) break;
    const rj = await reform.json();
    const alt = String(rj.content?.[0]?.text ?? "").trim().replace(/^["']|["']$/g, "");
    if (!alt || alt.length < 10) break;
    finalTitle = alt;
    titleAttempts++;
  }

  return NextResponse.json({
    keyword: assigned.keyword,
    keyword_id: assigned.id,
    category: assigned.category,
    title: finalTitle,
    outline: Array.isArray(parsed.outline) ? parsed.outline.slice(0, 6) : [],
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    title_attempts: titleAttempts,
  });
}
