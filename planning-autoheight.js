(()=>{
"use strict";
let raf=0,lastHeight=0;
function fitColumns(){
  const head=document.getElementById("weekHead");
  if(head){
    const count=Math.max(1,head.children.length-1);
    const rail=window.innerWidth<=720?52:62;
    head.style.gridTemplateColumns=`${rail}px repeat(${count},minmax(0,1fr))`;
  }
  const body=document.querySelector(".calendar-body");
  if(body){
    const rail=window.innerWidth<=720?52:62;
    body.style.gridTemplateColumns=`${rail}px minmax(0,1fr)`;
  }
}
function fit(){
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(()=>{
    fitColumns();
    const shell=document.querySelector(".planner-shell");
    if(!shell)return;
    const height=Math.max(420,Math.ceil(shell.getBoundingClientRect().height));
    if(Math.abs(height-lastHeight)<2)return;
    lastHeight=height;
    try{
      const pd=parent.document;
      const frame=pd.getElementById("legacyFrame");
      const stage=pd.querySelector(".iv-stage");
      const main=pd.querySelector(".iv-main");
      if(frame){frame.style.height=height+"px";frame.style.minHeight=height+"px";frame.setAttribute("scrolling","no");}
      if(stage){stage.style.height="auto";stage.style.minHeight=height+"px";stage.style.overflow="visible";}
      if(main){main.style.height="auto";main.style.minHeight="100dvh";main.style.overflow="visible";}
      pd.body.style.overflowY="auto";
      pd.body.style.overflowX="hidden";
      pd.documentElement.style.overflowY="auto";
      pd.documentElement.style.overflowX="hidden";
    }catch(e){console.warn("Planning auto-height",e)}
  });
}
const mo=new MutationObserver(fit);
const start=()=>{
  fit();
  mo.observe(document.body,{subtree:true,childList:true,attributes:true});
  if(window.ResizeObserver)new ResizeObserver(fit).observe(document.querySelector(".planner-shell")||document.body);
  window.addEventListener("resize",fit,{passive:true});
  setInterval(fit,1500);
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
