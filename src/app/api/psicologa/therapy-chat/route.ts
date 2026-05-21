// Asistente terapéutico privado para la psicóloga. Claude Sonnet 4.6 con enfoque psicológico.
// GET sin params → lista de conversaciones. GET ?conv=X → mensajes. POST → manda mensaje.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";

const sb = createClient(process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!, process.env.BLOG_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `Eres "Acompaña", un asistente conversacional ENTRENADO PSICOLÓGICAMENTE para apoyar a profesionales de la psicología que pueden estar agotadas, abrumadas o ante un caso difícil. Te habla una psicóloga colegiada.

PRINCIPIOS:
1. NO eres su terapeuta. Eres un espacio de descarga, supervisión informal e ideas. Si detectas crisis personal grave en ella (ideación suicida, autoagresión, abuso), dile con calma que esto requiere terapia humana especializada y sugiere "Para esto necesitas hablar con tu propia terapeuta o llamar al 024".
2. Trata a la persona como colega experta, NO como paciente. No la condesciendas con "qué sientes ahora" si te trae un dilema profesional concreto.
3. Si te trae un CASO de paciente:
   - Valida primero ("eso tiene que ser pesado", "entiendo el dilema").
   - Reformula con marcos: vincular/contención/transferencia/contratransferencia, ética colegial, encuadre.
   - Sugiere 2-3 hipótesis o intervenciones posibles, NUNCA UNA "respuesta correcta".
   - Recuerda que la decisión es suya — tú piensas con ella, no por ella.
4. Si te trae AGOTAMIENTO PROPIO: psicoeducación sobre fatiga por compasión, normaliza, pregunta por autocuidado real (descanso, supervisión, terapia personal).
5. Si te trae URGENCIA con paciente: sé concisa y directiva. Protocolo seguro: contacto familiar/sanitario, valoración riesgo, derivación a 024 o urgencias.
6. NUNCA recomiendes fármacos. NO eres médico.
7. Respuestas en máximo 4 párrafos. Sin emojis excepto raros. Tono cálido pero profesional, español neutro de España.
8. Confidencialidad: nada de lo que digas sale de esta conversación. Recuérdale eso ocasionalmente si parece insegura.

Estilo: piensa Carl Rogers + tu mejor supervisora + alguien que ha leído mucho. No motivacional barato.`;

async function ensureConversation(providerId: number, conversationId: string | null, firstUserMessage: string): Promise<string> {
  if (conversationId) {
    const { data } = await sb.from("psi_therapy_conversations").select("id, provider_id").eq("id", conversationId).maybeSingle();
    if (data && data.provider_id === providerId) return conversationId;
  }
  const title = firstUserMessage.slice(0, 80);
  const { data: conv } = await sb.from("psi_therapy_conversations").insert({ provider_id: providerId, title }).select("id").single();
  return conv!.id;
}

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const providerId = auth.agent.provider_id;
  const { searchParams } = new URL(req.url);
  const conv = searchParams.get("conv");
  if (conv) {
    const { data: c } = await sb.from("psi_therapy_conversations").select("id, provider_id, title, created_at").eq("id", conv).maybeSingle();
    if (!c || c.provider_id !== providerId) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data: msgs } = await sb.from("psi_therapy_messages").select("role, content, created_at").eq("conversation_id", conv).order("created_at", { ascending: true });
    return NextResponse.json({ conversation: c, messages: msgs ?? [] });
  }
  const { data: convs } = await sb.from("psi_therapy_conversations").select("id, title, mood, created_at, updated_at").eq("provider_id", providerId).order("updated_at", { ascending: false }).limit(30);
  return NextResponse.json({ conversations: convs ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const providerId = auth.agent.provider_id;
  const ANTHROPIC_KEY = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: "no_anthropic" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const userMsg = String(body.message ?? "").trim().slice(0, 4000);
  if (!userMsg) return NextResponse.json({ error: "empty" }, { status: 400 });

  const conversationId = await ensureConversation(providerId, body.conversation_id ?? null, userMsg);

  // Carga historial
  const { data: history } = await sb.from("psi_therapy_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(40);

  // Guarda mensaje del usuario
  await sb.from("psi_therapy_messages").insert({ conversation_id: conversationId, role: "user", content: userMsg });

  const messages = [
    ...(history ?? []).map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userMsg },
  ];

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": ANTHROPIC_KEY },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1200, system: SYSTEM, messages }),
    });
    if (!r.ok) return NextResponse.json({ error: "claude_failed", message: (await r.text()).slice(0, 300) }, { status: 500 });
    const d = await r.json();
    const text = d?.content?.[0]?.text?.trim() ?? "";
    await sb.from("psi_therapy_messages").insert({ conversation_id: conversationId, role: "assistant", content: text });
    await sb.from("psi_therapy_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    return NextResponse.json({ answer: text, conversation_id: conversationId });
  } catch (e: any) {
    return NextResponse.json({ error: "exception", message: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { searchParams } = new URL(req.url);
  const conv = searchParams.get("conv");
  if (!conv) return NextResponse.json({ error: "missing" }, { status: 400 });
  await sb.from("psi_therapy_conversations").delete().eq("id", conv).eq("provider_id", auth.agent.provider_id);
  return NextResponse.json({ ok: true });
}
