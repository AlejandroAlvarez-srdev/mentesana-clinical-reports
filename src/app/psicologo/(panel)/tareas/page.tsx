"use client";

import { useEffect, useState } from "react";
import { TaskThread } from "../../_components/PatientTasks";

const PURPLE = "#6A178C";

type InboxTask = {
  id: string;
  customer_id: number | null;
  appointment_id: number | null;
  patient_name: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "done" | "dismissed";
  created_at: string;
  sent_to_patient_at: string | null;
  unread_from_patient: number;
  message_count: number;
  last_patient_at: string | null;
};

export default function TareasPage() {
  const [tasks, setTasks] = useState<InboxTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"unread" | "pending" | "all">("unread");
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/psicologa/patient-tasks/inbox", { credentials: "include" });
    if (r.ok) { const d = await r.json(); setTasks(d.tasks ?? []); }
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const unreadTotal = tasks.reduce((n, t) => n + (t.unread_from_patient > 0 ? 1 : 0), 0);
  const pendingTotal = tasks.filter((t) => t.status === "pending").length;
  const filtered = tasks.filter((t) =>
    filter === "unread" ? t.unread_from_patient > 0 :
    filter === "pending" ? t.status === "pending" : true,
  );

  // Al abrir un hilo, el GET de mensajes marca leídas las del paciente →
  // recargamos la bandeja para que el badge desaparezca.
  function toggleOpen(id: string) {
    const opening = open !== id;
    setOpen(opening ? id : null);
    if (opening) setTimeout(() => void load(), 800);
  }

  const tabs: [typeof filter, string, number][] = [
    ["unread", "Sin leer", unreadTotal],
    ["pending", "Pendientes", pendingTotal],
    ["all", "Todas", tasks.length],
  ];

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>📝 Tareas y respuestas</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map(([k, l, n]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: filter === k ? `2px solid ${PURPLE}` : "1px solid rgba(0,0,0,0.1)", background: filter === k ? PURPLE : "#fff", color: filter === k ? "#fff" : "#475569", cursor: "pointer" }}>
              {l} {n > 0 && <span style={{ opacity: 0.85 }}>({n})</span>}
            </button>
          ))}
        </div>
      </header>

      {loading && <div style={{ padding: 30, textAlign: "center", color: "#888" }}>Cargando…</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ padding: 30, background: "#fff", borderRadius: 12, color: "#888", fontSize: 13, textAlign: "center" }}>
          {filter === "unread" ? "No hay respuestas sin leer 🎉" : "Sin tareas en este filtro."}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {filtered.map((t) => {
          const isOpen = open === t.id;
          const unread = t.unread_from_patient;
          return (
            <div key={t.id} style={{ background: "#fff", borderRadius: 12, border: `1px solid ${unread > 0 ? "#16a34a" : "rgba(0,0,0,0.08)"}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, cursor: "pointer" }} onClick={() => toggleOpen(t.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: PURPLE }}>{t.patient_name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>· {t.title}</span>
                    {t.status === "done" && <span style={{ fontSize: 10, fontWeight: 800, color: "#065f46", background: "rgba(16,185,129,0.14)", padding: "1px 7px", borderRadius: 999 }}>✓ hecha</span>}
                    {unread > 0 && <span style={{ padding: "1px 7px", background: "#16a34a", color: "#fff", borderRadius: 999, fontWeight: 800, fontSize: 10 }}>✉️ {unread} nuevo{unread > 1 ? "s" : ""}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 10.5, color: "#888", flexWrap: "wrap" }}>
                    {t.due_date && <span style={{ color: PURPLE, fontWeight: 700 }}>📅 {new Date(t.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>}
                    {t.sent_to_patient_at && <span style={{ color: "#065f46", fontWeight: 700 }}>📨 enviada</span>}
                    {t.message_count > 0 && <span>💬 {t.message_count}</span>}
                    {t.last_patient_at && <span>última respuesta {new Date(t.last_patient_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>}
                  </div>
                </div>
                <span style={{ color: "#aaa", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
              </div>
              {isOpen && <TaskThread taskId={t.id} onChange={load} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
