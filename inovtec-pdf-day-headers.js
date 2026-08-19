(()=>{
"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame");
const LABELS={Lu:"Lun",Ma:"Mar",Me:"Mer",Je:"Jeu",Ve:"Ven",Sa:"Sam",Di:"Dim"};
function win(){try{return frame?.contentWindow||null}catch{return null}}
function patch(){
 const w=win(),J=w?.jspdf?.jsPDF;if(!J||J.__ivDayHeadersV1)return false;
 function Wrapped(...args){
  const pdf=new J(...args),original=pdf.text;
  if(typeof original==="function"){
   pdf.text=function(text,...rest){
    const options=rest[2];
    const next=typeof text==="string"&&LABELS[text]&&options&&options.align==="center"?LABELS[text]:text;
    return original.call(this,next,...rest);
   };
  }
  return pdf;
 }
 try{Object.setPrototypeOf(Wrapped,J)}catch{}
 Wrapped.prototype=J.prototype;
 Object.keys(J).forEach(k=>{try{Wrapped[k]=J[k]}catch{}});
 Wrapped.__ivDayHeadersV1=true;
 w.jspdf.jsPDF=Wrapped;
 return true;
}
function install(){let tries=0;const timer=setInterval(()=>{tries++;if(patch()||tries>120)clearInterval(timer)},50)}
frame?.addEventListener("load",()=>setTimeout(install,80));
setTimeout(install,300);
})();
