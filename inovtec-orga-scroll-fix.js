(()=>{
"use strict";
const frame=document.getElementById("legacyFrame");
if(!frame)return;
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="organisation")return;
function apply(){
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
  height:100%!important;
  min-height:100%!important;
  overflow:hidden!important;
}
body.iv-visual-v2.iv-mode-organisation{
  height:100%!important;
  min-height:100%!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
}
body.iv-visual-v2.iv-mode-organisation #app{
  height:auto!important;
  min-height:100%!important;
  overflow:visible!important;
}
body.iv-visual-v2.iv-mode-organisation main.page{
  height:auto!important;
  max-height:none!important;
  min-height:100%!important;
  overflow:visible!important;
  display:grid!important;
  grid-template-columns:minmax(285px,350px) minmax(0,1fr)!important;
  grid-template-rows:auto auto!important;
  gap:10px!important;
  align-items:start!important;
  padding:0 4px 18px!important;
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
  overscroll-behavior:auto!important;
  margin:0!important;
}
body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(3){
  grid-column:2!important;
  grid-row:2!important;
  height:auto!important;
  max-height:none!important;
  overflow:visible!important;
  margin:0!important;
}
body.iv-visual-v2.iv-mode-organisation .board{
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  overflow:visible!important;
  overflow-x:visible!important;
  padding-bottom:0!important;
}
body.iv-visual-v2.iv-mode-organisation .column{min-width:0!important}
@media(max-width:900px){
  body.iv-visual-v2.iv-mode-organisation .board{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
@media(max-width:619px){
  body.iv-visual-v2.iv-mode-organisation main.page{grid-template-columns:1fr!important;grid-template-rows:auto auto auto!important}
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(1){grid-column:1!important;grid-row:1!important;position:sticky!important;top:0!important}
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(2){grid-column:1!important;grid-row:2!important;overflow:visible!important}
  body.iv-visual-v2.iv-mode-organisation main.page>section.card:nth-of-type(3){grid-column:1!important;grid-row:3!important;overflow:visible!important}
  body.iv-visual-v2.iv-mode-organisation .board{grid-template-columns:1fr!important}
}
`;
  }catch(e){console.warn("Organisation scroll fix",e);}
}
frame.addEventListener("load",()=>{setTimeout(apply,80);setTimeout(apply,350);setTimeout(apply,900);});
setTimeout(apply,700);
})();
