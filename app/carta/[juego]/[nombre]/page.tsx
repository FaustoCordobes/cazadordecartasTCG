import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { App } from "../../../components/App.tsx";
import { GAMES } from "@/lib/games.ts";
import { gameFromParam } from "@/lib/seo.ts";
import { popularSearches } from "@/lib/stats.ts";
import { norm } from "@/lib/parse.ts";
import { BRAND } from "@/lib/brand.ts";

/**
 * Página pública de una carta: /carta/magic/Sol%20Ring
 * Se indexa en buscadores solo si la carta tuvo búsquedas con resultados en el último mes
 * (para no publicar páginas vacías). La búsqueda en sí la hace el navegador, como en la home.
 */
type P = { params: Promise<{ juego: string; nombre: string }> };

async function read(params: P["params"]) {
  const { juego, nombre } = await params;
  const g = gameFromParam(juego);
  const name = decodeURIComponent(nombre).replace(/\s+/g, " ").trim().slice(0, 60);
  return { g, name, juego };
}

async function isPopular(g: NonNullable<ReturnType<typeof gameFromParam>>, name: string) {
  try {
    const top = await Promise.race([popularSearches(g, 30, 300), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
    return !!top?.some((t) => norm(t.consulta) === norm(name));
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { g, name, juego } = await read(params);
  if (!g || name.length < 2) return {};
  const title = `${name} (${GAMES[g].short}): precio en Argentina`;
  const description = `Dónde comprar ${name} de ${GAMES[g].name} en tiendas de Argentina: precio, stock y link directo a cada tienda.`;
  return {
    title,
    description,
    alternates: { canonical: `/carta/${juego}/${encodeURIComponent(name)}` },
    robots: (await isPopular(g, name)) ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title, description, images: ["/og.png"] },
  };
}

export default async function CardPage({ params }: P) {
  const { g, name, juego } = await read(params);
  if (!g || name.length < 2) notFound();
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: BRAND.name, item: BRAND.url },
      { "@type": "ListItem", position: 2, name: GAMES[g].short, item: `${BRAND.url}/${juego}` },
      { "@type": "ListItem", position: 3, name },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs).replace(/</g, "\\u003c") }} />
      <App initialGame={g} initialQuery={name} intro={<p className="seo-intro">Precios de <b>{name}</b> ({GAMES[g].name}) en tiendas de Argentina, consultados en el momento.</p>} />
    </>
  );
}
