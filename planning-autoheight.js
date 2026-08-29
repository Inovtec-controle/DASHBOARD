(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_AUTOHEIGHT_STABLE__)return;
window.__INOVTEC_PLANNING_AUTOHEIGHT_STABLE__=true;

let raf=0,lastHeight=0,resizeObserver=null;
const setStyle=(el,prop,value)=>{
  if(!el)return;
  if(el.style[prop]!==value)el.style[prop]=value;
};
function fitColumns(){
  const head=document.getElementById("weekHead");
  if(head){
    const count=Math.max(1,head.children.length-1);
    const rail=window.innerWidth<=720?52:62;
    const value=`${rail}px repeat(${count},minmax(0,1fr))`;
    setStyle(head,"gridTemplateColumns",value);
  }
  const body=document.querySelector(".calendar-body");
  if(body){
    const rail=window.innerWidth<=720?52:62;
    setStyle(body,"gridTemplateColumns",`${rail}px minmax(0,1fr)`);
  }
}
function fit(){
  if(raf)return;
  raf=requestAnimationFrame(()=>{
    raf=0;
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
      if(frame){
        if(frame.style.height!==height+"px")frame.style.height=height+"px";
        if(frame.style.minHeight!==height+"px")frame.style.minHeight=height+"px";
        if(frame.getAttribute("scrolling")!=="no")frame.setAttribute("scrolling","no");
      }
      if(stage){
        setStyle(stage,"height","auto");
        setStyle(stage,"minHeight",height+"px");
        setStyle(stage,"overflow","visible");
      }
      if(main){
        setStyle(main,"height","auto");
        setStyle(main,"minHeight","100dvh");
        setStyle(main,"overflow","visible");
      }
      setStyle(pd.body,"overflowY","auto");
      setStyle(pd.body,"overflowX","hidden");
      setStyle(pd.documentElement,"overflowY","auto");
      setStyle(pd.documentElement,"overflowX","hidden");
    }catch(e){console.warn("Planning auto-height",e)}
  });
}
const mo=new MutationObserver(mutations=>{
  if(mutations.some(m=>m.type==="childList"))fit();
});
function start(){
  fit();
  /* Important : on n'observe plus les attributs/style, sinon fit() déclenche
     lui-même le MutationObserver et crée une boucle permanente. */
  mo.observe(document.body,{subtree:true,childList:true});
  if(window.ResizeObserver){
    resizeObserver=new ResizeObserver(()=>fit());
    resizeObserver.observe(document.querySelector(".planner-shell")||document.body);
  }
  window.addEventListener("resize",fit,{passive:true});
  setInterval(()=>{if(!document.hidden)fit()},5000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();