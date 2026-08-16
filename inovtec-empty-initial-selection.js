(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="agents")return;
const frame=document.getElementById("legacyFrame");
function clearInitialSelection(){
  let d,w;try{d=frame?.contentDocument;w=frame?.contentWindow}catch{return}
  if(!d?.body||!w||d.documentElement.dataset.ivInitialSelectionCleared==="1")return;
  if(!w.state||typeof w.renderAll!=="function")return;
  d.documentElement.dataset.ivInitialSelectionCleared="1";
  try{
    w.state.selectedId=null;
    w.state.search="";
    const search=d.querySelector('input[type="search"],input[placeholder*="Recher" i]');
    if(search)search.value="";
    w.renderAll();
  }catch(e){console.warn("Initialisation vide Classeur Agents",e)}
}
frame?.addEventListener("load",()=>{setTimeout(clearInitialSelection,100);setTimeout(clearInitialSelection,500);setTimeout(clearInitialSelection,1200)});
setTimeout(clearInitialSelection,450);
})();
