(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CATS = window.BL_CATEGORIES.filter(c => c.id !== "all");
  const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36", "Unica"];
  const euro = p => p == null ? "Prezzo in store" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: p % 1 ? 2 : 0 }).format(p);
  const src = u => /^(https?:|\/)/.test(u) ? u : "/" + u;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

  let data = { items: [], store: {} };
  let seeded = false, show = "all", editing = null, pendingFile = null;

  /* ---------- api ---------- */
  async function api(path, opts = {}) {
    const r = await fetch(path, { credentials: "same-origin", ...opts });
    const body = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== "/api/session") { gate("login", "Accesso scaduto, rientra."); throw new Error(body.error || "Accesso scaduto"); }
    if (!r.ok) throw new Error(body.error || body.message || "Qualcosa è andato storto, riprova.");
    return body;
  }

  /* ---------- gate ---------- */
  const gateEl = $("[data-view=gate]"), appEl = $("[data-view=app]"), loginForm = $("[data-login]");
  let gateMode = "login";
  function gate(mode, msg) {
    gateMode = mode;
    appEl.hidden = true; gateEl.hidden = false;
    const t = $("[data-gate-text]"), title = $("[data-gate-title]");
    loginForm.hidden = mode === "storage";
    if (mode === "storage") {
      title.textContent = "Quasi pronto";
      t.textContent = "L'archivio per foto e capi non è ancora collegato al sito su Vercel. Appena è collegato, questa pagina funziona.";
    } else if (mode === "setup") {
      title.textContent = "Benvenuto";
      t.textContent = "Scegli la password per gestire il negozio. Ti servirà ogni volta che entri da un telefono nuovo.";
      $("[data-pw-label]").textContent = "Nuova password (almeno 8 caratteri)";
      loginForm.password.autocomplete = "new-password";
      $("[data-login-btn]").textContent = "Crea password ed entra";
    } else {
      title.textContent = "BL Store";
      t.textContent = msg || "Entra per aggiornare capi e prezzi.";
      $("[data-pw-label]").textContent = "Password";
      $("[data-login-btn]").textContent = "Entra";
    }
    if (!loginForm.hidden) loginForm.password.focus();
  }

  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("[data-login-btn]"), err = $("[data-login-err]");
    err.textContent = ""; btn.disabled = true;
    try {
      await api("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: loginForm.password.value }) });
      loginForm.reset();
      await start();
    } catch (x) { err.textContent = x.message; }
    btn.disabled = false;
  });

  async function boot() {
    try {
      const r = await fetch("/api/session", { credentials: "same-origin" });
      if (r.status === 503) return gate("storage");
      const s = await r.json();
      if (s.setup) return gate("setup");
      if (!s.authed) return gate("login");
      await start();
    } catch { gate("storage"); }
  }

  async function start() {
    const d = await api("/api/catalog", { cache: "no-store" });
    if (Array.isArray(d.items)) { data = { items: d.items, store: d.store || {} }; seeded = false; }
    else {
      data = { items: window.BL_CATALOG.map(it => ({ ...it, id: uid(), createdAt: new Date().toISOString() })), store: { hours: window.BL_STORE.hours, season: window.BL_STORE.season } };
      seeded = true;
    }
    gateEl.hidden = true; appEl.hidden = false;
    render();
  }

  /* ---------- list ---------- */
  const list = $("[data-list]");
  function render() {
    $("[data-seed-banner]").hidden = !seeded;
    const items = [...data.items].sort((a, b) => b.n - a.n);
    const count = s => data.items.filter(i => i.status === s).length;
    $("[data-stats]").innerHTML = `<span><b>${data.items.length}</b>capi</span><span><b>${count("new")}</b>nuovi</span><span><b>${count("out")}</b>esauriti</span>`;
    const shown = show === "all" ? items : items.filter(i => i.status === show);
    list.innerHTML = "";
    shown.forEach(it => {
      const li = document.createElement("li");
      li.className = "item" + (it.status === "out" ? " is-out" : "");
      li.tabIndex = 0; li.setAttribute("role", "button");
      li.setAttribute("aria-label", `Modifica ${it.name}`);
      li.innerHTML = `
        <img class="item__img" src="${esc(src(it.img))}" alt="" loading="lazy">
        <div>
          <div class="item__name"></div>
          <div class="item__meta"><span class="item__price">${euro(it.price)}</span>${it.sizes?.length ? `<span>${esc(it.sizes.join(" · "))}</span>` : ""}${it.status === "new" ? `<span class="tag tag--new">Nuovo</span>` : it.status === "out" ? `<span class="tag tag--out">Esaurito</span>` : ""}</div>
        </div>
        <span class="item__num">#${String(it.n).padStart(2, "0")}</span>`;
      $(".item__name", li).textContent = it.name;
      const open = () => openSheet(it);
      li.addEventListener("click", open);
      li.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      list.appendChild(li);
    });
    $("[data-empty]").hidden = shown.length > 0;
  }
  $$(".filter button").forEach(b => b.addEventListener("click", () => {
    show = b.dataset.show;
    $$(".filter button").forEach(x => x.setAttribute("aria-selected", x === b));
    render();
  }));

  /* ---------- sheet ---------- */
  const sheet = $("[data-sheet]"), form = $("[data-form]");
  const catsEl = $("[data-cats]"), sizesEl = $("[data-sizes]");
  catsEl.innerHTML = CATS.map(c => `<label><input type="radio" name="cat" value="${c.id}"><span>${c.label}</span></label>`).join("");

  function drawSizes(selected) {
    const all = [...new Set([...SIZES, ...selected])];
    sizesEl.innerHTML = all.map(s => `<label><input type="checkbox" name="size" value="${esc(s)}" ${selected.includes(s) ? "checked" : ""}><span>${esc(s)}</span></label>`).join("");
  }
  $("[data-size-add]").addEventListener("click", () => {
    const inp = $("[data-size-input]"); const v = inp.value.trim().toUpperCase();
    if (!v) return;
    const sel = $$("input[name=size]:checked", sizesEl).map(i => i.value);
    drawSizes([...sel, v]); inp.value = "";
  });

  function setPreview(url) {
    const img = $("[data-preview]");
    img.hidden = !url; if (url) img.src = url;
    $("[data-photo-empty]").hidden = !!url;
    $("[data-photo-change]").hidden = !url;
  }

  function openSheet(it) {
    editing = it || null; pendingFile = null;
    form.reset(); $("[data-form-err]").textContent = "";
    const n = it ? it.n : Math.max(0, ...data.items.map(i => i.n)) + 1;
    $("[data-sheet-title]").textContent = it ? "Modifica capo" : "Nuovo arrivo";
    $("[data-sheet-num]").textContent = "#" + String(n).padStart(2, "0");
    $("[data-delete]").hidden = !it;
    $("[data-save]").textContent = it ? "Salva modifiche" : "Pubblica";
    form.name.value = it?.name || "";
    form.variant.value = it?.variant || "";
    form.brand.value = it?.brand || "";
    form.price.value = it?.price != null ? (it.price % 1 ? it.price.toFixed(2) : String(it.price)).replace(".", ",") : "";
    (form.querySelector(`input[name=cat][value="${it?.cat || "maglie"}"]`) || {}).checked = true;
    form.querySelector(`input[name=status][value="${it?.status || "new"}"]`).checked = true;
    drawSizes(it?.sizes || []);
    setPreview(it ? src(it.img) : null);
    sheet.showModal();
    sheet.scrollTop = 0;
  }
  $("[data-new]").addEventListener("click", () => openSheet(null));
  $$("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

  $("[data-file]").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    pendingFile = f; setPreview(URL.createObjectURL(f));
  });

  /* phone photos are huge: shrink to 1400px JPEG and read the background tone */
  async function prepare(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
    const img = bmp || await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file); });
    const w0 = img.width, h0 = img.height, k = Math.min(1, 1400 / Math.max(w0, h0));
    const c = document.createElement("canvas"); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, c.width, c.height);
    const edge = ctx.getImageData(0, 0, c.width, 8).data;
    let sum = 0; for (let i = 0; i < edge.length; i += 4) sum += (edge[i] + edge[i + 1] + edge[i + 2]) / 3;
    const ground = sum / (edge.length / 4) < 90 ? "black" : "grey";
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", .85));
    return { blob, ground };
  }

  async function save(nextItems, msg) {
    const saved = await api("/api/catalog", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: nextItems, store: data.store }) });
    data = { items: saved.items, store: saved.store || {} }; seeded = false;
    render(); toast(msg);
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("[data-form-err]"), btn = $("[data-save]");
    err.textContent = "";
    const name = form.name.value.trim();
    if (!name) { err.textContent = "Scrivi il nome del capo."; form.name.focus(); return; }
    if (!editing && !pendingFile) { err.textContent = "Aggiungi una foto del capo."; return; }
    const rawPrice = form.price.value.trim().replace("€", "").replace(",", ".");
    if (rawPrice && isNaN(parseFloat(rawPrice))) { err.textContent = "Il prezzo deve essere un numero, es. 59,90."; form.price.focus(); return; }

    btn.disabled = true; btn.textContent = pendingFile ? "Carico la foto…" : "Salvo…";
    try {
      let img = editing?.img, ground = editing?.ground || "grey";
      if (pendingFile) {
        const p = await prepare(pendingFile);
        const up = await api(`/api/upload?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: p.blob });
        img = up.url; ground = p.ground;
      }
      btn.textContent = "Salvo…";
      const it = {
        id: editing?.id || uid(),
        n: editing?.n || Math.max(0, ...data.items.map(i => i.n)) + 1,
        name, variant: form.variant.value.trim(), brand: form.brand.value.trim(),
        cat: form.querySelector("input[name=cat]:checked")?.value || "look",
        price: rawPrice ? parseFloat(rawPrice) : null,
        sizes: $$("input[name=size]:checked", sizesEl).map(i => i.value),
        status: form.querySelector("input[name=status]:checked").value,
        ground, img, createdAt: editing?.createdAt || new Date().toISOString()
      };
      const next = editing ? data.items.map(i => i.id === editing.id ? it : i) : [...data.items, it];
      await save(next, editing ? "Modifiche salvate" : "Pubblicato sul sito");
      sheet.close();
    } catch (x) { err.textContent = x.message; }
    btn.disabled = false; btn.textContent = editing ? "Salva modifiche" : "Pubblica";
  });

  $("[data-delete]").addEventListener("click", async () => {
    if (!editing || !confirm(`Eliminare “${editing.name}” dal sito?`)) return;
    try { await save(data.items.filter(i => i.id !== editing.id), "Capo eliminato"); sheet.close(); }
    catch (x) { $("[data-form-err]").textContent = x.message; }
  });

  /* ---------- settings ---------- */
  const settings = $("[data-settings]"), sForm = $("[data-settings-form]");
  $("[data-open-settings]").addEventListener("click", () => {
    sForm.reset(); $("[data-set-err]").textContent = "";
    sForm.season.value = data.store.season || ""; sForm.hours.value = data.store.hours || "";
    settings.showModal();
  });
  sForm.addEventListener("submit", async e => {
    e.preventDefault();
    data.store = { season: sForm.season.value.trim(), hours: sForm.hours.value.trim() };
    try { await save(data.items, "Info negozio salvate"); settings.close(); }
    catch (x) { $("[data-set-err]").textContent = x.message; }
  });
  $("[data-change-pw]").addEventListener("click", async () => {
    const err = $("[data-set-err]"); err.textContent = "";
    try {
      await api("/api/session", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ current: sForm.current.value, password: sForm.next.value }) });
      sForm.current.value = sForm.next.value = ""; toast("Password cambiata");
    } catch (x) { err.textContent = x.message; }
  });
  $("[data-logout]").addEventListener("click", async () => {
    await fetch("/api/session", { method: "DELETE" }); settings.close(); gate("login");
  });

  /* ---------- toast ---------- */
  let tT;
  function toast(msg) {
    const t = $("[data-toast]"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(tT); tT = setTimeout(() => t.classList.remove("is-on"), 2400);
  }

  boot();
})();
