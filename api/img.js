// GET ?p=products/<file>: serves a product photo from the (private) store, cached on the CDN.
import { getImage } from "./_lib/store.js";

export async function GET(req) {
  const p = new URL(req.url).searchParams.get("p") || "";
  const img = await getImage(p).catch(() => null);
  if (!img) return new Response("Not found", { status: 404 });
  // file names carry a random suffix, so a photo never changes: cache it for a year
  return new Response(img.stream, { headers: { "x-content-type-options": "nosniff", "content-type": img.type, "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
}
