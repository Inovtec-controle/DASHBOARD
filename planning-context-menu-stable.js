(()=>{
"use strict";
if(window.__INOVTEC_CONTEXT_MENU_STABLE__)return;
window.__INOVTEC_CONTEXT_MENU_STABLE__=true;
let protectUntil=0,lastX=8,lastY=8;
const getMenu=()=>document.getElementById("contextMenu");
const active=()=>performance.now()<protectUntil;
function keepOpen(){
  const m=getMenu();
  if(!m||!active()||!m.children.length)return;
  if(!m.classList.contains("open"))m.classList.add("open");
  requestAnimationFrame(()=>{
    if(!m.classList.contains("open"))return;
    const r=m.getBoundingClientRect();
    m.style.left=Math.max(8,Math.min(lastX,innerWidth-r.width-8))+"px";
    m.style.top=Math.max(8,Math.min(lastY,innerHeight-r.height-8))+"px";
  });
}
function bind(){
  const m=getMenu();if(!m)return;
  document.addEventListener("mouseup",e=>{
    if(e.button===2&&e.target?.closest?.(".agent-row"))e.stopPropagation();
  },true);
  document.addEventListener("contextmenu",e=>{
    if(!e.target?.closest?.(".agent-row"))return;
    lastX=e.clientX;lastY=e.clientY;protectUntil=performance.now()+700;
    [0,40,120,260].forEach(ms=>setTimeout(keepOpen,ms));
  },true);
  new MutationObserver(()=>{if(active()&&!m.classList.contains("open"))setTimeout(keepOpen,0)}).observe(m,{attributes:true,attributeFilter:["class"]});
  document.addEventListener("mousedown",e=>{
    if(e.button===0&&!e.target?.closest?.("#contextMenu")&&!e.target?.closest?.(".agent-row"))protectUntil=0;
  },true);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
