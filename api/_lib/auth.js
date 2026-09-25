// Password del negozio (scelta al primo accesso) + sessione firmata in un cookie.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { readJSON, writeJSON } from "./store.js";

const COOKIE = "bl_admin";
const TTL = 60 * 60 * 24 * 30; // 30 giorni: il negoziante resta collegato sul suo telefono

// sessions are signed with a key derived from the stored password hash:
// it never leaves the server, and changing the password logs every phone out
const secretFrom = rec => createHmac("sha256", `${rec.salt}:${rec.hash}`).update("bl-session").digest();

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

function sign(payload, rec) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secretFrom(rec)).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token, rec) {
  if (!rec || !token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const good = createHmac("sha256", secretFrom(rec)).update(body).digest("base64url");
  if (mac.length !== good.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  return p.exp > Date.now() / 1000 ? p : null;
}

export async function sessionCookie(req) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  const token = sign({ sub: "admin", exp: Math.floor(Date.now() / 1000) + TTL }, await readJSON("auth/"));
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL}${secure}`;
}
export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

export async function isAuthed(req) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  return !!verify(m[1], await readJSON("auth/"));
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
