"use client";

// 2026-06-01: la psicóloga ya NO marca asistencia. Solo VE el estado en
// modo lectura. La asistencia la decide el equipo de soporte/admin desde
// su propio panel y se sincroniza con Amelia.
import { useState } from "react";

export default function AttendanceQuick({ initial, compact = false }: { appointmentId?: number; initial: boolean | null; compact?: boolean; onChange?: (v: boolean | null) => void }) {
  const [val] = useState<boolean | null>(initial);
  const padding = compact ? "4px 8px" : "8px 14px";
  const fs = compact ? 10.5 : 12;
  const chip = (color: string, bg: string, label: string) => (
    <span style={{ padding, fontSize: fs, fontWeight: 800, borderRadius: 8, background: bg, color, fontFamily: "inherit", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
  return (
    <div
      style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}
      title="La asistencia la marca el equipo de soporte. Si necesitas corregir, escríbeles por WhatsApp."
    >
      {val === true && chip("#065f46", "#d1fae5", "✓ Asistió")}
      {val === false && chip("#991b1b", "#fee2e2", "✗ No asistió")}
      {val === null && chip("#475569", "#f1f5f9", "— Pendiente (lo marca soporte)")}
    </div>
  );
}
