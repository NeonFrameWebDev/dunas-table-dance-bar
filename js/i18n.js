/* Dunas Table Dance and Bar - bilingual toggle (Mexican Spanish primary / English).
 *
 * Spanish is the primary language. On first load with no saved choice we honor
 * the visitor's browser language: anything that is not Spanish lands in English,
 * Spanish (or unset on a Spanish browser) lands in Spanish.
 *
 * Any element with both data-es and data-en swaps its innerHTML on toggle, so
 * inline emphasis and the ellipsis brand voice survive the swap.
 *
 * For attributes (aria-label, content, title, alt), use data-es-attr-X and
 * data-en-attr-X where X is the camelCase attribute name
 * (e.g. data-es-attr-aria-label -> data-esAttrAriaLabel via dataset).
 *
 * The toggle is a minimal "ES / EN" text pill (no flags), per the design spec.
 * Choice persists to localStorage.nf_lang and updates <html lang>.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "nf_lang";
  const SUPPORTED = ["es", "en"];

  function detectInitialLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
    const browser = (navigator.language || "es").slice(0, 2).toLowerCase();
    // Spanish primary: only non-Spanish browsers default to English.
    return browser === "es" ? "es" : (SUPPORTED.includes(browser) ? browser : "en");
  }

  function applyLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = "es";
    document.documentElement.lang = lang;
    document.body.dataset.lang = lang;

    // Text content swaps (innerHTML so links/emphasis/ellipsis survive)
    document.querySelectorAll("[data-es][data-en]").forEach((el) => {
      const val = el.dataset[lang];
      if (typeof val === "string") el.innerHTML = val;
    });

    // Attribute swaps. Pattern: data-es-attr-aria-label / data-en-attr-aria-label
    document.querySelectorAll("*").forEach((el) => {
      for (const key of Object.keys(el.dataset)) {
        const m = key.match(/^(es|en)Attr([A-Z]\w*)$/);
        if (!m) continue;
        const kLang = m[1];
        const attrPascal = m[2];
        if (kLang !== lang) continue;
        const attr = attrPascal
          .replace(/([A-Z])/g, (s, c) => "-" + c.toLowerCase())
          .replace(/^-/, "");
        el.setAttribute(attr, el.dataset[key]);
      }
    });

    // Minimal ES / EN text pill: highlight the active code, the other is the
    // switch target. aria-label describes the action in the target language.
    document.querySelectorAll(".lang-toggle").forEach((btn) => {
      btn.dataset.current = lang;
      const es = btn.querySelector('[data-code="es"]');
      const en = btn.querySelector('[data-code="en"]');
      if (es) es.classList.toggle("is-active", lang === "es");
      if (en) en.classList.toggle("is-active", lang === "en");
      btn.setAttribute(
        "aria-label",
        lang === "es" ? "Switch to English" : "Cambiar a espanol"
      );
      btn.setAttribute("aria-pressed", "false");
    });

    localStorage.setItem(STORAGE_KEY, lang);
  }

  function toggleLang() {
    const cur = localStorage.getItem(STORAGE_KEY) || detectInitialLang();
    applyLang(cur === "es" ? "en" : "es");
  }

  function init() {
    applyLang(detectInitialLang());
    document.querySelectorAll(".lang-toggle").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleLang();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose for debugging and for other modules that want current lang.
  window.NFi18n = { applyLang, toggleLang, detect: detectInitialLang };
})();
