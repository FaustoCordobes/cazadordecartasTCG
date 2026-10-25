/**
 * Revisa las cartas con aviso al celular y manda la notificación si se cumplió la alerta.
 * Lo corre GitHub Actions una vez por día, después de indexar (.github/workflows/indexar.yml).
 *
 *   npm run avisos
 *
 * Para no cargar a las tiendas: una sola búsqueda por carta distinta (aunque la vigilen varias personas),
 * como mucho 120 por día, con una pausa entre búsquedas.
 */
import webpush from "web-push";
import { supabase } from "../lib/supa.ts";
import { searchAll } from "../lib/search.ts";
import { bestFor, shouldNotify } from "../lib/push.ts";
import { GAMES } from "../lib/games.ts";
import type { Game } from "../lib/types.ts";

const call = supabase();
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cazadordecartas-tcg.vercel.app";
if (!call || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.log("Avisos desactivados: faltan SUPABASE_URL/SUPABASE_SERVICE_KEY o VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY.");
  process.exit(0);
}
webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? SITE, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

type Row = { push_id: string; game: Game; carta: string; card_key: string; precio_max: number | null; ultimo_precio: number | null; ultimo_aviso: string | null;
  avisos_push: { endpoint: string; p256dh: string; auth: string } };
const rows = (await (await call("avisos_cartas?select=*,avisos_push(endpoint,p256dh,auth)&limit=5000")).json()) as Row[];
const groups = new Map<string, Row[]>();
for (const r of rows) {
  const k = `${r.game}|${r.carta.toLowerCase()}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k)!.push(r);
}
console.log(`${rows.length} alertas · ${groups.size} cartas distintas`);

let sent = 0, gone = 0, searched = 0;
for (const list of [...groups.values()].slice(0, 120)) {
  const { game, carta } = list[0];
  let res;
  try {
    res = await searchAll(game, carta);
    searched++;
  } catch (e) {
    console.log(`  ${carta}: no se pudo buscar (${(e as Error).message})`);
    continue;
  }
  for (const w of list) {
    const best = bestFor(res, w.carta, w.card_key);
    const patch: Record<string, unknown> = { ultimo_precio: best?.price ?? null };
    if (shouldNotify(w, best)) {
      const payload = JSON.stringify({
        title: w.precio_max != null ? `🔔 ${w.carta} bajó a $ ${best!.price.toLocaleString("es-AR")}` : `🔔 ${w.carta} volvió a tener stock`,
        body: `${best!.store} · ${GAMES[game].short}. Confirmá el precio en la tienda.`,
        url: `${SITE}/?juego=${GAMES[game].param}&carta=${encodeURIComponent(w.carta)}`,
      });
      try {
        await webpush.sendNotification({ endpoint: w.avisos_push.endpoint, keys: { p256dh: w.avisos_push.p256dh, auth: w.avisos_push.auth } }, payload, { TTL: 86400 });
        patch.ultimo_aviso = new Date().toISOString();
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // la persona desactivó las notificaciones o desinstaló: se borra su suscripción
          await call(`avisos_push?id=eq.${w.push_id}`, { method: "DELETE" }).catch(() => {});
          gone++;
          continue;
        }
        console.log(`  no se pudo avisar (${status ?? (e as Error).message})`);
      }
    }
    await call(`avisos_cartas?push_id=eq.${w.push_id}&game=eq.${w.game}&carta=eq.${encodeURIComponent(w.carta)}&card_key=eq.${encodeURIComponent(w.card_key)}`, {
      method: "PATCH", body: JSON.stringify(patch),
    }).catch(() => {});
  }
  await new Promise((r) => setTimeout(r, 1500));
}
console.log(`Listo: ${searched} búsquedas, ${sent} avisos enviados, ${gone} suscripciones vencidas borradas.`);
