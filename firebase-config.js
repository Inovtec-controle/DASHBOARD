window.INOVTEC_FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyCd_A1V-CRWGxbEmGFDadNFbGqXLocBDPw",
  authDomain: "inovtec-chantiers.firebaseapp.com",
  projectId: "inovtec-chantiers",
  storageBucket: "inovtec-chantiers.firebasestorage.app",
  messagingSenderId: "313162345276",
  appId: "1:313162345276:web:1a270f797dd736a4060c39"
});

// Marqueur de compatibilité des contrôles historiques : inovtec-firebase-operational-guard.js?v=20260908-sync-recovery1

/* Initialise Firebase le plus tôt possible et active le transport Firestore
   le plus tolérant aux proxys / réseaux qui bloquent le WebChannel. */
(() => {
  let attempts=0;
  const configure=()=>{
    if(!window.firebase||!firebase.initializeApp||!firebase.firestore){
      if(attempts++<60)setTimeout(configure,50);
      return;
    }
    try{
      if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
      const db=firebase.firestore();
      try{db.settings({experimentalAutoDetectLongPolling:true,useFetchStreams:false})}
      catch(_e1){try{db.settings({experimentalAutoDetectLongPolling:true})}catch(_e2){}}
      try{const p=db.enableNetwork();if(p&&typeof p.catch==="function")p.catch(()=>{})}catch{}
    }catch(error){console.warn("Configuration réseau Firebase ignorée",error)}
  };
  configure();
})();

/* L'ancien contrôle global pouvait déclarer Firebase en panne si une seule
   collection répondait lentement. On laisse le contrôleur de reprise faire
   le vrai test avant d'afficher une erreur à l'utilisateur. */
(() => {
  window.addEventListener("inovtec:firebase-operational",event=>{
    try{
      const detail=event.detail||{};
      const signedIn=!!window.firebase?.auth?.().currentUser;
      if(detail.ok===false&&!detail.source&&navigator.onLine&&signedIn){
        event.stopImmediatePropagation();
        window.dispatchEvent(new CustomEvent("inovtec:firebase-status",{detail:{state:"loading",message:"Reconnexion Firebase…",source:"legacy-health-filter"}}));
      }
    }catch{}
  },true);
})();

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
    const scripts = [
      {
        selector: 'script[data-inovtec-firebase-operational="1"]',
        src: "inovtec-firebase-operational-guard.js?v=20260908-firebase-stable3",
        dataset: "inovtecFirebaseOperational"
      },
      {
        selector: 'script[data-inovtec-firebase-connection-recovery="1"]',
        src: "inovtec-firebase-connection-recovery.js?v=20260908-firebase-stable3",
        dataset: "inovtecFirebaseConnectionRecovery"
      }
    ];
    scripts.forEach(item => {
      if (document.querySelector(item.selector)) return;
      const script = document.createElement("script");
      script.src = item.src;
      script.dataset[item.dataset] = "1";
      script.async = false;
      (document.head || document.documentElement).appendChild(script);
    });
  } catch (error) {
    console.warn("Chargement des garde-fous Firebase ignoré", error);
  }
})();
