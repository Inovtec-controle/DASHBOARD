(()=>{
"use strict";
const frame=document.getElementById("legacyFrame");
if(!frame)return;
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="organisation")return;

let mutationObserver=null;
let resizeTimer=null;

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
html{
  height:auto!important;
  min-height:100%!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
}
body.iv-orga-global-scroll{
  height:auto!important;
  min-height:100%!important;
  overflow:visible!important;
}
body.iv-orga-global-scroll .iv-shell{
  height:auto!important;
  min-height:100dvh!important;
  overflow:visible!important;
  align-items:start!important;
}
body.iv-orga-global-scroll .iv-sidebar{
  position:sticky!important;
  top:0!important;
  height:100dvh!important;
  min-height:0!important;
  overflow:hidden!important;
}
body.iv-orga-global-scroll .iv-main{
  height:auto!important;
  min-height:100dvh!important;
  grid-template-rows:auto auto auto auto auto!important;
  overflow:visible!important;
}
body.iv-orga-global-scroll .iv-stage{
  height:auto!important;
  min-height:0!important;
  overflow:visible!important;
}
body.iv-orga-global-scroll .iv-frame{
  display:block!important;
  width:100%!important;
  min-height:0!important;
  overflow:hidden!important;
}
@media(max-width:760px){
  body.iv-orga-global-scroll .iv-shell{display:block!important;height:auto!important;min-height:100dvh!important}
  body.iv-orga-global-scroll .iv-main{height:auto!important;min-height:100dvh!important;grid-template-rows:auto auto auto auto auto!important;padding-bottom:72px!important}
  body.iv-orga-global-scroll .iv-stage{height:auto!important;min-height:0!important}
}
`;
}

function scheduleResize(delay=0){
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(resizeFrame,delay);
}

function measureContentHeight(d){
  const app=d.getElementById("app");
  const login=d.getElementById("loginScreen");

  if(!app||app.classList.contains("hidden")){
    if(login&&!login.classList.contains("hidden"))return 620;
    return 1;
  }

  const appRect=app.getBoundingClientRect();
  let bottom=0;
  const selectors=[
    ":scope > .topbar",
    "main.page",
    "main.page > section.card:nth-of-type(1)",
    "main.page > section.card:nth-of-type(2)",
    "#board",
    "#board .column",
    "#board .task-list",
    "#board .task"
  ];

  selectors.forEach(selector=>{
    let nodes=[];
    try{nodes=Array.from(app.querySelectorAll(selector));}catch(e){return;}
    nodes.forEach(el=>{
      const r=el.getBoundingClientRect();
      if(!(r.width||r.height))return;
      bottom=Math.max(bottom,r.bottom-appRect.top);
    });
  });

  return Math.max(1,Math.ceil(bottom+22));
}

function resizeFrame(){
  try{
    const d=frame.contentDocument;
    if(!d?.body)return;
    const target=measureContentHeight(d);
    const current=parseFloat(frame.style.height)||0;
    if(Math.abs(current-target)>2)frame.style.height=target+"px";
  }catch(e){console.warn("Organisation frame resize",e);}
}

function startWatching(){
  try{
    const d=frame.contentDocument;
    if(!d?.body)return;
    if(mutationObserver)mutationObserver.disconnect();

    mutationObserver=new MutationObserver(()=>scheduleResize(40));
    mutationObserver.observe(d.body,{
      subtree:true,
      childList:true,
      characterData:true,
      attributes:true,
      attributeFilter:["class"]
    });
  }catch(e){console.warn("Organisation height watch",e);}
}

function apply(){
  applyShellLayout();
  try{
    const d=frame.contentDocument;
    if(!d?.head||!d.body)return;

    frame.setAttribute("scrolling","no");
    frame.style.overflow="hidden";

    let style=d.getElementById("ivOrgaNoInternalScroll");
    if(!style){
      style=d.createElement("style");
      style.id="ivOrgaNoInternalScroll";
      d.head.appendChild(style);
    }

    style.textContent=`
html,body{
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:hidden!important;
}
body #app{
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
}
body main.page{
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
  display:grid!important;
  grid-template-columns:minmax(285px,350px) minmax(0,1fr)!important;
  grid-template-rows:auto!important;
  gap:10px!important;
  align-items:start!important;
  align-content:start!important;
  padding:0 4px 18px!important;
}
body #description{
  height:180px!important;
  min-height:180px!important;
  max-height:none!important;
  resize:vertical!important;
}
body main.page>section.card:nth-of-type(1){
  grid-column:1!important;
  grid-row:1!important;
  position:sticky!important;
  top:0!important;
  align-self:start!important;
  margin:0!important;
  z-index:20!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
}
body main.page>section.card:nth-of-type(2){
  grid-column:2!important;
  grid-row:1!important;
  align-self:start!important;
  margin:0!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
}
body main.page>section.card:nth-of-type(3){display:none!important}
body .board{
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  grid-auto-rows:max-content!important;
  align-items:start!important;
  align-content:start!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
  padding-bottom:0!important;
}
body .column,
body .task-list,
body .task,
body .table-wrap{
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
}
body .column{min-width:0!important;align-self:start!important}
@media(max-width:900px){body .board{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:619px){
  body main.page{grid-template-columns:1fr!important;grid-template-rows:auto auto!important}
  body main.page>section.card:nth-of-type(1){grid-column:1!important;grid-row:1!important;position:relative!important;top:auto!important}
  body main.page>section.card:nth-of-type(2){grid-column:1!important;grid-row:2!important}
  body .board{grid-template-columns:1fr!important}
}
`;

    startWatching();
    scheduleResize(0);
    setTimeout(()=>scheduleResize(0),100);
    setTimeout(()=>scheduleResize(0),350);
    setTimeout(()=>scheduleResize(0),900);
  }catch(e){console.warn("Organisation scroll fix",e);}
}

frame.addEventListener("load",apply);
window.addEventListener("resize",()=>scheduleResize(80));
applyShellLayout();
setTimeout(apply,120);
setTimeout(apply,600);
})();
