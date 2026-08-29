(()=>{
"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="planning")return;
if(window.__INOVTEC_CONTAINER_PLANNING_LINK_STABLE__)return;
window.__INOVTEC_CONTAINER_PLANNING_LINK_STABLE__=true;

const frame=document.getElementById("legacyFrame");
let lastDoc=null,lastSignature="";
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function sites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function selectedSite(d){
  const id=d?.getElementById("edTitle")?.value||"";
  return sites().find(c=>String(c.id)===String(id))||null;
}
function ensureStyle(d){
  if(d.getElementById("ivContainerPlanningStyle"))return;
  const s=d.createElement("style");
  s.id="ivContainerPlanningStyle";
  s.textContent="#ivPlanningContainerInfo{margin:-2px 8px 7px 28px;padding:7px 9px;border-radius:9px;background:#eef8f3;color:#285847;font-size:10px;line-height:1.35;border:1px solid #d6ebe0}#ivPlanningContainerInfo strong{color:#0b6b43}";
  d.head.appendChild(s);
}
function render(){
  const d=doc(),api=window.InovtecContainerSchedule;
  if(!d?.body||!api)return;
  ensureStyle(d);
  const select=d.getElementById("edTitle"),date=d.getElementById("edDate");
  if(!select||!date)return;

  let box=d.getElementById("ivPlanningContainerInfo");
  if(!box){
    box=d.createElement("div");
    box.id="ivPlanningContainerInfo";
    const ref=d.getElementById("ivPlanningSiteInfo")||select.closest(".editor-row");
    ref?.insertAdjacentElement("afterend",box);
  }
  if(!box)return;

  const site=selectedSite(d),day=api.dayKeyFromDate(date.value);
  if(!site||!day){
    const sig="hidden";
    if(lastSignature!==sig){
      lastSignature=sig;
      box.hidden=true;
      if(box.innerHTML)box.innerHTML="";
    }
    return;
  }

  const actions=typeof api.actionsForDate==="function"
    ?api.actionsForDate(site,date.value)
    :api.actionsForDay(site,day);

  const html=actions.length
    ?`<strong>Conteneurs :</strong> ${actions.map(x=>x.label).join(" · ")} prévu${actions.length>1?"es":"e"} ce jour.`
    :"<strong>Conteneurs :</strong> aucune sortie ou rentrée prévue ce jour (jour ou alternance de semaine).";

  const sig=[String(site.id||""),String(date.value||""),html].join("|");
  if(lastSignature===sig)return;
  lastSignature=sig;
  box.hidden=false;
  if(box.innerHTML!==html)box.innerHTML=html;
}
function install(){
  const d=doc();
  if(!d?.body)return;
  render();
  if(d===lastDoc)return;
  lastDoc=d;
  lastSignature="";
  const select=d.getElementById("edTitle"),date=d.getElementById("edDate");
  select?.addEventListener("change",()=>{lastSignature="";render()});
  date?.addEventListener("change",()=>{lastSignature="";render()});
  /* Aucun MutationObserver global ici :
     le script ne doit jamais réagir à ses propres modifications DOM. */
}
frame?.addEventListener("load",()=>{
  lastDoc=null;
  lastSignature="";
  setTimeout(install,180);
  setTimeout(install,700);
});
setTimeout(install,550);
try{window.InovtecDataHub?.subscribe?.(()=>{lastSignature="";render()})}catch{}
window.addEventListener("inovtec:container-schedule-updated",()=>{lastSignature="";render()});
})();