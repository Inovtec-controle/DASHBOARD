(()=>{
"use strict";
const frame=document.getElementById("legacyFrame");
if(!frame)return;
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
function addDisplayFix(doc){
  if(!doc?.head||doc.getElementById("iv-targeted-display-fix"))return;
  const style=doc.createElement("style");
  style.id="iv-targeted-display-fix";
  if(mode==="agents"){
    style.textContent=`
      html,body{width:100%!important;min-width:0!important}
      body{overflow-x:hidden!important}
      .app{width:100%!important;min-width:0!important;min-height:100%!important}
      .content{width:100%!important;max-width:none!important;min-width:0!important;padding-top:0!important;align-items:start!important}
      .content>.card{min-width:0!important;width:100%!important}
      .cardBody,.grid2,.grid2>*{min-width:0!important}
      .input,.textarea{min-width:0!important;max-width:100%!important}
      .list{max-height:calc(100dvh - 92px)!important}
      @media(max-width:980px){.content{grid-template-columns:1fr!important}.list{max-height:none!important}}
    `;
  }else if(mode==="salaire"){
    style.textContent=`
      html,body{width:100%!important;min-width:0!important}
      body{overflow-x:hidden!important}
      .tool{width:100%!important;max-width:none!important;min-width:0!important;grid-template-rows:auto auto!important}
      .tool>section.card:nth-of-type(1){grid-column:1!important;grid-row:1!important;min-width:0!important}
      .tool>section.card:nth-of-type(2){grid-column:2!important;grid-row:1!important;min-width:0!important}
      .tool>.notice{grid-column:1/-1!important;grid-row:2!important}
      .grid,.grid>*{min-width:0!important}
      @media(max-width:760px){
        .tool{display:block!important}
        .tool>section.card,.tool>.notice{width:100%!important;margin-bottom:10px!important}
      }
    `;
  }
  if(style.textContent.trim())doc.head.appendChild(style);
}
const hide=doc=>{
  if(!doc?.body)return;
  doc.querySelectorAll(".topbar").forEach(el=>el.style.setProperty("display","none","important"));
  if(mode==="heures")doc.querySelector(".wrap > header:first-child")?.style.setProperty("display","none","important");
  if(mode==="temps"||mode==="salaire")doc.querySelector(".tool > .actions:first-child")?.style.setProperty("display","none","important");
  addDisplayFix(doc);
  if(mode==="kontrol"){
    const nested=doc.getElementById("kontrolFrame");
    const nd=nested?.contentDocument;
    nd?.querySelector("header.hero")?.style.setProperty("display","none","important");
  }
};
const apply=()=>{
  try{
    hide(frame.contentDocument);
    const nested=frame.contentDocument?.getElementById("kontrolFrame");
    if(nested)nested.addEventListener("load",()=>setTimeout(()=>hide(frame.contentDocument),50),{once:false});
  }catch{}
};
frame.addEventListener("load",()=>{setTimeout(apply,20);setTimeout(apply,250);setTimeout(apply,900)});
setTimeout(apply,600);
})();
