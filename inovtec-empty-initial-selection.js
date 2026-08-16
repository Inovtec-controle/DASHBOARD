(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="agents")return;
const frame=document.getElementById("legacyFrame");

function ensureFullAgentsList(){
  let d;try{d=frame?.contentDocument}catch{return}
  if(!d?.head||!d?.body)return;
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
  const hasAgent=!!w.state?.selectedId && chipText!=="aucun";
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

function clearInitialSelection(){
  let d,w;try{d=frame?.contentDocument;w=frame?.contentWindow}catch{return}
  if(!d?.body||!w)return;
  ensureFullAgentsList();
  bindAgentCardVisibility();
  if(d.documentElement.dataset.ivInitialSelectionCleared==="1"){
    syncAgentCardVisibility();
    return;
  }
  if(!w.state||typeof w.renderAll!=="function")return;
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
  setTimeout(refreshAgentsPage,60);
  setTimeout(refreshAgentsPage,250);
  setTimeout(refreshAgentsPage,700);
  setTimeout(refreshAgentsPage,1400);
});
setTimeout(refreshAgentsPage,350);
})();
