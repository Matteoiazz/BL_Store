// GET: stato (serve creare la password? sei collegato?)
// POST {password}: accesso, oppure creazione della password al primo accesso
// PUT {current, password}: cambio password
// DELETE: esci
import { hasPassword, setPassword, checkPassword, sessionCookie, clearCookie, isAuthed, json } from "./_lib/auth.js";
import { storageReady, readJSON, writeJSON } from "./_lib/store.js";

const notReady = () => json({ error: "storage", message: "Archivio non ancora collegato su Vercel." }, 503);

// brute-force guard: after 5 wrong passwords the panel locks for 15 minutes (kept in the store, so it holds across servers)
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;
const lockState = async () => (await readJSON("lock/")) || { fails: 0, until: 0 };
const lockedFor = st => Math.max(0, st.until - Date.now());
const tooMany = ms => json({ error: `Troppi tentativi sbagliati. Riprova tra ${Math.ceil(ms / 60000)} minuti.` }, 429, { "retry-after": String(Math.ceil(ms / 1000)) });
async function failed(st) {
  const fails = st.fails + 1;
  await writeJSON("lock/", fails >= MAX_FAILS ? { fails: 0, until: Date.now() + LOCK_MS } : { fails, until: 0 });
  await new Promise(r => setTimeout(r, 800));
}

export async function GET(req) {
  if (!storageReady()) return notReady();
  return json({ setup: !(await hasPassword()), authed: await isAuthed(req) });
}

export async function POST(req) {
  if (!storageReady()) return notReady();
  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || password.length > 200) return json({ error: "Password mancante." }, 400);

  if (!(await hasPassword())) {
    if (password.length < 8) return json({ error: "La password deve avere almeno 8 caratteri." }, 400);
    await setPassword(password);
    return json({ ok: true, created: true }, 200, { "set-cookie": await sessionCookie(req) });
  }
  const st = await lockState();
  if (lockedFor(st)) return tooMany(lockedFor(st));
  if (!(await checkPassword(password))) {
    await failed(st);
    return json({ error: "Password sbagliata." }, 401);
  }
  if (st.fails) await writeJSON("lock/", { fails: 0, until: 0 });
  return json({ ok: true }, 200, { "set-cookie": await sessionCookie(req) });
}

export async function PUT(req) {
  if (!(await isAuthed(req))) return json({ error: "Accesso scaduto, rientra." }, 401);
  const { current, password } = await req.json().catch(() => ({}));
  const st = await lockState();
  if (lockedFor(st)) return tooMany(lockedFor(st));
  if (!(await checkPassword(current))) { await failed(st); return json({ error: "La password attuale non è giusta." }, 401); }
  if (typeof password !== "string" || password.length < 8 || password.length > 200) return json({ error: "La nuova password deve avere almeno 8 caratteri." }, 400);
  await setPassword(password);
  // the session key is derived from the password, so hand this phone a fresh session
  return json({ ok: true }, 200, { "set-cookie": await sessionCookie(req) });
}

export function DELETE() {
  return json({ ok: true }, 200, { "set-cookie": clearCookie });
}
