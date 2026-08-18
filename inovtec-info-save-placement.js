(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame");
let lastDoc=null,observer=null;
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function ensureStyle(d){
  if(!d?.head||d.getElementById("ivInfoSavePlacementStyle"))return;
  const s=d.createElement("style");
  s.id="ivInfoSavePlacementStyle";
  s.textContent=`
    #siteForm>.sticky-save.iv-after-cdc{
      position:static!important;
      bottom:auto!important;
      left:auto!important;
      right:auto!important;
      width:100%!important;
      margin:12px 0 0!important;
      padding:12px 0 4px!important;
      background:transparent!important;
      border-top:1px solid #dfeae4;
      display:flex!important;
      justify-content:flex-end!important;
      gap:8px!important;
      z-index:auto!important;
    }
    #siteForm>.sticky-save.iv-after-cdc .btn{min-width:150px}
    @media(max-width:700px){
      #siteForm>.sticky-save.iv-after-cdc{flex-direction:column}
      #siteForm>.sticky-save.iv-after-cdc .btn{width:100%;min-width:0}
    }
  `;
  d.head.appendChild(s);
}
function place(){
  const d=doc();if(!d?.body)return;
  ensureStyle(d);
  const form=d.getElementById("siteForm"),cdc=d.getElementById("ivCdcCard");
  const bar=form?.querySelector(":scope > .sticky-save")||form?.querySelector(".sticky-save");
  if(!form||!cdc||!bar)return;
  if(cdc.nextElementSibling!==bar)cdc.insertAdjacentElement("afterend",bar);
  bar.classList.add("iv-after-cdc");
}
function install(){
  const d=doc();if(!d?.body)return;
  if(d!==lastDoc){
    lastDoc=d;
    try{observer?.disconnect()}catch{}
    observer=new MutationObserver(()=>place());
    observer.observe(d.body,{childList:true,subtree:true});
  }
  place();
}
frame?.addEventListener("load",()=>{setTimeout(install,150);setTimeout(install,700);setTimeout(install,1500)});
setTimeout(install,500);
})();
