// GET: stato (serve creare la password? sei collegato?)
// POST {password}: accesso, oppure creazione della password al primo accesso
// PUT {current, password}: cambio password
// DELETE: esci
import { hasPassword, setPassword, checkPassword, sessionCookie, clearCookie, isAuthed, json } from "./_lib/auth.js";
import { storageReady } from "./_lib/store.js";

const notReady = () => json({ error: "storage", message: "Archivio non ancora collegato su Vercel." }, 503);

export async function GET(req) {
  if (!storageReady()) return notReady();
  return json({ setup: !(await hasPassword()), authed: isAuthed(req) });
}

export async function POST(req) {
  if (!storageReady()) return notReady();
  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== "string") return json({ error: "Password mancante." }, 400);

  if (!(await hasPassword())) {
    if (password.length < 8) return json({ error: "La password deve avere almeno 8 caratteri." }, 400);
    await setPassword(password);
    return json({ ok: true, created: true }, 200, { "set-cookie": sessionCookie(req) });
  }
  if (!(await checkPassword(password))) {
    await new Promise(r => setTimeout(r, 800));
    return json({ error: "Password sbagliata." }, 401);
  }
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(req) });
}

export async function PUT(req) {
  if (!isAuthed(req)) return json({ error: "Accesso scaduto, rientra." }, 401);
  const { current, password } = await req.json().catch(() => ({}));
  if (!(await checkPassword(current))) return json({ error: "La password attuale non è giusta." }, 401);
  if (typeof password !== "string" || password.length < 8) return json({ error: "La nuova password deve avere almeno 8 caratteri." }, 400);
  await setPassword(password);
  return json({ ok: true });
}

export function DELETE() {
  return json({ ok: true }, 200, { "set-cookie": clearCookie });
}
