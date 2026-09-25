// Password del negozio (scelta al primo accesso) + sessione firmata in un cookie.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { readJSON, writeJSON } from "./store.js";

const COOKIE = "bl_admin";
const TTL = 60 * 60 * 24 * 30; // 30 giorni: il negoziante resta collegato sul suo telefono
const secret = () => createHmac("sha256", process.env.BLOB_READ_WRITE_TOKEN || "dev-only-secret").update("bl-session").digest();

export async function hasPassword() {
  return !!(await readJSON("auth/"));
}

export async function setPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  await writeJSON("auth/", { salt, hash, v: Date.now() });
}

export async function checkPassword(password) {
  const rec = await readJSON("auth/");
  if (!rec) return false;
  const a = Buffer.from(rec.hash, "hex");
  const b = scryptSync(String(password), rec.salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const good = createHmac("sha256", secret()).update(body).digest("base64url");
  if (mac.length !== good.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  return p.exp > Date.now() / 1000 ? p : null;
}

export function sessionCookie(req) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  const token = sign({ sub: "admin", exp: Math.floor(Date.now() / 1000) + TTL });
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL}${secure}`;
}
export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

export function isAuthed(req) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return !!verify(m && m[1]);
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
