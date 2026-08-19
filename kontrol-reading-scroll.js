(() => {
  "use strict";

  const READING_CLASS = "iv-kontrol-reading";
  const READY_CLASS = "iv-kontrol-reading-ready";
  const STYLE_ID = "iv-kontrol-reading-style";
  const COLLAPSE_AT = 56;
  const RESTORE_AT = 18;
  const kontrolFrame = document.getElementById("kontrolFrame");
  let boundWindow = null;
  let scrollHandler = null;

  function shellDocument() {
    try {
      if (window.parent === window) return null;
      const doc = window.parent.document;
      return doc?.querySelector?.(".iv-shell") ? doc : null;
    } catch (_) {
      return null;
    }
  }

  function ensureShellStyles() {
    const doc = shellDocument();
    if (!doc?.head || !doc.body) return null;

    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        body.${READY_CLASS} .iv-hero,
        body.${READY_CLASS} .iv-summary,
        body.${READY_CLASS} .iv-context,
        body.${READY_CLASS} .iv-ref-context {
          overflow: hidden;
          transition: max-height .22s ease, min-height .22s ease, margin .22s ease, padding .22s ease, opacity .16s ease, border-width .22s ease;
        }
        body.${READY_CLASS} .iv-hero { max-height: 220px; }
        body.${READY_CLASS} .iv-summary { max-height: 260px; }
        body.${READY_CLASS} .iv-context,
        body.${READY_CLASS} .iv-ref-context { max-height: 90px; }

        body.${READING_CLASS} .iv-hero {
          min-height: 0 !important;
          max-height: 0 !important;
          margin-top: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          border-width: 0 !important;
          opacity: 0;
          pointer-events: none;
        }
        body.${READING_CLASS} .iv-summary,
        body.${READING_CLASS} .iv-context,
        body.${READING_CLASS} .iv-ref-context {
          min-height: 0 !important;
          max-height: 0 !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          border-width: 0 !important;
          gap: 0 !important;
          opacity: 0;
          pointer-events: none;
        }
        body.${READING_CLASS} .iv-stage {
          margin-top: 0 !important;
        }

        @media (max-width: 760px) {
          body.${READING_CLASS} .iv-stage {
            margin-left: 4px !important;
            margin-right: 4px !important;
            margin-bottom: 4px !important;
          }
          body.${READING_CLASS} .iv-frame {
            border-radius: 10px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          body.${READY_CLASS} .iv-hero,
          body.${READY_CLASS} .iv-summary,
          body.${READY_CLASS} .iv-context,
          body.${READY_CLASS} .iv-ref-context {
            transition: none !important;
          }
        }
      `;
      doc.head.appendChild(style);
    }

    doc.body.classList.add(READY_CLASS);
    return doc;
  }

  function setReadingMode(active) {
    const doc = ensureShellStyles();
    if (!doc?.body) return;
    doc.body.classList.toggle(READING_CLASS, !!active);
  }

  function currentScrollY(win, doc) {
    return Math.max(
      0,
      Number(win?.scrollY || 0),
      Number(doc?.documentElement?.scrollTop || 0),
      Number(doc?.body?.scrollTop || 0)
    );
  }

  function unbindCurrentWindow() {
    if (boundWindow && scrollHandler) {
      try { boundWindow.removeEventListener("scroll", scrollHandler); } catch (_) {}
    }
    boundWindow = null;
    scrollHandler = null;
  }

  function bindKontrolScroll() {
    if (!kontrolFrame) return;

    try {
      const win = kontrolFrame.contentWindow;
      const doc = kontrolFrame.contentDocument;
      if (!win || !doc?.body || win === boundWindow) return;

      unbindCurrentWindow();
      boundWindow = win;

      scrollHandler = () => {
        const y = currentScrollY(win, doc);
        const shell = ensureShellStyles();
        if (!shell?.body) return;

        if (y >= COLLAPSE_AT) {
          shell.body.classList.add(READING_CLASS);
        } else if (y <= RESTORE_AT) {
          shell.body.classList.remove(READING_CLASS);
        }
      };

      win.addEventListener("scroll", scrollHandler, { passive: true });
      scrollHandler();
    } catch (_) {
      setReadingMode(false);
    }
  }

  if (!kontrolFrame) return;

  ensureShellStyles();
  kontrolFrame.addEventListener("load", () => {
    setReadingMode(false);
    setTimeout(bindKontrolScroll, 80);
    setTimeout(bindKontrolScroll, 350);
    setTimeout(bindKontrolScroll, 900);
  });

  setTimeout(bindKontrolScroll, 300);
  setTimeout(bindKontrolScroll, 1200);

  window.addEventListener("beforeunload", () => {
    unbindCurrentWindow();
    setReadingMode(false);
  });
})();
