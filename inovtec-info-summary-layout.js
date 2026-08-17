(()=>{
"use strict";
const params=new URLSearchParams(location.search);
if((params.get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame"),summary=document.getElementById("pageSummary");
if(!frame||!summary)return;
let lastHtml="",timer=null,lastDoc=null;
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
function runNew(){
  const d=doc();if(!d?.body)return;
  triggerLegacyNew(d);forceNewUi(d);
  [60,180,420].forEach(delay=>setTimeout(()=>{
    if(!newStateReady(d))triggerLegacyNew(d);
    forceNewUi(d);render();
  },delay));
}
function runDelete(){
  const d=doc();if(!d?.body)return;
  const src=d.getElementById("deleteBtn");
  if(src&&!src.disabled)src.click();
  setTimeout(render,80);setTimeout(render,500);
}
document.addEventListener("click",e=>{
  const newBtn=e.target.closest?.("#ivInfoNewBtn");
  if(newBtn){e.preventDefault();e.stopPropagation();runNew();return;}
  const deleteBtn=e.target.closest?.("#ivInfoDeleteBtn");
  if(deleteBtn){e.preventDefault();e.stopPropagation();runDelete();}
},true);
function render(){
  const d=doc();if(!d?.body)return;
  ensureStyle();hideLegacyActions(d);
  const site=value(d,"nom","Aucun chantier"),agent=value(d,"agentNom","Non affecté"),disabled=!!d.getElementById("deleteBtn")?.disabled;
  const html=card("⌖","Chantier actif",site,"Fiche sélectionnée")+card("♙","Agent affecté",agent,"Référentiel commun")+actionsCard(disabled);
  if(html!==lastHtml||summary.innerHTML!==html){lastHtml=html;summary.innerHTML=html}
  if(d!==lastDoc){lastDoc=d;["input","change","click"].forEach(type=>d.addEventListener(type,()=>{clearTimeout(timer);timer=setTimeout(render,90)},true))}
}
const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(render,20)});observer.observe(summary,{childList:true,subtree:true,characterData:true});
frame.addEventListener("load",()=>{setTimeout(render,80);setTimeout(render,350);setTimeout(render,900)});
setInterval(render,700);setTimeout(render,250);
})();
