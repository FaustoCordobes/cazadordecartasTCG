/**
 * Nombre y datos de la marca en un solo lugar.
 * Si algún día cambia el dominio (ej. cazacartas.com.ar), se cambia acá y en Vercel.
 */
export const BRAND = {
  name: "Cazacartas",
  fullName: "Cazacartas TCG",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://cazadordecartas-tcg.vercel.app",
  owner: "Cordobes Fausto",
  whatsapp: "5492944242906",
  whatsappLabel: "2944 24-2906",
} as const;

export const waLink = (text?: string) => `https://wa.me/${BRAND.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
