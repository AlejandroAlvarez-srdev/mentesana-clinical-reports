"use client";

// Watchdog que vigila la conexión con la extensión Chrome mientras la
// psicóloga tiene el panel abierto. Si la ext deja de hacer heartbeat
// (porque la desactivó, la borró, perdió conexión, etc.), tras dos
// checks fallidos consecutivos cierra sesión y redirige a /login para
// que tenga que volver a parear.
//
// Reglas de diseño:
// - Polling cada 25 s (el servidor considera inactiva tras ~120 s).
// - Margen de 1 fallo (network glitch); kicked al 2º fallo.
// - Se pausa cuando la pestaña no está visible para no agotar la batería,
//   y se ejecuta de inmediato cuando vuelve a estar visible.
// - SSR-safe: no hace nada en server, todo en useEffect.
import { useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 25_000;
const MAX_FAILS_BEFORE_KICK = 2;

export default function ExtensionWatchdog() {
  const failsRef = useRef(0);
  const kickedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function kick() {
      if (kickedRef.current) return;
      kickedRef.current = true;
      try {
        await fetch("/api/psicologa/auth/verify-otp", {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        /* ignoramos el fallo de logout — vamos a redirect igualmente */
      }
      // hash para que la pantalla siguiente sepa por qué la echamos
      window.location.replace("/psicologo/login?ext=lost");
    }

    async function check() {
      if (cancelled || kickedRef.current) return;
      try {
        const r = await fetch("/api/psicologa/extension/status", {
          credentials: "include",
          cache: "no-store",
        });
        if (r.status === 401) {
          // Ya no hay sesión: mandamos directamente al login
          window.location.replace("/psicologo/login");
          return;
        }
        const data = (await r.json().catch(() => null)) as { active?: boolean } | null;
        if (data?.active) {
          failsRef.current = 0;
          return;
        }
        failsRef.current += 1;
        if (failsRef.current >= MAX_FAILS_BEFORE_KICK) await kick();
      } catch {
        // Sin red: NO contamos como fallo definitivo, pero sí incrementamos.
        failsRef.current += 1;
        if (failsRef.current >= MAX_FAILS_BEFORE_KICK + 1) await kick();
      }
    }

    function schedule() {
      stop();
      timerRef.current = window.setInterval(check, POLL_INTERVAL_MS);
    }
    function stop() {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    function onVis() {
      if (document.visibilityState === "visible") {
        void check();
        schedule();
      } else {
        stop();
      }
    }

    // Arranque
    void check();
    schedule();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
