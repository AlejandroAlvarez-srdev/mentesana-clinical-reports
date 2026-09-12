// Componente PDF server-side del "Resumen de sesión" (paciente-facing, con gráficos).
// Diseño: cabecera morada, ficha de datos, línea de tiempo del proceso, barras de
// focos, aprendizajes, recomendaciones (checklist), mensaje, próxima cita, sello +
// firma institucional. Sin lectura de disco (logo por texto) para el bundle serverless.
import * as React from "react";
import { Document, Page, Text, View, StyleSheet, Svg, Path } from "@react-pdf/renderer";

const h = React.createElement;
const P = "#6A178C";
const P2 = "#8B3DB0";
const INK = "#1a1a2e";
const MUTE = "#6b6b7a";

export interface ResumenData {
  firma: string;
  paciente: string;
  fechaSesion: string;
  fechaSesionCorta: string;
  modalidad: string;
  bono: string;
  enfoque: string;
  fechaHeader: string;
  codigo: string;
  intro: string;
  proceso: { fecha: string; label: string; actual?: boolean }[];
  focos: { label: string; nivel: string; pct: number }[];
  temas: string[];
  comoFue: string;
  aprendizajes: { t: string; x: string }[];
  recomendaciones: string[];
  mensaje: string;
  proxima: string;
  proximaCita: string;
}

const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 44, paddingHorizontal: 46, fontFamily: "Helvetica", fontSize: 10, color: INK, lineHeight: 1.42 },
  header: { flexDirection: "row", borderWidth: 1.2, borderColor: P, borderRadius: 4, marginBottom: 10 },
  hLogo: { width: 120, borderRightWidth: 1.2, borderColor: P, alignItems: "center", justifyContent: "center", padding: 8 },
  hLogoTxt: { fontFamily: "Helvetica-Bold", fontSize: 13, color: P, letterSpacing: 0.3 },
  hTitle: { flex: 1, borderRightWidth: 1.2, borderColor: P, alignItems: "center", justifyContent: "center", padding: 8 },
  hTitleTxt: { fontFamily: "Helvetica-Bold", fontSize: 12, color: P, textAlign: "center", letterSpacing: 0.5 },
  hMeta: { width: 92, flexDirection: "column" },
  hMetaRow: { flexDirection: "row" },
  hMetaLabel: { flex: 1, borderColor: P, borderBottomWidth: 1.2, borderRightWidth: 1.2, paddingVertical: 3, paddingHorizontal: 4, fontFamily: "Helvetica-Bold", fontSize: 6.5, color: P, textAlign: "center" },
  hMetaVal: { width: 48, borderColor: P, borderBottomWidth: 1.2, paddingVertical: 3, paddingHorizontal: 4, fontSize: 6.5, color: INK, textAlign: "center" },

  infoCard: { backgroundColor: "#F3ECF9", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 8, flexDirection: "row", flexWrap: "wrap" },
  infoItem: { width: "50%", marginBottom: 3, paddingRight: 8 },
  infoLabel: { fontSize: 6.5, color: MUTE, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, marginBottom: 1 },
  infoVal: { fontSize: 10, color: INK, fontFamily: "Helvetica-Bold" },

  intro: { fontSize: 9.5, color: "#4a4a58", lineHeight: 1.5, marginBottom: 10 },

  section: { marginBottom: 9 },
  secHead: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  secBar: { width: 4, height: 13, backgroundColor: P, borderRadius: 2, marginRight: 7 },
  secTitle: { fontFamily: "Helvetica-Bold", fontSize: 11.5, color: P, letterSpacing: 0.2 },

  bulletRow: { flexDirection: "row", marginBottom: 3, paddingLeft: 4 },
  bulletDot: { fontSize: 10, color: P, marginRight: 7 },
  bulletTxt: { flex: 1, fontSize: 10, color: INK, lineHeight: 1.42 },

  para: { fontSize: 10, color: INK, lineHeight: 1.5, paddingLeft: 4 },

  learnCard: { backgroundColor: "#FAF7FC", borderLeftWidth: 3, borderColor: P2, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 6 },
  learnTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, color: P, marginBottom: 2 },
  learnTxt: { fontSize: 9.5, color: "#3a3a48", lineHeight: 1.45 },

  taskRow: { flexDirection: "row", marginBottom: 5, paddingLeft: 4, alignItems: "flex-start" },
  checkbox: { width: 10, height: 10, borderWidth: 1.1, borderColor: P, borderRadius: 2, marginRight: 8, marginTop: 1.5 },
  taskTxt: { flex: 1, fontSize: 10, color: INK, lineHeight: 1.42 },

  note: { backgroundColor: "#F3ECF9", borderRadius: 5, paddingVertical: 9, paddingHorizontal: 11, fontSize: 10, color: "#39304a", lineHeight: 1.5 },

  nextBox: { flexDirection: "row", alignItems: "center", backgroundColor: P, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, marginTop: 2 },
  nextLabel: { fontSize: 7, color: "#E8D4F0", fontFamily: "Helvetica-Bold", letterSpacing: 0.6 },
  nextVal: { fontSize: 11, color: "#fff", fontFamily: "Helvetica-Bold", marginTop: 1 },

  signRow: { flexDirection: "row", marginTop: 12, alignItems: "flex-end", justifyContent: "space-between" },
  signCol: { width: 260 },
  signSvg: { marginLeft: 8, marginBottom: -10 },
  signLine: { borderTopWidth: 1, borderColor: INK, width: 200, marginBottom: 6 },
  signName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: INK },
  signMeta: { fontSize: 9.5, color: INK },

  sealWrap: { transform: "rotate(-9deg)", opacity: 0.82 },
  sealOuter: { width: 108, height: 108, borderRadius: 54, borderWidth: 2.4, borderColor: P, alignItems: "center", justifyContent: "center" },
  sealInner: { width: 92, height: 92, borderRadius: 46, borderWidth: 0.9, borderColor: P, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  sealTop: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: P, letterSpacing: 1.4, marginBottom: 1 },
  sealStar: { fontSize: 6.5, color: P, marginBottom: 2 },
  sealBig: { fontFamily: "Helvetica-Bold", fontSize: 12, color: P, lineHeight: 1.05, textAlign: "center" },
  sealHr: { width: 62, borderTopWidth: 0.8, borderColor: P, marginVertical: 3 },
  sealDate: { fontSize: 7, color: P, fontFamily: "Helvetica-Bold" },
  sealCode: { fontSize: 5.4, color: P, marginTop: 1, letterSpacing: 0.3 },

  footer: { position: "absolute", bottom: 24, left: 46, right: 46, borderTopWidth: 0.6, borderColor: "#ddd", paddingTop: 6, fontSize: 7, color: MUTE, textAlign: "center" },

  tlWrap: { position: "relative", paddingTop: 7, marginBottom: 2 },
  tlLine: { position: "absolute", top: 12, left: "9%", right: "9%", height: 2, backgroundColor: "#E3D3EE" },
  tlRow: { flexDirection: "row" },
  tlCol: { flex: 1, alignItems: "center", paddingHorizontal: 2 },
  tlDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#fff", borderWidth: 2, borderColor: P },
  tlDotActive: { backgroundColor: P },
  tlDate: { fontSize: 6.8, color: P, fontFamily: "Helvetica-Bold", marginTop: 3 },
  tlLabel: { fontSize: 6.4, color: "#4a4a58", textAlign: "center", marginTop: 1, lineHeight: 1.2 },

  barRow: { marginBottom: 6 },
  barTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 2 },
  barLabel: { fontSize: 9, color: INK, fontFamily: "Helvetica-Bold" },
  barNivel: { fontSize: 7.5, color: P, fontFamily: "Helvetica-Bold" },
  barTrack: { height: 8, backgroundColor: "#EEE6F5", borderRadius: 4 },
  barFill: { height: 8, backgroundColor: P, borderRadius: 4 },
  caption: { fontSize: 7, color: MUTE, marginTop: 2, paddingLeft: 4 },
});

function Firma() {
  const ink = "#1a2b6b";
  return h(Svg, { width: 196, height: 60, viewBox: "0 0 196 60", style: s.signSvg },
    h(Path, { d: "M6 46 C 8 14, 30 8, 28 42 C 27 22, 42 20, 42 44 C 42 26, 55 26, 56 42 C 60 22, 74 24, 68 44 C 64 56, 82 54, 90 34 C 100 12, 110 30, 104 42 C 101 49, 113 46, 122 36 C 136 20, 150 28, 142 44 C 138 54, 156 52, 172 38 C 180 31, 186 30, 190 34", stroke: ink, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }),
    h(Path, { d: "M12 52 C 70 64, 150 60, 188 44 C 176 48, 150 46, 150 40", stroke: ink, strokeWidth: 1.4, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }),
  );
}

const Info = (label: string, val: string) => h(View, { style: s.infoItem }, h(Text, { style: s.infoLabel }, label), h(Text, { style: s.infoVal }, val));
const Bullet = (t: string) => h(View, { style: s.bulletRow, key: t }, h(Text, { style: s.bulletDot }, "•"), h(Text, { style: s.bulletTxt }, t));
const Task = (t: string) => h(View, { style: s.taskRow, key: t }, h(View, { style: s.checkbox }), h(Text, { style: s.taskTxt }, t));
const Learn = (o: { t: string; x: string }) => h(View, { style: s.learnCard, key: o.t }, h(Text, { style: s.learnTitle }, o.t), h(Text, { style: s.learnTxt }, o.x));
const Section = (title: string, ...children: React.ReactNode[]) => h(View, { style: s.section, wrap: false },
  h(View, { style: s.secHead }, h(View, { style: s.secBar }), h(Text, { style: s.secTitle }, title)), ...children);
const SectionWrap = (title: string, ...children: React.ReactNode[]) => h(View, { style: s.section },
  h(View, { style: s.secHead }, h(View, { style: s.secBar }), h(Text, { style: s.secTitle }, title)), ...children);

export function ResumenPDF({ data: D }: { data: ResumenData }) {
  const Seal = () => h(View, { style: s.sealWrap },
    h(View, { style: s.sealOuter },
      h(View, { style: s.sealInner },
        h(Text, { style: s.sealTop }, "MENTE SANA"),
        h(Text, { style: s.sealStar }, "★ PSICOLOGÍA ★"),
        h(Text, { style: s.sealBig }, "SESIÓN"),
        h(Text, { style: s.sealBig }, "REALIZADA"),
        h(View, { style: s.sealHr }),
        h(Text, { style: s.sealDate }, D.fechaSesionCorta),
        h(Text, { style: s.sealCode }, D.codigo))));

  const Timeline = () => h(View, { style: s.tlWrap },
    h(View, { style: s.tlLine }),
    h(View, { style: s.tlRow },
      ...D.proceso.map((p, i) => h(View, { style: s.tlCol, key: i },
        h(View, { style: p.actual ? [s.tlDot, s.tlDotActive] : s.tlDot }),
        h(Text, { style: s.tlDate }, p.fecha),
        h(Text, { style: s.tlLabel }, p.label)))));

  const Focos = () => h(View, null,
    ...D.focos.map((f, i) => h(View, { style: s.barRow, key: i },
      h(View, { style: s.barTop }, h(Text, { style: s.barLabel }, f.label), h(Text, { style: s.barNivel }, f.nivel)),
      h(View, { style: s.barTrack }, h(View, { style: [s.barFill, { width: `${Math.round(f.pct * 100)}%` }] })))),
    h(Text, { style: s.caption }, "Refleja cuánto profundizamos en cada tema durante esta sesión."));

  return h(Document, null,
    h(Page, { size: "A4", style: s.page },
      h(View, { style: s.header },
        h(View, { style: s.hLogo }, h(Text, { style: s.hLogoTxt }, "Mente Sana")),
        h(View, { style: s.hTitle }, h(Text, { style: s.hTitleTxt }, "RESUMEN DE SESIÓN")),
        h(View, { style: s.hMeta },
          h(View, { style: s.hMetaRow }, h(Text, { style: s.hMetaLabel }, "VERSIÓN"), h(Text, { style: s.hMetaVal }, "1")),
          h(View, { style: s.hMetaRow }, h(Text, { style: [s.hMetaLabel, { borderBottomWidth: 0 }] }, "FECHA"), h(Text, { style: [s.hMetaVal, { borderBottomWidth: 0 }] }, D.fechaHeader)))),
      h(View, { style: s.infoCard },
        Info("PACIENTE", D.paciente),
        Info("FECHA DE LA SESIÓN", D.fechaSesion),
        Info("MODALIDAD", D.modalidad),
        Info("PLAN", D.bono),
        Info("ENFOQUE", D.enfoque),
        Info("VERIFICACIÓN", D.codigo)),
      h(Text, { style: s.intro }, D.intro),
      Section("Tu proceso hasta ahora", h(Timeline)),
      SectionWrap("Focos de esta sesión", h(Focos)),
      SectionWrap("Temas que trabajamos", ...D.temas.map(Bullet)),
      Section("Cómo fue la sesión", h(Text, { style: s.para }, D.comoFue)),
      SectionWrap("Aprendizajes clave", ...D.aprendizajes.map(Learn)),
      SectionWrap("Ejercicios y recomendaciones para esta semana", ...D.recomendaciones.map(Task)),
      Section("Un mensaje para ti", h(Text, { style: s.note }, D.mensaje)),
      Section("Para la próxima sesión", h(Text, { style: s.para }, D.proxima)),
      Section("Próxima cita",
        h(View, { style: s.nextBox },
          h(Svg, { width: 18, height: 18, viewBox: "0 0 24 24", style: { marginRight: 9 } },
            h(Path, { d: "M7 2 v3 M17 2 v3 M3.5 8.5 h17 M4 5 h16 a1 1 0 0 1 1 1 v13 a1 1 0 0 1 -1 1 h-16 a1 1 0 0 1 -1 -1 v-13 a1 1 0 0 1 1 -1 z", stroke: "#fff", strokeWidth: 1.6, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" })),
          h(View, null, h(Text, { style: s.nextLabel }, "AGENDADA PARA"), h(Text, { style: s.nextVal }, D.proximaCita)))),
      h(View, { style: s.signRow, wrap: false },
        h(View, { style: s.signCol },
          h(Firma),
          h(View, { style: s.signLine }),
          h(Text, { style: s.signName }, D.firma),
          h(Text, { style: [s.signMeta, { fontFamily: "Helvetica-Bold", color: P }] }, "MENTE SANA PSICOLOGÍA")),
        h(Seal)),
      h(Text, { style: s.footer, fixed: true },
        `Documento emitido electrónicamente por Mente Sana Psicología · Verificación: ${D.codigo} · Documento confidencial de uso terapéutico, dirigido a la paciente.`)));
}
