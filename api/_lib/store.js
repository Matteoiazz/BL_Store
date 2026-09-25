// Storage: Vercel Blob in produzione, cartella locale .data/ in sviluppo.
import { randomUUID } from "node:crypto";

// Vercel names the variable BLOB_READ_WRITE_TOKEN, or <PREFIX>_READ_WRITE_TOKEN when the store was connected with a custom prefix.
const tokenKey = "BLOB_READ_WRITE_TOKEN" in process.env ? "BLOB_READ_WRITE_TOKEN" : Object.keys(process.env).find(k => /_READ_WRITE_TOKEN$/.test(k));
export const blobToken = tokenKey ? process.env[tokenKey] : "";
export const tokenCandidates = () => Object.keys(process.env).filter(k => /BLOB|READ_WRITE_TOKEN|STORE_ID/i.test(k));
const useBlob = !!blobToken;
const T = { token: blobToken };
let blob;
async function B() { return blob ||= await import("@vercel/blob"); }

// ---------- local fallback (npm run dev without a token) ----------
import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
const DATA = join(process.cwd(), ".data");

async function localList(prefix) {
  const dir = join(DATA, prefix);
  try {
    const files = await readdir(dir);
    return files.map(f => ({ pathname: prefix + f, url: `/.data/${prefix}${f}`, uploadedAt: new Date(Number(f.split("-")[0]) || 0) }));
  } catch { return []; }
}

/** Latest JSON document under a prefix (e.g. "catalog/"). */
export async function readJSON(prefix) {
  if (useBlob) {
    const { list } = await B();
    const { blobs } = await list({ prefix, limit: 1000, ...T });
    if (!blobs.length) return null;
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const r = await fetch(blobs[0].url, { cache: "no-store" });
    return r.ok ? r.json() : null;
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
    await put(`${prefix}${Date.now()}.json`, body, { access: "public", addRandomSuffix: true, contentType: "application/json", cacheControlMaxAge: 60, ...T });
    const { blobs } = await list({ prefix, limit: 1000, ...T });
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const old = blobs.slice(5).map(b => b.url);
    if (old.length) await del(old, T);
    return;
  }
  await mkdir(join(DATA, prefix), { recursive: true });
  await writeFile(join(DATA, prefix, `${Date.now()}-${randomUUID().slice(0, 8)}.json`), body);
}

/** Stores an uploaded image, returns its public URL. */
export async function putImage(name, bytes, contentType) {
  if (useBlob) {
    const { put } = await B();
    const res = await put(`products/${name}`, bytes, { access: "public", addRandomSuffix: true, contentType, ...T });
    return res.url;
  }
  const file = `${Date.now()}-${name}`;
  await mkdir(join(DATA, "products"), { recursive: true });
  await writeFile(join(DATA, "products", file), bytes);
  return `/.data/products/${file}`;
}

export async function removeImage(url) {
  if (!url || url.startsWith("assets/")) return; // foto originali del sito: non si toccano
  if (useBlob) {
    if (!/\.blob\.vercel-storage\.com\//.test(url)) return;
    const { del } = await B();
    await del(url, T).catch(() => {});
    return;
  }
  if (url.startsWith("/.data/")) await rm(join(process.cwd(), url.slice(1))).catch(() => {});
}

export const storageReady = () => useBlob || process.env.NODE_ENV !== "production";
