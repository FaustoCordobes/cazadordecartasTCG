"use client";

import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Registra el service worker y muestra "Instalar app" cuando el navegador lo permite.
 * En iPhone no hay botón automático: se explica cómo agregarla desde Compartir.
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && location.hostname !== "localhost") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as PromptEvent); };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (prompt) {
    return (
      <button type="button" className="theme-btn install-btn" onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>
        <span aria-hidden="true">📲</span><span>Instalar app</span>
      </button>
    );
  }
  if (ios) {
    return (
      <span className="install-ios">
        <button type="button" className="theme-btn install-btn" aria-expanded={help} onClick={() => setHelp(!help)}>
          <span aria-hidden="true">📲</span><span>Instalar app</span>
        </button>
        {help && <span className="install-help" role="note">En Safari tocá <b>Compartir</b> (el cuadrado con la flecha) y después <b>Agregar a inicio</b>.</span>}
      </span>
    );
  }
  return null;
}
