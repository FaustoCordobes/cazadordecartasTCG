/**
 * Indexa el catálogo de las tiendas que no permiten búsqueda en vivo.
 *
 *   npm run indexar                 → todas
 *   npm run indexar -- cuevadragon  → solo esa tienda (por id de lib/stores.ts)
 *
 * Sin Supabase configurado guarda en .data/catalogo.json.
 * En producción lo corre GitHub Actions una vez por día (.github/workflows/indexar.yml).
 */
import { STORES } from "../lib/stores.ts";
import { indexAll } from "../lib/indexer.ts";
import { catalogMode } from "../lib/catalog.ts";

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
console.log(`Indexando catálogo (destino: ${catalogMode()})${only.length ? ` · solo: ${only.join(", ")}` : ""}\n`);

const results = await indexAll(STORES, { only, log: (m) => console.log(m) });

const ok = results.filter((r) => !r.error);
console.log(`\nListo: ${ok.length}/${results.length} catálogos, ${ok.reduce((s, r) => s + r.count, 0)} publicaciones.`);
if (results.some((r) => r.error)) {
  console.log("Con error:");
  for (const r of results.filter((r) => r.error)) console.log(`  ${r.storeId} (${r.game}): ${r.error}`);
}
