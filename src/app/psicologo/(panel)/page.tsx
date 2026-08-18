"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AttendanceQuick from "../_components/AttendanceQuick";
import WelcomeBanner from "../_components/WelcomeBanner";
import MyTasks from "@/components/MyTasks";
import PsiHomeContent from "../_components/PsiHomeContent";
import MeetLinkWithCCReminder from "../_components/MeetLinkWithCCReminder";
import CCAlwaysOnBanner from "../_components/CCAlwaysOnBanner";
import AnnouncementsBanner from "../_components/AnnouncementsBanner";
import { B2BCitaBadge } from "@/components/B2BCitaBadge";
import type { B2BProgramaPublic } from "@/lib/b2b-programas";
import { inferProducto, type Producto } from "@/lib/productos-catalogo";

const PURPLE = "#6A178C";
const DIAGNOSTICO_IDS = [8, 11];

type Appt = {
  appointment_id: number;
  booking_start_utc: string;
  customer_name: string;
  service_id: number;
  service_name: string | null;
  google_meet_url: string | null;
  has_clinical_note: boolean;
  attended: boolean | null;
  booking_status: string;
  program: B2BProgramaPublic | null;
  internal_notes?: string | null;
};

function fmtHr(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
function fmtDay(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "short" }).format(new Date(iso));
}

export default function DashboardPage() {
  const [today, setToday] = useState<Appt[]>([]);
  const [week, setWeek] = useState<Appt[]>([]);
  const [firstName, setFirstName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/psicologa/appointments?range=today", { credentials: "include" }).then(r => r.ok ? r.json() : { appointments: [] }),
      fetch("/api/psicologa/appointments?range=week", { credentials: "include" }).then(r => r.ok ? r.json() : { appointments: [] }),
      fetch("/api/psicologa/whoami", { credentials: "include" }).then(r => r.ok ? r.json() : { profile: null }),
    ]).then(([t, w, who]) => {
      setToday(t.appointments ?? []);
      setWeek(w.appointments ?? []);
      setFirstName(who.profile?.first_name ?? who.profile?.name?.split(" ")[0] ?? "");
      setAvatarUrl(who.profile?.avatar_url ?? null);
    }).finally(() => setLoading(false));
  }, []);

  const todayActive = today.filter(a => a.booking_status !== "canceled");
  const diagnosticosToday = todayActive.filter(a => DIAGNOSTICO_IDS.includes(a.service_id)).length;
  // Semántica Mente Sana: approved+pending=asistió (ambos generan obligación de rellenar HC)
  const pendingNotes = week.filter(a => !a.has_clinical_note && new Date(a.booking_start_utc) < new Date() && (a.booking_status === "approved" || a.booking_status === "pending")).length;
  const nextAppt = todayActive
    .map(a => ({ ...a, _ts: new Date(a.booking_start_utc).getTime() }))
    .filter(a => a._ts > Date.now())
    .sort((a, b) => a._ts - b._ts)[0] ?? null;

  return (
    <div>
      <AnnouncementsBanner />
      <CCAlwaysOnBanner />
      <WelcomeBanner firstName={firstName} avatarUrl={avatarUrl} todayCount={todayActive.length} diagnosticosToday={diagnosticosToday} nextAppt={nextAppt as any} />

      <MyTasks api="/api/psicologa/tasks" />
      <PsiHomeContent />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 22 }}>
        <Kpi label="📅 Hoy" value={today.length} color={PURPLE} />
        <Kpi label="📆 Esta semana" value={week.length} color="#0891b2" />
        <Kpi label="📝 Notas pendientes" value={pendingNotes} color={pendingNotes > 0 ? "#dc2626" : "#888"} sub={pendingNotes > 0 ? "rellena tras sesión" : "todo al día"} />
      </section>

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 18, color: "#1a1a2e", margin: "0 0 10px" }}>📅 Hoy</h2>
        {loading && <div style={{ color: "#888" }}>Cargando…</div>}
        {!loading && today.length === 0 && <div style={{ padding: 24, background: "#fff", borderRadius: 12, color: "#888", fontSize: 13, textAlign: "center" }}>Sin citas hoy. Disfruta del descanso 🌿</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {today.map(a => <ApptCard key={a.appointment_id} a={a} />)}
        </div>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ fontSize: 18, color: "#1a1a2e", margin: 0 }}>📆 Próximos 7 días</h2>
          <Link href="/psicologo/citas" style={{ color: PURPLE, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ver todas →</Link>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {week.slice(0, 6).map(a => <ApptCard key={a.appointment_id} a={a} showDay />)}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div style={{ padding: 14, background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ApptCard({ a, showDay = false }: { a: Appt; showDay?: boolean }) {
  // Tint por empresa B2B: fondo tenue + barra izquierda con el color del
  // programa (Kairos, Cerebro de Líder, Integria…) → imposible confundir con
  // un paciente 9,99€ normal.
  const bg = a.program?.colors.bgSoft ?? "#fff";
  const leftBar = a.program ? `4px solid ${a.program.colors.border}` : "1px solid rgba(0,0,0,0.06)";
  // Producto de origen (terapia sueño, plan compañía, VSL, diag 9,99, etc).
  // Sale del marker [PRODUCT:<slug>] inyectado en internalNotes al crear la
  // reserva (amelia-create-booking.ts / hold-slot.ts). Sirve a la psi para
  // preparar la sesión con el ángulo comercial correcto ("¿esta paciente viene
  // de la landing de duelo o de la de ansiedad?"). Retrocompatible: null en
  // citas antiguas → no renderiza nada.
  const producto = inferProducto({ internal_notes: a.internal_notes, service_id: (a as any).service_id, service_name: (a as any).service_name, price: (a as any).price ?? (a as any).service_price });
  const [productoModalOpen, setProductoModalOpen] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: bg, borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", borderLeft: leftBar, flexWrap: "wrap" }}>
      <Link href={`/psicologo/citas/${a.appointment_id}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flex: 1, minWidth: 200 }}>
        <div style={{ minWidth: 60 }}>
          {showDay && <div style={{ fontSize: 10, color: "#888", textTransform: "capitalize" }}>{fmtDay(a.booking_start_utc)}</div>}
          <div style={{ fontSize: 16, fontWeight: 800, color: PURPLE }}>{fmtHr(a.booking_start_utc)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>{a.customer_name}</span>
            {a.program && <B2BCitaBadge programa={a.program} size="sm" />}
            {producto && (
              <ProductoBadge
                producto={producto}
                onInfo={() => setProductoModalOpen(true)}
              />
            )}
          </div>
          <div style={{ fontSize: 11, color: "#666" }}>{a.service_name ?? "Sesión"}</div>
        </div>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {a.google_meet_url && (
          <MeetLinkWithCCReminder
            href={a.google_meet_url}
            programa={a.program}
            patientName={a.customer_name}
          />
        )}
        <AttendanceQuick appointmentId={a.appointment_id} initial={a.attended ?? null} compact />
        <Link href={`/psicologo/citas/${a.appointment_id}`} title={a.has_clinical_note ? "Ver/editar nota clínica" : "✍️ Escribir nota clínica"} style={{ fontSize: 11, padding: "5px 10px", background: a.has_clinical_note ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)", color: a.has_clinical_note ? "#065f46" : "#92400e", borderRadius: 8, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap", border: a.has_clinical_note ? "1px solid rgba(16,185,129,0.3)" : "1px dashed rgba(245,158,11,0.4)" }}>
          {a.has_clinical_note ? "✓ HC" : "✍️ + HC"}
        </Link>
      </div>
      {producto && productoModalOpen && (
        <ProductoInfoModal producto={producto} onClose={() => setProductoModalOpen(false)} />
      )}
    </div>
  );
}

// Badge del producto de origen (categoría + emoji + label corto) + botón ℹ️
// que abre modal con descripción completa. Clave para que la psi prepare la
// sesión con el ángulo correcto ("esta cita vino de landing X"). Colores del
// catálogo alineados por categoría (morado terapia / verde acomp / naranja VSL
// / azul diag / rosa plan).
function ProductoBadge({ producto, onInfo }: { producto: Producto; onInfo: () => void }) {
  return (
    <span
      title={`${producto.labelCategoria} · ${producto.slug}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "1px 4px 1px 6px", borderRadius: 999,
        background: producto.colors.bg, color: producto.colors.fg,
        border: `1px solid ${producto.colors.border}`,
        fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", lineHeight: 1.4,
      }}
    >
      <span aria-hidden style={{ fontSize: 11 }}>{producto.emoji}</span>
      <span>{producto.label}</span>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInfo(); }}
        title="Ver descripción del producto"
        aria-label={`Descripción de ${producto.label}`}
        style={{
          marginLeft: 2, padding: "0 4px", fontSize: 10, fontWeight: 800,
          color: producto.colors.fg, background: "rgba(255,255,255,0.65)",
          border: `1px solid ${producto.colors.border}`, borderRadius: 999,
          cursor: "pointer", lineHeight: 1.3, fontFamily: "inherit",
        }}
      >ℹ️</button>
    </span>
  );
}

// Modal con descripción del producto que originó la cita. Sirve a la psi para
// preparar la sesión con el ángulo comercial correcto sin abrir la landing.
function ProductoInfoModal({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, padding: 22, maxWidth: 480, width: "100%", borderTop: `4px solid ${producto.colors.fg}` }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: producto.colors.bg, border: `1px solid ${producto.colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{producto.emoji}</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: producto.colors.fg, fontWeight: 800 }}>{producto.label}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#666", fontWeight: 700 }}>{producto.labelCategoria}</p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: producto.colors.fg }}>{producto.precio > 0 ? `${producto.precio.toFixed(2)} €` : "🎯 Cerrar bono"}</span>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#1a1a2e", lineHeight: 1.5 }}>{producto.descripcion}</p>
        {producto.angulo && (
          <p style={{ margin: "0 0 12px", fontSize: 11, color: "#475569", fontStyle: "italic" }}>Ángulo comercial: {producto.angulo}</p>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "#666", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "ui-monospace, monospace", background: "#f4f4f4", padding: "2px 6px", borderRadius: 4 }}>{producto.slug}</span>
          <a href={producto.landing} target="_blank" rel="noreferrer" style={{ color: producto.colors.fg, fontWeight: 700, textDecoration: "underline" }}>
            {producto.landing}
          </a>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 800, color: "#fff", background: producto.colors.fg, border: "none", borderRadius: 8, cursor: "pointer" }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
