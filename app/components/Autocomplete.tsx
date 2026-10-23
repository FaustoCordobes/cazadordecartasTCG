"use client";

import { useEffect, useRef, useState } from "react";
import type { Game } from "@/lib/types.ts";

interface Suggestion {
  name: string;
  alt?: string;
}

/** Campo de texto que sugiere el nombre completo de la carta mientras se escribe */
export function Autocomplete({
  id, game, value, onChange, onPick, placeholder,
}: {
  id: string;
  game: Game;
  value: string;
  onChange: (v: string) => void;
  onPick: (v: string) => void;
  placeholder?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const skip = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    const term = value.trim();
    // no sugerir si parece un código (BT2-077)
    if (term.length < 3 || /^[a-z0-9]{2,5}-[a-z0-9]{2,6}$/i.test(term)) { setItems([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sugerencias?game=${game}&q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const list = (await res.json()) as Suggestion[];
        setItems(Array.isArray(list) ? list : []);
        setActive(-1);
        setOpen(true);
      } catch { /* sin sugerencias */ }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, game]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(s: Suggestion) {
    skip.current = true;
    onChange(s.name);
    setOpen(false);
    onPick(s.name);
  }

  const show = open && items.length > 0;
  return (
    <div className="ac" ref={box}>
      <input
        type="search" id={id} autoComplete="off" value={value} placeholder={placeholder}
        role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(items[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {show && (
        <ul className="ac-list" id={`${id}-list`} role="listbox">
          {items.map((s, i) => (
            <li
              key={s.name} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              className={i === active ? "on" : ""}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActive(i)}
            >
              {s.name}{s.alt && s.alt !== s.name ? <small> · {s.alt}</small> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
