"use client";

import { useEffect, useState } from "react";
import type { WishItem } from "@/lib/wishlist.ts";
import { watchKey } from "@/lib/watchkey.ts";

const KEY = "cazacartas:push";

function b64ToBytes(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/**
 * "Avisame al celular": activa las notificaciones push para las cartas con alerta de "Mi lista".
 * Sin cuenta: el navegador da una dirección anónima de notificaciones. Se revisa una vez por día.
 */
export function PushAlerts({ items }: { items: WishItem[] }) {
  const [state, setState] = useState<"loading" | "off" | "on" | "unsupported" | "disabled">("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!ok) { setState("unsupported"); return; }
    fetch("/api/avisos").then((r) => r.json()).then((d: { enabled: boolean }) => {
      if (!d.enabled) { setState("disabled"); return; }
      let on = false;
      try { on = !!localStorage.getItem(KEY) && Notification.permission === "granted"; } catch { /* nada */ }
      setState(on ? "on" : "off");
    }).catch(() => setState("disabled"));
  }, []);

  const cards = items
    .filter((it) => it.alert?.maxPrice || it.alert?.backInStock)
    .map((it) => ({ game: it.game, carta: it.name, card_key: watchKey(it.code, it.rarity, it.version), precio_max: it.alert?.maxPrice ?? null }));

  async function save(enable: boolean) {
    setBusy(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);
      let sub = await reg.pushManager.getSubscription();
      if (!enable) {
        if (sub) {
          await fetch("/api/avisos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
          await sub.unsubscribe();
        }
        try { localStorage.removeItem(KEY); } catch { /* nada */ }
        setState("off"); setMsg("Avisos desactivados."); return;
      }
      if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") {
        setMsg("No diste permiso para notificaciones. Podés activarlo en la configuración del navegador."); return;
      }
      if (!sub) {
        const { publicKey } = (await (await fetch("/api/avisos")).json()) as { publicKey: string };
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      }
      const r = await fetch("/api/avisos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), cartas: cards }) });
      const d = (await r.json()) as { error?: string; cartas?: number };
      if (!r.ok) { setMsg(d.error ?? "No se pudieron guardar los avisos."); return; }
      try { localStorage.setItem(KEY, "1"); } catch { /* nada */ }
      setState("on");
      setMsg(`Listo: te avisamos al celular cuando se cumpla alguna de tus ${d.cartas} alerta${d.cartas === 1 ? "" : "s"} (se revisa una vez por día).`);
    } catch {
      setMsg("Este navegador no dejó activar los avisos. En iPhone hay que instalar la app primero (Compartir → Agregar a inicio).");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "disabled") return null;
  if (state === "unsupported") return <p className="hint">📲 Este navegador no admite avisos al celular. En iPhone, instalá la app (Compartir → Agregar a inicio) y abrila desde ahí.</p>;
  return (
    <div className="push-box">
      {state === "on" ? (
        <>
          <span>📲 Avisos al celular activados.</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save(true)}>Actualizar mis alertas</button>
          <button type="button" className="linkbtn" disabled={busy} onClick={() => save(false)}>Desactivar</button>
        </>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !cards.length} onClick={() => save(true)} title={cards.length ? "" : "Primero poné una alerta en alguna carta"}>
          📲 Avisarme al celular aunque la app esté cerrada
        </button>
      )}
      <span className="hint">{cards.length ? `${cards.length} carta${cards.length === 1 ? "" : "s"} con alerta.` : "Poné una alerta en alguna carta (abajo) para activar los avisos."} No pedimos email ni teléfono: el navegador da una dirección anónima de notificaciones. Si cambiás alertas, tocá “Actualizar mis alertas”.</span>
      {msg && <p className="translated" role="status">{msg}</p>}
    </div>
  );
}
