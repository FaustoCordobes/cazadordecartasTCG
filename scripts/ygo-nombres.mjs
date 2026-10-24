// Actualiza lib/data/ygo-nombres.ts: nombres oficiales de Yu-Gi-Oh! en inglés y en español.
// Fuente: YGOJSON (https://github.com/iconmaster5326/YGOJSON), que junta los datos de Konami/Yugipedia.
// Uso: npm run ygo-nombres   (necesita el comando `unzip`, que viene en Linux/Mac y en GitHub Actions)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = "https://github.com/iconmaster5326/YGOJSON/releases/download/v1/aggregate.zip";
const dir = mkdtempSync(join(tmpdir(), "ygojson-"));
const zip = join(dir, "aggregate.zip");

console.log("Descargando", URL);
const res = await fetch(URL);
if (!res.ok) throw new Error(`No se pudo descargar: ${res.status}`);
writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
execFileSync("unzip", ["-o", "-q", zip, "cards.json", "meta.json", "-d", dir]);

const cards = JSON.parse(readFileSync(join(dir, "cards.json"), "utf8"));
const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
const pairs = new Set();
for (const c of cards) {
  const en = c.text?.en?.name?.trim();
  const es = c.text?.es?.name?.trim();
  if (en && es && en !== es && !/[\t\n]/.test(en + es)) pairs.add(`${en}\t${es}`);
}
const raw = [...pairs].sort().join("\n");
const fecha = String(meta.lastYugipediaRead ?? new Date().toISOString()).slice(0, 10);
writeFileSync(
  new URL("../lib/data/ygo-nombres.ts", import.meta.url),
  `// Generado por scripts/ygo-nombres.mjs a partir de YGOJSON (https://github.com/iconmaster5326/YGOJSON).
// Nombres oficiales de Yu-Gi-Oh! en inglés y en español, una carta por línea: "inglés<TAB>español".
// No editar a mano: correr \`npm run ygo-nombres\` para actualizarlo.
export const YGO_NOMBRES_FECHA = ${JSON.stringify(fecha)};
export const YGO_NOMBRES = ${JSON.stringify(raw)};
`
);
console.log(`Listo: ${pairs.size} cartas con nombre en español (datos del ${fecha}).`);
