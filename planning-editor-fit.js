(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_EDITOR_FIT_V1__)return;
window.__INOVTEC_PLANNING_EDITOR_FIT_V1__=true;

const pop=document.getElementById("editorPopover");
if(!pop)return;

const style=document.createElement("style");
style.id="ivPlanningEditorFitStyle";
style.textContent=`
#editorPopover{
  max-height:calc(100dvh - 24px)!important;
  overflow-y:auto!important;
  overscroll-behavior:contain;
  scrollbar-gutter:stable;
}
#editorPopover .editor-actions{
  position:sticky;
  bottom:-13px;
  z-index:4;
  background:rgba(255,255,255,.98);
  margin-left:-13px;
  margin-right:-13px;
  margin-bottom:-13px;
  padding:10px 13px 13px;
  backdrop-filter:blur(12px);
}
@media (max-height:680px){
  #editorPopover{padding:10px!important}
  #editorPopover .editor-row{margin-bottom:6px!important}
  #editorPopover .editor-field,
  #editorPopover .editor-textarea,
  #editorPopover .editor-select{padding:6px 8px!important}
  #editorPopover .editor-textarea{min-height:44px!important}
  #editorPopover .editor-actions{
    margin-top:7px!important;
    margin-left:-10px;
    margin-right:-10px;
    margin-bottom:-10px;
    padding:8px 10px 10px;
  }
}
@media (max-width:720px){
  #editorPopover{
    width:auto!important;
    max-width:none!important;
  }
}
`;
document.head.appendChild(style);

let fitting=false;
function viewport(){
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
function setPx(prop,value){
  const current=parseFloat(pop.style[prop]);
  if(!Number.isFinite(current)||Math.abs(current-value)>.5)pop.style[prop]=`${Math.round(value)}px`;
}
function fitEditor(){
  if(fitting||!pop.classList.contains("open"))return;
  fitting=true;
  try{
    const v=viewport();
    const margin=12;
    const maxH=Math.max(180,v.height-margin*2);
    pop.style.maxHeight=`${Math.floor(maxH)}px`;

    let r=pop.getBoundingClientRect();
    let left=r.left;
    let top=r.top;
    const minLeft=v.left+margin;
    const maxRight=v.left+v.width-margin;
    const minTop=v.top+margin;
    const maxBottom=v.top+v.height-margin;

    if(r.width>v.width-margin*2){
      pop.style.width=`${Math.max(240,Math.floor(v.width-margin*2))}px`;
      r=pop.getBoundingClientRect();
    }

    if(r.right>maxRight)left-=r.right-maxRight;
    if(left<minLeft)left=minLeft;
    if(r.bottom>maxBottom)top-=r.bottom-maxBottom;
    if(top<minTop)top=minTop;

    pop.style.right="auto";
    setPx("left",left);
    setPx("top",top);
  }finally{
    fitting=false;
  }
}
function scheduleFit(){
  requestAnimationFrame(()=>requestAnimationFrame(fitEditor));
}

const observer=new MutationObserver(mutations=>{
  if(mutations.some(m=>m.attributeName==="class"||m.attributeName==="style"))scheduleFit();
});
observer.observe(pop,{attributes:true,attributeFilter:["class","style"]});

window.addEventListener("resize",scheduleFit,{passive:true});
window.addEventListener("orientationchange",scheduleFit,{passive:true});
window.visualViewport?.addEventListener("resize",scheduleFit,{passive:true});
window.visualViewport?.addEventListener("scroll",scheduleFit,{passive:true});
document.addEventListener("pointerup",scheduleFit,true);
document.addEventListener("focusin",e=>{if(pop.contains(e.target))scheduleFit()},true);

scheduleFit();
})();
