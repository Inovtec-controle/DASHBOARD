(()=>{
"use strict";
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const mode=(params.get("mode")||"planning").toLowerCase();
let legacyPage=mode==="planning"?"PLANNINGS-APP.html?v=20261012-agent-hours-special1":(params.get("page")||"PLANNINGS-APP.html?v=20261012-agent-hours-special1");
const fuelIcon='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto"><path d="M5 21V4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v17"/><path d="M7 6h5v5H7z"/><path d="M14 8h2l2 2v7a2 2 0 1 0 4 0v-6l-2-2"/><path d="M3 21h13"/></svg>';
const configs={
 planning:{label:"Planning",eyebrow:"PLANNING",title:'Planning des <em>équipes</em>',subtitle:"Organisez et suivez les interventions de vos agents sur l’ensemble de vos chantiers.",route:"PLANNINGS.html?v=20261012-agent-hours-special1",icon:"▦"},
 kontrol:{label:"KONTROL",eyebrow:"CONTRÔLES QUALITÉ",title:"KONTROL",subtitle:"Réalisez vos contrôles qualité sans modifier les critères, réponses, calculs ni archives déjà en place.",route:"KONTROL-CLOUD.html?v=20261001-checklist1",icon:"✓"},
 discipline:{label:"Discipline",eyebrow:"DISCIPLINE",title:"Gestion des dossiers <em>disciplinaires</em>",subtitle:"Consultez, enregistrez et suivez vos dossiers, photos et PDF avec la même logique de sauvegarde.",route:"DISCIPLINE-V9.html",icon:"⚑"},
 infos:{label:"Infos chantier",eyebrow:"INFOS CHANTIER",title:"Informations <em>chantiers</em>",subtitle:"Retrouvez les accès, contacts, plannings et consignes de chaque résidence dans une présentation plus lisible.",route:"INFOCHANTIERS-V2.html?v=20260927-savecontrols1",icon:"ⓘ"},
 agents:{label:"Classeur agents",eyebrow:"AGENTS",title:"Classeur <em>agents</em>",subtitle:"Consultez les profils et informations de vos agents dans une interface unifiée.",route:"AGENTS.html?v=20261013-incidents-private-fast4",icon:"♙"},
 organisation:{label:"Organisation",eyebrow:"ORGANISATION",title:"Organisation",subtitle:"Planifiez, suivez et pilotez vos tâches, priorités et échéances sans changer leur stockage.",route:"ORGANISATION-V17.html?v=20261012-v17-direct",icon:"◎"},
 variables:{label:"Variables agents",eyebrow:"VARIABLES DE PAIE",title:"Variables <em>agents</em>",subtitle:"Centralisez les heures complémentaires, supplémentaires, dimanches, jours fériés, nuits et absences liées à chaque agent.",route:"VARIABLES.html?v=20260927-savecontrols1",icon:"◷"},
 temps:{label:"Conversion temps",eyebrow:"OUTILS",title:"Conversion <em>temps</em>",subtitle:"Convertissez vos durées avec le calculateur existant dans une présentation modernisée.",route:"TEMPS.html",icon:"◷"},
 salaire:{label:"Salaire",eyebrow:"SALAIRE",title:"Calculateur de <em>salaire</em>",subtitle:"Utilisez les calculs de rémunération existants avec une lecture plus graphique.",route:"SALAIRE.html",icon:"€"},
 essence:{label:"Dépense carburant",eyebrow:"DÉPLACEMENTS",title:"Dépense <em>carburant</em>",subtitle:"Calculez rapidement le coût réel du carburant d’un agent à partir de ses trajets et de son véhicule.",route:"ESSENCE.html",icon:fuelIcon}
};
const cfg=configs[mode]||configs.planning;
// Organisation doit toujours ouvrir la version canonique courante, même si une ancienne URL
// du shell contient encore page=ORGA-LEGACY.html?v=.... Cela évite qu’un favori ou un cache
// ancien contourne les correctifs de déplacement, archivage et synchronisation Firebase.
if(mode==="organisation") window.location.replace("ORGANISATION-V17.html?v=20261012-v17-direct");
// La navigation complète doit exister dès le premier rendu, avant le chargement de Firebase.
// Ces destinations et leur ordre correspondent au référentiel de inovtec-ui-stability.js.
const navDefinitions=[
 ['Accueil','⌂','index.html','home'],
 ['Planning','▦','PLANNINGS.html?v=20261012-agent-hours-special1','planning'],
 ['KONTROL','✓','KONTROL-CLOUD.html','kontrol'],
 ['Infos chantier','ⓘ','INFOCHANTIERS-V2.html','infos'],
 ['Classeur agents','♙','AGENTS.html?v=20261013-incidents-private-fast4','agents'],
 ['Matériel','▣','MATERIEL.html','materiel'],
 ['Réassort','↻','REASSORT.html','reassort'],
 ['Congés & absences','☂','CONGES.html?v=20261001-congesmonth1','conges'],
 ['Variables agents','◷','VARIABLES.html','variables'],
 ['Organisation','◎','ORGANISATION-V17.html?v=20261012-v17-direct','organisation'],
 ['Conversion temps','⇄','TEMPS.html','temps'],
 ['Salaire','€','SALAIRE.html','salaire'],
 ['Dépense carburant','⛽','ESSENCE.html','essence']
];
// Toutes les rubriques passent par leur page d'entrée officielle, jamais un ancien iframe en cache.
const navRoute=item=>item[2];
function makeNav(target,mobile=false){
 const items=mobile?navDefinitions.filter(item=>['home','planning','infos','agents'].includes(item[3])):navDefinitions;
 const fragment=document.createDocumentFragment();
 items.forEach(item=>{const a=document.createElement('a');a.href=navRoute(item);a.dataset.ivMenuKey=item[3];if(item[3]===mode)a.classList.add('active');if(mobile){const label={home:'Accueil',planning:'Planning',infos:'Chantiers',agents:'Agents',variables:'Variables'}[item[3]]||item[0];a.innerHTML='<span>'+item[1]+'</span><span>'+label+'</span>'}else a.innerHTML='<span class="iv-ico">'+item[1]+'</span><span>'+item[0]+'</span>';fragment.appendChild(a)});
 if(mobile){const more=document.createElement('button');more.type='button';more.className='iv-more-menu';more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-expanded','false');more.innerHTML='<span>☰</span><span>Menu</span>';more.addEventListener('click',()=>{
   // Le gestionnaire officiel du tiroir est installé par le script d'interface commun.
   const stable=window.__INOVTEC_UI_STABILITY_V1__;
   if(!stable){more.setAttribute('aria-expanded','false');return}
   more.dispatchEvent(new CustomEvent('iv:open-unified-menu',{bubbles:true}));
 });fragment.appendChild(more)}
 target.replaceChildren(fragment);
 // Le script commun ne doit pas reconstruire un menu déjà rendu de façon identique.
 target.dataset.ivStableMenu=mobile?'prebuilt-mobile':'1';
}
makeNav($("desktopNav"));
makeNav($("mobileNav"),true);
$("eyebrow").textContent=cfg.eyebrow;$("pageTitle").innerHTML=cfg.title;$("pageSubtitle").textContent=cfg.subtitle;$("topTitle").textContent=cfg.label;document.title=`${cfg.label} — Inovtec Dashboard`;
const df=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}),tf=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"});
function tick(){const d=new Date();$("dateLabel").textContent=df.format(d).replace(/^./,c=>c.toUpperCase());$("timeLabel").textContent=tf.format(d)}tick();setInterval(tick,30000);
const frame=$("legacyFrame"),loading=$("loading");
frame.src=legacyPage;
$("refreshPage").onclick=()=>{loading.classList.remove("hidden");try{frame.contentWindow.location.reload()}catch{frame.src=legacyPage}};
$("openOriginal").onclick=()=>window.open(legacyPage,"_blank");
function targetDoc(){try{return frame.contentDocument||null}catch{return null}}
function nestedKontrolDoc(){try{return frame.contentDocument?.getElementById("kontrolFrame")?.contentDocument||null}catch{return null}}
function addTheme(doc,modeName){if(!doc||!doc.head||!doc.body)return;doc.body.classList.add("iv-embedded",`iv-mode-${modeName}`);if(!doc.querySelector('link[data-inovtec-modern="1"]')){const link=doc.createElement("link");link.rel="stylesheet";link.href="inovtec-embedded.css?v=20260820-infos-mobile1";link.dataset.inovtecModern="1";doc.head.appendChild(link)}}
let agentsResizeObserver=null,agentsMutationObserver=null,agentsResizeRaf=0;
function fitAgentsFullPage(doc){
  if(mode!=="agents"||!doc?.body)return;
  document.body.classList.add("iv-agents-full-page");
  try{
    doc.documentElement.style.height="auto";
    doc.body.style.height="auto";
    doc.body.style.overflow="visible";
    const app=doc.querySelector(".app");
    if(app)app.style.minHeight="0";
    const list=doc.getElementById("agentList");
    if(list){list.style.maxHeight="none";list.style.overflow="visible"}
  }catch{}
  const resize=()=>{
    try{
      const h=Math.max(
        doc.documentElement?.scrollHeight||0,
        doc.body?.scrollHeight||0,
        doc.querySelector?.(".app")?.scrollHeight||0,
        700
      )+12;
      const height=h+"px";
      if(frame.style.height!==height){
        document.body.style.setProperty("--iv-agents-frame-height",height);
        frame.style.height=height;
      }
    }catch{}
  };
  const scheduleResize=()=>{
    if(agentsResizeRaf)return;
    agentsResizeRaf=requestAnimationFrame(()=>{agentsResizeRaf=0;resize()});
  };
  try{agentsResizeObserver?.disconnect()}catch{}
  try{agentsMutationObserver?.disconnect()}catch{}
  if(agentsResizeRaf){cancelAnimationFrame(agentsResizeRaf);agentsResizeRaf=0}
  if(window.ResizeObserver){
    agentsResizeObserver=new ResizeObserver(scheduleResize);
    agentsResizeObserver.observe(doc.body);
  }
  agentsMutationObserver=new MutationObserver(scheduleResize);
  agentsMutationObserver.observe(doc.body,{childList:true,subtree:true});
  resize();
  setTimeout(scheduleResize,120);
  setTimeout(scheduleResize,500);
  setTimeout(scheduleResize,1200);
}
function mirrorStatus(){
  const doc=targetDoc();
  if(!doc)return;
  const src=doc.querySelector("#syncStatus,.status.ok,.status.warning");
  if(!src||!src.textContent.trim())return;
  const value=src.textContent.trim().slice(0,70);
  const mirror=$("syncMirror");
  if(mirror&&mirror.textContent!==value)mirror.textContent=value;
}
let statusInterval=null;
function prepareFrame(){const doc=targetDoc();if(!doc)return;addTheme(doc,mode==="kontrol"?"kontrol-cloud":mode);if(mode==="agents")fitAgentsFullPage(doc);if(mode==="kontrol"){const nested=doc.getElementById("kontrolFrame");if(nested){const inject=()=>addTheme(nestedKontrolDoc(),"kontrol");nested.addEventListener("load",()=>setTimeout(inject,60));setTimeout(inject,300);setTimeout(inject,1100)}}mirrorStatus();if(statusInterval===null)statusInterval=setInterval(()=>{if(!document.hidden)mirrorStatus()},8000);loading.classList.add("hidden")}
frame.addEventListener("load",()=>setTimeout(prepareFrame,80));
window.addEventListener("inovtec:datahub",()=>setTimeout(mirrorStatus,30));
window.addEventListener("inovtec:firebase-status",()=>setTimeout(mirrorStatus,30));
})();