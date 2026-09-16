(()=>{
"use strict";
// L'iframe peut rester en attente de son evenement load si une ressource
// externe (notamment jsPDF) tarde : le calendrier, lui, est deja utilisable.
let outer;
try{
  if(parent===window || !parent.document) return;
  outer=parent.document;
  if(outer.getElementById("legacyFrame")?.contentWindow!==window) return;
}catch{return}
let tries=0;
function revealWhenReady(){
  try{
    const period=document.getElementById("periodLabel")?.textContent?.trim();
    const calendar=document.getElementById("calendarViewport");
    const loading=outer.getElementById("loading");
    if(!loading || !loading.isConnected) return;
    if(calendar && period && period!=="—"){
      loading.classList.add("hidden");
      loading.setAttribute("aria-hidden","true");
      return;
    }
  }catch{return}
  if(++tries<100) setTimeout(revealWhenReady,100);
}
revealWhenReady();
})();
