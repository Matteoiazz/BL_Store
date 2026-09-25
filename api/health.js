// Temporary: checks that the Blob store accepts a write, a read and a delete.
import { json } from "./_lib/auth.js";

export async function GET() {
  const out = { storeId: !!process.env.BLOB_STORE_ID };
  try {
    const { put, get, del } = await import("@vercel/blob");
    const b = await put(`health/${Date.now()}.txt`, "ok", { access: "private", addRandomSuffix: true, contentType: "text/plain" });
    out.put = true;
    const r = await get(b.pathname, { access: "private", useCache: false });
    out.read = r && r.stream ? (await new Response(r.stream).text()) === "ok" : false;
    await del(b.url);
    out.del = true;
  } catch (e) {
    out.error = String(e && e.message || e).slice(0, 300);
  }
  return json(out);
}
