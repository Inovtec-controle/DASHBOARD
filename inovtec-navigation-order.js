(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();

// Référence unique : menu gauche visible sur la page Accueil (MARK 1).
const HOME_MAIN=[
  ["index.html","Accueil","⌂","home"],
  ["PLANNINGS.html?v=20260829-planningstable1","Planning","▦","planning"],
  ["KONTROL-CLOUD.html","KONTROL","✓","kontrol"],
  ["DISCIPLINE-V9.html","Discipline","⚠","discipline"],
  ["INFOCHANTIERS-V2.html","Infos chantier","▥","infos"],
  ["AGENTS.html","Classeur agents","♙","agents"],
  ["CONGES.html","Congés & absences","☼","conges"],
  ["VARIABLES.html","Variables agents","◷","variables"],
  ["ORGA.html","Organisation","◎","organisation"]
];
const HOME_TOOLS=[
  ["TEMPS.html","Conversion temps","⇄","temps"],
  ["SALAIRE.html","Salaire","▱","salaire"],
  ["ESSENCE.html","Dépense carburant","⛽","essence"]
];
const HOME_DATA=[
  ["INFOCHANTIERS-V2.html","Chantiers","▤","data-chantiers"],
  ["AGENTS.html","Agents","◉","data-agents"]
];
// Le menu mobile reste volontairement inchangé : la demande porte sur le menu gauche desktop.
const MOBILE_PAGES=[
  ["index.html","Accueil","⌂","home"],
  ["INFOCHANTIERS-V2.html","Infos chantier","ⓘ","infos"],
  ["AGENTS.html","Classeur agents","♙","agents"],
  ["PLANNINGS.html?v=20260829-planningstable1","Planning","▦","planning"],
  ["CONGES.html","Congés & absences","☼","conges"],
  ["VARIABLES.html","Variables agents","◷","variables"],
  ["ORGA.html","Organisation","◎","organisation"]
];
const SHELL_MENU=[...HOME_MAIN,...HOME_TOOLS,...HOME_DATA];
const MODULE_PAGES=[...HOME_MAIN.slice(1),...HOME_TOOLS];
const base=a=>String(a?.getAttribute?.("href")||"").split("?")[0].replace(/^\.\//,"");
const activeKey=()=>({planning:"planning",kontrol:"kontrol",discipline:"discipline",infos:"infos",agents:"agents",conges:"conges",variables:"variables",organisation:"organisation",temps:"temps",salaire:"salaire",essence:"essence"}[mode]||"");
const rmHours=root=>root?.querySelectorAll?.('a[href*="HEURE-SUP.html"]').forEach(a=>a.remove());
function navLink(doc,p,shell){const a=doc.createElement("a");a.href=p[0];a.dataset.ivMenuKey=p[3];a.innerHTML=shell?`<span class="iv-ico">${p[2]}</span><span>${p[1]}</span>`:`<span class="ico">${p[2]}</span><span>${p[1]}</span>`;return a}
function rebuildShellDesktop(nav){if(!nav)return;const doc=nav.ownerDocument,key=activeKey();nav.innerHTML="";SHELL_MENU.forEach(p=>{const a=navLink(doc,p,true);if(p[3]===key)a.classList.add("active");nav.appendChild(a)})}
function rebuildLegacyNav(nav){if(!nav)return;const doc=nav.ownerDocument;nav.innerHTML="";SHELL_MENU.forEach(p=>nav.appendChild(navLink(doc,p,false)))}
function rebuildHomeMain(nav){if(!nav)return;const doc=nav.ownerDocument;nav.innerHTML="";HOME_MAIN.forEach(p=>{const a=navLink(doc,p,false);if(p[3]==="home")a.classList.add("active");nav.appendChild(a)})}
function setPageHeader(desktop,mobile,key,label,eyebrow,title,subtitle){document.querySelectorAll("#desktopNav a,#mobileNav a").forEach(a=>a.classList.remove("active"));desktop.querySelector(`a[href="${key}"]`)?.classList.add("active");mobile?.querySelector(`a[href="${key}"]`)?.classList.add("active");const set=(id,v,h)=>{const e=document.getElementById(id);if(e)h?e.innerHTML=v:e.textContent=v};set("topTitle",label);set("eyebrow",eyebrow);set("pageTitle",title,1);set("pageSubtitle",subtitle);document.title=`${label} — Inovtec Dashboard`}
function addShellTool(frame,tools,cls,label,handler){if(!tools||tools.querySelector("."+cls))return;const b=document.createElement("button");b.type="button";b.className=`iv-tool primary ${cls}`;b.innerHTML=`<span>＋</span><span>${label}</span>`;b.onclick=handler;tools.insertBefore(b,tools.firstChild)}
function shell(){const desktop=document.getElementById("desktopNav");if(!desktop)return;rebuildShellDesktop(desktop);const mobile=document.getElementById("mobileNav");if(mobile){mobile.innerHTML=MOBILE_PAGES.map(p=>`<a href="${p[0]}"><span>${p[2]}</span><span>${p[1].replace("Classeur ","").replace("Infos chantier","Chantiers").replace("Congés & absences","Congés").replace("Variables agents","Variables")}</span></a>`).join("");const key=activeKey();MOBILE_PAGES.forEach((p,i)=>{if(p[3]===key)mobile.children[i]?.classList.add("active")})}
const f=document.getElementById("legacyFrame"),t=document.getElementById("quickTools");
if(mode==="conges"){setPageHeader(desktop,mobile,"CONGES.html","Congés & absences","CONGÉS & ABSENCES",'Congés & <em>absences</em>',"Enregistrez les demandes, validez les périodes d’absence et pilotez les remplacements liés au planning.");const add=()=>addShellTool(f,t,"iv-conges-tool","Nouvelle demande / absence",()=>{try{f.contentDocument?.getElementById("newLeave")?.click()}catch{}});f?.addEventListener("load",()=>setTimeout(add,180));setTimeout(add,700)}
if(mode==="variables"){setPageHeader(desktop,mobile,"VARIABLES.html","Variables agents","VARIABLES DE PAIE",'Variables <em>agents</em>',"Centralisez heures complémentaires, supplémentaires, dimanches, jours fériés, nuits et absences sans ressaisie.");const add=()=>addShellTool(f,t,"iv-variables-tool","Ajouter une variable",()=>{try{f.contentDocument?.getElementById("newVariable")?.click()}catch{}});f?.addEventListener("load",()=>setTimeout(add,180));setTimeout(add,700)}
}
function moduleText(h){return h.includes("INFOCHANTIERS")?"Accédez aux informations clés, contacts et consignes de vos résidences.":h.includes("AGENTS")?"Consultez les informations et documents liés à vos agents.":h.includes("PLANNINGS")?"Consultez et gérez les plannings de vos équipes et chantiers.":h.includes("CONGES")?"Enregistrez les demandes, validez les absences et organisez les remplacements.":h.includes("VARIABLES")?"Centralisez les variables de paie de chaque agent et évitez les doubles saisies.":h.includes("ORGA")?"Centralisez les tâches et l’organisation opérationnelle de votre activité.":h.includes("KONTROL")?"Réalisez vos contrôles qualité et retrouvez les PDF archivés en ligne.":h.includes("DISCIPLINE")?"Gérez les dossiers, observations, photos, suivis et PDF disciplinaires.":h.includes("ESSENCE")?"Calculez rapidement les dépenses de carburant des agents.":h.includes("TEMPS")?"Convertissez rapidement les durées et temps de travail.":"Accédez au calculateur de salaire Inovtec."}
function mark1Module(mods,href,label,icon,text,beforeHref){let a=mods.querySelector(`a[href^="${href}"]`);if(!a){a=document.createElement("a");a.className="m1-module";a.href=href;a.innerHTML=`<span class="micon">${icon}</span><strong>${label}</strong><p>${text}</p><span class="arrow">→</span>`;const before=beforeHref?mods.querySelector(`a[href^="${beforeHref}"]`):null;before?mods.insertBefore(a,before):mods.appendChild(a)}return a}
function homeMark1(){const nav=document.querySelector(".m1-sidebar .m1-nav"),mods=document.querySelector(".m1-modules"),quick=document.querySelector(".m1-quick");if(!nav)return false;rebuildHomeMain(nav);if(mods){rmHours(mods);mark1Module(mods,"CONGES.html","Congés & absences","☼","Enregistrez les congés, absences et périodes à couvrir.","ORGA.html");mark1Module(mods,"VARIABLES.html","Variables agents","◷","Centralisez heures, majorations et absences pour préparer la paie.","ORGA.html")}if(quick){quick.querySelectorAll('a[href*="HEURE-SUP.html"]').forEach(a=>a.remove());if(!quick.querySelector('a[href="CONGES.html"]')){const a=document.createElement("a");a.href="CONGES.html";a.innerHTML='<span>☼</span>Renseigner un congé / une absence<span class="chev">›</span>';quick.appendChild(a)}if(!quick.querySelector('a[href="VARIABLES.html"]')){const a=document.createElement("a");a.href="VARIABLES.html";a.innerHTML='<span>◷</span>Ajouter une variable agent<span class="chev">›</span>';quick.appendChild(a)}}return true}
function homeLegacy(){const nav=document.querySelector(".sidebar .nav"),mods=document.querySelector(".modules");if(!nav)return;rebuildLegacyNav(nav);if(mods){rmHours(mods);MODULE_PAGES.forEach(p=>{let a=[...mods.querySelectorAll("a.module")].find(x=>base(x)===p[0]);if(!a){a=document.createElement("a");a.className="module";a.href=p[0];a.innerHTML=`<div class="module-top"><div class="module-ico">${p[2]}</div><h3>${p[1]}</h3></div><p>${moduleText(p[0])}</p><span class="go">Accéder →</span><div class="module-art"></div>`;mods.appendChild(a)}mods.appendChild(a)})}const tools=document.querySelector("section.tools");if(tools){const h=tools.previousElementSibling;if(h?.classList.contains("section-head")&&/autres outils/i.test(h.textContent||""))h.remove();tools.remove()}const q=document.querySelector(".quick");if(q&&!q.querySelector('a[href="CONGES.html"]')){const a=document.createElement("a");a.href="CONGES.html";a.innerHTML='<span class="plus">＋</span>Renseigner un congé / une absence';q.insertBefore(a,q.firstChild)}if(q&&!q.querySelector('a[href="VARIABLES.html"]')){const a=document.createElement("a");a.href="VARIABLES.html";a.innerHTML='<span class="plus">＋</span>Ajouter une variable agent';q.insertBefore(a,q.firstChild)}}
function home(){if(homeMark1())return;homeLegacy()}
function replacement(){if(mode!=="planning")return;const f=document.getElementById("legacyFrame");if(!f)return;const apply=()=>{let d;try{d=f.contentDocument}catch{}if(!d?.head||!d.body)return;if(!d.querySelector('[data-iv-replacement="1"]')){const l=d.createElement("link");l.rel="stylesheet";l.href="planning-replacement.css?v=20260815-1";l.dataset.ivReplacement="1";d.head.appendChild(l);const s=d.createElement("script");s.src="planning-replacement.js?v=20260815-1";s.dataset.ivReplacement="1";d.body.appendChild(s)}};f.addEventListener("load",()=>setTimeout(apply,120));setTimeout(apply,450);setTimeout(apply,1200)}
function run(){shell();home();replacement()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run();setTimeout(run,180);setTimeout(run,700);
})();
