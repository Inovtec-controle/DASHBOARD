window.INOVTEC_FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyCd_A1V-CRWGxbEmGFDadNFbGqXLocBDPw",
  authDomain: "inovtec-chantiers.firebaseapp.com",
  projectId: "inovtec-chantiers",
  storageBucket: "inovtec-chantiers.firebasestorage.app",
  messagingSenderId: "313162345276",
  appId: "1:313162345276:web:1a270f797dd736a4060c39"
});

(() => {
  try {
    if (!localStorage.getItem("orga_task_board_v2")) {
      const legacy = localStorage.getItem("orga_task_board_v1");
      if (legacy) localStorage.setItem("orga_task_board_v2", legacy);
    }

    if (!localStorage.getItem("inovtec_discipline_v2")) {
      const legacy = JSON.parse(localStorage.getItem("discipline") || "[]");
      if (Array.isArray(legacy) && legacy.length) {
        const migrated = legacy.map((item, index) => ({
          id: `disc_legacy_${index}_${Date.now()}`,
          agent: item.agent || "",
          site: item.site || "",
          date: item.date || "",
          niveau: item.niveau || "Observation",
          statut: "Ouvert",
          responsable: item.resp || "",
          motif: item.motif || "",
          temoins: item.tem || "",
          description: item.desc || "",
          suite: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          migratedFromLegacy: true
        }));
        localStorage.setItem("inovtec_discipline_v2", JSON.stringify(migrated));
      }
    }
  } catch (error) {
    console.warn("Migration locale ignorée", error);
  }
})();

(() => {
  try {
    if (window.top !== window) {
      // Matériel utilise son propre cadre : charger l'interface commune dans la page parente.
      const p = window.parent;
      const doc = p.document;
      if (doc.getElementById('materialFrame')?.contentWindow === window) {
        if (!doc.querySelector('script[data-iv-common-header="1"]') && !p.__INOVTEC_COMMON_HEADER_V1__) {
          const header = doc.createElement('script');
          header.src = 'inovtec-common-header.js?v=20260917-planning-background1';
          header.dataset.ivCommonHeader = '1';
          header.async = false;
          (doc.head || doc.documentElement).appendChild(header);
        }
        if (!doc.querySelector('script[data-iv-stable-ui="1"]') && !p.__INOVTEC_UI_STABILITY_V1__) {
          const script = doc.createElement('script');
          script.src = 'inovtec-ui-stability.js?v=20260917-ui-stable2';
          script.dataset.ivStableUi = '1';
          script.async = false;
          (doc.head || doc.documentElement).appendChild(script);
        }
      }
      return;
    }
    if (!document.querySelector('script[data-iv-common-header="1"]') && !window.__INOVTEC_COMMON_HEADER_V1__) {
      const header = document.createElement('script');
      header.src = 'inovtec-common-header.js?v=20260917-planning-background1';
      header.dataset.ivCommonHeader = '1';
      header.async = false;
      (document.head || document.documentElement).appendChild(header);
    }
    if (!document.querySelector('script[data-inovtec-firebase-operational="1"]')) {
      const script = document.createElement("script");
      script.src = "inovtec-firebase-operational-guard.js?v=20260829-operational1";
      script.dataset.inovtecFirebaseOperational = "1";
      script.async = false;
      (document.head || document.documentElement).appendChild(script);
    }
    if (!document.querySelector('script[data-iv-stable-ui="1"]') && !window.__INOVTEC_UI_STABILITY_V1__) {
      const script = document.createElement("script");
      script.src = "inovtec-ui-stability.js?v=20260917-ui-stable2";
      script.dataset.ivStableUi = "1";
      script.async = false;
      (document.head || document.documentElement).appendChild(script);
    }
  } catch (error) {
    console.warn("Chargement des services Firebase ignoré", error);
  }
})();

// Les champs « Chantier » lisent tous le même référentiel Infos chantier.
(() => {
  if (document.querySelector('script[data-iv-chantier-dropdown="1"]')) return;
  const script = document.createElement('script');
  script.src = 'inovtec-chantier-dropdown.js?v=20260917-1';
  script.dataset.ivChantierDropdown = '1';
  script.async = true;
  (document.head || document.documentElement).appendChild(script);
})();

// Les exports CSV ne sont plus proposés sur les pages et cadres de l'application.
(() => {
  if (document.querySelector('script[data-iv-hide-csv="1"]') || window.__INOVTEC_HIDE_CSV_EXPORTS_V1__) return;
  const script = document.createElement('script');
  script.src = 'inovtec-hide-csv-exports.js?v=20260917-no-csv1';
  script.dataset.ivHideCsv = '1';
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
})();
