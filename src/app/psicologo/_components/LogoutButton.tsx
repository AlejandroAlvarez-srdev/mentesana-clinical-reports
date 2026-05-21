"use client";

export default function LogoutButton() {
  async function go() {
    await fetch("/api/psicologa/auth/verify-otp", { method: "DELETE" });
    window.location.href = "/psicologo/login";
  }
  return <button onClick={() => void go()} style={{ background: "transparent", border: "none", color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Salir</button>;
}
