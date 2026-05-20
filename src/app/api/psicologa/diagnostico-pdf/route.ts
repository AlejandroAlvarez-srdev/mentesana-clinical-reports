// Devuelve el PDF + datos del diagnóstico 9,99€ del paciente.
// Match: email Amelia → diagnostico_tests.user_email. Si no, prueba con phone.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePsicologa } from "@/lib/psicologa-auth";
import { ameliaQuery, ameliaTable } from "@/lib/amelia-db";

const sb = createClient(
  process.env.NEXT_PUBLIC_BLOG_SUPABASE_URL!,
  process.env.BLOG_SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requirePsicologa(req);
  if ("status" in auth) return auth;
  const { provider_id } = auth.agent;
  const url = new URL(req.url);
  const customerId = Number(url.searchParams.get("customer_id"));
  if (!Number.isFinite(customerId)) return NextResponse.json({ error: "customer_id" }, { status: 400 });

  // Verifica ownership: customer ha tenido sesión con esta psi
  const ab = ameliaTable("appointments");
  const cb = ameliaTable("customer_bookings");
  const ub = ameliaTable("users");
  const own = await ameliaQuery<any>(
    `SELECT cu.email, cu.phone, cu.firstName, cu.lastName
     FROM ${cb} cb JOIN ${ab} a ON a.id = cb.appointmentId
     JOIN ${ub} cu ON cu.id = cb.customerId
     WHERE cb.customerId = ? AND a.providerId = ? LIMIT 1`,
    [customerId, provider_id],
  );
  if (own.length === 0) return NextResponse.json({ error: "out_of_scope" }, { status: 403 });
  const c = own[0];

  // Busca el test diagnóstico por email primero, luego phone
  let test: any = null;
  if (c.email) {
    const { data } = await sb
      .from("diagnostico_tests")
      .select("id, user_email, user_phone, report_url, report_generated, scores, perfil_tipo, perfil_nombre, perfil_urgencia, expectations, paid, paid_at, matched_psychologist, created_at")
      .ilike("user_email", c.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    test = data;
  }
  if (!test && c.phone) {
    const variants = [c.phone, String(c.phone).replace(/^\+/, ""), String(c.phone).startsWith("+") ? c.phone : `+${c.phone}`];
    const { data } = await sb
      .from("diagnostico_tests")
      .select("id, user_email, user_phone, report_url, report_generated, scores, perfil_tipo, perfil_nombre, perfil_urgencia, expectations, paid, paid_at, matched_psychologist, created_at")
      .in("user_phone", variants)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    test = data;
  }

  if (!test) {
    return NextResponse.json({
      found: false,
      customer_name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || null,
      hint: "Este paciente no hizo el diagnóstico 9,99€ o usó otro email",
    });
  }

  return NextResponse.json({
    found: true,
    customer_name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || null,
    test: {
      id: test.id,
      report_url: test.report_url,
      report_generated: !!test.report_generated,
      perfil_tipo: test.perfil_tipo,
      perfil_nombre: test.perfil_nombre,
      perfil_urgencia: test.perfil_urgencia,
      expectations: test.expectations,
      scores: test.scores,
      paid: !!test.paid,
      paid_at: test.paid_at,
      matched_psychologist: test.matched_psychologist,
      created_at: test.created_at,
    },
  });
}
