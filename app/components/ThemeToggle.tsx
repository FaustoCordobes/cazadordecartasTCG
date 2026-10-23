"use client";
import { useEffect, useState } from "react";

import { THEME_KEY as KEY } from "@/lib/theme.ts";

type Theme = "light" | "dark";

function current(): Theme {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(current()), []);

  function toggle() {
    const next: Theme = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* navegador sin almacenamiento: dura hasta recargar */ }
    setTheme(next);
  }

  const dark = theme === "dark";
  return (
    <button type="button" className="theme-btn" onClick={toggle} aria-pressed={dark} title={dark ? "Pasar a modo claro" : "Pasar a modo oscuro"}>
      <span aria-hidden="true">{dark ? "☀️" : "🌙"}</span>
      <span>{dark ? "Modo claro" : "Modo oscuro"}</span>
    </button>
  );
}
