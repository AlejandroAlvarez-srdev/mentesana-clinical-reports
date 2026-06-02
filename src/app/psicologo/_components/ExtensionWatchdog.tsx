"use client";

// Watchdog que vigila la conexión con la extensión Chrome mientras la
// psicóloga tiene el panel abierto. Si la ext deja de hacer heartbeat
// (porque la desactivó, la borró, perdió conexión, etc.), tras varios
// checks fallidos consecutivos cierra sesión y redirige a /login para
// que tenga que volver a parear.
//
// Reglas (afinadas 2026-06-01 tras falsos positivos):
// - Polling cada 60 s (antes 25s · era demasiado agresivo).
// - Solo cuenta como fallo cuando el servidor responde EXPLÍCITAMENTE
//   active=false. Errores de red (wifi inestable, fetch abortado) NO
//   incrementan el contador — la psi puede estar en una llamada y tener
//   blips momentáneos sin que la echemos.
// - 5 fallos consecutivos servidor=inactive antes de echar (~5 min).
// - Se pausa cuando la pestaña no está visible o cuando el navegador
//   reporta offline; reanuda en cuanto vuelve.
// - Total tiempo desde 'extensión OFF' hasta logout: ~5 min (ventana
//   server) + 5 polls × 60s = ~10 min máximo. Margen suficiente para
//   no falsos positivos pero rápido para detectar desinstalación real.
import { useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 60_000;
const MAX_FAILS_BEFORE_KICK = 5;

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
      window.location.replace("/psicologo/login?ext=lost");
    }

    async function check() {
      if (cancelled || kickedRef.current) return;
      // Si el navegador reporta offline, no penalizamos al usuario.
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      try {
        const r = await fetch("/api/psicologa/extension/status", {
          credentials: "include",
          cache: "no-store",
        });
        if (r.status === 401) {
          window.location.replace("/psicologo/login");
          return;
        }
        if (!r.ok) {
          // Errores 5xx u otros del servidor: no penalizamos al usuario.
          return;
        }
        const data = (await r.json().catch(() => null)) as { active?: boolean } | null;
        if (data === null) return; // respuesta no parseable, no penaliza
        if (data.active) {
          failsRef.current = 0;
          return;
        }
        failsRef.current += 1;
        if (failsRef.current >= MAX_FAILS_BEFORE_KICK) await kick();
      } catch {
        // Network glitch puro (fetch lanza). NO incrementa contador para
        // que un wifi inestable durante una llamada no eche a la psi.
        return;
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
    function onOnline() {
      // Cuando vuelve la red, reseteamos el contador y arrancamos un check.
      failsRef.current = 0;
      void check();
    }

    void check();
    schedule();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
