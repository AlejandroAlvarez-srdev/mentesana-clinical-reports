// Generador del "Resumen de sesión" para el fulfillment automático.
// Resuelve paciente (Amelia) -> saca última sesión (HC + grabación) -> Claude
// redacta paciente-facing (filtra lo interno, detecta alertas clínicas) -> renderiza
// PDF -> sube a bucket PRIVADO. NO envía: eso lo hace la psi tras aprobar.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import * as React from "react";
import { ResumenPDF, type ResumenData } from "./resumen-pdf";

export const BUCKET = "mentesana-informes"; // privado (RGPD art.9)

export function blogClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!.trim(),
    process.env.BLOG_SUPABASE_SERVICE_KEY!.trim(),
    { auth: { persistSession: false } },
  );
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fechaLarga(d: Date) { return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; }
function fechaCorta(d: Date) { return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`; }
function fechaMini(d: Date) { return `${d.getUTCDate()} ${MES_CORTO[d.getUTCMonth()]}`; }

export interface ResolvedCustomer { customer_id: number; full_name: string | null; bono: string | null; }

/** email del checkout puede != email de Amelia -> intenta email exacto y luego por nombre. */
export async function resolveCustomer(sb: SupabaseClient, email: string | null, name: string | null): Promise<ResolvedCustomer | null> {
  if (email) {
    const { data } = await sb.from("amelia_customer_embeddings")
      .select("amelia_user_id, full_name, last_package_name")
      .ilike("email", email).order("total_approved", { ascending: false }).limit(1).maybeSingle();
    if (data?.amelia_user_id) return { customer_id: data.amelia_user_id, full_name: data.full_name, bono: data.last_package_name };
  }
  if (name && name.trim().length > 4) {
    const { data } = await sb.from("amelia_customer_embeddings")
      .select("amelia_user_id, full_name, last_package_name")
      .ilike("full_name", `%${name.trim()}%`).order("total_approved", { ascending: false }).limit(1).maybeSingle();
    if (data?.amelia_user_id) return { customer_id: data.amelia_user_id, full_name: data.full_name, bono: data.last_package_name };
  }
  return null;
}

interface HcRow {
  provider_id: number; patient_name: string | null; session_date: string; appointment_id: number | null;
  highlights: string | null; how_went: string | null; patient_state: string | null;
  intervention: string | null; next_steps: string | null; homework: string | null; red_flags: string | null;
}

/** Datos de la última sesión con contenido + historial + resumen de la grabación. */
export async function fetchSessionData(sb: SupabaseClient, customerId: number) {
  const { data: notes } = await sb.from("psychologist_clinical_notes")
    .select("provider_id, patient_name, session_date, appointment_id, highlights, how_went, patient_state, intervention, next_steps, homework, red_flags")
    .eq("customer_id", customerId).order("session_date", { ascending: false }).limit(20);
  const rows = (notes ?? []) as HcRow[];
  const withContent = rows.filter((r) => ((r.highlights ?? "") + (r.how_went ?? "") + (r.intervention ?? "")).trim().length > 120);
  if (withContent.length === 0) return null; // aún no hay HC lista -> reintentar luego
  const last = withContent[0];

  // resumen de la grabación de esa sesión (± ventana), mejor esfuerzo
  let summaryMd: string | null = null;
  try {
    const sd = new Date(last.session_date).getTime();
    const from = new Date(sd - 3 * 3600 * 1000).toISOString();
    const to = new Date(sd + 3 * 3600 * 1000).toISOString();
    const { data: sn } = await sb.from("session_notes")
      .select("summary_md, meet_started_at")
      .eq("provider_id", last.provider_id).gte("meet_started_at", from).lte("meet_started_at", to)
      .not("summary_md", "is", null).order("meet_started_at", { ascending: false }).limit(1).maybeSingle();
    summaryMd = sn?.summary_md ?? null;
  } catch { /* best effort */ }

  const history = rows.slice().reverse().map((r) => ({
    fecha: fechaMini(new Date(r.session_date)),
    tema: (r.highlights || r.how_went || "").replace(/\s+/g, " ").slice(0, 90),
  }));

  return { last, history, summaryMd };
}

const SYSTEM = `Eres redactor clínico de Mente Sana Psicología. Escribes el "Resumen de sesión" que recibe EL PACIENTE (producto de pago). Tono cálido, en segunda persona ("tú"), español neutro, profesional y cuidadoso.

REGLAS INNEGOCIABLES:
- SOLO contenido dirigido al paciente. PROHIBIDO incluir nada interno: supervisión de la terapeuta, evaluación de su desempeño, señales de retención/negocio, "lo que no funciona", fricciones del servicio, hipótesis diagnósticas crudas o jerga.
- NO inventes hechos: usa solo lo que aparece en las notas/grabación.
- Contenido sensible (sexualidad, detalles íntimos): reencuádralo con dignidad y de forma general, NUNCA explícito.
- NADA de diagnósticos ni consejo médico. Si hay temas de salud física, enmárcalos como acompañamiento emocional.
- DETECTA alertas clínicas: ideación suicida/autolesión, "cansada de vivir", riesgo a terceros, abuso, crisis. Si aparece (aunque sea en el historial), pon alert.is=true y explica en alert.reason (para revisión de la psicóloga). Aun así, el documento al paciente debe ser sereno y sin mencionar el riesgo de forma alarmante.

Devuelve EXCLUSIVAMENTE un JSON válido (sin markdown, sin texto extra) con esta forma:
{
 "enfoque": "3-6 palabras",
 "intro": "1-2 frases que introducen el documento",
 "temas": ["3-5 bullets de lo trabajado"],
 "comoFue": "1 párrafo cálido de cómo fue la sesión",
 "aprendizajes": [{"t":"titular corto","x":"1-2 frases"}],
 "recomendaciones": ["3-4 tareas/ejercicios concretos para la semana"],
 "mensaje": "1 párrafo de mensaje personal, validante y motivador",
 "proxima": "1-2 frases sobre lo que se trabajará la próxima sesión",
 "proximaCita": "texto breve (ej. 'A agendar · próxima semana')",
 "focos": [{"label":"tema","nivel":"Profundo|Medio-alto|Medio|Inicial","pct":0.0}],
 "proceso": [{"fecha":"corta como viene","label":"2-4 palabras","actual":false}],
 "alert": {"is": false, "reason": ""}
}
"proceso" debe reflejar el historial que te doy (misma cantidad y orden), con la última marcada actual:true. "focos" 3-4 items con pct entre 0 y 1 según cuánto se profundizó.`;

function extractJson(txt: string): any {
  const a = txt.indexOf("{");
  const b = txt.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("no json in model output");
  return JSON.parse(txt.slice(a, b + 1));
}

async function callClaude(userMsg: string): Promise<any> {
  const key = (process.env.ANTHROPIC_API_KEY ?? "").replace(/[^\x20-\x7E]/g, "").trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const txt = j?.content?.[0]?.text ?? "";
  return extractJson(txt);
}

export interface BuiltOrder {
  data: ResumenData;
  provider_id: number;
  appointment_id: number | null;
  session_date: string;
  alert: boolean;
  alert_reason: string;
}

/** Construye el ResumenData completo (deterministas + IA). null si la HC aún no está lista. */
export async function buildOrder(sb: SupabaseClient, customerId: number, product: string, resolved: ResolvedCustomer): Promise<BuiltOrder | null> {
  const sd = await fetchSessionData(sb, customerId);
  if (!sd) return null;
  const { last, history, summaryMd } = sd;
  const sesDate = new Date(last.session_date);

  const notesBlock = [
    `Temas (highlights): ${last.highlights ?? ""}`,
    `Cómo fue (how_went): ${last.how_went ?? ""}`,
    `Estado (patient_state): ${last.patient_state ?? ""}`,
    `Intervención: ${last.intervention ?? ""}`,
    `Próximos pasos: ${last.next_steps ?? ""}`,
    `Tareas (homework): ${last.homework ?? ""}`,
    `Red flags: ${last.red_flags ?? ""}`,
  ].join("\n");

  const userMsg = [
    `Producto: ${product}. Paciente: ${resolved.full_name || last.patient_name || "Paciente"}.`,
    `Fecha de la sesión: ${fechaLarga(sesDate)}.`,
    `\n== NOTAS CLÍNICAS DE LA SESIÓN ==\n${notesBlock}`,
    summaryMd ? `\n== RESUMEN DE LA GRABACIÓN (interno; extrae SOLO lo paciente-facing, ignora supervisión/negocio/alertas internas) ==\n${summaryMd.slice(0, 12000)}` : "",
    `\n== HISTORIAL DE SESIONES (para la línea de tiempo, en orden) ==\n${history.map((hh, i) => `${i + 1}. ${hh.fecha} :: ${hh.tema}`).join("\n")}`,
  ].join("\n");

  const g = await callClaude(userMsg);

  const proceso = Array.isArray(g.proceso) && g.proceso.length
    ? g.proceso.map((p: any, i: number) => ({ fecha: String(p.fecha ?? history[i]?.fecha ?? ""), label: String(p.label ?? ""), actual: i === g.proceso.length - 1 }))
    : history.map((hh, i) => ({ fecha: hh.fecha, label: hh.tema.slice(0, 24), actual: i === history.length - 1 }));

  const data: ResumenData = {
    firma: "Equipo Clínico · Mente Sana Psicología",
    paciente: resolved.full_name || last.patient_name || "Paciente",
    fechaSesion: fechaLarga(sesDate),
    fechaSesionCorta: fechaCorta(sesDate),
    modalidad: "Videollamada · 50 min",
    bono: resolved.bono || "Bono Mente Sana",
    enfoque: String(g.enfoque || "Bienestar emocional"),
    fechaHeader: fechaCorta(new Date()),
    codigo: `MS-RESUM-${sesDate.getUTCFullYear()}${String(sesDate.getUTCMonth() + 1).padStart(2, "0")}${String(sesDate.getUTCDate()).padStart(2, "0")}-${String(customerId).slice(-4)}`,
    intro: String(g.intro || "Este es el resumen de tu sesión, preparado para ti."),
    proceso,
    focos: (Array.isArray(g.focos) ? g.focos : []).map((f: any) => {
      let p = Number(f.pct); if (!Number.isFinite(p)) p = 0.5; if (p > 1) p = p / 100; // el modelo a veces devuelve 0-100
      return { label: String(f.label ?? ""), nivel: String(f.nivel ?? "Medio"), pct: Math.max(0.15, Math.min(1, p)) };
    }),
    temas: (Array.isArray(g.temas) ? g.temas : []).map(String),
    comoFue: String(g.comoFue || ""),
    aprendizajes: (Array.isArray(g.aprendizajes) ? g.aprendizajes : []).map((a: any) => ({ t: String(a.t ?? ""), x: String(a.x ?? "") })),
    recomendaciones: (Array.isArray(g.recomendaciones) ? g.recomendaciones : []).map(String),
    mensaje: String(g.mensaje || ""),
    proxima: String(g.proxima || ""),
    proximaCita: String(g.proximaCita || "A convenir con tu psicóloga"),
  };

  return {
    data,
    provider_id: last.provider_id,
    appointment_id: last.appointment_id,
    session_date: last.session_date,
    alert: !!g?.alert?.is,
    alert_reason: String(g?.alert?.reason || ""),
  };
}

export async function renderResumenPDF(data: ResumenData): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(React.createElement(ResumenPDF, { data }) as never));
}

export async function uploadResumenPDF(sb: SupabaseClient, orderId: string, buf: Buffer): Promise<string> {
  await sb.storage.createBucket(BUCKET, { public: false }).catch(() => {});
  const path = `resumenes/${orderId}.pdf`;
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`upload: ${error.message}`);
  return path;
}

export async function signedUrl(sb: SupabaseClient, path: string, seconds = 3600): Promise<string | null> {
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
