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

function clearInitialSelection(){
  let d,w;try{d=frame?.contentDocument;w=frame?.contentWindow}catch{return}
  if(!d?.body||!w)return;
  ensureFullAgentsList();
  if(d.documentElement.dataset.ivInitialSelectionCleared==="1")return;
  if(!w.state||typeof w.renderAll!=="function")return;
  d.documentElement.dataset.ivInitialSelectionCleared="1";
  try{
    w.state.selectedId=null;
    w.state.search="";
    const search=d.querySelector('input[type="search"],input[placeholder*="Recher" i]');
    if(search)search.value="";
    w.renderAll();
    ensureFullAgentsList();
  }catch(e){console.warn("Initialisation vide Classeur Agents",e)}
}

function refreshAgentsPage(){ensureFullAgentsList();clearInitialSelection()}
frame?.addEventListener("load",()=>{
  setTimeout(refreshAgentsPage,60);
  setTimeout(refreshAgentsPage,250);
  setTimeout(refreshAgentsPage,700);
  setTimeout(refreshAgentsPage,1400);
});
setTimeout(refreshAgentsPage,350);
})();
