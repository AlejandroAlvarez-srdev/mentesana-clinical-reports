"use client";

import { useEffect, useState } from "react";

const PURPLE = "#6A178C";
const DIAGNOSTICO_IDS = [8, 11]; // Sesion Individual 9,99

type Appt = { appointment_id: number; service_id: number; booking_start_utc: string; customer_name: string; google_meet_url: string | null };

export default function WelcomeBanner({ firstName, todayCount, diagnosticosToday, nextAppt }: { firstName: string; todayCount: number; diagnosticosToday: number; nextAppt: Appt | null }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);

  const greeting = getGreeting(now);
  const headline = pickHeadline(now, todayCount, diagnosticosToday, firstName);
  const cta = pickCta(now);

  return (
    <section style={{
      position: "relative",
      background: "linear-gradient(135deg, #2d0e3e 0%, #4a1670 35%, #6A178C 70%, #8b2dad 100%)",
      borderRadius: 20,
      padding: "26px 28px",
      marginBottom: 22,
      overflow: "hidden",
      color: "#fff",
      boxShadow: "0 10px 36px rgba(106,23,140,0.25), 0 1px 0 rgba(255,255,255,0.08) inset",
    }}>
      {/* Decorative */}
      <div style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(250,128,114,0.35) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -50, left: "40%", width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,169,209,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>{fmtDate(now)}</div>
        <h1 style={{ fontSize: "clamp(22px, 3.2vw, 32px)", fontWeight: 800, margin: 0, lineHeight: 1.12, letterSpacing: -0.6, color: "#fff" }}>
          {greeting},{" "}
          <span style={{ fontFamily: "Playfair Display, Georgia, serif", fontStyle: "italic", fontWeight: 600, background: "linear-gradient(90deg, #ffd9d3 0%, #fff 50%, #f9c9ee 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {firstName || "psicóloga"}
          </span>
        </h1>
        <p style={{ margin: "12px 0 0", maxWidth: "62ch", fontSize: 15, color: "rgba(255,255,255,0.92)", lineHeight: 1.55, fontWeight: 500 }}>
          {headline}
        </p>

        {todayCount > 0 && (
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip emoji="📅" label={`${todayCount} cita${todayCount === 1 ? "" : "s"} hoy`} />
            {diagnosticosToday > 0 && <Chip emoji="🧠" label={`${diagnosticosToday} diagnóstico${diagnosticosToday === 1 ? "" : "s"} 9,99€`} highlight />}
            {nextAppt && new Date(nextAppt.booking_start_utc) > now && <Chip emoji="⏰" label={`próxima en ${minsUntil(nextAppt.booking_start_utc, now)}`} />}
          </div>
        )}

        <p style={{ margin: "14px 0 0", fontSize: 19, fontStyle: "italic", color: "rgba(255,255,255,0.78)", fontFamily: "Caveat, cursive" }}>
          {cta}
        </p>
      </div>
    </section>
  );
}

function Chip({ emoji, label, highlight }: { emoji: string; label: string; highlight?: boolean }) {
  return (
    <span style={{
      padding: "5px 12px",
      borderRadius: 999,
      background: highlight ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)",
      border: `1px solid rgba(255,255,255,${highlight ? 0.4 : 0.25})`,
      fontSize: 12.5, fontWeight: 700, color: "#fff",
      backdropFilter: "blur(6px)",
    }}>
      {emoji} {label}
    </span>
  );
}

function minsUntil(iso: string, now: Date): string {
  const m = Math.floor((new Date(iso).getTime() - now.getTime()) / 60000);
  if (m < 0) return "ahora";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function getGreeting(d: Date): string {
  const h = d.getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });
}

function pickHeadline(d: Date, count: number, diag: number, firstName: string): string {
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  if (count === 0) {
    const empty = [
      "Hoy no tienes citas agendadas. Aprovecha para escribir notas clínicas pendientes, descansar o leer un caso difícil con calma 🌿",
      "Día tranquilo en tu agenda. Quizás un buen momento para repasar pacientes que llevan tiempo sin venir o cerrar pendientes 💜",
      "Sin sesiones hoy. Recordatorio amable: cuidarte a ti también es parte de cuidar a tus pacientes ✨",
      "Hoy descansamos del clinic. Si te apetece, revisa el historial de algún paciente activo y dale follow-up 🤍",
    ];
    return empty[dayOfYear % empty.length];
  }

  const sessionsWord = count === 1 ? "sesión" : "sesiones";
  if (diag > 0) {
    const withDiag = [
      `Hoy acompañas a ${count} personas — ${diag} ${diag === 1 ? "es" : "son"} primera consulta (9,99€). Recuerda leer el PDF del diagnóstico antes 💜`,
      `${count} ${sessionsWord} hoy, con ${diag} primera${diag === 1 ? "" : "s"} cita${diag === 1 ? "" : "s"}. Las primeras sesiones son sagradas — el PDF te ayudará a llegar preparada ✨`,
      `${diag} paciente${diag === 1 ? "" : "s"} llega${diag === 1 ? "" : "n"} hoy por primera vez. Para ${diag === 1 ? "ella/él" : "ellas"} eres la primera puerta — gracias por estar 🌸`,
      `Tienes ${count} ${sessionsWord} y ${diag} ${diag === 1 ? "es" : "son"} de 9,99€. Léete el informe antes para llegar con contexto, no improvises 💪`,
    ];
    return withDiag[dayOfYear % withDiag.length];
  }
  const onlyRec = [
    `Hoy ${count} ${sessionsWord} con personas que ya te conocen. Mira sus highlights anteriores antes de empezar — la continuidad es el regalo de la terapia 💜`,
    `${count} ${sessionsWord} hoy. Cada conversación es un paso. Vas a hacerlo bonito ✨`,
    `${count} sesiones recurrentes. Recuerda: no tienes que arreglar nada, solo acompañar 🌿`,
    `Hoy ${count} personas confían en ti para sostener su proceso. Gracias por elegir hacer esto 💜`,
  ];
  return onlyRec[dayOfYear % onlyRec.length];
}

function pickCta(d: Date): string {
  const dow = d.getDay();
  const ctas = [
    "que sea un día amable",       // 0 dom
    "respira y empieza",           // 1 lun
    "vamos a por ello",            // 2 mar
    "tú sostienes mucho hoy",      // 3 mié
    "hoy va a salir bonito",       // 4 jue
    "ya casi finde — ánimo",       // 5 vie
    "gracias por estar aquí",      // 6 sáb
  ];
  return ctas[dow];
}
