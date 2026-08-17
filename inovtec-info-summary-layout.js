(()=>{
"use strict";
const params=new URLSearchParams(location.search);
if((params.get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame"),summary=document.getElementById("pageSummary");
if(!frame||!summary)return;
let lastHtml="",lastDoc=null,rendering=false;
let stableSite="Aucun chantier",stableAgent="Non affecté",stableDisabled=true;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const value=(d,id,fallback)=>{const el=d?.getElementById(id),v=String(el?.value||el?.textContent||"").trim();return v||fallback};
function doc(){try{return frame.contentDocument||null}catch{return null}}
function ensureStyle(){
  if(document.getElementById("ivInfoSummaryActionsStyle"))return;
  const s=document.createElement("style");s.id="ivInfoSummaryActionsStyle";s.textContent=`
  .iv-summary-card.iv-summary-actions-card{align-items:center}.iv-summary-actions-card .iv-summary-copy{flex:1}.iv-summary-action-buttons{display:flex;gap:8px;align-items:center;margin-top:5px;flex-wrap:wrap}.iv-summary-action-btn{border:0;border-radius:11px;min-height:36px;padding:8px 13px;font:800 13px/1 Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;cursor:pointer;white-space:nowrap;transition:transform .08s ease,filter .15s ease,opacity .15s ease}.iv-summary-action-btn:active{transform:translateY(1px)}.iv-summary-action-btn.new{background:#047857;color:#fff}.iv-summary-action-btn.delete{background:#ef2b2d;color:#fff}.iv-summary-action-btn:hover{filter:brightness(.96)}.iv-summary-action-btn:disabled{opacity:.42;cursor:not-allowed;filter:none}.iv-summary-actions-card .iv-summary-note{margin-top:5px}@media(max-width:760px){.iv-summary-action-buttons{gap:5px}.iv-summary-action-btn{min-height:33px;padding:7px 9px;font-size:11px}}
  `;document.head.appendChild(s);
}
function card(icon,label,val,note){return `<article class="iv-summary-card"><span class="iv-summary-icon">${icon}</span><span class="iv-summary-copy"><small class="iv-summary-label">${label}</small><strong class="iv-summary-value">${esc(val)}</strong><span class="iv-summary-note">${note}</span></span></article>`}
function actionsCard(disabled){return `<article class="iv-summary-card iv-summary-actions-card"><span class="iv-summary-icon">＋</span><span class="iv-summary-copy"><small class="iv-summary-label">Actions chantier</small><div class="iv-summary-action-buttons"><button id="ivInfoNewBtn" class="iv-summary-action-btn new" type="button">+ Nouveau</button><button id="ivInfoDeleteBtn" class="iv-summary-action-btn delete" type="button"${disabled?" disabled":""}>Supprimer</button></div><span class="iv-summary-note">Gestion de la fiche</span></span></article>`}
function hideLegacyActions(d){
  const newBtn=d?.getElementById("newBtn"),deleteBtn=d?.getElementById("deleteBtn");
  const wrap=newBtn?.closest(".actions")||deleteBtn?.closest(".actions");
  if(wrap){wrap.style.display="none";wrap.dataset.ivMovedToSummary="1"}
}
function captureStable(d){
  if(!d?.body)return;
  stableSite=value(d,"nom","Aucun chantier");
  stableAgent=value(d,"agentNom","Non affecté");
  stableDisabled=!!d.getElementById("deleteBtn")?.disabled;
}
function render(capture=false){
  const d=doc();if(!d?.body)return;
  ensureStyle();hideLegacyActions(d);
  if(capture)captureStable(d);
  const html=card("⌖","Chantier actif",stableSite,"Fiche sélectionnée")+card("♙","Agent affecté",stableAgent,"Référentiel commun")+actionsCard(stableDisabled);
  if(summary.innerHTML===html){lastHtml=html;return;}
  rendering=true;
  lastHtml=html;
  summary.innerHTML=html;
  rendering=false;
}
function forceNewUi(d){
  const form=d.getElementById("siteForm"),empty=d.getElementById("emptySelection"),state=d.getElementById("recordState");
  form?.classList.remove("hidden");
  empty?.classList.add("hidden");
  if(state){state.textContent="Nouveau";state.className="status";}
  d.querySelectorAll("#siteList .site-item.active").forEach(el=>el.classList.remove("active"));
  try{d.defaultView?.scrollTo({top:0,behavior:"smooth"})}catch{}
  setTimeout(()=>d.getElementById("nom")?.focus(),30);
}
function newStateReady(d){
  const form=d.getElementById("siteForm"),state=(d.getElementById("recordState")?.textContent||"").trim();
  return !!form&&!form.classList.contains("hidden")&&/nouveau/i.test(state)&&!d.querySelector("#siteList .site-item.active");
}
function triggerLegacyNew(d){
  const src=d.getElementById("newBtn");if(!src)return false;
  try{src.click();return true}catch{}
  try{return src.dispatchEvent(new d.defaultView.MouseEvent("click",{bubbles:true,cancelable:true,view:d.defaultView}))}catch{return false}
}
function setNewStable(){stableSite="Aucun chantier";stableAgent="Non affecté";stableDisabled=true;render(false)}
function runNew(){
  const d=doc();if(!d?.body)return;
  triggerLegacyNew(d);forceNewUi(d);setNewStable();
  [60,180,420].forEach(delay=>setTimeout(()=>{
    if(!newStateReady(d))triggerLegacyNew(d);
    forceNewUi(d);
  },delay));
}
function runDelete(){
  const d=doc();if(!d?.body)return;
  const src=d.getElementById("deleteBtn");
  if(src&&!src.disabled)src.click();
  setTimeout(()=>{setNewStable()},120);
}
function bindFrameEvents(d){
  if(!d?.body||d.body.dataset.ivInfoStableSummary==="1")return;
  d.body.dataset.ivInfoStableSummary="1";
  d.addEventListener("click",e=>{
    if(e.target.closest?.("#siteList .site-item"))setTimeout(()=>render(true),0);
  },true);
  const form=d.getElementById("siteForm");
  form?.addEventListener("submit",()=>{
    setTimeout(()=>render(true),80);
    setTimeout(()=>render(true),450);
  },true);
}
document.addEventListener("click",e=>{
  const newBtn=e.target.closest?.("#ivInfoNewBtn");
  if(newBtn){e.preventDefault();e.stopPropagation();runNew();return;}
  const deleteBtn=e.target.closest?.("#ivInfoDeleteBtn");
  if(deleteBtn){e.preventDefault();e.stopPropagation();runDelete();}
},true);
const observer=new MutationObserver(()=>{
  if(rendering)return;
  if(summary.innerHTML!==lastHtml)render(false);
});
observer.observe(summary,{childList:true,subtree:true,characterData:true});
function install(){
  const d=doc();if(!d?.body)return;
  if(d!==lastDoc){lastDoc=d;bindFrameEvents(d);captureStable(d);}
  render(false);
}
frame.addEventListener("load",()=>{setTimeout(install,80);setTimeout(install,350);setTimeout(install,900)});
setTimeout(install,250);
})();
