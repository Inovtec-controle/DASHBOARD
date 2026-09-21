/* Cross-device sync entry point. The actual onSnapshot listener and moduleSyncV1 writes live in v2. */
(()=>{
'use strict';
const script=document.createElement('script');
script.src='inovtec-cloud-sync-v2.js?v=20260921-server-confirmed1';
script.async=false;
script.onerror=()=>{const status=document.getElementById('syncMirror');if(status)status.textContent='Firebase — module de synchronisation indisponible';};
document.head.appendChild(script);
})();
