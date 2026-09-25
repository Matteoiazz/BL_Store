// Temporary: checks that the Blob store accepts a write, a read and a delete.
import { json } from "./_lib/auth.js";

export async function GET() {
  const out = { storeId: !!process.env.BLOB_STORE_ID, token: !!process.env.BLOB_READ_WRITE_TOKEN };
  try {
    const { put, del, list } = await import("@vercel/blob");
    const b = await put(`health/${Date.now()}.txt`, "ok", { access: "public", addRandomSuffix: true, contentType: "text/plain" });
    out.put = true;
    out.read = (await (await fetch(b.url, { cache: "no-store" })).text()) === "ok";
    out.list = (await list({ prefix: "health/" })).blobs.length > 0;
    await del(b.url);
    out.del = true;
  } catch (e) {
    out.error = String(e && e.message || e).slice(0, 300);
  }
  return json(out);
}
