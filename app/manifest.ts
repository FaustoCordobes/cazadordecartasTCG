import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cazacartas TCG",
    short_name: "Cazacartas",
    description: "Buscá cartas de Yu-Gi-Oh!, Digimon, Magic, Pokémon y One Piece y compará precio y stock en tiendas TCG de Argentina.",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#13121a",
    theme_color: "#13121a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
