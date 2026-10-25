"use client";

import { BRAND } from "@/lib/brand.ts";
import { AccountPanel } from "../components/AccountPanel.tsx";

/** Página de la cuenta (también es adonde lleva el link de "olvidé mi contraseña") */
export function CuentaClient() {
  return (
    <div className="app" data-game="mtg">
      <main className="wrap guide">
        <header className="top">
          <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="logo" aria-hidden="true" />
            <div><h1>{BRAND.name}</h1><p>Volver al buscador</p></div>
          </a>
        </header>
        <h1>Tu cuenta</h1>
        <section className="panel"><AccountPanel /></section>
      </main>
    </div>
  );
}
