// Server di sviluppo: file statici + funzioni in /api, come su Vercel.
// Senza BLOB_READ_WRITE_TOKEN i dati vanno nella cartella .data/
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const port = Number(process.env.PORT) || 5173;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/") && !url.pathname.includes("/_")) {
      const mod = await import(pathToFileURL(join(root, url.pathname + ".js")).href + `?t=${Date.now()}`);
      const fn = mod[req.method];
      if (!fn) { res.writeHead(405).end(); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length && !["GET", "HEAD"].includes(req.method) ? Buffer.concat(chunks) : undefined;
      const r = await fn(new Request(url, { method: req.method, headers: req.headers, body }));
      const headers = {}; r.headers.forEach((v, k) => headers[k] = v);
      res.writeHead(r.status, headers).end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([\\/])+/, "");
    let file = join(root, p);
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, "index.html");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" }).end(data);
  } catch (e) {
    if (e.code === "ENOENT" || e.code === "ERR_MODULE_NOT_FOUND") { res.writeHead(404).end("Not found"); return; }
    console.error(e); res.writeHead(500).end(String(e));
  }
}).listen(port, () => console.log(`BL Store dev: http://localhost:${port}`));
