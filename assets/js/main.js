document.documentElement.classList.add("js");
(async () => {
  /* catalogo dal pannello di gestione; se non risponde, quello di partenza in catalog.js */
  const catalogReady = (async () => {
    try {
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 3000);
      const r = await fetch("/api/catalog", { signal: ctl.signal });
      const d = r.ok ? await r.json() : null;
      if (d && Array.isArray(d.items)) {
        window.BL_CATALOG = d.items;
        if (d.store?.hours) window.BL_STORE.hours = d.store.hours;
        if (d.store?.season) window.BL_STORE.season = d.store.season;
      }
    } catch {}
    return [...window.BL_CATALOG].sort((a, b) => b.n - a.n); // ultimi arrivi per primi
  })();

  const S = window.BL_STORE, CATS = window.BL_CATEGORIES;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const euro = p => p == null ? null : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: p % 1 ? 2 : 0 }).format(p);
  const wa = text => `https://wa.me/${S.phone.replace(/\D/g, "")}${text ? "?text=" + encodeURIComponent(text) : ""}`;

  /* ---------- store facts into the page ---------- */
  const facts = () => {
    $$("[data-season]").forEach(el => el.textContent = S.season);
    if (S.hours) $("[data-hours]").textContent = S.hours;
  };
  $$("[data-wa]").forEach(a => a.href = wa("Ciao BL Store! Vorrei qualche info."));
  $$("[data-ig]").forEach(a => a.href = S.instagram);
  $$("[data-tel]").forEach(a => a.href = "tel:" + S.phone);
  $$("[data-maps]").forEach(a => a.href = S.maps);
  $$("[data-wa-hours]").forEach(a => a.href = wa("Ciao BL Store! Che orari fate oggi?"));
  $$("[data-phone-label]").forEach(el => el.textContent = S.phoneLabel);
  $$("[data-handle]").forEach(el => el.textContent = S.handle);
  $$("[data-city]").forEach(el => el.textContent = S.city);
  $("[data-year]").textContent = new Date().getFullYear();
  facts();

  /* ---------- black box: the tubes switch on ---------- */
  requestAnimationFrame(() => $("[data-box]").classList.add("is-in"));

  /* ticker: duplicate content so the loop is seamless */
  $$("[data-marquee]").forEach(t => { t.innerHTML += t.innerHTML; });

  /* top bar goes solid after the hero */
  const bar = $("[data-bar]");
  const onScroll = () => bar.classList.toggle("is-solid", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- capi ---------- */
  const CAT = await catalogReady;
  facts();
  const grid = $("[data-grid]"), filters = $("[data-filters]"), empty = $("[data-empty]"), count = $("[data-count]");
  let current = "all", visible = CAT;

  CATS.forEach(c => {
    const n = c.id === "all" ? CAT.length : CAT.filter(p => p.cat === c.id).length;
    if (!n) return;
    const b = document.createElement("button");
    b.className = "chip"; b.type = "button"; b.setAttribute("role", "tab");
    b.dataset.cat = c.id; b.setAttribute("aria-selected", c.id === current);
    b.innerHTML = `${c.label}<sup>${n}</sup>`;
    b.addEventListener("click", () => select(c.id));
    filters.appendChild(b);
  });

  /* on touch screens the light passes over each garment once, as it enters the screen */
  const lightIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("is-lit"); lightIO.unobserve(e.target); }
  }), { threshold: .55 });
  const touch = matchMedia("(hover: none)").matches;

  function card(p, i) {
    const li = document.createElement("li");
    li.className = "card" + (p.status === "out" ? " is-out" : "");
    li.style.setProperty("--i", i);
    const price = euro(p.price);
    const tag = p.status === "new" ? `<span class="card__tag">Nuovo arrivo</span>` : p.status === "out" ? `<span class="card__tag card__tag--out">Esaurito</span>` : "";
    li.innerHTML = `
      <button class="card__btn" type="button" aria-label="${esc(p.name)}, ${esc(p.variant)}. ${price || "Prezzo in store"}">
        <div class="card__img" data-ground="${esc(p.ground)}">
          <img src="${esc(p.img)}" alt="${esc(p.name)}, ${esc(p.variant)}" loading="${i < 4 ? "eager" : "lazy"}" width="640" height="640">
          ${tag}
        </div>
        <div class="card__info">
          <span class="card__name"><span class="card__no">N°${pad(p.n)}</span>${esc(p.name)}</span>
          <span class="card__price${price ? "" : " is-ask"}">${price || "Prezzo in store"}</span>
          <span class="card__variant">${esc(p.variant)}</span>
        </div>
      </button>`;
    $(".card__btn", li).addEventListener("click", () => openLocker(p));
    if (touch) lightIO.observe(li);
    return li;
  }

  /* no row ends on an empty cell: the last card stretches to close it */
  function closeRow() {
    const items = $$(".card", grid);
    items.forEach(li => { li.classList.remove("is-wide", "is-solo"); li.style.gridColumn = ""; });
    const last = items[items.length - 1];
    if (!last || items.length < 2) return;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    const hasFeature = items[0].classList.contains("is-feature");
    const featureCells = hasFeature ? (cols <= 2 ? cols : 4) : 1;
    const at = (featureCells + (items.length - 2)) % cols;
    const span = cols - at;
    last.style.gridColumn = `span ${span}`;
    if (span === cols && span > 1) last.classList.add("is-solo");
    else if (span > 1) last.classList.add("is-wide");
  }
  let rT; addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(closeRow, 120); });

  function render() {
    visible = current === "all" ? CAT : CAT.filter(p => p.cat === current);
    grid.innerHTML = "";
    visible.forEach((p, i) => { const li = card(p, i); if (i === 0 && visible.length > 2) li.classList.add("is-feature"); grid.appendChild(li); });
    empty.hidden = visible.length > 0;
    count.textContent = visible.length;
    closeRow();
  }
  function select(id) {
    current = id;
    $$(".chip", filters).forEach(b => b.setAttribute("aria-selected", b.dataset.cat === id));
    render();
  }
  render();

  /* ---------- scheda capo ---------- */
  const locker = $("[data-locker]");
  const L = k => $(`[data-l-${k}]`, locker);
  let lockerIdx = 0;

  function fillLocker(p) {
    const price = euro(p.price);
    L("img").src = p.img; L("img").alt = `${p.name}, ${p.variant}`;
    L("img").parentElement.style.background = p.ground === "black" ? "#0c0c0d" : p.ground === "wood" ? "#b98a5e" : "";
    L("num").textContent = `N°${pad(p.n)}`;
    L("brand").textContent = p.brand || "";
    L("brand").hidden = !p.brand;
    L("name").textContent = p.name;
    L("variant").textContent = p.variant;
    L("price").textContent = price || "Prezzo in store · chiedi su WhatsApp";
    L("price").classList.toggle("is-ask", !price);
    L("sizes").innerHTML = p.sizes && p.sizes.length
      ? p.sizes.map(s => `<li>${esc(s)}</li>`).join("")
      : `<li class="is-ask">Chiedi disponibilità</li>`;
    L("wa").href = wa(`Ciao BL Store! Mi interessa il capo N°${pad(p.n)} ${p.name}${p.variant ? ` (${p.variant})` : ""}. È disponibile? Che taglie avete?`);
  }
  function openLocker(p) {
    lockerIdx = visible.indexOf(p);
    fillLocker(p);
    if (!locker.open) locker.showModal();
  }
  const step = d => openLocker(visible[(lockerIdx + d + visible.length) % visible.length]);
  $("[data-close]", locker).addEventListener("click", () => locker.close());
  $("[data-prev]", locker).addEventListener("click", () => step(-1));
  $("[data-next]", locker).addEventListener("click", () => step(1));
  locker.addEventListener("click", e => { if (e.target === locker) locker.close(); });
  locker.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });
})();
