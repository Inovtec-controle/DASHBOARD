(()=>{
"use strict";
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const mode=(params.get("mode")||"planning").toLowerCase();
const legacyPage=params.get("page")||"PLANNINGS-LEGACY.html";
const configs={
 planning:{label:"Planning",eyebrow:"PLANNING",title:'Planning des <em>équipes</em>',subtitle:"Organisez et suivez les interventions de vos agents sur l’ensemble de vos chantiers.",route:"PLANNINGS.html?v=20260829-planningstable3",icon:"▦"},
 kontrol:{label:"KONTROL",eyebrow:"CONTRÔLES QUALITÉ",title:"KONTROL",subtitle:"Réalisez vos contrôles qualité sans modifier les critères, réponses, calculs ni archives déjà en place.",route:"KONTROL-CLOUD.html?v=20260830-historydelete1",icon:"✓"},
 discipline:{label:"Discipline",eyebrow:"DISCIPLINE",title:"Gestion des dossiers <em>disciplinaires</em>",subtitle:"Consultez, enregistrez et suivez vos dossiers, photos et PDF avec la même logique de sauvegarde.",route:"DISCIPLINE-V9.html",icon:"⚑"},
 infos:{label:"Infos chantier",eyebrow:"INFOS CHANTIER",title:"Informations <em>chantiers</em>",subtitle:"Retrouvez les accès, contacts, plannings et consignes de chaque résidence dans une présentation plus lisible.",route:"INFOCHANTIERS-V2.html?v=20260830-historydelete1",icon:"ⓘ"},
 agents:{label:"Classeur agents",eyebrow:"AGENTS",title:"Classeur <em>agents</em>",subtitle:"Consultez les profils et informations de vos agents dans une interface unifiée.",route:"AGENTS.html",icon:"♙"},
 organisation:{label:"Organisation",eyebrow:"ORGANISATION",title:"Organisation",subtitle:"Planifiez, suivez et pilotez vos tâches, priorités et échéances sans changer leur stockage.",route:"ORGA.html",icon:"◎"},
 variables:{label:"Variables agents",eyebrow:"VARIABLES DE PAIE",title:"Variables <em>agents</em>",subtitle:"Centralisez les heures complémentaires, supplémentaires, dimanches, jours fériés, nuits et absences liées à chaque agent.",route:"VARIABLES.html?v=20260829-variables-dashboard1",icon:"◷"},
 temps:{label:"Conversion temps",eyebrow:"OUTILS",title:"Conversion <em>temps</em>",subtitle:"Convertissez vos durées avec le calculateur existant dans une présentation modernisée.",route:"TEMPS.html",icon:"◷"},
 salaire:{label:"Salaire",eyebrow:"SALAIRE",title:"Calculateur de <em>salaire</em>",subtitle:"Utilisez les calculs de rémunération existants avec une lecture plus graphique.",route:"SALAIRE.html",icon:"€"},
 essence:{label:"Dépense carburant",eyebrow:"DÉPLACEMENTS",title:"Dépense <em>carburant</em>",subtitle:"Calculez rapidement le coût réel du carburant d’un agent à partir de ses trajets et de son véhicule.",route:"ESSENCE.html",icon:"⛽"}
};
const cfg=configs[mode]||configs.planning;
const nav=[configs.planning,configs.kontrol,configs.infos,configs.agents,configs.organisation,configs.variables,configs.temps,configs.salaire,configs.essence];
function makeNav(target,mobile=false){target.innerHTML="";const home=document.createElement("a");home.href="index.html";home.innerHTML=mobile?'<span>⌂</span><span>Accueil</span>':'<span class="iv-ico">⌂</span><span>Accueil</span>';target.appendChild(home);nav.forEach(item=>{const a=document.createElement("a");a.href=item.route;a.classList.toggle("active",item===cfg);a.innerHTML=mobile?`<span>${item.icon}</span><span>${item.label.replace("Classeur ","")}</span>`:`<span class="iv-ico">${item.icon}</span><span>${item.label}</span>`;target.appendChild(a)})}
makeNav($("desktopNav"));
const mobileItems=[configs.planning,configs.kontrol,configs.infos,configs.agents];
$("mobileNav").innerHTML='<a href="index.html"><span>⌂</span><span>Accueil</span></a>'+mobileItems.map(item=>`<a href="${item.route}" class="${item===cfg?"active":""}"><span>${item.icon}</span><span>${item.label.replace("Classeur ","")}</span></a>`).join("");
$("eyebrow").textContent=cfg.eyebrow;$("pageTitle").innerHTML=cfg.title;$("pageSubtitle").textContent=cfg.subtitle;$("topTitle").textContent=cfg.label;document.title=`${cfg.label} — Inovtec Dashboard`;
const df=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}),tf=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"});
function tick(){const d=new Date();$("dateLabel").textContent=df.format(d).replace(/^./,c=>c.toUpperCase());$("timeLabel").textContent=tf.format(d)}tick();setInterval(tick,30000);
const frame=$("legacyFrame"),loading=$("loading"),tools=$("quickTools");
frame.src=legacyPage;
$("refreshPage").onclick=()=>{loading.classList.remove("hidden");try{frame.contentWindow.location.reload()}catch{frame.src=legacyPage}};
$("openOriginal").onclick=()=>window.open(legacyPage,"_blank");
function targetDoc(){try{return frame.contentDocument||null}catch{return null}}
function nestedKontrolDoc(){try{return frame.contentDocument?.getElementById("kontrolFrame")?.contentDocument||null}catch{return null}}
function addTheme(doc,modeName){if(!doc||!doc.head||!doc.body)return;doc.body.classList.add("iv-embedded",`iv-mode-${modeName}`);if(!doc.querySelector('link[data-inovtec-modern="1"]')){const link=doc.createElement("link");link.rel="stylesheet";link.href="inovtec-embedded.css?v=20260820-infos-mobile1";link.dataset.inovtecModern="1";doc.head.appendChild(link)}}
function textButton(doc,labels){const buttons=[...doc.querySelectorAll("button,a.btn,label.btn")];return buttons.find(el=>labels.some(label=>(el.textContent||"").trim().toLowerCase().includes(label)))}
function clickTarget(selector,labels=[],deep=false){const doc=deep?nestedKontrolDoc():targetDoc();if(!doc)return false;let el=selector?doc.querySelector(selector):null;if(!el&&labels.length)el=textButton(doc,labels);if(el){el.click();return true}return false}
function focusTarget(selector){const doc=targetDoc();const el=doc?.querySelector(selector);if(el){el.focus();el.scrollIntoView({behavior:"smooth",block:"center"});return true}return false}
function addTool(label,icon,handler,primary=false){const b=document.createElement("button");b.type="button";b.className="iv-tool"+(primary?" primary":"");b.innerHTML=`<span>${icon}</span><span>${label}</span>`;b.onclick=handler;tools.appendChild(b)}
function buildTools(){tools.innerHTML="";
 addTool("Rechercher","⌕",()=>focusTarget('input[type="search"],#search,input[placeholder*="Recher"]'));
 if(mode==="planning"){addTool("Ajouter un agent","＋",()=>clickTarget("#addAgent",["ajouter"]),true);addTool("Exporter","⇩",()=>clickTarget("#exportBtn",["exporter"]));addTool("Imprimer","▤",()=>clickTarget("#printBtn",["imprimer"]));}
 if(mode==="kontrol"){addTool("Archives PDF","☁",()=>clickTarget("#archiveBtn",["archives pdf"]),true);addTool("Générer le PDF","▤",()=>clickTarget(null,["générer le pdf","générer pdf"],true));}
 if(mode==="discipline"){addTool("Nouveau dossier","＋",()=>{const d=targetDoc();d?.getElementById("recordForm")?.scrollIntoView({behavior:"smooth",block:"start"});d?.getElementById("agent")?.focus()},true);addTool("Exporter JSON","⇩",()=>clickTarget("#exportBtn",["exporter json"]));addTool("Actualiser données","↻",()=>clickTarget("#syncBtn",["actualiser"]));}
 if(mode==="infos"){addTool("Nouveau chantier","＋",()=>clickTarget("#newBtn",["nouveau"]),true);addTool("Fiche PDF","▤",()=>clickTarget("#pdfBtn",["pdf"]));addTool("Ma position","⌖",()=>clickTarget("#gpsBtn",["position"]));}
 if(mode==="agents"){addTool("Rechercher un agent","⌕",()=>focusTarget('input[type="search"],input[placeholder*="Recher"]'),true);addTool("Exporter","⇩",()=>clickTarget(null,["exporter"]));}
 if(mode==="organisation"){addTool("Nouvelle tâche","＋",()=>{const d=targetDoc();d?.getElementById("taskForm")?.scrollIntoView({behavior:"smooth",block:"start"});d?.getElementById("title")?.focus()},true);addTool("Archives","▤",()=>clickTarget(null,["archive"]));}
 if(mode==="variables"){addTool("Ajouter une variable","＋",()=>clickTarget("#newVariable",["ajouter une variable"]),true);addTool("Détecter planning","◷",()=>clickTarget("#detectPlanning",["détecter planning"]));addTool("Exporter CSV","⇩",()=>clickTarget("#exportCsv",["export csv"]));}
 if(mode==="temps"){addTool("Convertir","⇄",()=>clickTarget(null,["convertir"]),true);addTool("Réinitialiser","↻",()=>clickTarget(null,["réinitialiser"]));}
 if(mode==="salaire"){addTool("Calculer","=",()=>clickTarget(null,["calculer"]),true);addTool("Réinitialiser","↻",()=>clickTarget(null,["réinitialiser"]));}
 if(mode==="essence"){addTool("Calculer","=",()=>clickTarget("#calculateBtn",["calculer"]),true);addTool("Réinitialiser","↻",()=>clickTarget("#resetBtn",["réinitialiser"]));}
 const spacer=document.createElement("span");spacer.className="iv-spacer";tools.appendChild(spacer);const live=document.createElement("span");live.className="iv-live";live.id="liveMirror";live.textContent="Fonctions d’origine conservées";tools.appendChild(live)
}
let agentsResizeObserver=null,agentsMutationObserver=null;
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
      document.body.style.setProperty("--iv-agents-frame-height",h+"px");
      frame.style.height=h+"px";
    }catch{}
  };
  try{agentsResizeObserver?.disconnect()}catch{}
  try{agentsMutationObserver?.disconnect()}catch{}
  if(window.ResizeObserver){
    agentsResizeObserver=new ResizeObserver(()=>requestAnimationFrame(resize));
    agentsResizeObserver.observe(doc.body);
  }
  agentsMutationObserver=new MutationObserver(()=>requestAnimationFrame(resize));
  agentsMutationObserver.observe(doc.body,{childList:true,subtree:true});
  resize();
  setTimeout(resize,120);
  setTimeout(resize,500);
  setTimeout(resize,1200);
}
function mirrorStatus(){const doc=targetDoc();if(!doc)return;const src=doc.querySelector("#syncStatus,.status.ok,.status.warning");if(src&&src.textContent.trim())$("syncMirror").textContent=src.textContent.trim().slice(0,70);const live=$("liveMirror");if(!live)return;let count="";if(mode==="planning")count=doc.querySelector("#count")?.textContent||"";else if(mode==="infos")count=(doc.querySelector("#count")?.textContent||"")+" chantier(s)";else if(mode==="discipline")count=doc.querySelector("#count")?.textContent||"";else if(mode==="organisation")count=`${doc.querySelectorAll(".task").length} tâche(s)`;else if(mode==="variables")count=(doc.querySelector("#kpiEntries")?.textContent||"0")+" variable(s) ce mois";else if(mode==="essence")count=doc.querySelector("#totalCost")?.textContent||"";live.textContent=count||"Fonctions d’origine conservées"}
function prepareFrame(){const doc=targetDoc();if(!doc)return;addTheme(doc,mode==="kontrol"?"kontrol-cloud":mode);if(mode==="agents")fitAgentsFullPage(doc);if(mode==="kontrol"){const nested=doc.getElementById("kontrolFrame");if(nested){const inject=()=>addTheme(nestedKontrolDoc(),"kontrol");nested.addEventListener("load",()=>setTimeout(inject,60));setTimeout(inject,300);setTimeout(inject,1100)}}buildTools();mirrorStatus();setInterval(mirrorStatus,1200);loading.classList.add("hidden")}
frame.addEventListener("load",()=>setTimeout(prepareFrame,80));
})();