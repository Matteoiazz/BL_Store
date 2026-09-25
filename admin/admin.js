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
  let seeded = false, show = "all", editing = null, photos = [];

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
          <div class="item__meta"><span class="item__price">${euro(it.price)}</span>${it.imgs?.length > 1 ? `<span>${it.imgs.length} foto</span>` : ""}${it.sizes?.length ? `<span>${esc(it.sizes.join(" · "))}</span>` : ""}${it.status === "new" ? `<span class="tag tag--new">Nuovo</span>` : it.status === "out" ? `<span class="tag tag--out">Esaurito</span>` : ""}</div>
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

  /* photos of the garment: saved ones are {url}, new ones {file, preview}; the first is the cover */
  const MAX_PHOTOS = 8;
  const photosEl = $("[data-photos]"), fileInput = $("[data-file]");
  const photoList = it => (it?.imgs?.length ? it.imgs : it?.img ? [it.img] : []).map(url => ({ url }));
  function drawPhotos() {
    photosEl.innerHTML = photos.map((ph, i) => `
      <li class="ph${i === 0 ? " is-cover" : ""}">
        <img src="${esc(ph.preview || src(ph.url))}" alt="Foto ${i + 1}">
        ${i === 0 ? `<span class="ph__cover">Copertina</span>` : `<button type="button" class="ph__btn ph__star" data-cover="${i}" aria-label="Usa come copertina"><svg class="ico"><use href="#i-star"/></svg></button>`}
        <button type="button" class="ph__btn ph__del" data-del="${i}" aria-label="Togli questa foto"><svg class="ico"><use href="#i-close"/></svg></button>
      </li>`).join("") + (photos.length < MAX_PHOTOS ? `
      <li><button type="button" class="ph__add" data-add><svg class="ico ico--lg"><use href="#i-cam"/></svg><b>${photos.length ? "Aggiungi" : "Aggiungi foto"}</b><small>Scatta o scegli</small></button></li>` : "");
    $("[data-photo-count]").textContent = photos.length ? `${photos.length}/${MAX_PHOTOS}` : "";
  }
  photosEl.addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.hasAttribute("data-add")) return fileInput.click();
    if (t.dataset.cover) { const [ph] = photos.splice(+t.dataset.cover, 1); photos.unshift(ph); }
    if (t.dataset.del) photos.splice(+t.dataset.del, 1);
    drawPhotos();
  });

  function openSheet(it) {
    editing = it || null; photos = photoList(it);
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
    drawPhotos();
    sheet.showModal();
    sheet.scrollTop = 0;
  }
  $("[data-new]").addEventListener("click", () => openSheet(null));
  $$("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

  fileInput.addEventListener("change", e => {
    [...e.target.files].slice(0, MAX_PHOTOS - photos.length).forEach(file => photos.push({ file, preview: URL.createObjectURL(file) }));
    fileInput.value = "";
    drawPhotos();
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
    if (!photos.length) { err.textContent = "Aggiungi almeno una foto del capo."; return; }
    const rawPrice = form.price.value.trim().replace("€", "").replace(",", ".");
    if (rawPrice && isNaN(parseFloat(rawPrice))) { err.textContent = "Il prezzo deve essere un numero, es. 59,90."; form.price.focus(); return; }

    btn.disabled = true;
    try {
      let ground = editing?.ground || "grey";
      const fresh = photos.filter(ph => ph.file).length;
      let done = 0;
      for (const [i, ph] of photos.entries()) {
        if (!ph.file) continue;
        btn.textContent = `Carico le foto ${++done}/${fresh}…`;
        const p = await prepare(ph.file);
        const up = await api(`/api/upload?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: p.blob });
        Object.assign(ph, { url: up.url, file: null });
        if (i === 0) ground = p.ground; // the cover decides the card background
      }
      const imgs = photos.map(ph => ph.url);
      btn.textContent = "Salvo…";
      const it = {
        id: editing?.id || uid(),
        n: editing?.n || Math.max(0, ...data.items.map(i => i.n)) + 1,
        name, variant: form.variant.value.trim(), brand: form.brand.value.trim(),
        cat: form.querySelector("input[name=cat]:checked")?.value || "look",
        price: rawPrice ? parseFloat(rawPrice) : null,
        sizes: $$("input[name=size]:checked", sizesEl).map(i => i.value),
        status: form.querySelector("input[name=status]:checked").value,
        ground, imgs, img: imgs[0], createdAt: editing?.createdAt || new Date().toISOString()
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
