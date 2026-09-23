(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_EDITOR_FIT_V4__)return;
window.__INOVTEC_PLANNING_EDITOR_FIT_V4__=true;

const pop=document.getElementById("editorPopover");
if(!pop)return;

const style=document.createElement("style");
style.id="ivPlanningEditorFitStyleV4";
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

let scheduled=false;

function visibleBounds(){
  const margin=12;
  let top=margin;
  let bottom=window.innerHeight-margin;
  let left=margin;
  let right=window.innerWidth-margin;

  try{
    if(parent!==window){
      const frame=parent.document.getElementById("legacyFrame");
      if(frame?.contentWindow===window){
        const fr=frame.getBoundingClientRect();
        const vv=parent.visualViewport;
        const pTop=vv?.offsetTop||0;
        const pLeft=vv?.offsetLeft||0;
        const pHeight=vv?.height||parent.innerHeight;
        const pWidth=vv?.width||parent.innerWidth;

        top=Math.max(margin,pTop-fr.top+margin);
        bottom=Math.min(window.innerHeight-margin,pTop+pHeight-fr.top-margin);
        left=Math.max(margin,pLeft-fr.left+margin);
        right=Math.min(window.innerWidth-margin,pLeft+pWidth-fr.left-margin);
      }
    }
  }catch{}

  if(bottom-top<160){
    top=margin;
    bottom=Math.max(top+160,window.innerHeight-margin);
  }
  if(right-left<220){
    left=margin;
    right=Math.max(left+220,window.innerWidth-margin);
  }
  return{top,bottom,left,right};
}

function fitEditor(){
  scheduled=false;
  if(!pop.classList.contains("open"))return;

  const b=visibleBounds();
  const availableHeight=Math.max(160,b.bottom-b.top);
  const availableWidth=Math.max(220,b.right-b.left);

  pop.style.setProperty("max-height",Math.floor(availableHeight)+"px","important");
  pop.style.setProperty("overflow-y","auto","important");

  let r=pop.getBoundingClientRect();

  if(r.width>availableWidth){
    pop.style.setProperty("width",Math.floor(availableWidth)+"px","important");
    r=pop.getBoundingClientRect();
  }

  let nextLeft=r.left;
  let nextTop=r.top;

  if(r.right>b.right)nextLeft-=r.right-b.right;
  if(nextLeft<b.left)nextLeft=b.left;

  if(r.bottom>b.bottom)nextTop-=r.bottom-b.bottom;
  if(nextTop<b.top)nextTop=b.top;

  pop.style.setProperty("right","auto","important");
  pop.style.setProperty("bottom","auto","important");
  pop.style.setProperty("left",Math.round(nextLeft)+"px","important");
  pop.style.setProperty("top",Math.round(nextTop)+"px","important");
}

function scheduleFit(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>requestAnimationFrame(fitEditor));
}

new MutationObserver(mutations=>{
  if(mutations.some(m=>m.attributeName==="class")&&pop.classList.contains("open")){
    scheduleFit();
  }
}).observe(pop,{attributes:true,attributeFilter:["class"]});

window.addEventListener("orientationchange",scheduleFit,{passive:true});
window.visualViewport?.addEventListener("resize",scheduleFit,{passive:true});

try{
  parent.addEventListener("scroll",scheduleFit,{passive:true});
  parent.addEventListener("resize",scheduleFit,{passive:true});
  parent.visualViewport?.addEventListener("resize",scheduleFit,{passive:true});
}catch{}

scheduleFit();
})();
