# Cazacartas

Escribís una carta de **Yu-Gi-Oh!** o **Digimon** y la app la busca en las tiendas TCG de Argentina. Te dice en qué tienda está, a qué precio, si hay stock y dónde queda el local, con link directo a la publicación. Abajo muestra las tiendas físicas del juego que no venden online, para consultarles por Instagram.

> **Proyecto sin fines de lucro.** Cazacartas no vende cartas ni cobra comisiones: solo muestra dónde está cada carta y lleva al usuario a la tienda para que le compre directamente a ella. Su objetivo es generar más ventas para las tiendas de Argentina y que cada jugador complete su mazo más fácil. Solo lee información pública, respeta robots.txt, se identifica con su propio User-Agent y hace pausas entre consultas. Si una tienda prefiere no aparecer, se la saca a pedido (WhatsApp 2944 24-2906).

## Qué hace

- **Buscar una carta**, con nombre autocompletado mientras escribís (en inglés o español para Yu-Gi-Oh!).
- **Armar un mazo:** pegás una decklist en casi cualquier formato (`4 Angemon BT25-034`, `Exosister Karmael x2`, `3x`, `-3`, `(3)`...) y la app muestra qué tienda tiene más cartas del mazo, la compra más barata carta por carta y una tabla ordenable por precio, rareza o cantidad. Las líneas que no entiende las marca con el formato correcto.
  - En Digimon se respeta el código (Angemon BT25-034 ≠ BT23-027). En Yu-Gi-Oh! sirve cualquier impresión con el mismo nombre.

## Cómo correrlo

```bash
npm install
npm run indexar    # lee el catálogo de las tiendas Tiendanube/PrestaShop (tarda unos minutos)
npm run dev        # http://localhost:3000
npm test           # pruebas
```

## Cómo busca

Hay dos formas de consultar una tienda, según lo que permite su web:

| Modo | Plataformas | Cómo funciona |
|---|---|---|
| **En vivo** | WooCommerce, Shopify, Casco TCG | Se consulta su buscador en cada búsqueda. Precio y stock al instante. |
| **Catálogo diario** | Tiendanube, PrestaShop | Su robots.txt bloquea el buscador, pero permite las categorías. `npm run indexar` recorre las categorías de Yu-Gi-Oh!/Digimon y guarda las publicaciones; las búsquedas se hacen sobre eso. |

Siempre se respeta robots.txt: si una tienda bloquea lo necesario, se saltea y la app muestra el motivo en "Ver el estado de cada tienda".

### Tiendas que consulta (22)

**En vivo:** Rancho Store, Phoenix Reborn, Azeroth Comic Store, Lair, El Ático de Hisui, Haru TCG (solo online), Casco TCG.

**Catálogo diario:** La Cueva Dragon, Polybius, El Abismo de Helm, Aquí hay Dragones, Confluencia TCG, Duelist City, Ludik, Invictvs, Space Gaming.

**Se detecta la plataforma sola:** Hadouken, La Batikueva, Dima Game, Tolaria, Lordpipas, Creepshop. La primera vez la app mira su home, reconoce la plataforma y la consulta en vivo o la indexa según corresponda.

**Tiendas con local sin web para buscar:** las otras ~45 del relevamiento (`lib/directory.ts`) aparecen debajo de los resultados, filtradas por juego y provincia.

### Sumar una tienda

Agregala en `lib/stores.ts`. Si no sabés la plataforma, poné `platform: "auto"`. Para Tiendanube/PrestaShop podés indicar las categorías del juego; si no, se buscan solas en la home.

## Catálogo diario en producción (Supabase + GitHub Actions)

En tu compu el catálogo se guarda en `.data/catalogo.json`. En Vercel eso no persiste, así que:

1. En Supabase → SQL Editor, corré `supabase/schema.sql`.
2. En Vercel → Environment Variables: `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` (la service role key; solo la usa el servidor).
3. En GitHub → Settings → Secrets → Actions: las mismas dos variables.
4. `.github/workflows/indexar.yml` corre el indexador todos los días a las 06:17. También se puede correr a mano desde la pestaña Actions.

El indexador espera 1,5 s entre páginas para no cargar a las tiendas.

## Archivos

```
app/page.tsx              página (filtros por juego, resultados, tiendas para consultar)
app/api/buscar/route.ts   GET /api/buscar?game=digi&q=omnimon
lib/search.ts             junta en vivo + catálogo, agrupa por carta
lib/stores.ts             tiendas con web
lib/directory.ts          relevamiento de 63 tiendas con local
lib/adapters/             woocommerce, shopify, casco (en vivo) y catalog (Tiendanube, PrestaShop, WooCommerce)
lib/indexer.ts            recorre categorías y guarda el catálogo
lib/catalog.ts            guardado en Supabase o en archivo local
lib/detect.ts             reconoce la plataforma de una tienda
lib/cardinfo.ts           ficha oficial (digimoncard.io, YGOPRODeck)
lib/decklist.ts           lee decklists pegadas
lib/deck.ts               cruza el mazo con las tiendas (por tienda, compra más barata)
lib/suggest.ts            sugerencias de nombres (GET /api/sugerencias)
app/components/           Autocomplete, Deck, Aviso
scripts/indexar.ts        npm run indexar
```

## Límites conocidos

- La búsqueda de Shopify devuelve como máximo 10 productos por tienda.
- En Tiendanube, un stock vacío significa "ilimitado": se muestra como "Disponible".
- Phoenix Reborn usa una verificación de Cloudflare; si bloquea las consultas automáticas, aparece con error.
- Antes de lanzar, conviene avisarle a cada tienda: les mandás clientes y es mejor que lo sepan.

---

Propiedad de Cordobes Fausto · WhatsApp 2944 24-2906
