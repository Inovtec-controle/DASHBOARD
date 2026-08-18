(()=>{
"use strict";
const frame=document.getElementById("legacyFrame");
if(!frame)return;
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="organisation")return;

let resizeObserver=null;
let mutationObserver=null;
let resizeTimer=null;
let boundDoc=null;

function applyShellLayout(){
  document.body.classList.add("iv-orga-global-scroll");
  frame.setAttribute("scrolling","no");
  frame.style.overflow="hidden";

  let style=document.getElementById("ivOrgaGlobalPageScroll");
  if(!style){
    style=document.createElement("style");
    style.id="ivOrgaGlobalPageScroll";
    document.head.appendChild(style);
  }
  style.textContent=`
html{height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important}
body.iv-orga-global-scroll{height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:visible!important}
body.iv-orga-global-scroll .iv-shell{height:auto!important;min-height:100dvh!important;overflow:visible!important;align-items:start!important}
body.iv-orga-global-scroll .iv-sidebar{position:sticky!important;top:0!important;height:100dvh!important;min-height:0!important;overflow:hidden!important}
body.iv-orga-global-scroll .iv-main{height:auto!important;min-height:100dvh!important;grid-template-rows:auto auto auto auto auto!important;overflow:visible!important}
body.iv-orga-global-scroll .iv-stage{height:auto!important;min-height:0!important;overflow:visible!important}
body.iv-orga-global-scroll .iv-frame{display:block!important;width:100%!important;height:1px;min-height:1px!important;overflow:hidden!important}
@media(max-width:760px){
  body.iv-orga-global-scroll .iv-shell{display:block!important;height:auto!important;min-height:100dvh!important}
  body.iv-orga-global-scroll .iv-main{height:auto!important;min-height:100dvh!important;grid-template-rows:auto auto auto auto auto!important;padding-bottom:72px!important}
  body.iv-orga-global-scroll .iv-stage{height:auto!important;min-height:0!important}
}
`;
}

function px(value){
  const n=parseFloat(value);
  return Number.isFinite(n)?n:0;
}

function outerHeight(el){
  if(!el)return 0;
  const cs=getComputedStyle(el);
  if(cs.display==="none")return 0;
  return Math.max(el.offsetHeight,el.scrollHeight)+px(cs.marginTop)+px(cs.marginBottom);
}

function measureNaturalHeight(d){
  const app=d.getElementById("app");
  const login=d.getElementById("loginScreen");
  if(!app||app.classList.contains("hidden")){
    if(login&&!login.classList.contains("hidden"))return 620;
    return 1;
  }

  const topbar=app.querySelector(":scope > .topbar");
  const main=app.querySelector("main.page");
  if(!main)return Math.max(1,outerHeight(topbar)+8);

  const formCard=main.querySelector(":scope > section.card:nth-of-type(1)");
  const boardCard=main.querySelector(":scope > section.card:nth-of-type(2)");
  const cs=getComputedStyle(main);
  const pad=px(cs.paddingTop)+px(cs.paddingBottom);
  const gap=px(cs.rowGap||cs.gap);
  const mobile=matchMedia("(max-width:619px)").matches;
  const formH=outerHeight(formCard);
  const boardH=outerHeight(boardCard);
  const mainH=mobile?(formH+boardH+gap+pad):(Math.max(formH,boardH)+pad);

  return Math.max(1,Math.ceil(outerHeight(topbar)+mainH+6));
}

function resizeFrame(){
  try{
    const d=frame.contentDocument;
    if(!d?.body)return;
    const target=measureNaturalHeight(d);
    const current=parseFloat(frame.style.height)||0;
    if(Math.abs(current-target)>1)frame.style.height=target+"px";
  }catch(e){console.warn("Organisation frame resize",e);}
}

function scheduleResize(delay=0){
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(resizeFrame,delay);
}

function archiveModalOpen(d){
  return !!d.getElementById("ivArchiveModal")?.classList.contains("iv-open");
}

function bindScrollForwarding(d){
  if(boundDoc===d)return;
  boundDoc=d;
  d.addEventListener("wheel",e=>{
    if(archiveModalOpen(d)||e.ctrlKey)return;
    if(!e.deltaY)return;
    e.preventDefault();
    window.scrollBy({top:e.deltaY,left:0,behavior:"auto"});
  },{passive:false});

  d.addEventListener("keydown",e=>{
    if(archiveModalOpen(d))return;
    const tag=(e.target?.tagName||"").toLowerCase();
    if(["input","textarea","select"].includes(tag))return;
    let delta=0;
    if(e.key==="ArrowDown")delta=48;
    else if(e.key==="ArrowUp")delta=-48;
    else if(e.key==="PageDown"||e.key===" ")delta=Math.round(innerHeight*.82);
    else if(e.key==="PageUp")delta=-Math.round(innerHeight*.82);
    else if(e.key==="Home"){e.preventDefault();window.scrollTo({top:0,behavior:"auto"});return;}
    else if(e.key==="End"){e.preventDefault();window.scrollTo({top:document.documentElement.scrollHeight,behavior:"auto"});return;}
    if(delta){e.preventDefault();window.scrollBy({top:delta,behavior:"auto"});}
  });
}

function watchNaturalContent(d){
  if(resizeObserver)resizeObserver.disconnect();
  if(mutationObserver)mutationObserver.disconnect();

  const app=d.getElementById("app");
  const topbar=app?.querySelector(":scope > .topbar");
  const main=app?.querySelector("main.page");
  const formCard=main?.querySelector(":scope > section.card:nth-of-type(1)");
  const boardCard=main?.querySelector(":scope > section.card:nth-of-type(2)");
  const board=d.getElementById("board");

  if("ResizeObserver" in window){
    resizeObserver=new ResizeObserver(()=>scheduleResize(25));
    [topbar,formCard,boardCard,board].filter(Boolean).forEach(el=>{
      try{resizeObserver.observe(el);}catch(e){}
    });
  }

  mutationObserver=new MutationObserver(()=>scheduleResize(25));
  if(board)mutationObserver.observe(board,{subtree:true,childList:true,characterData:true});
  if(formCard)mutationObserver.observe(formCard,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});
}

function apply(){
  applyShellLayout();
  try{
    const d=frame.contentDocument;
    if(!d?.head||!d.body)return;

    let style=d.getElementById("ivOrgaStableLayout");
    if(!style){
      style=d.createElement("style");
      style.id="ivOrgaStableLayout";
      d.head.appendChild(style);
    }
    style.textContent=`
html,body{height:auto!important;min-height:0!important;max-height:none!important;overflow:hidden!important}
body #app{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
body main.page{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;display:grid!important;grid-template-columns:minmax(285px,350px) minmax(0,1fr)!important;grid-template-rows:auto!important;gap:10px!important;align-items:start!important;align-content:start!important;padding:0 4px 18px!important}
body #description{height:180px!important;min-height:180px!important;max-height:none!important;resize:vertical!important}
body main.page>section.card:nth-of-type(1){grid-column:1!important;grid-row:1!important;position:relative!important;top:auto!important;align-self:start!important;margin:0!important;z-index:2!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
body main.page>section.card:nth-of-type(2){grid-column:2!important;grid-row:1!important;align-self:start!important;margin:0!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
body main.page>section.card:nth-of-type(3){display:none!important}
body .board{grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-rows:max-content!important;align-items:start!important;align-content:start!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;padding-bottom:0!important}
body .column{min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;align-self:start!important;overflow:visible!important}
body .task-list{flex:0 0 auto!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
body .task,body .table-wrap{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
@media(max-width:900px){body .board{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:619px){
  body main.page{grid-template-columns:1fr!important;grid-template-rows:auto auto!important}
  body main.page>section.card:nth-of-type(1){grid-column:1!important;grid-row:1!important}
  body main.page>section.card:nth-of-type(2){grid-column:1!important;grid-row:2!important}
  body .board{grid-template-columns:1fr!important}
}
`;

    frame.setAttribute("scrolling","no");
    frame.style.overflow="hidden";
    bindScrollForwarding(d);
    watchNaturalContent(d);
    scheduleResize(0);
    setTimeout(()=>scheduleResize(0),120);
    setTimeout(()=>scheduleResize(0),400);
    setTimeout(()=>scheduleResize(0),900);
  }catch(e){console.warn("Organisation stable layout",e);}
}

frame.addEventListener("load",apply);
window.addEventListener("resize",()=>scheduleResize(80));
applyShellLayout();
setTimeout(apply,120);
setTimeout(apply,600);
})();
