(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame");
let lastDoc=null,observer=null;
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function hideGps(){
  const d=doc();if(!d?.body)return;
  const gps=d.getElementById("gps");
  const gpsField=gps?.closest?.(".field");
  const gpsBtn=d.getElementById("gpsBtn");
  if(gpsField){gpsField.style.setProperty("display","none","important");gpsField.setAttribute("aria-hidden","true");}
  if(gpsBtn){gpsBtn.style.setProperty("display","none","important");gpsBtn.setAttribute("aria-hidden","true");}
}
function install(){
  const d=doc();if(!d?.body)return;
  if(d!==lastDoc){
    lastDoc=d;
    try{observer?.disconnect()}catch{}
    observer=new MutationObserver(()=>hideGps());
    observer.observe(d.body,{childList:true,subtree:true});
  }
  hideGps();
}
frame?.addEventListener("load",()=>{setTimeout(install,100);setTimeout(install,500)});
setInterval(install,1000);
setTimeout(install,350);
})();
