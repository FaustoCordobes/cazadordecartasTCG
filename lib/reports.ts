/** Validación de los reportes y formularios (se usa en el servidor y en las pruebas) */
export const REPORT_TYPES = {
  precio: "El precio está desactualizado",
  stock: "La carta no está disponible",
  link: "El link está roto",
  variante: "La versión o rareza es incorrecta",
  otra_carta: "La publicación es de otra carta",
  tienda_nueva: "Sugerir una tienda nueva",
  tienda_dato: "Corregir un dato de una tienda",
  tienda_cerrada: "La tienda cerró o cambió de web",
  tienda_baja: "Soy de la tienda y quiero que la saquen",
  contacto: "Consulta o sugerencia",
} as const;
export type ReportType = keyof typeof REPORT_TYPES;

export interface Report {
  tipo: ReportType;
  game?: string | null;
  carta?: string | null;
  store_id?: string | null;
  url?: string | null;
  comentario?: string | null;
  email?: string | null;
}

const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

/** Devuelve el reporte limpio o un mensaje de error */
export function validateReport(body: unknown): Report | string {
  if (!body || typeof body !== "object") return "Formulario vacío";
  const b = body as Record<string, unknown>;
  if (typeof b.tipo !== "string" || !(b.tipo in REPORT_TYPES)) return "Elegí qué querés reportar";
  if (typeof b.website === "string" && b.website) return "Formulario inválido"; // campo trampa para bots
  const url = clip(b.url, 400);
  if (url && !/^https?:\/\//i.test(url)) return "El link tiene que empezar con http";
  const email = clip(b.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "El email no parece válido";
  const comentario = clip(b.comentario, 600);
  if ((b.tipo === "contacto" || b.tipo === "tienda_nueva") && !comentario && !url) return "Contanos un poco más";
  return {
    tipo: b.tipo as ReportType,
    game: clip(b.game, 10),
    carta: clip(b.carta, 120),
    store_id: clip(b.store_id, 60),
    url,
    comentario,
    email,
  };
}
