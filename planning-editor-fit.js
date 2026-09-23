(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_EDITOR_FIT_V3__)return;
window.__INOVTEC_PLANNING_EDITOR_FIT_V3__=true;

const pop=document.getElementById("editorPopover");
if(!pop)return;

const style=document.createElement("style");
style.id="ivPlanningEditorFitStyleV3";
style.textContent=`
#editorPopover{
  max-height:calc(100dvh - 24px)!important;
  overflow-y:auto!important;
  overscroll-behavior:contain;
  scrollbar-gutter:stable;
}
#editorPopover .editor-actions{
  position:sticky!important;
  bottom:0!important;
  z-index:20!important;
  background:rgba(255,255,255,.98)!important;
  margin-left:-13px;
  margin-right:-13px;
  margin-bottom:-13px;
  padding:10px 13px 13px;
  backdrop-filter:blur(12px);
  box-shadow:0 -6px 12px rgba(15,23,42,.04);
}
@media (max-height:760px){
  #editorPopover{padding:9px!important}
  #editorPopover .editor-row{margin-bottom:5px!important}
  #editorPopover .editor-field,
  #editorPopover .editor-textarea,
  #editorPopover .editor-select{padding:5px 7px!important}
  #editorPopover .editor-textarea{min-height:38px!important;max-height:56px!important}
  #editorPopover .editor-actions{
    margin-top:5px!important;
    margin-left:-9px;
    margin-right:-9px;
    margin-bottom:-9px;
    padding:7px 9px 9px;
  }
}
@media (max-width:720px){
  #editorPopover.open{
    left:12px!important;
    right:12px!important;
    top:12px!important;
    bottom:auto!important;
    width:auto!important;
    max-width:none!important;
    max-height:calc(100dvh - 24px)!important;
    overflow-y:auto!important;
  }
}
`;
document.head.appendChild(style);

let fitting=false;

function ownViewport(){
  const vv=window.visualViewport;
  if(vv){
    return{
      left:vv.offsetLeft||0,
      top:vv.offsetTop||0,
      width:vv.width||window.innerWidth,
      height:vv.height||window.innerHeight
    };
  }
  return{left:0,top:0,width:window.innerWidth,height:window.innerHeight};
}

/* Dans le Dashboard, l'iframe Planning peut être plus haute que la zone réellement
   visible du navigateur. On calcule donc l'intersection entre l'iframe et le viewport
   du parent, puis on la convertit en coordonnées du Planning. */
function visibleViewport(){
  const local=ownViewport();
  try{
    if(parent===window)return local;
    let frame=parent.document.getElementById("legacyFrame");
    if(frame?.contentWindow!==window){
      frame=[...parent.document.querySelectorAll("iframe")].find(f=>f.contentWindow===window)||null;
    }
    if(!frame)return local;

    const fr=frame.getBoundingClientRect();
    const pvv=parent.visualViewport;
    const pLeft=pvv?.offsetLeft||0;
    const pTop=pvv?.offsetTop||0;
    const pWidth=pvv?.width||parent.innerWidth;
    const pHeight=pvv?.height||parent.innerHeight;

    const left=Math.max(0,pLeft-fr.left);
    const top=Math.max(0,pTop-fr.top);
    const right=Math.min(window.innerWidth,pLeft+pWidth-fr.left);
    const bottom=Math.min(window.innerHeight,pTop+pHeight-fr.top);

    if(right-left>180&&bottom-top>140){
      return{left,top,width:right-left,height:bottom-top};
    }
  }catch{}
  return local;
}

function forcePx(prop,value){
  pop.style.setProperty(prop,`${Math.round(value)}px`,"important");
}

function fitEditor(){
  if(fitting||!pop.classList.contains("open"))return;
  fitting=true;
  try{
    const v=visibleViewport();
    const margin=12;
    const availableW=Math.max(220,v.width-margin*2);
    const availableH=Math.max(160,v.height-margin*2);
    const minLeft=v.left+margin;
    const maxRight=v.left+v.width-margin;
    const minTop=v.top+margin;
    const maxBottom=v.top+v.height-margin;

    pop.style.setProperty("max-height",`${Math.floor(availableH)}px`,"important");
    pop.style.setProperty("overflow-y","auto","important");

    /* Évite de conserver une largeur réduite après un changement de taille d'écran. */
    if(v.width>720)pop.style.removeProperty("width");

    let r=pop.getBoundingClientRect();
    if(r.width>availableW){
      pop.style.setProperty("width",`${Math.floor(availableW)}px`,"important");
      r=pop.getBoundingClientRect();
    }

    let left=r.left;
    let top=r.top;

    if(r.right>maxRight)left-=r.right-maxRight;
    if(left<minLeft)left=minLeft;

    /* Le bas (boutons Terminé/Supprimer) est prioritaire : il doit toujours rester
       dans l'écran. Si le contenu est plus haut, la bulle devient scrollable. */
    if(r.bottom>maxBottom)top-=r.bottom-maxBottom;
    if(top<minTop)top=minTop;

    pop.style.setProperty("right","auto","important");
    pop.style.setProperty("bottom","auto","important");
    forcePx("left",left);
    forcePx("top",top);

    requestAnimationFrame(()=>{
      if(!pop.classList.contains("open"))return;
      const vv=visibleViewport();
      const minL=vv.left+margin;
      const maxR=vv.left+vv.width-margin;
      const minT=vv.top+margin;
      const maxB=vv.top+vv.height-margin;
      const rr=pop.getBoundingClientRect();

      if(rr.bottom>maxB)forcePx("top",Math.max(minT,maxB-rr.height));
      if(rr.top<minT)forcePx("top",minT);
      if(rr.right>maxR)forcePx("left",Math.max(minL,maxR-rr.width));
      if(rr.left<minL)forcePx("left",minL);
    });
  }finally{
    fitting=false;
  }
}

function scheduleFit(){requestAnimationFrame(()=>requestAnimationFrame(fitEditor));}

const observer=new MutationObserver(mutations=>{
  if(mutations.some(m=>m.attributeName==="class"))scheduleFit();
});
observer.observe(pop,{attributes:true,attributeFilter:["class"]});

new ResizeObserver(scheduleFit).observe(pop);
window.addEventListener("resize",scheduleFit,{passive:true});
window.addEventListener("scroll",scheduleFit,{passive:true});
window.addEventListener("orientationchange",scheduleFit,{passive:true});
window.visualViewport?.addEventListener("resize",scheduleFit,{passive:true});
window.visualViewport?.addEventListener("scroll",scheduleFit,{passive:true});
document.addEventListener("pointerup",scheduleFit,true);
document.addEventListener("focusin",e=>{if(pop.contains(e.target))scheduleFit()},true);

try{
  parent.addEventListener("scroll",scheduleFit,{passive:true,capture:true});
  parent.addEventListener("resize",scheduleFit,{passive:true});
  parent.visualViewport?.addEventListener("resize",scheduleFit,{passive:true});
  parent.visualViewport?.addEventListener("scroll",scheduleFit,{passive:true});
}catch{}

scheduleFit();
})();
