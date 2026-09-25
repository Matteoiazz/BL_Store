// Storage: Vercel Blob in produzione, cartella locale .data/ in sviluppo.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

// Vercel names the variable BLOB_READ_WRITE_TOKEN, or <PREFIX>_READ_WRITE_TOKEN when the store was connected with a custom prefix.
// Newer projects connect Blob with BLOB_STORE_ID only: the SDK then authenticates by itself (OIDC).
const tokenKey = "BLOB_READ_WRITE_TOKEN" in process.env ? "BLOB_READ_WRITE_TOKEN" : Object.keys(process.env).find(k => /_READ_WRITE_TOKEN$/.test(k));
const blobToken = tokenKey ? process.env[tokenKey] : "";
export const tokenCandidates = () => Object.keys(process.env).filter(k => /BLOB|READ_WRITE_TOKEN|STORE_ID/i.test(k));
const useBlob = !!blobToken || !!process.env.BLOB_STORE_ID;
const T = blobToken ? { token: blobToken } : {};
let blob;
async function B() { return blob ||= await import("@vercel/blob"); }

// a store is either private or public; learn which on the first call and remember it
let ACCESS = process.env.BLOB_ACCESS || null;
async function withAccess(fn) {
  const tries = ACCESS ? [ACCESS] : ["private", "public"];
  for (let i = 0; i < tries.length; i++) {
    try { const r = await fn(tries[i]); ACCESS = tries[i]; return r; }
    catch (e) { if (i < tries.length - 1 && /access/i.test(String(e?.message))) continue; throw e; }
  }
}

async function readBlobText(pathname) {
  const { get } = await B();
  const r = await withAccess(access => get(pathname, { access, useCache: false, ...T }));
  if (!r || !r.stream) return null;
  return new Response(r.stream).text();
}

// ---------- local fallback (npm run dev without Blob) ----------
const DATA = join(process.cwd(), ".data");
async function localList(prefix) {
  try {
    return (await readdir(join(DATA, prefix))).map(f => ({ pathname: prefix + f }));
  } catch { return []; }
}

/** Latest JSON document under a prefix (e.g. "catalog/"). */
export async function readJSON(prefix) {
  if (useBlob) {
    const { list } = await B();
    const { blobs } = await list({ prefix, limit: 1000, ...T });
    if (!blobs.length) return null;
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const text = await readBlobText(blobs[0].pathname);
    return text ? JSON.parse(text) : null;
  }
  const files = (await localList(prefix)).sort((a, b) => b.pathname.localeCompare(a.pathname));
  if (!files.length) return null;
  return JSON.parse(await readFile(join(DATA, files[0].pathname), "utf8"));
}

/** Writes a new version and removes the older ones (keeps the last 5 as history). */
export async function writeJSON(prefix, data) {
  const body = JSON.stringify(data);
  if (useBlob) {
    const { put, list, del } = await B();
    await withAccess(access => put(`${prefix}${Date.now()}.json`, body, { access, addRandomSuffix: true, contentType: "application/json", cacheControlMaxAge: 60, ...T }));
    const { blobs } = await list({ prefix, limit: 1000, ...T });
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const old = blobs.slice(5).map(b => b.url);
    if (old.length) await del(old, T);
    return;
  }
  await mkdir(join(DATA, prefix), { recursive: true });
  await writeFile(join(DATA, prefix, `${Date.now()}-${randomUUID().slice(0, 8)}.json`), body);
}

/** Stores an uploaded image, returns the URL the site shows it from. */
export async function putImage(name, bytes, contentType) {
  if (useBlob) {
    const { put } = await B();
    const res = await withAccess(access => put(`products/${name}`, bytes, { access, addRandomSuffix: true, contentType, cacheControlMaxAge: 31536000, ...T }));
    // private stores can't be linked directly: the site serves the photo itself (api/img)
    return ACCESS === "public" ? res.url : `/api/img?p=${encodeURIComponent(res.pathname)}`;
  }
  const file = `${Date.now()}-${name}`;
  await mkdir(join(DATA, "products"), { recursive: true });
  await writeFile(join(DATA, "products", file), bytes);
  return `/.data/products/${file}`;
}

/** Streams a stored photo (only for pathnames under products/). */
export async function getImage(pathname) {
  if (!/^products\/[\w.-]+$/.test(pathname)) return null;
  if (useBlob) {
    const { get } = await B();
    const r = await withAccess(access => get(pathname, { access, ...T }));
    return r && r.stream ? { stream: r.stream, type: r.blob.contentType || "image/jpeg" } : null;
  }
  try { return { stream: await readFile(join(DATA, pathname)), type: "image/jpeg" }; } catch { return null; }
}

export async function removeImage(url) {
  if (!url || url.startsWith("assets/")) return; // foto originali del sito: non si toccano
  const own = url.startsWith("/api/img?p=") ? decodeURIComponent(url.split("p=")[1]) : null;
  if (useBlob) {
    const target = own || (/\.blob\.vercel-storage\.com\//.test(url) ? url : null);
    if (!target) return;
    const { del } = await B();
    await del(target, T).catch(() => {});
    return;
  }
  if (url.startsWith("/.data/")) await rm(join(process.cwd(), url.slice(1))).catch(() => {});
}

export const storageReady = () => useBlob || process.env.NODE_ENV !== "production";
