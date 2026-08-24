"use client";

/**
 * EncuadreInforme — el informe del test de 30 preguntas, en el panel de la psi.
 *
 * Es la pieza que hace verdad lo que prometen las landings del tercer embudo:
 * que ella entra a la cita de encuadre con el informe ya leído y que la paciente
 * no tiene que contarlo todo desde el principio.
 *
 * Devuelve null si esta paciente no viene de ese embudo, igual que
 * BienvenidaMotivos: el panel no se llena de bloques vacíos.
 *
 * Orden pensado para leerlo en dos minutos antes de entrar al Meet:
 *   1. Sus palabras (lo que más rinde en la sesión)
 *   2. Por dónde empezaría
 *   3. Escalas con su puntuación
 *   4. Barras por dominio
 */

import { useEffect, useState } from "react";
import type { Informe } from "@/lib/encuadre/scoring";

const PURPLE = "#6A178C";

const COLOR_NIVEL: Record<string, string> = {
  alto: "#B3392F",
  medio: "#8A6410",
  bajo: "#3D6B4E",
};

interface Respuesta {
  found: boolean;
  customer_name?: string | null;
  angulo?: string | null;
  created_at?: string;
  informe?: Informe;
}

export default function EncuadreInforme({ customerId }: { customerId: number }) {
  const [data, setData] = useState<Respuesta | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/psicologa/encuadre-report?customer_id=${customerId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: Respuesta) => vivo && setData(j))
      .catch(() => vivo && setData({ found: false }));
    return () => {
      vivo = false;
    };
  }, [customerId]);

  if (!data?.found || !data.informe) return null;
  const inf = data.informe;

  const fecha = data.created_at
    ? new Date(data.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long" })
    : null;

  return (
    <section
      style={{
        background: "#FFFFFF",
        border: `1px solid ${PURPLE}1F`,
        borderRadius: 16,
        padding: "20px 22px",
        marginBottom: 20,
        boxShadow: `0 8px 28px ${PURPLE}0F`,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: PURPLE }}>
          📄 Informe del test de 30 preguntas
        </h3>
        <span style={{ fontSize: 11.5, color: "rgba(0,0,0,0.4)" }}>
          {fecha && `Hecho el ${fecha}`}
          {inf.completado < 100 && ` · completó el ${inf.completado}%`}
        </span>
      </header>
      <p style={{ margin: "0 0 18px", fontSize: 12, color: "rgba(0,0,0,0.45)", lineHeight: 1.5 }}>
        Viene de la cita de encuadre. Ella espera que ya lo hayas leído: no le pidas que empiece
        contándotelo todo.
      </p>

      {/* 1 · Sus palabras — lo más útil para entrar a la sesión. */}
      {inf.enSusPalabras.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "rgba(0,0,0,0.4)" }}>
            En sus palabras
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {inf.enSusPalabras.map((x) => (
              <blockquote key={x.pregunta} style={{ margin: 0, borderLeft: `2px solid ${PURPLE}`, paddingLeft: 12 }}>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(0,0,0,0.4)" }}>{x.pregunta}</p>
                <p style={{ margin: "3px 0 0", fontSize: 14, fontStyle: "italic", lineHeight: 1.6, color: "rgba(0,0,0,0.78)" }}>
                  «{x.texto}»
                </p>
              </blockquote>
            ))}
          </div>
        </div>
      )}

      {/* 2 · Prioridades. */}
      {inf.prioridades.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "rgba(0,0,0,0.4)" }}>
            Por dónde empezaría
          </p>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {inf.prioridades.map((p) => (
              <li key={p} style={{ fontSize: 13.5, lineHeight: 1.6, color: "rgba(0,0,0,0.7)" }}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      {/* 3 · Escalas. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
        {inf.escalas.map((e) => (
          <div key={e.instrumento} style={{ background: "#FFFAF2", borderRadius: 12, padding: "12px 14px", border: `1px solid ${PURPLE}12` }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: PURPLE }}>{e.instrumento}</span>
              <span style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", fontVariantNumeric: "tabular-nums" }}>{e.total}/{e.max}</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, textTransform: "capitalize" }}>
              Intensidad {e.severidadLabel}
            </p>
            {!e.completa && (
              <p style={{ margin: "4px 0 0", fontSize: 10.5, color: "#8A6410" }}>Escala incompleta</p>
            )}
          </div>
        ))}
      </div>

      {/* 4 · Barras. */}
      {inf.barras.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {inf.barras.map((b) => (
            <div key={b.dominio}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: "rgba(0,0,0,0.65)" }}>{b.label}</span>
                <span style={{ color: COLOR_NIVEL[b.nivel], fontWeight: 600, textTransform: "capitalize" }}>{b.nivel}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ width: `${b.pct}%`, height: "100%", borderRadius: 999, background: COLOR_NIVEL[b.nivel] }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: 0, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.07)", fontSize: 11, lineHeight: 1.6, color: "rgba(0,0,0,0.4)" }}>
        Este test <strong>no evalúa riesgo suicida</strong>: no incluye ese ítem (se usa PHQ-8, no
        PHQ-9). Explóralo tú si procede.
      </p>
    </section>
  );
}
