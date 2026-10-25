/** Clave de versión de una carta vigilada: "código|rareza|versión" (vacío = cualquier versión con ese nombre) */
export const watchKey = (code: string | null, rarity: string | null, version: string | null) =>
  code || rarity || (version && version !== "Normal") ? [code ?? "", rarity ?? "", version ?? ""].join("|") : "";
