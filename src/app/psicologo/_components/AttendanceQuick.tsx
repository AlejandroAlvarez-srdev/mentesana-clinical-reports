"use client";

import { useState } from "react";

const PURPLE = "#6A178C";

export default function AttendanceQuick({ appointmentId, initial, compact = false, onChange }: { appointmentId: number; initial: boolean | null; compact?: boolean; onChange?: (v: boolean | null) => void }) {
  const [val, setVal] = useState<boolean | null>(initial);
  const [saving, setSaving] = useState<"yes" | "no" | "null" | null>(null);
  const [synced, setSynced] = useState(false);

  async function set(next: boolean | null) {
    if (val === next) return;
    setSaving(next === true ? "yes" : next === false ? "no" : "null");
    try {
      const r = await fetch(`/api/psicologa/appointments/${appointmentId}/attendance`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attended: next }),
      });
      const d = await r.json();
      if (r.ok) {
        setVal(next);
        if (d.amelia_synced) { setSynced(true); setTimeout(() => setSynced(false), 1500); }
        onChange?.(next);
      }
    } finally { setSaving(null); }
  }

  const size = compact ? "compact" : "full";
  const padding = size === "compact" ? "4px 8px" : "8px 14px";
  const fs = size === "compact" ? 10.5 : 12;

  function btn(active: boolean, color: string, label: string, value: boolean | null, key: "yes" | "no" | "null") {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); void set(value); }}
        disabled={saving !== null}
        style={{
          padding, fontSize: fs, fontWeight: 800, borderRadius: 8,
          border: active ? `2px solid ${color}` : "1px solid rgba(0,0,0,0.1)",
          background: active ? color : "#fff",
          color: active ? "#fff" : "#475569",
          cursor: saving !== null ? "default" : "pointer",
          fontFamily: "inherit", whiteSpace: "nowrap",
        }}
      >
        {saving === key ? "…" : label}
      </button>
    );
  }

  const showPrompt = compact && val === null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }} onClick={(e) => e.stopPropagation()}>
      {showPrompt && <span style={{ fontSize: 10, color: "#666", fontWeight: 700, marginRight: 4, whiteSpace: "nowrap" }}>¿Asistió?</span>}
      {btn(val === true, "#16a34a", "✓ Asistió", true, "yes")}
      {btn(val === false, "#dc2626", "✗ No asistió", false, "no")}
      {!compact && btn(val === null, "#888", "— pendiente", null, "null")}
      {synced && <span style={{ fontSize: 9.5, color: "#065f46", fontWeight: 800, marginLeft: 4 }}>✓ Amelia</span>}
    </div>
  );
}
