import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { popularSearches } from "@/lib/stats.ts";

export const revalidate = 86400;

/** Home, juegos, tiendas, guía y las cartas más buscadas del último mes (solo las que tuvieron resultados) */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: BRAND.url, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...GAME_IDS.map((g) => ({ url: `${BRAND.url}/${GAMES[g].param}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 })),
    { url: `${BRAND.url}/tiendas`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BRAND.url}/guia`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BRAND.url}/ofertas`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BRAND.url}/calculadora`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BRAND.url}/vender`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BRAND.url}/sumar-tienda`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
  const cards: MetadataRoute.Sitemap = [];
  for (const g of GAME_IDS) {
    try {
      for (const p of (await popularSearches(g, 30, 30)) ?? []) {
        cards.push({ url: `${BRAND.url}/carta/${GAMES[g].param}/${encodeURIComponent(p.consulta)}`, lastModified: now, changeFrequency: "daily", priority: 0.4 });
      }
    } catch { /* sin datos: solo las páginas fijas */ }
  }
  return [...base, ...cards];
}
