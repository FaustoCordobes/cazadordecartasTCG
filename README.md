# Cazacartas

Escribís una carta de **Yu-Gi-Oh!**, **Digimon**, **Magic**, **Pokémon** u **One Piece** y la app la busca en tiendas TCG de Argentina: en qué tienda está, a qué precio, si hay stock, de cuándo es el dato y dónde queda el local, con link directo a la publicación.

> **Gratis y sin comisiones.** Cazacartas no vende cartas, no cobra comisiones y ninguna tienda paga por aparecer ni por salir primera. Solo muestra dónde está cada carta y lleva al usuario a la tienda para que le compre directamente. Lee solo información pública, respeta robots.txt (incluido el Crawl-delay), se identifica con su propio User-Agent y hace pausas entre consultas. Si una tienda prefiere no aparecer, se la saca a pedido (WhatsApp 2944 24-2906). Las donaciones (por Cafecito: cafecito.app/faust0cordobes) son voluntarias y se usan solo para mantener el servidor; no cambian los resultados.

## Qué hace

**Buscar una carta**
- Por nombre (parcial, con o sin acentos), en inglés o español, o por **código**: `RA01-EN008`, `BT19-070`, `OP01-025`, `125/197`.
  En Yu-Gi-Oh!, Magic y Pokémon cada búsqueda se hace con **los dos nombres** (por ejemplo “Mago Oscuro” y “Dark Magician”),
  porque las tiendas publican con el nombre de la impresión que tienen (`lib/names.ts`). Los nombres de Yu-Gi-Oh! en español
  están en `lib/data/ygo-nombres.ts`; para actualizarlos: `npm run ygo-nombres`.
- Guía de precios por versión, como TCGplayer: mediana publicada, copias en stock y precio de referencia de TCGplayer (EE. UU.)
  convertido al dólar del día (`lib/refprice.ts`). Es solo una referencia: no incluye envío ni impuestos.
- Autocompletado desde 2 letras, con imagen de la carta cuando la base oficial la tiene.
- Resultados **progresivos**: aparecen a medida que responde cada tienda. Si una tienda falla, se marca "temporalmente no disponible" y el resto sigue.
- Si no hay resultados: "¿quisiste decir?", búsqueda por código, links a tiendas con búsqueda manual y locales.
- **Coincidencia exacta vs. parcial** marcada en cada resultado; orden por relevancia, precio, tiendas, precio más reciente, cercanía o nombre (siempre se dice el criterio).
- **No mezcla versiones**: código + rareza + variante (Foil, Parallel, Alter…) + idioma distinto del inglés son tarjetas separadas. Si hay estados mezclados (NM/LP) se avisa.
- Cada publicación muestra: tienda, precio ARS (y referencia en USD con fuente y fecha), stock honesto (*N disponibles*, *Últimas unidades*, *Stock sin confirmar*, *Agotado*), estado, idioma, "Precio verificado recién" o "Último precio detectado hace X", descuento en efectivo si la tienda lo publica, y botones **Ver publicación**, **+ Lista** y **Reportar**.
- Badges **Mejor precio** y **Único en stock** (nunca pagos).
- **Historial de precios** (7/30/90 días) desde que empezamos a medir.
- Filtros por juego (solo se muestran los que tienen datos) + tienda, provincia, stock, precio y "solo coincidencia exacta". **Todo queda en el link** para compartir (`?juego=magic&carta=sol%20ring&f_ver=Foil&orden=pasc`).

**Listado de cartas / Decklist (optimizador de compra)**
- Pegás la lista o subís un archivo: texto libre (`4 Agumon BT1-009`, `Exosister Karmael x2`), Pokémon TCG Live, Magic Arena/Moxfield, `.ydk` y `ydke://` de Yu-Gi-Oh!.
- Las líneas que no entiende se corrigen ahí mismo, sin volver a pegar todo.
- **Tres estrategias**: *Menor costo total*, *Menos tiendas* y *Equilibrada* (menos tiendas pagando como mucho 10 % más), más *Personalizada* eligiendo la tienda de cada carta a mano.
- **Envíos sin inventar**: solo se suman si cargás un envío estimado por tienda o elegís retiro en local ($0). El resto figura como "envío sin datos".
- Respeta el stock, avisa las copias con stock sin confirmar y las que no tiene nadie. "Mejor resultado entre las tiendas consultadas", nunca "el mínimo del país".
- Copiar / mandar el plan por WhatsApp, pasarlo a Mi lista y compartir el listado por link.

**Mi lista** (en el navegador, o en tu cuenta si ingresaste)
- Varias listas con nombre, copias y **conseguidas**, cuánto falta.
- **Alertas** "avisame si baja de $X" y "si vuelve el stock": se revisan al tocar *Actualizar precios* (no hay avisos con la app cerrada).
- Cambio de precio desde que la guardaste, optimizar la compra de lo que falta, exportar/importar `.json`, compartir por WhatsApp.

**Directorio** (`/tiendas` y plegable en la home)
- *Búsqueda integrada* vs. *Búsqueda manual* vs. *Integración no disponible*, contadores derivados de los datos, fecha de revisión, formulario para **sugerir, corregir o pedir la baja** de una tienda.

**Otros**: modo oscuro, PWA instalable, páginas por juego (`/magic`, `/pokemon`…), por carta (`/carta/magic/Sol%20Ring`), guía para principiantes (`/guia`), panel `/estado` de cada tienda indexada, sitemap y robots, analítica sin cookies, formulario de contacto.

## Novedades (v12)

- **Envío por tienda** en el plan de compra: costo y monto desde el que envía gratis (lo carga la persona y se guarda
  en su navegador; también se puede poner el dato verificado en `shipping` de `lib/stores.ts`). El optimizador lo tiene en cuenta.
- **Opciones del plan**: estado mínimo (NM, LP…), idioma, "solo la impresión que pide la lista" y sin versiones especiales (`lib/deckprefs.ts`).
- **Importar un mazo con su link** (Archidekt, TappedOut, MTGGoldfish), respetando su robots.txt (`/api/mazo`, `lib/deckurl.ts`).
  Para Moxfield, YGOPRODeck, Limitless y otros se explica cómo exportar la lista.
- **Ofertas y subas/bajas de la semana** en `/ofertas` (`lib/market.ts`): publicaciones 20 % o más por debajo de la referencia
  de TCGplayer, y cambios de precio desde el historial. Necesita la migración `supabase/migrations/003_mercado_y_avisos.sql`.
- **Avisos al celular** (notificaciones push, sin cuenta) para las alertas de "Mi lista". Los revisa `npm run avisos`
  una vez por día en GitHub Actions. Necesita la migración 003 y las claves VAPID (ver `.env.example`).
- **Buscar con una foto**: lee el código impreso de la carta con OCR en el navegador (Tesseract; la foto no se sube).
- **Sumá tu tienda** (`/sumar-tienda`) y **Vender tus cartas** (`/vender`): cuánto se venden hoy y la referencia, y tiendas que compran
  (campo `buylist` de `lib/stores.ts`, solo con datos confirmados por la tienda).

## Cuentas (v13)

- Crear cuenta con mail y contraseña **sin confirmar el mail** (Supabase Auth con "Confirm email" desactivado), ingresar,
  "Mantener la sesión iniciada" (localStorage) o solo hasta cerrar el navegador (sessionStorage), recuperar contraseña por mail,
  cerrar sesión y borrar la cuenta (`/api/cuenta`).
- Lo que se guarda en la cuenta: todas las listas de "Mi lista" (con alertas) y los ajustes (opciones del plan, envíos por tienda,
  provincia). Al ingresar desde otro dispositivo se juntan sin duplicar (`lib/accountsync.ts`).
- Necesita la migración `supabase/migrations/004_cuentas.sql` (tabla `cuentas_datos` con Row Level Security: cada persona
  ve solo su fila) y las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Sin ellas, el botón
  "Cuenta" no aparece y la app funciona igual que antes.

## Cómo correrlo

```bash
npm install
npm run indexar    # lee el catálogo de las tiendas Tiendanube/PrestaShop (tarda unos minutos)
npm run dev        # http://localhost:3000
npm test           # pruebas (node:test)
npx tsc --noEmit   # chequeo de tipos (hace de "lint")
npm run build
```

## Variables de entorno (`.env.example`)

| Variable | Para qué | Obligatoria |
|---|---|---|
| `SUPABASE_URL` | catálogo diario, historial, reportes, analítica | No (sin ella: archivo local y sin reportes/historial) |
| `SUPABASE_SERVICE_KEY` | clave de servidor (`sb_secret_…`). **Nunca** en el navegador ni en GitHub | Igual que la anterior |
| `DOLAR_TIPO` | referencia en USD: `bolsa` (MEP, por defecto), `blue` u `oficial` | No |
| `NEXT_PUBLIC_SITE_URL` | dominio para sitemap y links (por defecto el de Vercel) | No |

## Base de datos (Supabase)

1. `supabase/schema.sql` (catálogo).
2. `supabase/migrations/002_mejoras.sql`: **corrélo una vez** en Supabase → SQL Editor. Habilita los 5 juegos en el catálogo y crea `historial_precios`, `reportes`, `busquedas_dia` y `clicks_dia` (sin IP ni datos de las personas).
3. Los reportes se leen en Supabase → Table Editor → `reportes`.

## Cómo busca en cada tienda

| Modo | Plataformas | Cómo funciona |
|---|---|---|
| **En vivo** | WooCommerce, Shopify, Casco TCG | Su buscador público en cada búsqueda (filtrando por la categoría o el tipo de cada juego). |
| **Catálogo diario** | Tiendanube, PrestaShop | Su robots.txt bloquea el buscador pero permite las categorías: `npm run indexar` las recorre una vez por día. Si una tienda pide más de 20 s entre consultas, no se indexa. |
| **Búsqueda manual** | sistemas propios, BigCommerce, marketplaces | `lib/linkstores.ts`: la app solo muestra un botón a su web o a su buscador. |

## Agregar una tienda

- Con búsqueda integrada: en `lib/stores.ts` (`platform: "auto"` si no sabés la plataforma; para WooCommerce podés poner `wooCategory` por juego, para Tiendanube las `categories`).
- Con búsqueda manual: en `lib/linkstores.ts`, con `searchUrl` (`{q}` = la carta) o `gameUrls`.
- Antes: revisá robots.txt y que opere en Argentina. Hay una prueba que impide que una tienda esté en las dos listas.

## Agregar un juego

1. `lib/games.ts`: nombre, emblema, ejemplos, orden de rarezas, ejemplo de decklist.
2. `lib/types.ts`: sumar el id a `Game`.
3. `lib/parse.ts`: cómo leer el título (código, rareza, versión).
4. `lib/cardinfo.ts` y `lib/suggest.ts`: base oficial de cartas y autocompletado.
5. `app/components/App.tsx`: filtros del juego (`CARD_FILTERS`) y `lib/seo.ts` (textos de su página).
6. En Supabase, sumar el id al `check` de `catalogo.game`.

## Archivos principales

```
app/components/App.tsx        pantalla principal (búsqueda, filtros, resultados, comparación)
app/components/Deck.tsx       listado de cartas + optimizador
app/components/Wishlist.tsx   Mi lista (varias listas, alertas, exportar)
app/components/searchClient.ts búsqueda progresiva + memoria de 10 min en el navegador
app/api/buscar                búsqueda (JSON o NDJSON con ?stream=1)
app/api/reporte|evento|historial|populares|dolar|ydk|estado
lib/search.ts                 tiendas en vivo + catálogo, agrupado por versión
lib/optimizer.ts              estrategias de compra
lib/stats.ts                  historial y analítica (Supabase)
lib/stores.ts / linkstores.ts tiendas integradas / con búsqueda manual
supabase/                     esquema y migraciones
docs/PENDIENTES.md            lo que falta, riesgos y propuestas
```

## Límites conocidos

- Shopify devuelve como máximo 10 productos por tienda en cada búsqueda.
- En Tiendanube, un stock vacío significa "ilimitado": se muestra "Disponible (sin cantidad)".
- Phoenix Reborn responde 403 a los servidores (Cloudflare): está como búsqueda manual, con link a su buscador. Si la tienda habilita el User-Agent de Cazacartas, se puede volver a integrar.
- Mi lista vive en el navegador: no se sincroniza entre dispositivos (usá exportar/importar).

---

Propiedad de Cordobes Fausto · WhatsApp 2944 24-2906
