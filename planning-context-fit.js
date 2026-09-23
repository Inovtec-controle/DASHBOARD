(()=>{
"use strict";
const MARGIN=8;
let raf=0;
function visibleBounds(){
  let left=MARGIN,top=MARGIN,right=Math.max(MARGIN,innerWidth-MARGIN),bottom=Math.max(MARGIN,innerHeight-MARGIN);
  try{
    if(parent&&parent!==window){
      const frame=window.frameElement||parent.document.getElementById("legacyFrame");
      if(frame){
        const fr=frame.getBoundingClientRect(),vv=parent.visualViewport;
        const vpLeft=vv?.offsetLeft||0,vpTop=vv?.offsetTop||0;
        const vpWidth=vv?.width||parent.innerWidth,vpHeight=vv?.height||parent.innerHeight;
        left=Math.max(left,vpLeft-fr.left+MARGIN);
        top=Math.max(top,vpTop-fr.top+MARGIN);
        right=Math.min(right,vpLeft+vpWidth-fr.left-MARGIN);
        bottom=Math.min(bottom,vpTop+vpHeight-fr.top-MARGIN);
      }
    }
  }catch{}
  if(right<=left){left=MARGIN;right=Math.max(left,innerWidth-MARGIN)}
  if(bottom<=top){top=MARGIN;bottom=Math.max(top,innerHeight-MARGIN)}
  return{left,top,right,bottom};
}
function fitContextMenu(){
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(()=>{
    const menu=document.getElementById("contextMenu");
    if(!menu?.classList.contains("open"))return;
    const bounds=visibleBounds();
    const availableWidth=Math.max(160,bounds.right-bounds.left);
    const availableHeight=Math.max(140,bounds.bottom-bounds.top);
    menu.style.maxWidth=Math.floor(availableWidth)+"px";
    menu.style.maxHeight=Math.floor(availableHeight)+"px";
    menu.style.overflowY="auto";
    menu.style.overscrollBehavior="contain";
    const rect=menu.getBoundingClientRect();
    const currentLeft=parseFloat(menu.style.left),currentTop=parseFloat(menu.style.top);
    const wantedLeft=Number.isFinite(currentLeft)?currentLeft:bounds.left;
    const wantedTop=Number.isFinite(currentTop)?currentTop:bounds.top;
    const maxLeft=Math.max(bounds.left,bounds.right-rect.width);
    const maxTop=Math.max(bounds.top,bounds.bottom-rect.height);
    menu.style.left=Math.max(bounds.left,Math.min(wantedLeft,maxLeft))+"px";
    menu.style.top=Math.max(bounds.top,Math.min(wantedTop,maxTop))+"px";
  });
}
function start(){
  const menu=document.getElementById("contextMenu");
  if(!menu)return;
  new MutationObserver(fitContextMenu).observe(menu,{attributes:true,attributeFilter:["class"],childList:true,subtree:true});
  if(window.ResizeObserver)new ResizeObserver(fitContextMenu).observe(menu);
  window.addEventListener("resize",fitContextMenu,{passive:true});
  document.addEventListener("scroll",fitContextMenu,true);
  try{
    if(parent&&parent!==window){
      parent.addEventListener("scroll",fitContextMenu,{passive:true});
      parent.addEventListener("resize",fitContextMenu,{passive:true});
      parent.visualViewport?.addEventListener("scroll",fitContextMenu,{passive:true});
      parent.visualViewport?.addEventListener("resize",fitContextMenu,{passive:true});
    }
  }catch{}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
