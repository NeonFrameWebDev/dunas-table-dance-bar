/* Dunas Table Dance and Bar - main.js
   La Sala Oscura: cinematic film-noir single-page scroll.

   Handles: branded loader, 18+ age-gate (focus-trapped dialog),
   sticky nav scroll state + hamburger drawer + active-link sync,
   the SIGNATURE scroll-following crimson spotlight (single rAF lerp loop),
   IntersectionObserver fade/rise reveals + letterbox-wipe film-stills,
   Galeria filmstrip (desktop drag + arrows, mobile swipe-snap + dot indicator),
   lazy/facade Google Maps embed, live open-now badge, footer year.

   prefers-reduced-motion is honored throughout: the spotlight is rendered
   static, Ken Burns and parallax are disabled, reveals collapse to a plain
   fade, and the rAF loop never starts.
*/
"use strict";

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE_POINTER = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* Storage keys (Dunas-namespaced so they never collide with other builds) */
const K_AGE = "dunasAgePassed";
const K_SEEN = "dunasIntroSeen";

/* ----- Branded loader (first visit per session) ------------------------- */
(function initLoader() {
  const loader = $("#loader");
  if (!loader) return;

  const finish = () => {
    loader.classList.add("is-hidden");
    setTimeout(() => {
      loader.style.display = "none";
      document.body.classList.remove("is-loading");
    }, 600);
  };

  // Return visit this session, or reduced motion: snap the intro away fast.
  const seen = sessionStorage.getItem(K_SEEN) === "1";
  const hold = (seen || REDUCED) ? 250 : 1700;

  sessionStorage.setItem(K_SEEN, "1");

  // Fire the reveal classes (CSS handles the staged fade-up / hairline draw).
  requestAnimationFrame(() => loader.classList.add("is-playing"));

  // Safety: also exit when window load fires, but never before the cinematic hold.
  let done = false;
  const exit = () => { if (done) return; done = true; finish(); };
  setTimeout(exit, hold);
  window.addEventListener("load", () => setTimeout(exit, Math.min(hold, 400)));
})();

/* ----- 18+ Age gate (focus-trapped dialog) ------------------------------ */
(function initAgeGate() {
  const gate = $("#age-gate");
  if (!gate) return;

  const fireCleared = () =>
    document.dispatchEvent(new CustomEvent("dunas:gate-cleared"));

  const passed = localStorage.getItem(K_AGE) === "1";
  if (passed) {
    gate.remove();
    document.body.classList.remove("gate-open");
    fireCleared();
    return;
  }

  document.body.classList.add("gate-open");

  const enterBtn = $("#age-enter");
  const exitBtn = $("#age-exit");
  const focusables = [enterBtn, exitBtn].filter(Boolean);

  // Focus the primary action once the loader has cleared.
  const focusEnter = () => { if (enterBtn) enterBtn.focus(); };
  setTimeout(focusEnter, REDUCED ? 300 : 1800);

  // Trap focus inside the dialog while it is open.
  gate.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  if (enterBtn) {
    enterBtn.addEventListener("click", () => {
      localStorage.setItem(K_AGE, "1");
      gate.classList.add("is-closing");
      // Kick the hero entrance as the gate begins to dissolve, so the lights
      // come up just as the velvet rope drops.
      fireCleared();
      setTimeout(() => {
        gate.remove();
        document.body.classList.remove("gate-open");
      }, 520);
    });
  }
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      window.location.href = "https://www.google.com";
    });
  }
})();

/* ----- Hero entrance ("the lights come up", once) ----------------------- */
/* Adds .is-entering to the hero so the CSS choreography plays a single time:
   lights warm up, "DunaS" rises, "Show Girls" writes on in neon, eyebrow +
   tagline + CTAs stagger up, the ember ignites, the scroll cue fades in. The
   default (settled) hero look needs no JS, so this only ever adds the IN
   animation. Disabled under reduced motion. Triggered the moment the age gate
   clears (or, with no gate, on first paint). Plays at most once per page. */
(function initHeroEntrance() {
  const hero = document.querySelector(".hero");
  if (!hero || REDUCED) return;

  let played = false;
  const play = () => {
    if (played) return;
    played = true;
    hero.classList.add("is-entering");
    // The longest entrance delay+duration is ~1.8s + 0.9s. Drop the class once
    // it has settled so it never re-triggers; the ambient loops (defined
    // outside .is-entering) keep running regardless.
    setTimeout(() => hero.classList.remove("is-entering"), 3200);
  };

  // Primary trigger: the age gate signalling it has cleared.
  document.addEventListener("dunas:gate-cleared", play, { once: true });

  // Fallback: if the gate event never arrives (e.g. gate markup absent), start
  // on next frame so the hero still animates in on a fresh load.
  if (!document.getElementById("age-gate")) {
    requestAnimationFrame(play);
  } else {
    // Safety net in case the event was missed.
    setTimeout(play, 6000);
  }
})();

/* ----- Sticky nav: scrolled state + hamburger drawer -------------------- */
(function initNav() {
  const nav = $("#nav");
  const ham = $(".nav-toggle");
  const drawer = $("#nav-drawer");

  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  if (ham && drawer) {
    const setOpen = (open) => {
      ham.setAttribute("aria-expanded", String(open));
      drawer.classList.toggle("is-open", open);
      document.body.classList.toggle("drawer-open", open);
    };
    ham.addEventListener("click", () => {
      setOpen(ham.getAttribute("aria-expanded") !== "true");
    });
    $$("a", drawer).forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) setOpen(false);
    });
  }
})();

/* ----- Active nav link sync (which section am I in) --------------------- */
(function initNavActive() {
  const sections = $$("main section[id]");
  const links = $$(".nav-links a[href^='#'], .drawer-links a[href^='#']");
  if (!sections.length || !links.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });

  sections.forEach((s) => io.observe(s));
})();

/* ----- SIGNATURE: scroll-following crimson spotlight -------------------- */
/* A fixed radial-gradient layer whose --spot-y eases toward the vertical
   center of whichever section is currently in view, via a single rAF lerp.
   Cheap: rects are cached and only recomputed on resize / when sections
   enter or leave the viewport. Disabled entirely under reduced motion. */
(function initSpotlight() {
  const layer = $("#spotlight");
  if (!layer) return;

  if (REDUCED) {
    // Static, still beautiful: park the glow a touch above center.
    layer.style.setProperty("--spot-y", "38%");
    return;
  }

  const sections = $$("main section[id], #hero");
  if (!sections.length) {
    layer.style.setProperty("--spot-y", "40%");
    return;
  }

  let target = 40; // percent of viewport height
  let current = 40;
  const vh = () => window.innerHeight || document.documentElement.clientHeight;

  // Recompute the target based on the section nearest viewport center.
  function recomputeTarget() {
    const mid = vh() / 2;
    let best = null;
    let bestDist = Infinity;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      // Only consider sections that intersect the viewport.
      if (r.bottom < 0 || r.top > vh()) continue;
      const center = r.top + r.height / 2;
      const d = Math.abs(center - mid);
      if (d < bestDist) { bestDist = d; best = center; }
    }
    if (best === null) return;
    // Clamp so the bloom stays gracefully on screen.
    target = Math.max(18, Math.min(82, (best / vh()) * 100));
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { recomputeTarget(); scheduled = false; });
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  recomputeTarget();
  current = target;

  let raf = null;
  function loop() {
    current += (target - current) * 0.06; // slow cinematic ease
    layer.style.setProperty("--spot-y", current.toFixed(2) + "%");
    if (Math.abs(target - current) > 0.05) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = null;
    }
  }
  // Keep the loop alive while scrolling; restart on demand.
  const kick = () => { if (raf === null) raf = requestAnimationFrame(loop); };
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick, { passive: true });
  kick();
})();

/* ----- Hero parallax (desktop, motion-allowed only) --------------------- */
(function initHeroParallax() {
  if (REDUCED || !FINE_POINTER) return;
  const media = $(".hero-media");
  const inner = $(".hero-inner");
  if (!media) return;

  let raf = null;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        media.style.transform = "translate3d(0," + (y * 0.18).toFixed(1) + "px,0)";
        if (inner) inner.style.transform = "translate3d(0," + (y * 0.06).toFixed(1) + "px,0)";
      }
      raf = null;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
})();

/* ----- Scroll reveals + letterbox-wipe film-stills ---------------------- */
(function initReveal() {
  const items = $$(".reveal, .filmstill");
  if (!items.length) return;

  if (REDUCED) {
    // Plain fade is handled in CSS; just mark everything revealed at once.
    items.forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  // Stagger children inside any [data-stagger] container.
  $$("[data-stagger]").forEach((parent) => {
    $$(".reveal, .filmstill", parent).forEach((child, i) => {
      child.style.setProperty("--stagger", (i * 80) + "ms");
    });
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-revealed");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });

  items.forEach((el) => io.observe(el));
})();

/* ----- Ember hairline dividers draw in --------------------------------- */
(function initDividers() {
  const lines = $$(".ember-line");
  if (!lines.length) return;
  if (REDUCED) { lines.forEach((l) => l.classList.add("is-revealed")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-revealed"); io.unobserve(e.target); }
    });
  }, { threshold: 0.6 });
  lines.forEach((l) => io.observe(l));
})();

/* ----- Galeria filmstrip: drag, arrows, swipe-snap, dots ---------------- */
(function initFilmstrip() {
  const strip = $("#filmstrip");
  if (!strip) return;
  const track = $(".filmstrip-track", strip);
  const cells = $$(".film-cell", strip);
  const prevBtn = $(".filmstrip-prev", strip);
  const nextBtn = $(".filmstrip-next", strip);
  const dotsWrap = $(".filmstrip-dots", strip);
  if (!track || !cells.length) return;

  // Build dot indicators (used mainly on mobile snap).
  const dots = [];
  if (dotsWrap) {
    cells.forEach((_, i) => {
      const d = document.createElement("button");
      d.className = "fs-dot";
      d.type = "button";
      d.setAttribute("aria-label", "Foto " + (i + 1) + " / Photo " + (i + 1));
      d.addEventListener("click", () => {
        cells[i].scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", inline: "center", block: "nearest" });
      });
      dotsWrap.appendChild(d);
      dots.push(d);
    });
  }

  const updateDots = () => {
    if (!dots.length) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let active = 0, best = Infinity;
    cells.forEach((c, i) => {
      const cc = c.offsetLeft + c.clientWidth / 2;
      const d = Math.abs(cc - center);
      if (d < best) { best = d; active = i; }
    });
    dots.forEach((d, i) => d.classList.toggle("is-active", i === active));
  };

  const step = () => Math.max(track.clientWidth * 0.7, cells[0].clientWidth + 24);
  if (prevBtn) prevBtn.addEventListener("click", () =>
    track.scrollBy({ left: -step(), behavior: REDUCED ? "auto" : "smooth" }));
  if (nextBtn) nextBtn.addEventListener("click", () =>
    track.scrollBy({ left: step(), behavior: REDUCED ? "auto" : "smooth" }));

  let ticking = false;
  track.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateDots(); ticking = false; });
  }, { passive: true });
  updateDots();

  // Pointer drag-to-scroll on fine pointers (the editing-table feel).
  if (FINE_POINTER) {
    let down = false, startX = 0, startScroll = 0, moved = false;
    track.addEventListener("pointerdown", (e) => {
      down = true; moved = false;
      startX = e.clientX; startScroll = track.scrollLeft;
      track.classList.add("is-dragging");
    });
    track.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startScroll - dx;
    });
    const end = () => { down = false; track.classList.remove("is-dragging"); };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointerleave", end);
    // Prevent the drag from also firing as a click on a cell.
    track.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  }

  // Arrow keys when the strip has focus.
  strip.setAttribute("tabindex", "0");
  strip.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); track.scrollBy({ left: step(), behavior: REDUCED ? "auto" : "smooth" }); }
    if (e.key === "ArrowLeft") { e.preventDefault(); track.scrollBy({ left: -step(), behavior: REDUCED ? "auto" : "smooth" }); }
  });
})();

/* ----- Google Maps facade (lazy iframe on click or scroll-into-view) ---- */
(function initMapFacade() {
  const facade = $("#map-facade");
  if (!facade) return;

  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    const iframe = document.createElement("iframe");
    iframe.src = facade.dataset.src;
    iframe.title = facade.dataset.title || "Mapa / Map";
    iframe.loading = "lazy";
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.style.border = "0";
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    iframe.allowFullscreen = true;
    facade.innerHTML = "";
    facade.appendChild(iframe);
    facade.classList.add("is-loaded");
  };

  facade.addEventListener("click", load);
  facade.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); load(); }
  });

  // Also auto-load when the visitor scrolls near it (keeps it off the LCP path).
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { load(); io.disconnect(); } });
  }, { rootMargin: "200px" });
  io.observe(facade);
})();

/* ----- Live "open now" badge (computed from local time) ----------------- */
(function initOpenNow() {
  const badges = $$(".open-now");
  if (!badges.length) return;

  // Hours: Wed(3) & Sun(0) 19:00-03:00; Thu(4)-Sat(6) 18:00-03:00; Mon/Tue closed.
  // A night that opens on day D runs until 03:00 the next morning, so the
  // early-morning hours (before 03:00) belong to the PREVIOUS day's session.
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  const openHourFor = (d) => {
    if (d === 3 || d === 0) return 19; // Wed, Sun
    if (d === 4 || d === 5 || d === 6) return 18; // Thu, Fri, Sat
    return null; // Mon(1), Tue(2) closed
  };

  let isOpen = false;
  // Same-day evening session.
  const todayOpen = openHourFor(day);
  if (todayOpen !== null && hour >= todayOpen) isOpen = true;
  // Spillover from the previous day's session (00:00-02:59).
  if (hour < 3) {
    const prev = (day + 6) % 7;
    if (openHourFor(prev) !== null) isOpen = true;
  }

  badges.forEach((b) => {
    b.classList.toggle("is-open", isOpen);
    b.classList.toggle("is-closed", !isOpen);
    const label = b.querySelector(".open-now-label");
    if (label) {
      // Both languages live in data-* so the i18n pass keeps swapping them.
      label.dataset.es = isOpen ? "Abierto ahora" : "Cerrado ahora";
      label.dataset.en = isOpen ? "Open now" : "Closed now";
      const lang = document.documentElement.lang === "en" ? "en" : "es";
      label.textContent = label.dataset[lang];
    }
  });
})();

/* ----- Footer auto-year ------------------------------------------------- */
(function setYear() {
  $$(".js-year").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
