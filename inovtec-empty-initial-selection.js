(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="agents")return;
const frame=document.getElementById("legacyFrame");

function ensureFullAgentsList(){
  let d;try{d=frame?.contentDocument}catch{return}
  if(!d?.head||!d?.body)return;
  const detailsHeader=d.getElementById("selectedChip")?.closest(".cardHeader");
  if(detailsHeader)detailsHeader.style.setProperty("display","none","important");
  let style=d.getElementById("ivAgentsFullListFix");
  if(!style){
    style=d.createElement("style");
    style.id="ivAgentsFullListFix";
    style.textContent=`
      html,body{height:auto!important;min-height:100%!important;overflow-x:hidden!important}
      body{overflow-y:auto!important}
      .app{height:auto!important;min-height:100%!important;overflow:visible!important}
      .content{height:auto!important;min-height:0!important;overflow:visible!important;align-items:start!important}
      .content>.card{height:auto!important;max-height:none!important;align-self:start!important}
      .list{height:auto!important;max-height:none!important;overflow:visible!important;padding-bottom:0!important}
    `;
    d.head.appendChild(style);
  }
  try{
    frame.setAttribute("scrolling","auto");
    frame.style.overflow="auto";
  }catch{}
}

function syncAgentCardVisibility(){
  let d,w;try{d=frame?.contentDocument;w=frame?.contentWindow}catch{return}
  if(!d?.body||!w)return;
  const chip=d.getElementById("selectedChip");
  const form=d.getElementById("agentForm");
  const noMsg=d.getElementById("noAgentMessage");
  const card=(chip||form||noMsg)?.closest(".card");
  if(!card)return;
  const chipText=(chip?.textContent||"").trim().toLowerCase();
  const selected=w.state?.agents?.find?.(a=>a?.id===w.state?.selectedId);
  const hasAgent=!!selected && selected?._deleted!==true;
  if(card.hidden===!hasAgent)return;
  card.hidden=!hasAgent;
  card.setAttribute("aria-hidden",hasAgent?"false":"true");
}

function bindAgentCardVisibility(){
  let d;try{d=frame?.contentDocument}catch{return}
  if(!d?.body||d.documentElement.dataset.ivAgentCardVisibilityBound==="1")return;
  const chip=d.getElementById("selectedChip");
  const form=d.getElementById("agentForm");
  if(!chip&&!form)return;
  d.documentElement.dataset.ivAgentCardVisibilityBound="1";
  const observer=new MutationObserver(()=>syncAgentCardVisibility());
  if(chip)observer.observe(chip,{childList:true,subtree:true,characterData:true});
  if(form)observer.observe(form,{attributes:true,attributeFilter:["style"]});
  syncAgentCardVisibility();
}

function bindUserInteractionGuard(){
  let d;try{d=frame?.contentDocument}catch{return}
  if(!d?.body||d.documentElement.dataset.ivAgentInteractionGuard==="1")return;
  d.documentElement.dataset.ivAgentInteractionGuard="1";
  const mark=()=>{d.documentElement.dataset.ivAgentUserInteracted="1"};
  ["pointerdown","mousedown","touchstart","keydown","input","change","focusin"].forEach(type=>{
    d.addEventListener(type,mark,true);
  });
}

function clearInitialSelection(){
  let d,w;try{d=frame?.contentDocument;w=frame?.contentWindow}catch{return}
  if(!d?.body||!w)return;
  ensureFullAgentsList();
  bindAgentCardVisibility();
  bindUserInteractionGuard();
  if(d.documentElement.dataset.ivInitialSelectionCleared==="1"){
    syncAgentCardVisibility();
    return;
  }
  if(!w.state||typeof w.renderAll!=="function")return;

  // Ne jamais effacer une sélection après que l'utilisateur a commencé à agir.
  // Cela protège aussi bien "Nouvel agent" que la modification d'un agent existant.
  const selected=w.state?.agents?.find?.(a=>a?.id===w.state?.selectedId);
  const userInteracted=d.documentElement.dataset.ivAgentUserInteracted==="1";
  if(userInteracted || selected?._draft===true){
    d.documentElement.dataset.ivInitialSelectionCleared="1";
    syncAgentCardVisibility();
    return;
  }

  d.documentElement.dataset.ivInitialSelectionCleared="1";
  try{
    w.state.selectedId=null;
    w.state.search="";
    const search=d.querySelector('input[type="search"],input[placeholder*="Recher" i]');
    if(search)search.value="";
    w.renderAll();
    ensureFullAgentsList();
    bindAgentCardVisibility();
    syncAgentCardVisibility();
  }catch(e){console.warn("Initialisation vide Classeur Agents",e)}
}

function refreshAgentsPage(){
  ensureFullAgentsList();
  clearInitialSelection();
  bindAgentCardVisibility();
  syncAgentCardVisibility();
}
frame?.addEventListener("load",()=>{
  // L'iframe est complètement chargée à cet instant : initialiser immédiatement
  // évite qu'un reset différé puisse interrompre une saisie utilisateur.
  refreshAgentsPage();
  setTimeout(refreshAgentsPage,250);
  setTimeout(refreshAgentsPage,700);
});
setTimeout(refreshAgentsPage,350);
})();
