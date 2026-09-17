(()=>{
'use strict';
// Le menu est rendu une seule fois par inovtec-ui-stability.js. Ne plus le reconstruire après affichage.
const mode=(new URLSearchParams(location.search).get('mode')||'').toLowerCase();
if(!document.querySelector('script[data-iv-stable-ui="1"]')&&!window.__INOVTEC_UI_STABILITY_V1__){
 const s=document.createElement('script');s.src='inovtec-ui-stability.js?v=20260917-ui-stable1';s.dataset.ivStableUi='1';s.async=false;document.head.appendChild(s);
}
if(mode==='conges'&&!document.querySelector('script[data-iv-conges-full-list="1"]')){
 const s=document.createElement('script');s.src='inovtec-conges-full-list.js?v=20260825-1';s.dataset.ivCongesFullList='1';s.async=false;document.head.appendChild(s);
}
if(mode==='planning'){
 const f=document.getElementById('legacyFrame');
 const apply=()=>{let d;try{d=f?.contentDocument}catch{}if(!d?.head||!d.body||d.querySelector('[data-iv-replacement="1"]'))return;
 const link=d.createElement('link');link.rel='stylesheet';link.href='planning-replacement.css?v=20260815-1';link.dataset.ivReplacement='1';d.head.appendChild(link);
 const script=d.createElement('script');script.src='planning-replacement.js?v=20260815-1';script.dataset.ivReplacement='1';d.body.appendChild(script)};
 f?.addEventListener('load',()=>setTimeout(apply,120));setTimeout(apply,450);setTimeout(apply,1200);
}
})();
