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
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;

  /* ---------- rolling numbers: every digit is a strip that snaps with a small overshoot ---------- */
  function roll(el, value, { spin = false, from = null } = {}) {
    const str = String(value);
    if (el._value?.length !== str.length) {
      el.innerHTML = "";
      [...str].forEach(() => {
        const d = document.createElement("span"); d.className = "d";
        const s = document.createElement("span"); s.className = "s";
        for (let k = 0; k < 20; k++) { const n = document.createElement("span"); n.textContent = k % 10; s.appendChild(n); }
        d.appendChild(s); el.appendChild(d);
      });
      from = from ?? str; spin = true;
    }
    $$(".s", el).forEach((s, i) => {
      const target = +str[i];
      if (reduce) { s.style.transition = "none"; s.style.transform = `translateY(${-target}em)`; return; }
      const start = from != null ? +String(from).padStart(str.length, "0")[i] || 0 : target;
      s.style.transition = "none";
      s.style.transform = `translateY(${-start}em)`;
      s.getBoundingClientRect();
      s.style.transition = "";
      s.style.transitionDelay = `${i * 80}ms`;
      s.style.transform = `translateY(${-(spin || start >= target ? target + 10 : target)}em)`;
    });
    el._value = str;
  }

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

  /* ---------- black box ---------- */
  const box = $("[data-box]");
  requestAnimationFrame(() => box.classList.add("is-in"));
  setTimeout(() => box.classList.add("is-ready"), 2000);

  // the display on the floor: the lights flicker and, in the dark, the garment changes
  const DISPLAY = [
    { n: 2, name: "Hoodie Blessed 17", img: "assets/img/cut/p02.png", w: 574, h: 385, glints: [[61, 44], [79, 37], [70, 66], [57, 72], [24, 27], [40, 24]] },
    { n: 6, name: "Longsleeve Rise Again", img: "assets/img/cut/p06.png", w: 514, h: 421, glints: [[22, 7], [34, 5], [66, 5], [78, 8]] },
    { n: 7, name: "Look Yellow Print", img: "assets/img/cut/p07.png", w: 395, h: 601, glints: [] }
  ];
  const disp = { a: $("[data-display]"), frame: $("[data-display-frame]"), img: $("[data-display-img]"), mirror: $("[data-display-mirror]"),
    glints: $("[data-glints]"), num: $("[data-display-num]"), name: $("[data-display-name]"), label: $(".display") };
  DISPLAY.forEach(d => { const i = new Image(); i.src = d.img; }); // preload
  let dIdx = 0, dPaused = false;
  function showDisplay(d, prevN) {
    disp.img.src = disp.mirror.src = d.img;
    disp.img.width = disp.mirror.width = d.w; disp.img.height = disp.mirror.height = d.h;
    disp.glints.innerHTML = d.glints.map(([x, y], i) => `<span class="glint" style="--x:${x}%;--y:${y}%;--d:${(i * .7).toFixed(1)}s"></span>`).join("");
    disp.name.textContent = d.name;
    disp.a.setAttribute("aria-label", `${d.name}: apri la scheda`);
    roll(disp.num, pad(d.n), { from: prevN });
  }
  showDisplay(DISPLAY[0]);
  function nextDisplay() {
    if (dPaused || document.hidden || !lightsOn()) return;
    const prev = DISPLAY[dIdx];
    dIdx = (dIdx + 1) % DISPLAY.length;
    box.classList.add("is-swap");
    [disp.frame, disp.label].forEach(el => el.classList.add("is-dark"));
    setTimeout(() => showDisplay(DISPLAY[dIdx], pad(prev.n)), 220);
    setTimeout(() => [disp.frame, disp.label].forEach(el => el.classList.remove("is-dark")), 300);
    setTimeout(() => box.classList.remove("is-swap"), 520);
  }
  if (!reduce) setInterval(nextDisplay, 5200);
  disp.a.addEventListener("pointerenter", () => dPaused = true);
  disp.a.addEventListener("pointerleave", () => dPaused = false);

  // the tubes are real switches
  const tubes = $$("[data-tube]");
  const lightsOn = () => tubes.some(t => !t.classList.contains("is-off"));
  tubes.forEach(t => t.addEventListener("click", () => {
    t.classList.toggle("is-off");
    box.classList.toggle("is-dim", !lightsOn());
  }));

  // rhinestones left behind by the pointer
  if (finePointer && !reduce) {
    let last = 0, live = 0;
    box.addEventListener("pointermove", e => {
      const now = performance.now();
      if (now - last < 45 || live > 26 || !lightsOn()) return;
      last = now; live++;
      const r = box.getBoundingClientRect();
      const s = document.createElement("span");
      s.className = "spark";
      s.style.left = `${e.clientX - r.left + (Math.random() * 16 - 8)}px`;
      s.style.top = `${e.clientY - r.top + (Math.random() * 16 - 8)}px`;
      s.style.setProperty("--s", `${6 + Math.random() * 10}px`);
      s.addEventListener("animationend", () => { s.remove(); live--; });
      box.appendChild(s);
    });
  }

  /* ticker: duplicate content so the loop is seamless */
  $$("[data-marquee]").forEach(t => { t.innerHTML += t.innerHTML; });

  /* top bar goes solid after the hero */
  const bar = $("[data-bar]");
  const onScroll = () => bar.classList.toggle("is-solid", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* footer neon sign strikes on when reached */
  const neon = $("[data-neon]");
  new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { neon.classList.add("is-on"); o.disconnect(); } }), { threshold: .5 }).observe(neon);

  /* ---------- capi ---------- */
  const CAT = await catalogReady;
  facts();
  const grid = $("[data-grid]"), filters = $("[data-filters]"), empty = $("[data-empty]"), count = $("[data-count]");
  let current = "all", visible = CAT;

  disp.a.addEventListener("click", e => {
    const d = DISPLAY[dIdx];
    const it = CAT.find(p => p.name === d.name);
    if (it) { e.preventDefault(); visible = CAT; openLocker(it); }
  });

  CATS.forEach(c => {
    const n = c.id === "all" ? CAT.length : CAT.filter(p => p.cat === c.id).length;
    if (!n) return;
    const b = document.createElement("button");
    b.className = "chip"; b.type = "button"; b.setAttribute("role", "tab");
    b.dataset.cat = c.id; b.setAttribute("aria-selected", c.id === current);
    b.innerHTML = `${esc(c.label)}<sup>${n}</sup>`;
    b.addEventListener("click", () => select(c.id));
    filters.appendChild(b);
  });

  // numbers roll and the light passes over each garment once, as it enters the screen
  const inView = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const li = e.target;
    if (touch) li.classList.add("is-lit");
    li._roll?.();
    inView.unobserve(li);
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
          <img src="${esc(p.img)}" alt="${esc(p.name)}, ${esc(p.variant)}" loading="${i < 5 ? "eager" : "lazy"}" width="640" height="640">
          ${tag}
          <span class="swing" aria-hidden="true"><b class="${price ? "" : "is-ask"}">${price || "In store"}</b></span>
        </div>
        <div class="card__info">
          <span class="card__name"><span class="card__no" aria-hidden="true">N°<span class="num"></span></span>${esc(p.name)}</span>
          <span class="card__variant">${esc(p.variant)}</span>
        </div>
      </button>`;
    const num = $(".num", li);
    roll(num, pad(p.n));
    li._roll = () => roll(num, pad(p.n), { spin: true });
    const btn = $(".card__btn", li);
    btn.addEventListener("mouseenter", li._roll);
    btn.addEventListener("click", () => openLocker(p));
    inView.observe(li);
    return li;
  }

  /* no row ends on an empty cell: the last card stretches to close it */
  function closeRow() {
    const items = $$(".card", grid);
    items.forEach(li => { li.classList.remove("is-wide", "is-solo"); li.style.gridColumn = ""; });
    const last = items[items.length - 1];
    if (!last || items.length < 2) return;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    const at = (items.length - 1) % cols;
    const span = cols - at;
    last.style.gridColumn = `span ${span}`;
    if (span === cols && span > 1) last.classList.add("is-solo");
    else if (span > 1) last.classList.add("is-wide");
  }
  let rT; addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(closeRow, 120); });

  function render() {
    visible = current === "all" ? CAT : CAT.filter(p => p.cat === current);
    grid.innerHTML = "";
    visible.forEach((p, i) => grid.appendChild(card(p, i)));
    empty.hidden = visible.length > 0;
    closeRow();
  }
  function select(id) {
    current = id;
    $$(".chip", filters).forEach(b => b.setAttribute("aria-selected", b.dataset.cat === id));
    const prev = count._value;
    render();
    roll(count, pad(visible.length), { from: prev });
  }
  render();
  roll(count, pad(CAT.length));
  new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { roll(count, pad(CAT.length), { from: "00" }); o.disconnect(); } }), { threshold: 1 }).observe(count);

  /* ---------- scheda capo ---------- */
  const locker = $("[data-locker]");
  const L = k => $(`[data-l-${k}]`, locker);
  let lockerIdx = 0;

  function fillLocker(p) {
    const price = euro(p.price);
    L("img").src = p.img; L("img").alt = `${p.name}, ${p.variant}`;
    L("img").parentElement.style.background = p.ground === "black" ? "#0c0c0d" : p.ground === "wood" ? "#b98a5e" : "";
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
    const prev = L("num")._value;
    lockerIdx = Math.max(0, visible.indexOf(p));
    fillLocker(p);
    if (!locker.open) locker.showModal();
    roll(L("num"), pad(p.n), { from: prev || "00" });
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
