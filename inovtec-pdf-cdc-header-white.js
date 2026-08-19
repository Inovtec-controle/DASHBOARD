(()=>{
"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame");
const LEFT=12,ZONE_W=34,TASK_W=95,DAYS_W=57,DAY_W=DAYS_W/7;
const HEADER={
 Zone:{x:LEFT,w:ZONE_W,tx:LEFT+2,align:"left"},
 Prestation:{x:LEFT+ZONE_W,w:TASK_W,tx:LEFT+ZONE_W+2,align:"left"},
 Lun:{x:LEFT+ZONE_W+TASK_W,w:DAY_W},
 Mar:{x:LEFT+ZONE_W+TASK_W+DAY_W,w:DAY_W},
 Mer:{x:LEFT+ZONE_W+TASK_W+DAY_W*2,w:DAY_W},
 Jeu:{x:LEFT+ZONE_W+TASK_W+DAY_W*3,w:DAY_W},
 Ven:{x:LEFT+ZONE_W+TASK_W+DAY_W*4,w:DAY_W},
 Sam:{x:LEFT+ZONE_W+TASK_W+DAY_W*5,w:DAY_W},
 Dim:{x:LEFT+ZONE_W+TASK_W+DAY_W*6,w:DAY_W}
};
function iframeDoc(){try{return frame?.contentDocument||null}catch{return null}}
function iframeWin(){try{return frame?.contentWindow||null}catch{return null}}
function patch(){
 const w=iframeWin(),J=w?.jspdf?.jsPDF;
 if(!J||J.__ivCdcHeaderVisibleV3)return false;
 function Wrapped(...args){
  const pdf=new J(...args),origText=pdf.text.bind(pdf),origRect=pdf.rect.bind(pdf),fill=pdf.setFillColor.bind(pdf),draw=pdf.setDrawColor.bind(pdf),color=pdf.setTextColor.bind(pdf),font=pdf.setFont.bind(pdf),size=pdf.setFontSize.bind(pdf);
  pdf.text=function(value,x,y,options,...rest){
   const label=typeof value==="string"?value:"",h=HEADER[label];
   if(h&&options&&typeof options==="object"){
    const rowY=Number(y)-5;
    fill(6,78,59);draw(6,78,59);origRect(h.x,rowY,h.w,8,"FD");
    color(255,255,255);font("helvetica","bold");size(8.4);
    const tx=h.tx??(h.x+h.w/2),opts={...options,align:h.align||"center"};
    return origText(label,tx,y,opts,...rest);
   }
   return origText(value,x,y,options,...rest);
  };
  return pdf;
 }
 try{Object.setPrototypeOf(Wrapped,J)}catch{}
 Wrapped.prototype=J.prototype;Object.keys(J).forEach(k=>{try{Wrapped[k]=J[k]}catch{}});Wrapped.__ivCdcHeaderVisibleV3=true;w.jspdf.jsPDF=Wrapped;return true;
}
function install(){const d=iframeDoc();if(!d)return;d.addEventListener("load",e=>{const s=e.target;if(s?.tagName==="SCRIPT"&&/jspdf/i.test(String(s.src||"")))patch()},true);const timer=setInterval(()=>{if(patch())clearInterval(timer)},100)}
frame?.addEventListener("load",()=>setTimeout(install,40));setTimeout(install,180);
})();
