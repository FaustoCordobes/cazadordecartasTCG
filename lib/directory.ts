import type { Game } from "./types.ts";

/**
 * Tiendas TCG de Argentina con local físico (relevamiento del 23/10/2026).
 * Fuentes: directorio Yu-Gi-Oh! Argentina, Konami, Bandai y torneos de Digimon 2025-26.
 * Se usa para mostrar, debajo de los resultados, las tiendas físicas del juego
 * que no tienen tienda online para buscar (se les consulta por Instagram).
 */
export interface PhysicalStore {
  name: string;
  province: string;
  city: string;
  address: string;
  ygo: boolean;
  digi: boolean;
  web: string | null;
  instagram: string | null;
  confirmed: boolean;
}

export const DIRECTORY: PhysicalStore[] = [
 {
  "name": "4unico",
  "province": "Córdoba",
  "city": "Córdoba",
  "address": "General Paz 415",
  "ygo": true,
  "digi": false,
  "web": "https://sites.google.com/view/4unico/inicio",
  "instagram": "4unico",
  "confirmed": true
 },
 {
  "name": "Antigua Games",
  "province": "CABA",
  "city": "CABA (Saavedra)",
  "address": "Av. Cabildo 3652",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "antiguagames",
  "confirmed": true
 },
 {
  "name": "Aquí hay Dragones",
  "province": "Mendoza",
  "city": "Mendoza",
  "address": "Gutiérrez 323",
  "ygo": true,
  "digi": false,
  "web": "http://www.aquihaydragones.com.ar/",
  "instagram": "aquihaydragonesarg",
  "confirmed": true
 },
 {
  "name": "Arkadia Comics & Toys",
  "province": "Santiago del Estero",
  "city": "Santiago del Estero",
  "address": "Saenz Peña 223",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "arkadia.sgo",
  "confirmed": true
 },
 {
  "name": "Azeroth Comic Store",
  "province": "La Rioja",
  "city": "La Rioja",
  "address": "25 de Mayo 70",
  "ygo": true,
  "digi": false,
  "web": "https://azerothcomicstore.shop/",
  "instagram": "azeroth.comicstore",
  "confirmed": true
 },
 {
  "name": "Bebop! Hobbies & Games Store",
  "province": "Tucumán",
  "city": "San Miguel de Tucumán",
  "address": "Juan Bautista Alberdi 360",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "bebop.store.tuc",
  "confirmed": true
 },
 {
  "name": "Blue Age",
  "province": "Jujuy",
  "city": "San Salvador de Jujuy",
  "address": "Gral. Güemes 787",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "blueage_ar",
  "confirmed": true
 },
 {
  "name": "Casco TCG",
  "province": "Santa Fe",
  "city": "Rosario",
  "address": "9 de Julio 1050",
  "ygo": true,
  "digi": true,
  "web": "https://cascotcg.com/",
  "instagram": "cascotcg",
  "confirmed": true
 },
 {
  "name": "Circunloquio Juegos",
  "province": "Santa Fe",
  "city": "Rosario",
  "address": "Zeballos 1107",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "circunloquiojuegos",
  "confirmed": true
 },
 {
  "name": "Confluencia TCG",
  "province": "Neuquén",
  "city": "Neuquén",
  "address": "Leguizamón 30",
  "ygo": true,
  "digi": false,
  "web": "https://confluenciatcg.mitiendanube.com/",
  "instagram": "confluenciatcg",
  "confirmed": true
 },
 {
  "name": "Creepshop Castelar",
  "province": "Buenos Aires",
  "city": "Castelar",
  "address": "Avellaneda 971",
  "ygo": true,
  "digi": false,
  "web": "https://creepshop.com.ar/",
  "instagram": "creepshop.ar",
  "confirmed": true
 },
 {
  "name": "Dima Game",
  "province": "CABA",
  "city": "CABA (Flores)",
  "address": "Av. Avellaneda 907",
  "ygo": true,
  "digi": true,
  "web": "http://www.dimagame.com/",
  "instagram": "dimagames",
  "confirmed": true
 },
 {
  "name": "Dominaria Comics",
  "province": "Buenos Aires",
  "city": "Vicente López",
  "address": "Av. Maipú 1194",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "dominariacomics",
  "confirmed": true
 },
 {
  "name": "Duelist City",
  "province": "Buenos Aires",
  "city": "Villa Ballester",
  "address": "Alvear 2643",
  "ygo": true,
  "digi": true,
  "web": "http://www.duelistcity.com.ar/",
  "instagram": "duelistcity",
  "confirmed": true
 },
 {
  "name": "El Abismo de Helm Wargames",
  "province": "CABA",
  "city": "CABA (Villa Crespo)",
  "address": "Av. Corrientes 5233",
  "ygo": true,
  "digi": false,
  "web": "https://www.elabismodehelmwargames.ar/",
  "instagram": "elabismodehelmwargames",
  "confirmed": true
 },
 {
  "name": "El Ático Club",
  "province": "San Luis",
  "city": "San Luis",
  "address": "Bolívar 881",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": null,
  "confirmed": true
 },
 {
  "name": "El Ático de Hisui",
  "province": "Buenos Aires",
  "city": "Mar del Plata",
  "address": "Catamarca 1657",
  "ygo": true,
  "digi": false,
  "web": "https://aticodehisui.com/",
  "instagram": "el.atico.de.hisui",
  "confirmed": true
 },
 {
  "name": "F&F TCG Store",
  "province": "Misiones",
  "city": "Posadas",
  "address": "Av. López Torres 2759",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "fyf_tcg",
  "confirmed": true
 },
 {
  "name": "Gallifrey Café - Rol - Comics",
  "province": "Buenos Aires",
  "city": "Mar del Plata",
  "address": "Santiago del Estero 2075",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "gally_crc",
  "confirmed": true
 },
 {
  "name": "Gogogo Manga & Comic Store",
  "province": "Misiones",
  "city": "Posadas",
  "address": "Av. López y Planes 3165",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "gogogolocal",
  "confirmed": true
 },
 {
  "name": "Hadouken",
  "province": "Córdoba",
  "city": "Córdoba",
  "address": "Av. Duarte Quirós 272",
  "ygo": true,
  "digi": true,
  "web": "https://hadouken.com.ar/",
  "instagram": "hadoukencba",
  "confirmed": true
 },
 {
  "name": "Hanoi Proxy",
  "province": "CABA",
  "city": "CABA (Caballito)",
  "address": "Rojas 504",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "hanoi_proxy",
  "confirmed": true
 },
 {
  "name": "Invictvs Paraná",
  "province": "Entre Ríos",
  "city": "Paraná",
  "address": "España 152",
  "ygo": true,
  "digi": false,
  "web": "https://invictvs.com.ar/",
  "instagram": "invictvsparana",
  "confirmed": true
 },
 {
  "name": "Invictvs Rosario",
  "province": "Santa Fe",
  "city": "Rosario",
  "address": "San Lorenzo 1167",
  "ygo": true,
  "digi": true,
  "web": "https://invictvs.com.ar/",
  "instagram": "invictvsrosario",
  "confirmed": true
 },
 {
  "name": "Kame House",
  "province": "Misiones",
  "city": "Posadas",
  "address": "Monteagudo 2150",
  "ygo": true,
  "digi": true,
  "web": null,
  "instagram": null,
  "confirmed": true
 },
 {
  "name": "Konozuba Games",
  "province": "Jujuy",
  "city": "San Salvador de Jujuy",
  "address": "Capitán Martel 1174",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "kono.games",
  "confirmed": true
 },
 {
  "name": "La Batikueva Store",
  "province": "CABA",
  "city": "CABA (Caballito)",
  "address": "Camacuá 371",
  "ygo": true,
  "digi": false,
  "web": "http://www.labatikuevastore.com/",
  "instagram": "La_Batikueva_Store",
  "confirmed": true
 },
 {
  "name": "La Cueva Dragon",
  "province": "Córdoba",
  "city": "Córdoba",
  "address": "Obispo Trejo 419",
  "ygo": true,
  "digi": true,
  "web": "https://lacuevadragon.com/",
  "instagram": "lacuevadragon",
  "confirmed": true
 },
 {
  "name": "La Forja TCG Comics & Games",
  "province": "Buenos Aires",
  "city": "Hurlingham",
  "address": "Tte. Gral. J. A. Roca 981",
  "ygo": true,
  "digi": false,
  "web": "https://www.laforjatcg.com.ar/",
  "instagram": "laforja981",
  "confirmed": true
 },
 {
  "name": "La Frikioteca",
  "province": "Buenos Aires",
  "city": "La Plata",
  "address": "Calle 10 N° 1267",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "lafrikioteca",
  "confirmed": true
 },
 {
  "name": "La Guarida del Hobbit",
  "province": "Salta",
  "city": "Salta",
  "address": "Ruiz de los Llanos 1589",
  "ygo": true,
  "digi": true,
  "web": null,
  "instagram": "la_guarida_del_hobbit",
  "confirmed": true
 },
 {
  "name": "Lair (Magic Lair)",
  "province": "CABA",
  "city": "CABA (Caballito)",
  "address": "José María Moreno 875",
  "ygo": true,
  "digi": false,
  "web": "https://www.lair.com.ar/",
  "instagram": "lair_argentina",
  "confirmed": true
 },
 {
  "name": "Locura Magic TCG",
  "province": "Mendoza",
  "city": "Mendoza",
  "address": "Av. San Martín 1136, Pasaje San Martín, Local 24",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "locuramagic_tcg",
  "confirmed": true
 },
 {
  "name": "Lordpipas Store",
  "province": "Buenos Aires",
  "city": "Los Polvorines",
  "address": "Dr. Juan A. Mazza 2916",
  "ygo": true,
  "digi": false,
  "web": "https://lordpipas.com/",
  "instagram": "lordpipasstore",
  "confirmed": true
 },
 {
  "name": "Ludik: Legends and Lattes",
  "province": "Buenos Aires",
  "city": "Bahía Blanca",
  "address": "Garibaldi 102",
  "ygo": true,
  "digi": false,
  "web": "https://ludiktcg.mitiendanube.com/",
  "instagram": "ludik.tcg",
  "confirmed": true
 },
 {
  "name": "Magic Games II",
  "province": "CABA",
  "city": "CABA (Belgrano)",
  "address": "Juramento 2984",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": null,
  "confirmed": true
 },
 {
  "name": "Milenio Oscuro Comics",
  "province": "Buenos Aires",
  "city": "Necochea",
  "address": "Calle 62 N° 3108",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "mileniooscuro",
  "confirmed": true
 },
 {
  "name": "Mou Ikkai",
  "province": "Buenos Aires",
  "city": "Quilmes",
  "address": "Av. Mitre 573",
  "ygo": true,
  "digi": false,
  "web": "https://www.mercadolibre.com.ar/pagina/mouikkai",
  "instagram": "mouikkaistore",
  "confirmed": true
 },
 {
  "name": "My Little Kioto",
  "province": "Buenos Aires",
  "city": "Martín Coronado",
  "address": "Leandro N. Alem 6824",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "mylittlekioto",
  "confirmed": true
 },
 {
  "name": "Nippona Comics",
  "province": "Mendoza",
  "city": "Mendoza",
  "address": "Lavalle 35, Local 21",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "nipponacomics",
  "confirmed": true
 },
 {
  "name": "Ozen TCG",
  "province": "Buenos Aires",
  "city": "Quilmes",
  "address": "Moreno 634",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "ozentcg",
  "confirmed": true
 },
 {
  "name": "Patagonia Games",
  "province": "Chubut",
  "city": "Comodoro Rivadavia",
  "address": "Dorrego 1095",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "minamipatagoniagames",
  "confirmed": true
 },
 {
  "name": "Penta Game",
  "province": "Buenos Aires",
  "city": "Temperley",
  "address": "Av. Hipólito Yrigoyen 10450",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "penta_game_",
  "confirmed": true
 },
 {
  "name": "Polybius",
  "province": "Buenos Aires",
  "city": "Merlo",
  "address": "Chacabuco 579",
  "ygo": true,
  "digi": true,
  "web": "https://www.polybiustore.com.ar/",
  "instagram": "polybius1280",
  "confirmed": true
 },
 {
  "name": "Puro Comic",
  "province": "Santa Fe",
  "city": "Rosario",
  "address": "3 de Febrero 1180",
  "ygo": true,
  "digi": false,
  "web": "http://www.purocomic.com.ar/",
  "instagram": "purocomic",
  "confirmed": true
 },
 {
  "name": "R.C. Mangas",
  "province": "Buenos Aires",
  "city": "Rafael Castillo",
  "address": "Comandante Granville 1774",
  "ygo": true,
  "digi": false,
  "web": "https://rcmangas.empretienda.com.ar/",
  "instagram": "r.c_mangas",
  "confirmed": true
 },
 {
  "name": "Sekai Games",
  "province": "CABA",
  "city": "CABA (San Nicolás)",
  "address": "Ayacucho 662",
  "ygo": true,
  "digi": true,
  "web": null,
  "instagram": "sekaigamesargentina",
  "confirmed": true
 },
 {
  "name": "Space Gaming",
  "province": "Buenos Aires",
  "city": "Banfield (Lomas de Zamora)",
  "address": "Alem 1400",
  "ygo": true,
  "digi": true,
  "web": "https://spacegaminglomas.com/",
  "instagram": "spacegaminglomas",
  "confirmed": true
 },
 {
  "name": "START Informática & Hobbies",
  "province": "Córdoba",
  "city": "Río Cuarto",
  "address": "Sarmiento 906",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "start_info.r4",
  "confirmed": true
 },
 {
  "name": "Stefano Espacio Geek",
  "province": "Buenos Aires",
  "city": "Florencio Varela",
  "address": "San Juan 256",
  "ygo": true,
  "digi": false,
  "web": "https://stefanotiendageek.empretienda.com.ar/",
  "instagram": "stefanosgeekst",
  "confirmed": true
 },
 {
  "name": "TCG Club",
  "province": "Buenos Aires",
  "city": "La Plata",
  "address": "Calle 45 N° 845",
  "ygo": true,
  "digi": true,
  "web": null,
  "instagram": "tcgclub.lp",
  "confirmed": true
 },
 {
  "name": "Tolaria",
  "province": "Buenos Aires",
  "city": "Mar del Plata",
  "address": "Almirante Brown 2446",
  "ygo": true,
  "digi": false,
  "web": "https://www.tolariashop.com/",
  "instagram": "tolariashop",
  "confirmed": true
 },
 {
  "name": "Tutopia",
  "province": "Santa Fe",
  "city": "Santa Fe",
  "address": "25 de Mayo 2581",
  "ygo": true,
  "digi": false,
  "web": "http://www.tutopiaplace.com/",
  "instagram": "tutopia.place",
  "confirmed": true
 },
 {
  "name": "Utopia TCG",
  "province": "Buenos Aires",
  "city": "San Nicolás de los Arroyos",
  "address": "Bartolomé Mitre 206, planta alta",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "utopiatcg.sn",
  "confirmed": true
 },
 {
  "name": "Wonderland Store",
  "province": "Santiago del Estero",
  "city": "La Banda",
  "address": "Garay 216",
  "ygo": true,
  "digi": false,
  "web": null,
  "instagram": "wl_isports",
  "confirmed": true
 },
 {
  "name": "Phoenix Reborn",
  "province": "CABA",
  "city": "CABA (Villa Devoto)",
  "address": "Cnel. Ramón Lista 5126",
  "ygo": true,
  "digi": true,
  "web": "https://phoenixreborn.com.ar/",
  "instagram": "phoenixrebornstore",
  "confirmed": true
 },
 {
  "name": "Rancho Store",
  "province": "CABA",
  "city": "CABA (Floresta)",
  "address": "Cervantes 1099",
  "ygo": false,
  "digi": true,
  "web": "https://ranchostoretcg.com.ar/",
  "instagram": "ranchodelprofesor",
  "confirmed": false
 },
 {
  "name": "El Ojo de Ugin",
  "province": "Buenos Aires",
  "city": "Tandil",
  "address": "Yrigoyen 731",
  "ygo": false,
  "digi": true,
  "web": null,
  "instagram": "elojodeugin",
  "confirmed": true
 },
 {
  "name": "Maná Café y Juegos",
  "province": "Buenos Aires",
  "city": "La Plata",
  "address": "Calle 8 entre 58 y 59",
  "ygo": false,
  "digi": true,
  "web": "https://linktr.ee/manacafelp",
  "instagram": "manacafelp",
  "confirmed": false
 },
 {
  "name": "Duel Coffee Store",
  "province": "Chaco",
  "city": "Chaco (ciudad sin confirmar)",
  "address": "Sin dirección publicada",
  "ygo": false,
  "digi": true,
  "web": null,
  "instagram": null,
  "confirmed": false
 },
 {
  "name": "Merlo Insumos",
  "province": "Buenos Aires",
  "city": "Merlo",
  "address": "Sin dirección publicada",
  "ygo": false,
  "digi": true,
  "web": null,
  "instagram": null,
  "confirmed": false
 },
 {
  "name": "2de6",
  "province": "CABA",
  "city": "CABA (Villa Crespo)",
  "address": "Aráoz 272",
  "ygo": false,
  "digi": true,
  "web": null,
  "instagram": null,
  "confirmed": false
 },
 {
  "name": "Magic Dealers",
  "province": "CABA",
  "city": "CABA (Belgrano R)",
  "address": "Zapiola 2041",
  "ygo": false,
  "digi": true,
  "web": null,
  "instagram": null,
  "confirmed": false
 }
];

export const storesForGame = (g: Game) => DIRECTORY.filter((s) => (g === "ygo" ? s.ygo : s.digi));
