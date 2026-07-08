// POST /api/psicologa/blog/auto-brief
// Garantía total de no-repetición: la keyword se selecciona ATÓMICAMENTE
// de la tabla blog_keyword_universe (status='available'), pasa a status='in_progress'
// con un lock de 30 min. Si la psi no publica en ese tiempo, otro cron la libera.
//
// La keyword se elige con VARIEDAD garantizada: se reparte entre TODAS las
// categorías disponibles, priorizando las que esta psi menos ha trabajado
// (sin sesgo a su especialidad — el blog necesita cubrir todo el abanico).
import { NextRequest, NextResponse } from "next/server";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb } from "@/lib/psy-blog";
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

  const sb = psyBlogSb();

  // Si la psi viene del botón "🎲 Otro tema", libera la keyword anterior antes
  // de pedir una nueva — así no se queda bloqueada 30 min sin necesidad.
  // Guardamos su categoría para EVITARLA en la nueva selección: el reroll debe
  // cambiar también de categoría, no solo de keyword dentro de la misma.
  const body = await req.json().catch(() => ({}));
  const releaseKeywordId = Number(body?.release_keyword_id);
  let avoidCategory = "";
  if (Number.isFinite(releaseKeywordId) && releaseKeywordId > 0) {
    const prev = await sb.from("blog_keyword_universe")
      .select("category")
      .eq("id", releaseKeywordId)
      .maybeSingle();
    avoidCategory = (prev.data?.category ?? "").toLowerCase();
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

  // 2) Uso por categoría de ESTA psi (lo que ya tiene en curso o publicado),
  //    para darle primero los temas que MENOS ha trabajado.
  const mineRes = await sb.from("blog_keyword_universe")
    .select("category")
    .eq("assigned_provider_id", agent.provider_id)
    .in("status", ["in_progress", "published"])
    .limit(2000);
  const usageByCat = new Map<string, number>();
  for (const r of mineRes.data ?? []) {
    const c = (r.category ?? "").toLowerCase();
    if (c) usageByCat.set(c, (usageByCat.get(c) ?? 0) + 1);
  }

  // 3) Liberar locks expirados antes de seleccionar (evita zombis)
  await sb.from("blog_keyword_universe")
    .update({ status: "available", assigned_provider_id: null, assigned_at: null, lock_expires_at: null })
    .eq("status", "in_progress")
    .lt("lock_expires_at", new Date().toISOString());

  // 4) Categorías que tienen keywords disponibles AHORA mismo.
  const availRes = await sb.from("blog_keyword_universe")
    .select("category")
    .eq("status", "available")
    .limit(3000);
  const availCats = Array.from(
    new Set((availRes.data ?? []).map((r) => (r.category ?? "").toLowerCase()).filter(Boolean)),
  );
  if (availCats.length === 0) {
    return NextResponse.json({
      error: "no_keywords_available",
      hint: "El universo de keywords está agotado. Pídele al CTO que cargue más en blog_keyword_universe.",
    }, { status: 409 });
  }

  // Orden de preferencia: la categoría que esta psi MENOS ha trabajado primero;
  // empate → aleatorio (así dos psis distintas no reciben siempre lo mismo).
  const orderedCats = availCats
    .map((c) => ({ c, n: usageByCat.get(c) ?? 0, r: Math.random() }))
    .sort((a, b) => a.n - b.n || a.r - b.r)
    .map((x) => x.c);

  // En un reroll ("🎲 Otro tema") excluimos la categoría anterior para que el
  // tema nuevo sea de OTRA categoría — salvo que sea la única disponible.
  const candidateCats = (avoidCategory && orderedCats.some((c) => c !== avoidCategory))
    ? orderedCats.filter((c) => c !== avoidCategory)
    : orderedCats;

  // 5) Seleccionar UNA keyword atómicamente de la primera categoría que enganche.
  //    CAS update (available → in_progress) garantiza que no hay carreras.
  async function tryLock(category: string): Promise<{ id: number; keyword: string; category: string } | null> {
    const sel = await sb.from("blog_keyword_universe")
      .select("id, keyword, category")
      .eq("status", "available")
      .eq("category", category)
      .limit(20);
    if (!sel.data || sel.data.length === 0) return null;
    const pick = sel.data[Math.floor(Math.random() * sel.data.length)];
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

  let assigned: { id: number; keyword: string; category: string } | null = null;
  for (const cat of candidateCats) {
    assigned = await tryLock(cat);
    if (assigned) break;
  }
  if (!assigned) {
    return NextResponse.json({
      error: "no_keywords_available",
      hint: "El universo de keywords está agotado. Pídele al CTO que cargue más en blog_keyword_universe.",
    }, { status: 409 });
  }

  // 6) Recoger TODOS los títulos ya usados en blog_articles para que Claude los
  //    EVITE desde el primer intento (no solo en la verificación post-hoc).
  //    Pasamos los más relevantes: misma categoría primero, después generales recientes.
  const sameCat = await sb.from("blog_articles")
    .select("title")
    .ilike("category", `%${assigned.category}%`)
    .neq("status", "archived")
    .order("publish_date", { ascending: false })
    .limit(80);
  const generalRecent = await sb.from("blog_articles")
    .select("title")
    .neq("status", "archived")
    .order("publish_date", { ascending: false })
    .limit(120);
  const forbiddenSet = new Set<string>();
  (sameCat.data ?? []).forEach(r => r.title && forbiddenSet.add(r.title));
  (generalRecent.data ?? []).forEach(r => r.title && forbiddenSet.add(r.title));
  const forbiddenList = Array.from(forbiddenSet).join("\n- ");

  // 7) Pedir a Claude SOLO título + outline + rationale, con la lista de prohibidos.
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
TÍTULOS YA USADOS EN EL BLOG — NO REPITAS NINGUNO NI CREES VARIACIONES OBVIAS:
- ${forbiddenList || "(ninguno todavía)"}

Reglas:
- Título: 50-65 caracteres, contiene la keyword o variación natural, promete valor concreto, sin clickbait.
- Tu título DEBE ser claramente distinto de la lista anterior (no solo cambiar un sinónimo). Ángulo nuevo o promesa nueva.
- Outline: 4-6 puntos breves que la psicóloga debe cubrir, alineados con su enfoque clínico si tenemos perfil.
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
      max_tokens: 900,
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
    forbidden_titles_in_prompt: forbiddenSet.size,
  });
}
