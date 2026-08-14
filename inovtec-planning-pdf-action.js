(()=>{
"use strict";
const params=new URLSearchParams(location.search);
if((params.get("mode")||"").toLowerCase()!=="planning")return;
const summary=document.getElementById("pageSummary"),frame=document.getElementById("legacyFrame");
if(!summary||!frame)return;
const style=document.createElement("style");
style.textContent=`
  .iv-summary.iv-summary-with-pdf{grid-template-columns:repeat(5,minmax(0,1fr))!important}
  .iv-summary .iv-pdf-action{cursor:pointer;user-select:none;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;background:linear-gradient(145deg,#064e3b,#087654)!important;border-color:#064e3b!important}
  .iv-summary .iv-pdf-action .iv-summary-icon{background:rgba(255,255,255,.15)!important;color:#fff!important;font-size:10px!important;letter-spacing:.04em}
  .iv-summary .iv-pdf-action .iv-summary-label,.iv-summary .iv-pdf-action .iv-summary-value{color:#fff!important}
  .iv-summary .iv-pdf-action .iv-summary-note{color:#c9efdf!important}
  .iv-summary .iv-pdf-action:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(4,78,59,.18)!important}
  .iv-summary .iv-pdf-action:focus{outline:3px solid rgba(5,150,105,.2);outline-offset:2px}
  @media(max-width:1180px){.iv-summary.iv-summary-with-pdf{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
  @media(max-width:760px){.iv-summary.iv-summary-with-pdf{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
`;
document.head.appendChild(style);
function generate(){
  try{
    const api=frame.contentWindow?.InovtecPlanningPDF;
    if(api?.generate)return api.generate();
  }catch(e){console.error(e)}
  alert("Le générateur PDF du Planning n’est pas encore prêt. Réessaie dans quelques secondes.");
}
function makeCard(){
  const card=document.createElement("article");
  card.id="planningPdfAction";card.className="iv-summary-card iv-pdf-action";card.setAttribute("role","button");card.setAttribute("tabindex","0");card.setAttribute("aria-label","Générer le planning de la semaine en PDF portrait");
  card.innerHTML='<span class="iv-summary-icon">PDF</span><span class="iv-summary-copy"><small class="iv-summary-label">PDF</small><strong class="iv-summary-value">Générer</strong><span class="iv-summary-note">Planning portrait A4</span></span>';
  card.addEventListener("click",generate);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();generate()}});
  return card;
}
function ensure(){
  summary.classList.add("iv-summary-with-pdf");
  if(!document.getElementById("planningPdfAction")&&summary.children.length)summary.prepend(makeCard());
}
const observer=new MutationObserver(()=>requestAnimationFrame(ensure));observer.observe(summary,{childList:true});
frame.addEventListener("load",()=>{setTimeout(ensure,150);setTimeout(ensure,700)});
setTimeout(ensure,300);setInterval(ensure,1600);
})();