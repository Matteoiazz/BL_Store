/*
  CATALOGO BL STORE
  -----------------
  Per aggiungere o modificare un capo modifica solo questo file.
  - price: prezzo in euro (es. 59.90). Lascia null per mostrare "Prezzo in store".
  - sizes: taglie disponibili (es. ["S","M","L","XL"]). Lascia [] se da chiedere.
  - ground: "grey" per le foto su fondo grigio, "black" per quelle nella black box.
  - status: "new" mostra l'etichetta "Nuovo arrivo", "in" = disponibile, "out" = esaurito.
    Metti "new" solo sui capi davvero appena arrivati.
*/
window.BL_STORE = {
  phone: "+393756795995",
  phoneLabel: "375 679 5995",
  instagram: "https://www.instagram.com/bl_store_official_/",
  handle: "@bl_store_official_",
  address: "Via Cesare Marini, 19",
  city: "87100 Cosenza CS",
  maps: "https://www.google.com/maps/search/?api=1&query=Via+Cesare+Marini+19+Cosenza",
  hours: null, // es. "Lun–Sab 9:30–13:00 / 16:30–20:30"
  season: "FW 26/27"
};

window.BL_CATALOG = [
  { n: 1,  name: "Hockey Jersey Black District", variant: "Heather / White", brand: "Cianotic Archive", cat: "maglie", price: null, sizes: [], ground: "grey",  status: "in",  img: "assets/img/ig/p01.jpg" },
  { n: 2,  name: "Hoodie Blessed 17",             variant: "Strass all over",  brand: "",                 cat: "felpe",  price: null, sizes: [], ground: "grey",  status: "in",  img: "assets/img/ig/p02.jpg" },
  { n: 3,  name: "Hockey Jersey Black District", variant: "Black / White",   brand: "Cianotic Archive", cat: "maglie", price: null, sizes: [], ground: "grey",  status: "in",  img: "assets/img/ig/p03.jpg" },
  { n: 4,  name: "Tuta Track Stripe",             variant: "Nero / bande bianche", brand: "",           cat: "tute",   price: null, sizes: [], ground: "grey",  status: "in",  img: "assets/img/ig/p04.jpg" },
  { n: 5,  name: "Completo Overshirt",            variant: "Camicia + pantalone, nero", brand: "",      cat: "tute",   price: null, sizes: [], ground: "grey",  status: "in",  img: "assets/img/ig/p05.jpg" },
  { n: 6,  name: "Longsleeve Rise Again",         variant: "Aquila e strass",  brand: "",                 cat: "maglie", price: null, sizes: [], ground: "grey",  status: "in",  img: "assets/img/ig/p06.jpg" },
  { n: 7,  name: "Look Yellow Print",             variant: "Tee oversize + jeans destroyed", brand: "", cat: "look",   price: null, sizes: [], ground: "grey",  status: "in",  img: "assets/img/ig/p07.jpg" },
  { n: 8,  name: "Giacca Denim Hood",             variant: "Raw blue, zip",    brand: "",                 cat: "giacche",price: null, sizes: [], ground: "black", status: "in",  img: "assets/img/ig/p08.jpg" },
  { n: 9,  name: "Longsleeve Dream It",           variant: "Nero · Bianco",    brand: "",                 cat: "maglie", price: null, sizes: [], ground: "black", status: "in",  img: "assets/img/ig/p09.jpg" },
  { n: 10, name: "Look Flannel",                  variant: "Camicia quadri + jeans strass", brand: "",  cat: "look",   price: null, sizes: [], ground: "wood",  status: "in",  img: "assets/img/ig/p10.jpg" },
  { n: 11, name: "Look Angel",                    variant: "Felpa stampa + jeans grey wash", brand: "", cat: "look",   price: null, sizes: [], ground: "black", status: "in",  img: "assets/img/ig/p11.jpg" },
  { n: 12, name: "Jeans Patch Camo",              variant: "Black wash + camo", brand: "",                cat: "jeans",  price: null, sizes: [], ground: "black", status: "in",  img: "assets/img/ig/p12.jpg" }
];

window.BL_CATEGORIES = [
  { id: "all",     label: "Tutto" },
  { id: "maglie",  label: "Maglie" },
  { id: "felpe",   label: "Felpe" },
  { id: "giacche", label: "Giacche" },
  { id: "tute",    label: "Tute & completi" },
  { id: "jeans",   label: "Jeans" },
  { id: "look",    label: "Look" }
];
