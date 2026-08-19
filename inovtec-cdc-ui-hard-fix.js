(()=>{
"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame");
let observedDoc=null,observer=null,timer=null;
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function apply(){
  const d=doc();if(!d?.body)return;
  let style=d.getElementById("ivCdcUiHardFixStyle");
  if(!style){
    style=d.createElement("style");
    style.id="ivCdcUiHardFixStyle";
    style.textContent=`
      #ivCdcOverlay .iv-cdc-modal{width:min(950px,calc(100vw - 24px))!important;max-width:950px!important;max-height:94vh!important}
      #ivCdcOverlay .field.iv-cdc-force-hidden{display:none!important}
      @media(max-width:780px){#ivCdcOverlay .iv-cdc-modal{width:calc(100vw - 18px)!important;max-width:calc(100vw - 18px)!important}}
    `;
    d.head.appendChild(style);
  }
  ["ivCdcFrequence","ivCdcControle","ivCdcMethode"].forEach(id=>{
    const el=d.getElementById(id),field=el?.closest?.(".field");
    if(!field)return;
    field.classList.add("iv-cdc-force-hidden");
    field.hidden=true;
    field.setAttribute("aria-hidden","true");
    field.style.setProperty("display","none","important");
  });
  const modal=d.querySelector("#ivCdcOverlay .iv-cdc-modal");
  if(modal){
    modal.style.setProperty("width","min(950px, calc(100vw - 24px))","important");
    modal.style.setProperty("max-width","950px","important");
    modal.dataset.ivCdcSimplified="1";
  }
}
function schedule(){clearTimeout(timer);timer=setTimeout(apply,30)}
function install(){
  const d=doc();if(!d?.body)return;
  if(d!==observedDoc){
    observedDoc=d;
    try{observer?.disconnect()}catch{}
    observer=new MutationObserver(schedule);
    observer.observe(d.body,{childList:true,subtree:true});
  }
  apply();
}
frame?.addEventListener("load",()=>{setTimeout(install,120);setTimeout(install,500);setTimeout(install,1200)});
setTimeout(install,300);
setInterval(install,1000);
})();
