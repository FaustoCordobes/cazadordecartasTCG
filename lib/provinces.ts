/** Provincias de Argentina (CABA aparte, como figura en las tiendas) */
export const PROVINCES = [
  "CABA", "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy",
  "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz",
  "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

/** CABA y Buenos Aires se consideran cercanas entre sí (AMBA) */
export function sameArea(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  if (a === b) return true;
  const amba = new Set(["CABA", "Buenos Aires"]);
  return amba.has(a) && amba.has(b);
}
