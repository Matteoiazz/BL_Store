// GET: catalogo pubblico (capi + info negozio). PUT: salva il catalogo (solo negozio).
import { readJSON, writeJSON, removeImage, storageReady } from "./_lib/store.js";
import { isAuthed, json } from "./_lib/auth.js";

const CATS = ["maglie", "felpe", "giacche", "tute", "jeans", "look", "accessori", "scarpe"];
const STATUS = ["new", "in", "out"];
const clip = (v, n) => String(v ?? "").trim().slice(0, n);

function clean(data) {
  const items = (Array.isArray(data.items) ? data.items : []).slice(0, 500).map(it => ({
    id: clip(it.id, 40) || crypto.randomUUID(),
    n: Math.max(1, Math.min(999, parseInt(it.n, 10) || 1)),
    name: clip(it.name, 80),
    variant: clip(it.variant, 120),
    brand: clip(it.brand, 60),
    cat: CATS.includes(it.cat) ? it.cat : "look",
    price: it.price === null || it.price === "" || it.price === undefined ? null : Math.max(0, Math.round(parseFloat(String(it.price).replace(",", ".")) * 100) / 100) || null,
    sizes: (Array.isArray(it.sizes) ? it.sizes : []).map(s => clip(s, 8)).filter(Boolean).slice(0, 20),
    status: STATUS.includes(it.status) ? it.status : "in",
    ground: ["grey", "black", "wood"].includes(it.ground) ? it.ground : "grey",
    img: clip(it.img, 500),
    createdAt: it.createdAt || new Date().toISOString()
  })).filter(it => it.name && it.img);
  const s = data.store || {};
  return {
    items,
    store: { hours: clip(s.hours, 160) || null, season: clip(s.season, 30) || null },
    updatedAt: new Date().toISOString()
  };
}

export async function GET() {
  if (!storageReady()) return json({ items: null }, 200);
  const data = await readJSON("catalog/");
  // la pagina pubblica è in cache per 20s sul CDN: gli aggiornamenti arrivano quasi subito
  return json(data || { items: null }, 200, { "cache-control": "public, s-maxage=20, stale-while-revalidate=300" });
}

export async function PUT(req) {
  if (!storageReady()) return json({ error: "Archivio non ancora collegato su Vercel." }, 503);
  if (!isAuthed(req)) return json({ error: "Accesso scaduto, rientra." }, 401);
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Dati non validi." }, 400);

  const prev = await readJSON("catalog/");
  const next = clean(body);
  await writeJSON("catalog/", next);

  // foto dei capi eliminati: via anche dall'archivio
  if (prev && prev.items) {
    const keep = new Set(next.items.map(i => i.img));
    await Promise.all(prev.items.filter(i => !keep.has(i.img)).map(i => removeImage(i.img)));
  }
  return json(next);
}
