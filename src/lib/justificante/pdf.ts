// PDF "Justificante de asistencia" (producto de la tienda, 8,99 €). Misma identidad que
// el resumen de sesión (src/lib/resumen/resumen-pdf.ts): cabecera con logo, tarjeta de
// datos, sello "SESIÓN REALIZADA", firma institucional. Sin número de colegiada.
// El logo se carga por URL pública; si falla, se renderiza con el nombre en texto.
import * as React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Svg, Path, renderToBuffer } from "@react-pdf/renderer";

const h = React.createElement;
const P = "#6A178C";
const INK = "#1a1a2e";
const MUTE = "#6b6b7a";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://mentesanapsicologia.com";

export interface JustificanteData {
  paciente: string;
  fechaSesion: string;        // "1 de octubre de 2026"
  fechaSesionLarga: string;   // "jueves 1 de octubre de 2026"
  fechaSesionCorta: string;   // "01/10/2026"
  horaSesion: string;         // "18:00 a 18:50 h"
  duracion: string;           // "50 minutos"
  modalidad: string;
  psicologa: string;
  servicio: string;
  desde?: string | null;      // "1 de septiembre de 2026"
  sesionesRealizadas?: number | null;
  fechaEmisionLarga: string;
  fechaEmisionCorta: string;
  codigo: string;             // MS-JA-<appointment_id>
  firma: string;              // "Equipo Clínico"
}

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 48, paddingHorizontal: 50, fontFamily: "Helvetica", fontSize: 10.5, color: INK, lineHeight: 1.5 },
  header: { flexDirection: "row", borderWidth: 1.2, borderColor: P, borderRadius: 4, marginBottom: 18 },
  hLogo: { width: 118, borderRightWidth: 1.2, borderColor: P, alignItems: "center", justifyContent: "center", padding: 8 },
  hLogoTxt: { fontFamily: "Helvetica-Bold", fontSize: 13, color: P, letterSpacing: 0.3 },
  hTitle: { flex: 1, borderRightWidth: 1.2, borderColor: P, alignItems: "center", justifyContent: "center", padding: 8 },
  hTitleTxt: { fontFamily: "Helvetica-Bold", fontSize: 12, color: P, textAlign: "center", letterSpacing: 0.5 },
  hMeta: { width: 100, flexDirection: "column" },
  hMetaRow: { flexDirection: "row" },
  hMetaLabel: { flex: 1, borderColor: P, borderBottomWidth: 1.2, borderRightWidth: 1.2, paddingVertical: 3, paddingHorizontal: 4, fontFamily: "Helvetica-Bold", fontSize: 6.5, color: P, textAlign: "center" },
  hMetaVal: { width: 54, borderColor: P, borderBottomWidth: 1.2, paddingVertical: 3, paddingHorizontal: 4, fontSize: 6.5, color: INK, textAlign: "center" },
  logo: { width: 102, height: 24, objectFit: "contain" },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 17, color: P, textAlign: "center", letterSpacing: 0.4, marginBottom: 4 },
  sub: { fontSize: 9, color: MUTE, textAlign: "center", marginBottom: 20, letterSpacing: 0.3 },
  para: { fontSize: 11, color: INK, lineHeight: 1.65, marginBottom: 12, textAlign: "justify" },
  strong: { fontFamily: "Helvetica-Bold" },
  infoCard: { backgroundColor: "#F3ECF9", borderRadius: 6, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14, flexDirection: "row", flexWrap: "wrap" },
  infoItem: { width: "50%", marginBottom: 7, paddingRight: 8 },
  infoLabel: { fontSize: 6.8, color: MUTE, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, marginBottom: 1.5 },
  infoVal: { fontSize: 10.5, color: INK, fontFamily: "Helvetica-Bold" },
  note: { fontSize: 9, color: "#4a4a58", lineHeight: 1.5, marginTop: 4, marginBottom: 6, fontStyle: "italic" },
  signRow: { flexDirection: "row", marginTop: 26, alignItems: "flex-end", justifyContent: "space-between" },
  signCol: { width: 270 },
  signSvg: { marginLeft: 8, marginBottom: -10 },
  signLine: { borderTopWidth: 1, borderColor: INK, width: 210, marginBottom: 6 },
  signName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: INK },
  signMeta: { fontSize: 9.5, color: INK },
  sealWrap: { transform: "rotate(-9deg)", opacity: 0.85 },
  sealOuter: { width: 112, height: 112, borderRadius: 56, borderWidth: 2.4, borderColor: P, alignItems: "center", justifyContent: "center" },
  sealInner: { width: 96, height: 96, borderRadius: 48, borderWidth: 0.9, borderColor: P, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  sealTop: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: P, letterSpacing: 1.4, marginBottom: 1 },
  sealStar: { fontSize: 6.5, color: P, marginBottom: 2 },
  sealBig: { fontFamily: "Helvetica-Bold", fontSize: 12, color: P, lineHeight: 1.05, textAlign: "center" },
  sealHr: { width: 62, borderTopWidth: 0.8, borderColor: P, marginVertical: 3 },
  sealDate: { fontSize: 7, color: P, fontFamily: "Helvetica-Bold" },
  sealCode: { fontSize: 5.4, color: P, marginTop: 1, letterSpacing: 0.3 },
  footer: { position: "absolute", bottom: 26, left: 50, right: 50, borderTopWidth: 0.6, borderColor: "#ddd", paddingTop: 6, fontSize: 7, color: MUTE, textAlign: "center", lineHeight: 1.4 },
});

function Firma() {
  const ink = "#1a2b6b";
  return h(Svg, { width: 196, height: 60, viewBox: "0 0 196 60", style: s.signSvg },
    h(Path, { d: "M6 46 C 8 14, 30 8, 28 42 C 27 22, 42 20, 42 44 C 42 26, 55 26, 56 42 C 60 22, 74 24, 68 44 C 64 56, 82 54, 90 34 C 100 12, 110 30, 104 42 C 101 49, 113 46, 122 36 C 136 20, 150 28, 142 44 C 138 54, 156 52, 172 38 C 180 31, 186 30, 190 34", stroke: ink, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }),
    h(Path, { d: "M12 52 C 70 64, 150 60, 188 44 C 176 48, 150 46, 150 40", stroke: ink, strokeWidth: 1.4, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }),
  );
}

const Info = (label: string, val: string) => h(View, { style: s.infoItem }, h(Text, { style: s.infoLabel }, label), h(Text, { style: s.infoVal }, val));

function JustificanteDoc({ d, logoUrl }: { d: JustificanteData; logoUrl: string | null }) {
  const Seal = h(View, { style: s.sealWrap },
    h(View, { style: s.sealOuter },
      h(View, { style: s.sealInner },
        h(Text, { style: s.sealTop }, "MENTE SANA"),
        h(Text, { style: s.sealStar }, "★ PSICOLOGÍA ★"),
        h(Text, { style: s.sealBig }, "SESIÓN"),
        h(Text, { style: s.sealBig }, "REALIZADA"),
        h(View, { style: s.sealHr }),
        h(Text, { style: s.sealDate }, d.fechaSesionCorta),
        h(Text, { style: s.sealCode }, d.codigo),
      )));

  return h(Document, { title: "Justificante de asistencia · Mente Sana Psicología", author: "Mente Sana Psicología" },
    h(Page, { size: "A4", style: s.page },
      h(View, { style: s.header },
        h(View, { style: s.hLogo }, logoUrl ? h(Image, { src: logoUrl, style: s.logo }) : h(Text, { style: s.hLogoTxt }, "Mente Sana")),
        h(View, { style: s.hTitle }, h(Text, { style: s.hTitleTxt }, "JUSTIFICANTE DE ASISTENCIA")),
        h(View, { style: s.hMeta },
          h(View, { style: s.hMetaRow }, h(Text, { style: s.hMetaLabel }, "Nº"), h(Text, { style: s.hMetaVal }, d.codigo)),
          h(View, { style: s.hMetaRow }, h(Text, { style: [s.hMetaLabel, { borderBottomWidth: 0 }] }, "EMITIDO"), h(Text, { style: [s.hMetaVal, { borderBottomWidth: 0 }] }, d.fechaEmisionCorta)),
        )),
      h(Text, { style: s.h1 }, "Justificante de asistencia a sesión de psicoterapia"),
      h(Text, { style: s.sub }, "MENTE SANA PSICOLOGÍA · ATENCIÓN PSICOLÓGICA ONLINE"),
      h(Text, { style: s.para },
        "Mente Sana Psicología ", h(Text, { style: s.strong }, "CERTIFICA"), " que ",
        h(Text, { style: s.strong }, d.paciente),
        " ha asistido a una sesión de psicoterapia con una psicóloga de nuestro equipo, realizada por videollamada, el ",
        h(Text, { style: s.strong }, d.fechaSesionLarga), " de ", h(Text, { style: s.strong }, d.horaSesion),
        ", con una duración de ", h(Text, { style: s.strong }, d.duracion), "."),
      h(View, { style: s.infoCard },
        Info("PACIENTE", d.paciente),
        Info("FECHA DE LA SESIÓN", d.fechaSesion),
        Info("HORARIO", d.horaSesion + " (hora peninsular)"),
        Info("DURACIÓN", d.duracion),
        Info("MODALIDAD", d.modalidad),
        Info("PROFESIONAL", d.psicologa),
        Info("TIPO DE SESIÓN", d.servicio),
        Info("VERIFICACIÓN", d.codigo),
      ),
      d.desde && d.sesionesRealizadas ? h(Text, { style: s.para },
        "La paciente se encuentra en seguimiento psicológico con Mente Sana Psicología desde el ",
        h(Text, { style: s.strong }, d.desde), ", habiendo realizado hasta la fecha ",
        h(Text, { style: s.strong }, `${d.sesionesRealizadas} ${d.sesionesRealizadas === 1 ? "sesión" : "sesiones"}`), ".") : null,
      h(Text, { style: s.para },
        "Se expide el presente justificante a petición de la interesada, para los fines que estime oportunos, con fecha ",
        h(Text, { style: s.strong }, d.fechaEmisionLarga), "."),
      h(Text, { style: s.note },
        "Este documento acredita únicamente la asistencia a la sesión indicada. No incluye información clínica ni diagnóstica, que queda protegida por el secreto profesional y la normativa de protección de datos (RGPD, art. 9)."),
      h(View, { style: s.signRow, wrap: false },
        h(View, { style: s.signCol },
          h(Firma),
          h(View, { style: s.signLine }),
          h(Text, { style: s.signName }, d.firma),
          h(Text, { style: [s.signMeta, { fontFamily: "Helvetica-Bold", color: P }] }, "MENTE SANA PSICOLOGÍA"),
          h(Text, { style: s.signMeta }, "hola@mentesanapsicologia.com · mentesanapsicologia.com"),
        ),
        Seal),
      h(Text, { style: s.footer, fixed: true },
        "Documento emitido electrónicamente por Mente Sana Psicología · Nº de verificación: " + d.codigo +
        " · Para comprobar su autenticidad escriba a hola@mentesanapsicologia.com indicando el número de verificación."),
    ));
}

export async function renderJustificantePDF(d: JustificanteData): Promise<Buffer> {
  try {
    return Buffer.from(await renderToBuffer(h(JustificanteDoc, { d, logoUrl: `${SITE}/images/logo-email.png` }) as never));
  } catch (e) {
    console.warn("[justificante] render con logo falló, reintento con texto:", e instanceof Error ? e.message : e);
    return Buffer.from(await renderToBuffer(h(JustificanteDoc, { d, logoUrl: null }) as never));
  }
}

// ─── Formateo de fechas (hora Madrid) ───────────────────────────────────────
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", ...o }).format(d);

export function buildJustificanteData(input: {
  paciente: string; sessionStart: Date; durationMin: number; psicologa: string; servicio?: string;
  firstSession?: Date | null; attendedCount?: number | null; appointmentId: number | string; emitidoAt?: Date;
}): JustificanteData {
  const start = input.sessionStart;
  const end = new Date(start.getTime() + input.durationMin * 60_000);
  const emit = input.emitidoAt ?? new Date();
  const larga = (d: Date) => fmt(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(",", "");
  return {
    paciente: input.paciente,
    fechaSesion: fmt(start, { day: "numeric", month: "long", year: "numeric" }),
    fechaSesionLarga: larga(start),
    fechaSesionCorta: fmt(start, { day: "2-digit", month: "2-digit", year: "numeric" }),
    horaSesion: `${fmt(start, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} a ${fmt(end, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} h`,
    duracion: `${input.durationMin} minutos`,
    modalidad: "Online · videollamada",
    psicologa: `${input.psicologa} · Psicóloga colegiada`,
    servicio: input.servicio ?? "Sesión de psicoterapia individual",
    desde: input.firstSession ? fmt(input.firstSession, { day: "numeric", month: "long", year: "numeric" }) : null,
    sesionesRealizadas: input.attendedCount ?? null,
    fechaEmisionLarga: fmt(emit, { day: "numeric", month: "long", year: "numeric" }),
    fechaEmisionCorta: fmt(emit, { day: "2-digit", month: "2-digit", year: "numeric" }),
    codigo: `MS-JA-${input.appointmentId}`,
    firma: "Equipo Clínico",
  };
}
