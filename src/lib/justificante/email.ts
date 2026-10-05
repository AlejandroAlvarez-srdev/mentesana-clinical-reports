import { emailLayout } from "@/lib/emails/layout";

export function emailJustificante(p: { nombre: string; fechaLarga: string; psicologa: string }): { subject: string; html: string } {
  const nombre = p.nombre.split(" ")[0] || "Hola";
  const subject = `${nombre}, tu justificante de asistencia 💜`;
  const content = `
    <p style="margin:0 0 6px;font-family:'Caveat',cursive;font-size:24px;color:#6A178C;line-height:1;">Aquí lo tienes</p>
    <h1 style="margin:0 0 16px;font-family:'Playfair Display',Georgia,serif;font-weight:400;font-size:24px;line-height:1.25;color:#1a1a2e;">${esc(nombre)}, tu justificante de asistencia</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Te adjuntamos el <strong>justificante de asistencia</strong> de tu sesión del <strong>${esc(p.fechaLarga)}</strong> con ${esc(p.psicologa)}, en PDF y con nuestro sello, listo para presentar donde lo necesites.</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">Si necesitas que incluya algún dato más (por ejemplo, el nombre de tu centro de estudios o empresa) o un justificante de otra sesión, responde a este correo y lo preparamos.</p>
    <p style="margin:0;font-size:15px;line-height:1.6;">Un abrazo,<br><strong style="color:#6A178C;">Equipo Mente Sana</strong></p>`;
  return { subject, html: emailLayout({ title: subject, preheader: "Tu justificante de asistencia en PDF, con nuestro sello.", content }) };
}

function esc(s: string): string { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
