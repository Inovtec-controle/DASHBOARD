(()=>{
'use strict';
// Le menu est rendu une seule fois par inovtec-ui-stability.js.
const mode=(new URLSearchParams(location.search).get('mode')||'').toLowerCase();
if(!document.querySelector('script[data-iv-stable-ui="1"]')&&!window.__INOVTEC_UI_STABILITY_V1__){
 const s=document.createElement('script');s.src='inovtec-ui-stability.js?v=20261002-organisation-live16';s.dataset.ivStableUi='1';s.async=false;document.head.appendChild(s);
}
if(mode==='conges'){
 if(!document.querySelector('script[data-iv-conges-full-list="1"]')){
  const s=document.createElement('script');s.src='inovtec-conges-full-list.js?v=20260825-1';s.dataset.ivCongesFullList='1';s.async=false;document.head.appendChild(s);
 }
 const labels=[['topTitle','Congés & absences'],['eyebrow','CONGÉS & ABSENCES'],['pageSubtitle','Enregistrez les demandes, validez les absences et organisez les remplacements liés au planning.']];
 labels.forEach(([id,text])=>{const el=document.getElementById(id);if(el)el.textContent=text});
 const title=document.getElementById('pageTitle');if(title)title.innerHTML='Congés & <em>absences</em>';
 document.title='Congés & absences — Inovtec Dashboard';
}
// Le module Planning importe déjà replacement.js/css : aucun second chargement ici.
if(document.querySelector('.c3-app')&&!document.querySelector('script[data-iv-home-day-detail="1"]')){
 const s=document.createElement('script');s.src='dashboard-home-day-detail.js?v=20260918-home-day1';s.dataset.ivHomeDayDetail='1';s.async=false;document.body.appendChild(s);
}
})();
