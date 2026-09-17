(()=>{
'use strict';
// Le menu est rendu une seule fois par inovtec-ui-stability.js.
const mode=(new URLSearchParams(location.search).get('mode')||'').toLowerCase();
if(!document.querySelector('script[data-iv-stable-ui="1"]')&&!window.__INOVTEC_UI_STABILITY_V1__){
 const s=document.createElement('script');s.src='inovtec-ui-stability.js?v=20260917-ui-stable2';s.dataset.ivStableUi='1';s.async=false;document.head.appendChild(s);
}
if(mode==='conges'){
 if(!document.querySelector('script[data-iv-conges-full-list="1"]')){
  const s=document.createElement('script');s.src='inovtec-conges-full-list.js?v=20260825-1';s.dataset.ivCongesFullList='1';s.async=false;document.head.appendChild(s);
 }
 const labels=[['topTitle','Congés & absences'],['eyebrow','CONGÉS & ABSENCES'],['pageSubtitle','Enregistrez les demandes, validez les absences et organisez les remplacements liés au planning.']];
 labels.forEach(([id,text])=>{const el=document.getElementById(id);if(el)el.textContent=text});
 const title=document.getElementById('pageTitle');if(title)title.innerHTML='Congés & <em>absences</em>';
 document.title='Congés & absences — Inovtec Dashboard';
 const frame=document.getElementById('legacyFrame'),tools=document.getElementById('quickTools');
 const add=()=>{if(!tools||tools.querySelector('.iv-conges-tool'))return;const button=document.createElement('button');button.type='button';button.className='iv-tool primary iv-conges-tool';button.innerHTML='<span>＋</span><span>Nouvelle demande / absence</span>';button.addEventListener('click',()=>{try{frame?.contentDocument?.getElementById('newLeave')?.click()}catch{}});tools.insertBefore(button,tools.firstChild)};
 frame?.addEventListener('load',()=>setTimeout(add,180));setTimeout(add,700);
}
if(mode==='planning'){
 const f=document.getElementById('legacyFrame');
 const apply=()=>{let d;try{d=f?.contentDocument}catch{}if(!d?.head||!d.body||d.querySelector('[data-iv-replacement="1"]'))return;
 const link=d.createElement('link');link.rel='stylesheet';link.href='planning-replacement.css?v=20260815-1';link.dataset.ivReplacement='1';d.head.appendChild(link);
 const script=d.createElement('script');script.src='planning-replacement.js?v=20260815-1';script.dataset.ivReplacement='1';d.body.appendChild(script)};
 f?.addEventListener('load',()=>setTimeout(apply,120));setTimeout(apply,450);setTimeout(apply,1200);
}
})();
