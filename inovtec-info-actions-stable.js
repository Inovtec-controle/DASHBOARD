(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame");
const summary=document.getElementById("pageSummary");
if(!frame||!summary)return;

function legacyDoc(){
  try{return frame.contentDocument||null}catch{return null}
}

function ensureStyle(){
  if(document.getElementById("ivInfoStableActionsStyle"))return;
  const style=document.createElement("style");
  style.id="ivInfoStableActionsStyle";
  style.textContent=`
    #ivInfoActionsCard{align-items:center}
    #ivInfoActionsCard .iv-summary-copy{flex:1}
    #ivInfoActionsCard .iv-info-actions{display:flex;gap:8px;align-items:center;margin-top:5px;flex-wrap:wrap}
    #ivInfoActionsCard button{border:0;border-radius:11px;min-height:36px;padding:8px 13px;font:800 13px/1 Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;cursor:pointer;white-space:nowrap}
    #ivInfoNewStable{background:#047857;color:#fff}
    #ivInfoDeleteStable{background:#ef2b2d;color:#fff}
    #ivInfoActionsCard button:disabled{opacity:.4;cursor:not-allowed}
    @media(max-width:760px){#ivInfoActionsCard .iv-info-actions{gap:5px}#ivInfoActionsCard button{min-height:33px;padding:7px 9px;font-size:11px}}
  `;
  document.head.appendChild(style);
}

function hideNativeActions(d){
  const newBtn=d?.getElementById("newBtn");
  const deleteBtn=d?.getElementById("deleteBtn");
  const wrap=newBtn?.closest(".actions")||deleteBtn?.closest(".actions");
  if(wrap)wrap.style.display="none";
}

function ensureCard(){
  ensureStyle();
  let card=document.getElementById("ivInfoActionsCard");
  if(!card){
    card=document.createElement("article");
    card.id="ivInfoActionsCard";
    card.className="iv-summary-card";
    card.innerHTML=`<span class="iv-summary-icon">＋</span><span class="iv-summary-copy"><small class="iv-summary-label">Actions chantier</small><div class="iv-info-actions"><button id="ivInfoNewStable" type="button">+ Nouveau</button><button id="ivInfoDeleteStable" type="button">Supprimer</button></div><span class="iv-summary-note">Gestion de la fiche</span></span>`;
    summary.appendChild(card);
  }
  const d=legacyDoc();
  hideNativeActions(d);
  const del=document.getElementById("ivInfoDeleteStable");
  if(del)del.disabled=!d?.getElementById("deleteBtn")||d.getElementById("deleteBtn").disabled;
}

document.addEventListener("click",event=>{
  const target=event.target;
  if(!(target instanceof Element))return;
  if(target.closest("#ivInfoNewStable")){
    event.preventDefault();
    const d=legacyDoc();
    const btn=d?.getElementById("newBtn");
    if(btn)btn.click();
    setTimeout(ensureCard,60);
    setTimeout(ensureCard,250);
    return;
  }
  if(target.closest("#ivInfoDeleteStable")){
    event.preventDefault();
    const d=legacyDoc();
    const btn=d?.getElementById("deleteBtn");
    if(btn&&!btn.disabled)btn.click();
    setTimeout(ensureCard,80);
    setTimeout(ensureCard,400);
  }
},true);

const observer=new MutationObserver(()=>ensureCard());
observer.observe(summary,{childList:true});
frame.addEventListener("load",()=>{
  setTimeout(ensureCard,80);
  setTimeout(ensureCard,350);
  setTimeout(ensureCard,900);
});
setTimeout(ensureCard,250);
})();
