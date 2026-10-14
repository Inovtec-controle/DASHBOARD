/* KONTROL: dashboard layout while authentication stays in the top-level window.
   Presentation only; all Firebase and control functions remain untouched. */
(()=>{
"use strict";
if(window.top!==window||window.__IV_KONTROL_NATIVE_SHELL__)return;
window.__IV_KONTROL_NATIVE_SHELL__=true;
const app=document.getElementById("appShell"),login=document.getElementById("loginScreen");
if(!app||!login)return;
document.body.classList.add("iv-kontrol-native");
const root=document.createElement("div");root.className="iv-shell";
root.innerHTML=[
'<aside class="iv-sidebar">',
'<a class="iv-brand" href="index.html"><span class="iv-brand-mark"></span><span class="iv-brand-copy"><strong>INOVTEC</strong><span>DASHBOARD</span></span></a>',
'<nav class="iv-nav" id="ivNativeDesktopNav" aria-label="Navigation principale"></nav>',
'<div class="iv-sidebar-note"><strong>Inovtec Construction</strong><span>Outils de suivi et de contrôle</span></div></aside>',
'<section class="iv-main"><section class="iv-hero">',
'<div class="iv-hero-copy"><div class="iv-eyebrow">CONTRÔLES QUALITÉ</div><h1>KONTROL</h1>',
'<p>Réalisez vos contrôles qualité, consultez les historiques et archivez les PDF.</p></div>',
'<div class="iv-date"><strong id="ivNativeDate">—</strong><span id="ivNativeTime">—</span></div>',
'<div class="iv-geometry" aria-hidden="true"><span class="iv-dots"></span><span class="iv-circle a"></span><span class="iv-circle b"></span><span class="iv-rect a"></span><span class="iv-rect b"></span><span class="iv-diag one"></span><span class="iv-diag two"></span><span class="iv-diag three"></span></div>',
'</section><section class="iv-summary" aria-label="État de KONTROL">',
'<div class="iv-summary-card"><span class="iv-summary-icon">✓</span><div class="iv-summary-copy">',
'<span class="iv-summary-label">Contrôles qualité</span><strong class="iv-summary-value">KONTROL</strong>',
'<span class="iv-summary-note" id="ivNativeAuthStatus">Connexion à vérifier</span></div></div>',
'<div class="iv-summary-card"><span class="iv-summary-icon">▤</span><div class="iv-summary-copy">',
'<span class="iv-summary-label">Documents</span><strong class="iv-summary-value">Archives PDF</strong>',
'<span class="iv-summary-note">Accessible depuis le bouton dans la page</span></div></div>',
'</section><section class="iv-stage" id="ivNativeStage" aria-label="Contrôles KONTROL"></section></section>'
].join("");
document.body.insertBefore(root,login);
document.getElementById("ivNativeStage").appendChild(app);
const defs=[
["Accueil","⌂","index.html","home"],
["Planning","▦","PLANNINGS.html","planning"],
["KONTROL","✓","KONTROL-CLOUD.html","kontrol"],
["Infos chantier","ⓘ","INFOCHANTIERS-V2.html","infos"],
["Classeur agents","♙","AGENTS.html","agents"],
["Matériel","▣","MATERIEL.html","materiel"],
["Réassort","↻","REASSORT.html","reassort"],
["Congés & absences","☂","CONGES.html","conges"],
["Variables agents","◷","VARIABLES.html","variables"],
["Organisation","◎","ORGANISATION-V17.html","organisation"],
["Conversion temps","⇄","TEMPS.html","temps"],
["Salaire","€","SALAIRE.html","salaire"],
["Dépense carburant","⛽","ESSENCE.html","essence"]
];
function link(d,mobile){
 const a=document.createElement("a");a.href=d[2];a.dataset.ivMenuKey=d[3];
 if(d[3]==="kontrol"){a.classList.add("active");a.setAttribute("aria-current","page");}
 const ico=document.createElement("span");ico.textContent=d[1];if(!mobile)ico.className="iv-ico";
 const label=document.createElement("span");label.textContent=mobile&&d[3]==="infos"?"Chantiers":mobile&&d[3]==="agents"?"Agents":d[0];
 a.append(ico,label);return a;
}
const desktop=document.getElementById("ivNativeDesktopNav");desktop.dataset.ivStableMenu="1";
defs.forEach(d=>desktop.appendChild(link(d,false)));
const more=document.createElement("nav");more.id="ivNativeMore";more.hidden=true;more.className="iv-native-more";
more.setAttribute("aria-label","Tous les modules");defs.forEach(d=>more.appendChild(link(d,false)));
document.body.appendChild(more);
const mobile=document.createElement("nav");mobile.id="ivNativeMobile";mobile.className="iv-mobile-nav";
mobile.dataset.ivStableMenu="1";mobile.setAttribute("aria-label","Navigation mobile");
for(const id of ["home","planning","infos","agents"]){mobile.appendChild(link(defs.find(d=>d[3]===id),true));}
const moreButton=document.createElement("button");moreButton.type="button";
moreButton.setAttribute("aria-label","Tous les modules");moreButton.setAttribute("aria-expanded","false");
moreButton.innerHTML="<span>☰</span><span>Menu</span>";
moreButton.addEventListener("click",()=>{
 more.hidden=!more.hidden;moreButton.setAttribute("aria-expanded",String(!more.hidden));
});
more.addEventListener("click",()=>{more.hidden=true;moreButton.setAttribute("aria-expanded","false");});
mobile.appendChild(moreButton);document.body.appendChild(mobile);
const dateFmt=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const timeFmt=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"});
function tick(){const now=new Date();
 document.getElementById("ivNativeDate").textContent=dateFmt.format(now);
 document.getElementById("ivNativeTime").textContent=timeFmt.format(now);
}
tick();setInterval(tick,60000);
try{
 firebase.auth().onAuthStateChanged(user=>{
  const status=document.getElementById("ivNativeAuthStatus");
  if(status)status.textContent=user?"Compte Firebase connecté":"Connexion nécessaire";
 });
}catch(e){console.warn("KONTROL : indicateur de connexion indisponible",e);}
// Preserve the styling previously applied by the outer Dashboard to the control iframe.
const frame=document.getElementById("kontrolFrame");
if(frame)frame.addEventListener("load",()=>{
 try{
  const doc=frame.contentDocument;if(!doc?.head||!doc?.body)return;
  doc.body.classList.add("iv-embedded","iv-mode-kontrol");
  if(doc.querySelector('link[data-inovtec-modern="1"]'))return;
  const css=doc.createElement("link");css.rel="stylesheet";
  css.href="inovtec-embedded.css?v=20260820-infos-mobile1";
  css.dataset.inovtecModern="1";doc.head.appendChild(css);
 }catch(e){console.warn("KONTROL : habillage interne non disponible",e);}
});
})();