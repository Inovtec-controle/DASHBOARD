(()=>{
const frame=document.getElementById("legacyFrame");
const labels={toutes:"Toutes les semaines",paire:"Semaines paires",impaire:"Semaines impaires"};
function restore(select,value){
 if(!select||!select.isConnected)return;
 select.value=value;
 const summary=select.closest(".iv-container-picker")?.querySelector(".iv-container-frequency-summary");
 if(summary)summary.textContent=`Fréquence : ${labels[value]||labels.toutes}`;
}
function bind(){
 let doc;try{doc=frame?.contentDocument}catch{return}
 if(!doc?.body||doc.documentElement.dataset.ivFrequencyEditFix)return;
 doc.documentElement.dataset.ivFrequencyEditFix="1";
 doc.addEventListener("change",event=>{
  const select=event.target;
  if(!select?.classList?.contains("iv-container-frequency-select"))return;
  const value=select.value;
  if(!labels[value])return;
  setTimeout(()=>restore(select,value),650);
  setTimeout(()=>restore(select,value),1200);
 },true);
}
frame?.addEventListener("load",()=>setTimeout(bind,200));
setTimeout(bind,600);
})();