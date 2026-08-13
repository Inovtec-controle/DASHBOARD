(()=>{
"use strict";
const frame=document.getElementById("legacyFrame");
if(!frame)return;
const hide=doc=>{
  if(!doc?.body)return;
  doc.querySelectorAll(".topbar").forEach(el=>el.style.setProperty("display","none","important"));
  const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
  if(mode==="heures")doc.querySelector(".wrap > header:first-child")?.style.setProperty("display","none","important");
  if(mode==="temps"||mode==="salaire")doc.querySelector(".tool > .actions:first-child")?.style.setProperty("display","none","important");
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
