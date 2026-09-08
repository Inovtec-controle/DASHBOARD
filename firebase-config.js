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
    if (window.top !== window) return;
    if (document.querySelector('script[data-inovtec-firebase-operational="1"]')) return;
    const script = document.createElement("script");
    script.src = "inovtec-firebase-operational-guard.js?v=20260829-operational1";
    script.dataset.inovtecFirebaseOperational = "1";
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.warn("Chargement du garde-fou Firebase ignoré", error);
  }
})();
