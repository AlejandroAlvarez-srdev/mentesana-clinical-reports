"use client";

/**
 * AcompanamientoInforme — el test del acompañante, en el panel de la psi.
 *
 * Este bloque cambia de quién va la sesión. Quien viene del embudo de 9,99 € de
 * acompañamiento NO es la persona que sufre: es quien está al lado. La sesión no
 * va de tratarle a él, va de darle una estrategia para acercarse a otra persona
 * que ni siquiera ha contestado nada. Si no se lee esto antes, los 50 minutos
 * se van en reconstruir el contexto.
 *
 * Devuelve null si esta paciente no viene de ese embudo: el panel no se llena
 * de bloques vacíos.
 *
 * Orden pensado para leerlo en dos minutos antes de entrar al Meet:
 *   1. La fase (determina toda la estrategia)
 *   2. Sus palabras, tal cual las escribió
 *   3. Su contexto: si convive o llama de lejos, si la otra persona sabe que
 *      hay preocupación, cuánta gente más está encima. Es lo que permite
 *      aterrizar la estrategia en vez de dar el guion genérico de la fase.
 *   4. Qué ha probado que va en contra
 *   5. Lo que está viendo y lo que le está costando a ella
 */

import { useEffect, useState } from "react";
import type { Informe } from "@/lib/acompanamiento/scoring";

const PURPLE = "#6A178C";

const COLOR_NIVEL: Record<string, string> = {
  alto: "#B3392F",
  medio: "#8A6410",
  bajo: "#3D6B4E",
};

const ETIQUETA_FASE: Record<string, string> = {
  no_lo_ve: "Precontemplación",
  lo_duda: "Contemplación",
  lo_ve: "Preparación",
  ya_quiere: "Acción",
};

interface Respuesta {
  found: boolean;
  customer_name?: string | null;
  variante?: string;
  persona?: string;
  created_at?: string;
  informe?: Informe;
  abiertas?: { pregunta: string; respuesta: string }[];
}

export default function AcompanamientoInforme({ customerId }: { customerId: number }) {
  const [data, setData] = useState<Respuesta | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/psicologa/acompanamiento-report?customer_id=${customerId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: Respuesta) => vivo && setData(j))
      .catch(() => vivo && setData({ found: false }));
    return () => {
      vivo = false;
    };
  }, [customerId]);

  if (!data?.found || !data.informe) return null;
  const inf = data.informe;
  const persona = data.persona ?? "la persona acompañada";

  const fecha = data.created_at
    ? new Date(data.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long" })
    : null;

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-normal">Viene de acompañamiento</h2>
        <span className="text-xs text-black/40">
          Test sobre {persona}
          {fecha ? ` · ${fecha}` : ""}
        </span>
      </header>

      <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-[13.5px] leading-relaxed text-amber-900">
        Ojo: quien viene a la sesión es <strong>quien acompaña</strong>, no {persona}. {persona} no
        ha contestado nada y no hay nada que diagnosticar aquí. Lo que compró es una estrategia para
        acercarse.
      </p>

      {/* 1 · La fase */}
      <div className="mb-5 rounded-xl border border-purple/15 bg-purple/[0.04] p-4">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-purple/70">
          Fase de cambio · {ETIQUETA_FASE[inf.fase] ?? inf.fase}
        </p>
        <p className="mb-2 font-serif text-lg" style={{ color: PURPLE }}>
          {inf.faseTitulo}
        </p>
        <p className="text-sm leading-relaxed text-black/65">{inf.porDonde}</p>
      </div>

      {/* 2 · Sus palabras */}
      {!!data.abiertas?.length && (
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-black/45">
            En sus palabras
          </p>
          <div className="flex flex-col gap-3">
            {data.abiertas.map((a) => (
              <div key={a.pregunta} className="border-l-2 border-purple/25 pl-3">
                <p className="mb-1 text-xs text-black/45">{a.pregunta}</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-black/75">
                  {a.respuesta}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3 · Su contexto, que es lo que cambia el plan */}
      {inf.ajustes.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-black/45">
            Su situación cambia el plan
          </p>
          <ul className="flex flex-col gap-2">
            {inf.ajustes.map((a) => (
              <li key={a.titulo} className="text-sm leading-relaxed text-black/70">
                <span className="font-semibold" style={{ color: PURPLE }}>
                  {a.titulo}
                </span>
                {" — "}
                {a.texto}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4 · Lo que ya ha probado y juega en contra */}
      {inf.errores.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-black/45">
            Ya ha probado esto, y en su fase va en contra
          </p>
          <ul className="flex flex-col gap-1.5">
            {inf.errores.map((e) => (
              <li key={e.que} className="text-sm leading-relaxed text-black/70">
                <span className="font-semibold" style={{ color: COLOR_NIVEL.alto }}>
                  {e.que}
                </span>
                {" — "}
                {e.porque}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 5 · Las dos medidas */}
      <div className="flex flex-col gap-3">
        {inf.barras.map((b) => (
          <div key={b.clave}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-black/60">{b.label}</span>
              <span
                className="text-[11px] font-bold uppercase tracking-wide"
                style={{ color: COLOR_NIVEL[b.nivel] }}
              >
                {b.nivel}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(3, b.pct)}%`, background: COLOR_NIVEL[b.nivel] }}
              />
            </div>
          </div>
        ))}
      </div>

      {inf.desgasteAviso && (
        <p className="mt-4 rounded-xl bg-black/[0.03] px-4 py-3 text-[13.5px] leading-relaxed text-black/60">
          {inf.desgasteAviso}
        </p>
      )}
    </section>
  );
}
