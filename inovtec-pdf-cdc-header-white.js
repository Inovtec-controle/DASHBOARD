(()=>{
"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame");
function iframeDoc(){try{return frame?.contentDocument||null}catch{return null}}
function iframeWin(){try{return frame?.contentWindow||null}catch{return null}}
function patch(){
 const w=iframeWin(),J=w?.jspdf?.jsPDF;
 if(!J||J.__ivCdcGreenWhiteHeaderV2)return false;
 function Wrapped(...args){
  const pdf=new J(...args);
  const fill=typeof pdf.setFillColor==="function"?pdf.setFillColor.bind(pdf):null;
  const draw=typeof pdf.setDrawColor==="function"?pdf.setDrawColor.bind(pdf):null;
  const text=typeof pdf.setTextColor==="function"?pdf.setTextColor.bind(pdf):null;
  const size=typeof pdf.setFontSize==="function"?pdf.setFontSize.bind(pdf):null;
  if(fill)pdf.setFillColor=function(...a){
   if(Number(a[0])===234&&Number(a[1])===246&&Number(a[2])===239)return fill(6,78,59);
   return fill(...a);
  };
  if(draw)pdf.setDrawColor=function(...a){
   if(Number(a[0])===212&&Number(a[1])===229&&Number(a[2])===220)return draw(6,78,59);
   return draw(...a);
  };
  if(text)pdf.setTextColor=function(...a){
   if(Number(a[0])===21&&Number(a[1])===90&&Number(a[2])===64)return text(255,255,255);
   return text(...a);
  };
  if(size)pdf.setFontSize=function(v){return size(Number(v)===7.2?8.4:v)};
  return pdf;
 }
 try{Object.setPrototypeOf(Wrapped,J)}catch{}
 Wrapped.prototype=J.prototype;
 Object.keys(J).forEach(k=>{try{Wrapped[k]=J[k]}catch{}});
 Wrapped.__ivCdcGreenWhiteHeaderV2=true;
 w.jspdf.jsPDF=Wrapped;
 return true;
}
function install(){
 const d=iframeDoc();if(!d)return;
 d.addEventListener("load",e=>{const s=e.target;if(s?.tagName==="SCRIPT"&&/jspdf/i.test(String(s.src||"")))patch()},true);
 const timer=setInterval(()=>{if(patch())clearInterval(timer)},200);
}
frame?.addEventListener("load",()=>setTimeout(install,60));
setTimeout(install,250);
})();
