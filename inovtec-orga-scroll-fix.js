(()=>{
"use strict";
const frame=document.getElementById("legacyFrame");
if(!frame)return;
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="organisation")return;

let resizeObserver=null;
let resizeTimer=null;

function applyShellLayout(){
  document.body.classList.add("iv-orga-global-scroll");
  let style=document.getElementById("ivOrgaGlobalPageScroll");
  if(!style){
    style=document.createElement("style");
    style.id="ivOrgaGlobalPageScroll";
    document.head.appendChild(style);
  }
  style.textContent=`
html{height:auto!important;min-height:100%!important;overflow-y:auto!important;overflow-x:hidden!important}
body.iv-orga-global-scroll{height:auto!important;min-height:100%!important;overflow-y:auto!important;overflow-x:hidden!important}
body.iv-orga-global-scroll .iv-shell{height:auto!important;min-height:100dvh!important;align-items:start!important}
body.iv-orga-global-scroll .iv-sidebar{position:sticky!important;top:0!important;height:100dvh!important}
body.iv-orga-global-scroll .iv-main{height:auto!important;min-height:100dvh!important;grid-template-rows:auto auto auto auto!important;overflow:visible!important}
body.iv-orga-global-scroll .iv-stage{height:auto!important;min-height:0!important;overflow:visible!important}
body.iv-orga-global-scroll .iv-frame{height:1px;min-height:1px;overflow:hidden!important}
@media(max-width:760px){
  body.iv-orga-global-scroll .iv-shell{display:block!important;height:auto!important;min-height:100dvh!important}
  body.iv-orga-global-scroll .iv-main{height:auto!important;min-height:100dvh!important;grid-template-rows:auto auto auto auto!important;padding-bottom:72px!important}
  body.iv-orga-global-scroll .iv-stage{height:auto!important;min-height:0!important}
}
`;
}

function getContentRoot(d){
  const app=d.getElementById("app");
  const login=d.getElementById("loginScreen");
  if(app && !app.classList.contains("hidden")) return app;
  return login || app || d.body;
}

function resizeFrame(){
  try{
    const d=frame.contentDocument;
    if(!d?.body)return;
    const root=getContentRoot(d);
    const height=Math.ceil(Math.max(root.scrollHeight,root.getBoundingClientRect().height));
    if(height>0){
      const target=height+4;
      if(Math.abs(frame.getBoundingClientRect().height-target)>1) frame.style.height=target+"px";
    }
  }catch(e){console.warn("Organisation frame resize",e);}
}

function watchHeight(){
  try{
    const d=frame.contentDocument;
    if(!d?.body)return;
    if(resizeObserver) resizeObserver.disconnect();
    if("ResizeObserver" in window){
      resizeObserver=new ResizeObserver(()=>{
        clearTimeout(resizeTimer);
        resizeTimer=setTimeout(resizeFrame,25);
      });
      resizeObserver.observe(d.body);
      const app=d.getElementById("app");
      const login=d.getElementById("loginScreen");
      const main=d.querySelector("main.page");
      if(app) resizeObserver.observe(app);
      if(login) resizeObserver.observe(login);
      if(main) resizeObserver.observe(main);
    }
  }catch(e){console.warn("Organisation height watch",e);}
}

function apply(){
  applyShellLayout();
  try{
    const d=frame.contentDocument;
    if(!d?.head||!d.body)return;
    let style=d.getElementById("ivOrgaNoInternalScroll");
    if(!style){
      style=d.createElement("style");
      style.id="ivOrgaNoInternalScroll";
      d.head.appendChild(style);
    }
    style.textContent=`
html:has(body.iv-visual-v2.iv-mode-organisation){
  height:auto!important;
  min-height:0!important;
  overflow:visible!important;
}
body.iv-visual-v2.iv-mode-organisation{
  height:auto!important;
  min-height:0!important;
  overflow:visible!important;
}
body.iv-visual-v2.iv-mode-organisation #app{
  height:auto!important;
  min-height:0!important;
  overflow:visible!important;
}
body.iv-visual-v2.iv-mode-organisation main.page{
  height:auto!important;
  max-height:none!important;
  min-height:0!important;
  overflow:visible!important;
  display:grid!important;
  grid-template-columns:minmax(285px,350px) minmax(0,1fr)!important;
  grid-template-rows:auto auto!important;
  gap:10px!important;
  align-items:start!important;
  padding:0 4px 18px!important;
}
body.iv-visual-v2.iv-mode-organisation #description{
  height:180px!important;
  min-height:180px!important;
  resize:vertical!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1){
  grid-column:1!important;
  grid-row:1/3!important;
  position:sticky!important;
  top:0!important;
  align-self:start!important;
  margin:0!important;
  z-index:20!important;
  overflow:visible!important;
  max-height:none!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(2){
  grid-column:2!important;
  grid-row:1!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
  align-self:start!important;
  margin:0!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(3){
  grid-column:2!important;
  grid-row:2!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
  align-self:start!important;
  margin:0!important;
}
body.iv-visual-v2.iv-mode-organisation .board{
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  grid-auto-rows:max-content!important;
  align-items:start!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
  overflow-x:visible!important;
  overflow-y:visible!important;
  padding-bottom:0!important;
}
body.iv-visual-v2.iv-mode-organisation .task-list,
body.iv-visual-v2.iv-mode-organisation .table-wrap{
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:visible!important;
}
body.iv-visual-v2.iv-mode-organisation .column{
  min-width:0!important;
  min-height:0!important;
  height:auto!important;
  align-self:start!important;
}
@media(max-width:900px){
  body.iv-visual-v2.iv-mode-organisation .board{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
@media(max-width:619px){
  body.iv-visual-v2.iv-mode-organisation main.page{grid-template-columns:1fr!important;grid-template-rows:auto auto auto!important}
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1){grid-column:1!important;grid-row:1!important;position:relative!important;top:auto!important}
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(2){grid-column:1!important;grid-row:2!important;overflow:visible!important}
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(3){grid-column:1!important;grid-row:3!important;overflow:visible!important}
  body.iv-visual-v2.iv-mode-organisation .board{grid-template-columns:1fr!important}
}
`;
    watchHeight();
    resizeFrame();
    setTimeout(resizeFrame,100);
    setTimeout(resizeFrame,400);
    setTimeout(resizeFrame,1000);
  }catch(e){console.warn("Organisation scroll fix",e);}
}

frame.addEventListener("load",apply);
window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resizeFrame,80);});
applyShellLayout();
setTimeout(apply,150);
setTimeout(apply,700);
})();
