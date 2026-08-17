(()=>{
"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="planning")return;
const frame=document.getElementById("legacyFrame");
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function sites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function selectedSite(d){const id=d?.getElementById("edTitle")?.value||"";return sites().find(c=>String(c.id)===String(id))||null}
function ensureStyle(d){if(d.getElementById("ivContainerPlanningStyle"))return;const s=d.createElement("style");s.id="ivContainerPlanningStyle";s.textContent="#ivPlanningContainerInfo{margin:-2px 8px 7px 28px;padding:7px 9px;border-radius:9px;background:#eef8f3;color:#285847;font-size:10px;line-height:1.35;border:1px solid #d6ebe0}#ivPlanningContainerInfo strong{color:#0b6b43}";d.head.appendChild(s)}
function render(){const d=doc(),api=window.InovtecContainerSchedule;if(!d?.body||!api)return;ensureStyle(d);const select=d.getElementById("edTitle"),date=d.getElementById("edDate");if(!select||!date)return;let box=d.getElementById("ivPlanningContainerInfo");if(!box){box=d.createElement("div");box.id="ivPlanningContainerInfo";const ref=d.getElementById("ivPlanningSiteInfo")||select.closest(".editor-row");ref?.insertAdjacentElement("afterend",box)}if(!box)return;const site=selectedSite(d),day=api.dayKeyFromDate(date.value);if(!site||!day){box.hidden=true;return}const actions=api.actionsForDay(site,day);box.hidden=false;if(actions.length){box.innerHTML=`<strong>Conteneurs :</strong> ${actions.map(x=>x.label).join(" · ")} prévu${actions.length>1?"es":"e"} ce jour.`}else box.innerHTML="<strong>Conteneurs :</strong> aucune sortie ou rentrée prévue ce jour."}
function install(){const d=doc();if(!d?.body)return;render();if(d.documentElement.dataset.ivContainerPlanningBound==="1")return;d.documentElement.dataset.ivContainerPlanningBound="1";d.getElementById("edTitle")?.addEventListener("change",render);d.getElementById("edDate")?.addEventListener("change",render);new MutationObserver(render).observe(d.body,{childList:true,subtree:true})}
frame?.addEventListener("load",()=>{setTimeout(install,250);setTimeout(install,900)});setTimeout(install,700);try{window.InovtecDataHub?.subscribe?.(()=>render())}catch{}
})();
