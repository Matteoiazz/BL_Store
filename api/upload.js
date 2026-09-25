// POST (corpo = immagine JPEG/PNG/WebP già ridimensionata dal telefono) -> { url }
import { putImage, storageReady } from "./_lib/store.js";
import { isAuthed, json } from "./_lib/auth.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 4 * 1024 * 1024;

export async function POST(req) {
  if (!storageReady()) return json({ error: "Archivio non ancora collegato su Vercel." }, 503);
  if (!isAuthed(req)) return json({ error: "Accesso scaduto, rientra." }, 401);
  const type = (req.headers.get("content-type") || "").split(";")[0];
  if (!TYPES[type]) return json({ error: "Formato foto non supportato." }, 415);
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX) return json({ error: "Foto troppo grande (massimo 4 MB)." }, 413);
  const slug = (new URL(req.url).searchParams.get("name") || "capo").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "capo";
  const url = await putImage(`${slug}.${TYPES[type]}`, bytes, type);
  return json({ url });
}
