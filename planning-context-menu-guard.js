(()=>{
"use strict";
if(window.__INOVTEC_CONTEXT_MENU_GUARD__)return;
window.__INOVTEC_CONTEXT_MENU_GUARD__=true;

const nativeDispatch=window.dispatchEvent.bind(window);
let pendingPlanningRefresh=false;

function menuOpen(){
  return !!document.getElementById("contextMenu")?.classList.contains("open");
}

window.dispatchEvent=function(event){
  if(menuOpen()){
    if(event?.type==="inovtec:planning-cloud-updated"){
      pendingPlanningRefresh=true;
      return true;
    }
    if(event?.type==="resize"&&!event.isTrusted){
      return true;
    }
  }
  return nativeDispatch(event);
};

function flushWhenClosed(){
  if(!pendingPlanningRefresh||menuOpen())return;
  pendingPlanningRefresh=false;
  setTimeout(()=>nativeDispatch(new Event("inovtec:planning-cloud-updated")),60);
}

function bind(){
  const menu=document.getElementById("contextMenu");
  if(!menu)return;
  new MutationObserver(flushWhenClosed).observe(menu,{attributes:true,attributeFilter:["class"]});
  document.addEventListener("contextmenu",e=>{
    if(e.target?.closest?.(".agent-row"))setTimeout(()=>{
      if(menu.classList.contains("open"))menu.dispatchEvent(new Event("iv:context-menu-open"));
    },0);
  },true);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
