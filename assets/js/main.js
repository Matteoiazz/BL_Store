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
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = n => String(n).padStart(2, "0");
  const euro = p => p == null ? null : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: p % 1 ? 2 : 0 }).format(p);
  const wa = text => `https://wa.me/${S.phone.replace(/\D/g, "")}${text ? "?text=" + encodeURIComponent(text) : ""}`;

  /* ---------- store facts into the page ---------- */
  $$("[data-wa]").forEach(a => a.href = wa("Ciao BL Store! Vorrei qualche info."));
  $$("[data-ig]").forEach(a => a.href = S.instagram);
  $$("[data-tel]").forEach(a => a.href = "tel:" + S.phone);
  $$("[data-maps]").forEach(a => a.href = S.maps);
  $$("[data-wa-hours]").forEach(a => a.href = wa("Ciao BL Store! Che orari fate oggi?"));
  $$("[data-season]").forEach(el => el.textContent = S.season);
  $$("[data-phone-label]").forEach(el => el.textContent = S.phoneLabel);
  $$("[data-handle]").forEach(el => el.textContent = S.handle);
  $$("[data-city]").forEach(el => el.textContent = S.city);
  if (S.hours) $("[data-hours]").textContent = S.hours;
  $("[data-year]").textContent = new Date().getFullYear();

  /* ---------- scoreboard roller: digits snap one course, with overshoot ---------- */
  function roller(el, value) {
    const str = String(value);
    el.innerHTML = "";
    el.setAttribute("aria-label", str);
    [...str].forEach(() => {
      const d = document.createElement("span"); d.className = "d";
      const s = document.createElement("span"); s.className = "s";
      for (let k = 0; k < 20; k++) { const n = document.createElement("span"); n.textContent = k % 10; s.appendChild(n); }
      d.appendChild(s); el.appendChild(d);
    });
    el._value = str;
    return el;
  }
  function setRoll(el, value, { spin = false, instant = false, from = null } = {}) {
    const str = String(value);
    if (!el._value || el._value.length !== str.length) roller(el, str);
    $$(".s", el).forEach((s, i) => {
      const target = +str[i];
      if (instant || reduce) { s.style.transition = "none"; s.style.transform = `translateY(${-target}em)`; return; }
      if (spin || from != null) {
        const start = from != null ? +String(from).padStart(str.length, "0")[i] : target;
        s.style.transition = "none";
        s.style.transform = `translateY(${-start}em)`;
        s.getBoundingClientRect();
        s.style.transition = "";
        s.style.transitionDelay = `${i * 90}ms`;
        const end = spin || start >= target ? target + 10 : target;
        s.style.transform = `translateY(${-end}em)`;
      } else {
        s.style.transform = `translateY(${-target}em)`;
      }
    });
    el._value = str;
  }

  /* hero sleeves + home number */
  $$("[data-roll]").forEach(el => { roller(el, el.dataset.roll); setRoll(el, "0".repeat(el.dataset.roll.length), { instant: true }); });

  const home = $(".home");
  requestAnimationFrame(() => {
    home.classList.add("is-in");
    $$("[data-intro]").forEach((el, i) => setTimeout(() => setRoll(el, el.dataset.roll, { spin: true }), 500 + i * 180));
  });

  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    if (el.dataset.roll) setRoll(el, el.dataset.roll, { spin: true });
    if (el.hasAttribute("data-count")) setRoll(el, pad(el._target), { spin: true });
    io.unobserve(el);
  }), { threshold: .4 });
  $$("[data-inview]").forEach(el => io.observe(el));

  /* hero crest tilts with the pointer, like fabric under light */
  const tilt = $("[data-tilt]");
  if (!reduce && matchMedia("(pointer: fine)").matches) {
    let raf;
    home.addEventListener("pointermove", e => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = home.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        tilt.style.transform = `perspective(1200px) rotateY(${x * 9}deg) rotateX(${-y * 6}deg)`;
      });
    });
    home.addEventListener("pointerleave", () => tilt.style.transform = "");
    tilt.style.transition = "transform .6s cubic-bezier(.16,1,.3,1)";
  }

  /* sleeves drift against the scroll, like arms swinging past */
  const sleeves = $$(".sleeve");
  if (!reduce) addEventListener("scroll", () => {
    const y = Math.min(scrollY, innerHeight);
    sleeves.forEach((s, i) => s.style.transform = `translateY(${y * (i ? .28 : .18)}px)`);
  }, { passive: true });

  /* marquee: duplicate content so the loop is seamless */
  $$("[data-marquee]").forEach(t => { t.innerHTML += t.innerHTML; });

  /* top bar goes solid after the hero */
  const bar = $("[data-bar]");
  const onScroll = () => bar.classList.toggle("is-solid", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- roster ---------- */
  const CAT = await catalogReady;
  $$("[data-season]").forEach(el => el.textContent = S.season);
  if (S.hours) $("[data-hours]").textContent = S.hours;
  const grid = $("[data-grid]"), filters = $("[data-filters]"), empty = $("[data-empty]");
  const count = $("[data-count]");
  count._target = CAT.length;
  roller(count, pad(CAT.length)); setRoll(count, "00", { instant: true });
  io.observe(count);

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

  function card(p, i) {
    const li = document.createElement("li");
    li.className = "player" + (p.status === "out" ? " is-out" : "");
    li.style.setProperty("--i", i);
    const price = euro(p.price);
    const tag = p.status === "new" ? `<span class="player__tag">Nuovo arrivo</span>` : p.status === "out" ? `<span class="player__tag player__tag--out">Esaurito</span>` : "";
    li.innerHTML = `
      <button class="player__btn" type="button" aria-label="#${pad(p.n)} ${esc(p.name)}, ${esc(p.variant)}. ${price || "Prezzo in store"}">
        <div class="player__img" data-ground="${esc(p.ground)}">
          <img src="${esc(p.img)}" alt="${esc(p.name)}, ${esc(p.variant)}" loading="${i < 3 ? "eager" : "lazy"}" width="640" height="640">
          ${tag}
        </div>
        <div class="player__bar">
          <span class="num player__num" aria-hidden="true"></span>
          <span class="player__name">${esc(p.name)}</span>
          <span class="player__sub"><span class="player__variant">${esc(p.variant)}</span><span class="player__price${price ? "" : " is-ask"}">${price || "Prezzo in store"}</span></span>
        </div>
      </button>`;
    const num = $(".player__num", li);
    roller(num, pad(p.n)); setRoll(num, pad(p.n), { instant: true });
    const btn = $(".player__btn", li);
    btn.addEventListener("mouseenter", () => setRoll(num, pad(p.n), { spin: true }));
    num._spin = () => setRoll(num, pad(p.n), { spin: true });
    cardIO.observe(num);
    btn.addEventListener("click", () => openLocker(p));
    return li;
  }

  /* every number flips once as its player enters the screen (the signature, also on touch) */
  const cardIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target._spin(); cardIO.unobserve(e.target); }
  }), { threshold: .6 });

  /* no row ends on an empty cell: the last player stretches to close it */
  function closeRow() {
    const items = $$(".player", grid);
    items.forEach(li => { li.classList.remove("is-wide", "is-solo"); li.style.gridColumn = ""; });
    const last = items[items.length - 1];
    if (!last || items.length < 2) return;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    const hasFeature = items[0].classList.contains("is-feature");
    const featureCells = hasFeature ? (cols <= 2 ? cols : 4) : 1;
    const before = featureCells + (items.length - 2);   // cells filled before the last player
    const at = before % cols;
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
    closeRow();
  }
  function select(id) {
    current = id;
    $$(".chip", filters).forEach(b => b.setAttribute("aria-selected", b.dataset.cat === id));
    const from = count._value;
    setRoll(count, pad(id === "all" ? CAT.length : CAT.filter(p => p.cat === id).length), { from });
    render();
  }
  render();

  /* ---------- locker ---------- */
  const locker = $("[data-locker]");
  const L = k => $(`[data-l-${k}]`, locker);
  let lockerIdx = 0;
  roller(L("num"), "00");

  function fillLocker(p) {
    const price = euro(p.price);
    L("img").src = p.img; L("img").alt = `${p.name}, ${p.variant}`;
    L("brand").textContent = p.brand || "";
    L("brand").hidden = !p.brand;
    L("name").textContent = p.name;
    L("variant").textContent = p.variant;
    L("price").textContent = price || "Prezzo in store · chiedi su WhatsApp";
    L("price").classList.toggle("is-ask", !price);
    L("sizes").innerHTML = p.sizes && p.sizes.length
      ? p.sizes.map(s => `<li>${esc(s)}</li>`).join("")
      : `<li class="is-ask">Chiedi disponibilità</li>`;
    L("wa").href = wa(`Ciao BL Store! Mi interessa il #${pad(p.n)} ${p.name} (${p.variant}). È disponibile? Che taglie avete?`);
  }
  function openLocker(p) {
    const prev = L("num")._value;
    lockerIdx = visible.indexOf(p);
    fillLocker(p);
    if (!locker.open) locker.showModal();
    setRoll(L("num"), pad(p.n), { from: prev });
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
