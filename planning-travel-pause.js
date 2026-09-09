(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_TRAVEL_PAUSE_V1__)return;
window.__INOVTEC_PLANNING_TRAVEL_PAUSE_V1__=true;

const pop=document.getElementById("editorPopover");
const title=document.getElementById("edTitle");
if(!pop||!title)return;

const SPECIAL={
  travel:{label:"Déplacement",icon:"↔"},
  break:{label:"Pause",icon:"☕"}
};
let currentKind="";

function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function kindFromLabel(v){
  const n=norm(v);
  if(n==="deplacement")return "travel";
  if(n==="pause")return "break";
  return "";
}
function legacyOption(){return [...title.options].find(o=>o.value==="__legacy__")||null}
function ensureLegacyOption(){
  let o=legacyOption();
  if(!o){o=document.createElement("option");o.value="__legacy__";title.appendChild(o)}
  return o;
}
function ensureStyle(){
  if(document.getElementById("ivPlanningTravelPauseStyle"))return;
  const s=document.createElement("style");
  s.id="ivPlanningTravelPauseStyle";
  s.textContent=`
    #ivPlanningSiteInfo.iv-planning-special-choices{margin:-2px 8px 7px 28px;display:grid;grid-template-columns:1fr 1fr;gap:7px;background:transparent!important;border:0!important;padding:0!important;color:inherit!important}
    #ivPlanningSiteInfo .iv-planning-special-btn{appearance:none;border:1px solid #cfe7db;background:#f4fbf7;color:#245a45;border-radius:10px;min-height:34px;padding:7px 10px;font:600 11px/1.15 Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease,transform .05s ease}
    #ivPlanningSiteInfo .iv-planning-special-btn:hover{background:#eaf7f0;border-color:#add8c3}
    #ivPlanningSiteInfo .iv-planning-special-btn:active{transform:translateY(1px)}
    #ivPlanningSiteInfo .iv-planning-special-btn.active{background:#dff3e8;border-color:#79bf98;color:#0b6b43;box-shadow:0 0 0 2px rgba(11,107,67,.08) inset}
    #ivPlanningSiteInfo .iv-planning-special-icon{font-size:14px;line-height:1}
  `;
  document.head.appendChild(s);
}
function hideOldHint(){
  [...pop.querySelectorAll("div,p,span")].forEach(el=>{
    if(el.closest("#ivPlanningSiteInfo"))return;
    const t=String(el.textContent||"").replace(/\s+/g," ").trim();
    if(/^Sélectionne un chantier d['’]Infos chantier\.?$/i.test(t))el.style.display="none";
  });
}
function ensureChoices(){
  ensureStyle();
  let box=document.getElementById("ivPlanningSiteInfo");
  if(!box){
    box=document.createElement("div");
    box.id="ivPlanningSiteInfo";
    title.closest(".editor-row")?.insertAdjacentElement("afterend",box);
  }
  box.className="iv-planning-special-choices";
  if(!box.querySelector("[data-iv-special]")){
    box.innerHTML=`
      <button type="button" class="iv-planning-special-btn" data-iv-special="travel" aria-pressed="false"><span class="iv-planning-special-icon" aria-hidden="true">↔</span><span>Déplacement</span></button>
      <button type="button" class="iv-planning-special-btn" data-iv-special="break" aria-pressed="false"><span class="iv-planning-special-icon" aria-hidden="true">☕</span><span>Pause</span></button>`;
    box.querySelectorAll("[data-iv-special]").forEach(btn=>btn.addEventListener("click",()=>setKind(btn.dataset.ivSpecial)));
  }
  hideOldHint();
  return box;
}
function syncButtons(){
  const box=ensureChoices();
  box.querySelectorAll("[data-iv-special]").forEach(btn=>{
    const on=btn.dataset.ivSpecial===currentKind;
    btn.classList.toggle("active",on);
    btn.setAttribute("aria-pressed",on?"true":"false");
  });
}
function setKind(kind){
  const item=SPECIAL[kind];
  if(!item)return;
  currentKind=kind;
  const o=ensureLegacyOption();
  o.textContent="Choisir un chantier…";
  title.dataset.legacyTitle=item.label;
  title.value="__legacy__";
  syncButtons();
  title.dispatchEvent(new Event("change",{bubbles:true}));
}
function detectFromEditor(){
  const label=title.dataset.legacyTitle||((title.value==="__legacy__"&&legacyOption())?legacyOption().textContent:"");
  currentKind=kindFromLabel(label);
  if(currentKind){
    const o=ensureLegacyOption();
    o.textContent="Choisir un chantier…";
    title.dataset.legacyTitle=SPECIAL[currentKind].label;
    title.value="__legacy__";
  }
  syncButtons();
}
function clearSpecialIfChantier(){
  if(title.value==="__legacy__"){
    detectFromEditor();
    return;
  }
  if(currentKind||kindFromLabel(title.dataset.legacyTitle)){
    currentKind="";
    title.dataset.legacyTitle="";
    const o=legacyOption();
    if(o&&title.value!=="__legacy__")o.remove();
  }
  syncButtons();
}

ensureChoices();
title.addEventListener("change",clearSpecialIfChantier);
const popObserver=new MutationObserver(()=>{
  ensureChoices();
  if(pop.classList.contains("open"))requestAnimationFrame(detectFromEditor);
  else{currentKind="";syncButtons()}
});
popObserver.observe(pop,{attributes:true,attributeFilter:["class"]});

/* Certains modules du shell sont injectés après le chargement de l'iframe.
   On garantit donc que la rangée garde sa place sans observer tout le document. */
setTimeout(ensureChoices,250);
setTimeout(ensureChoices,900);
})();
