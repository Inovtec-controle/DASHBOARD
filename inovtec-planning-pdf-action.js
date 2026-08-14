(()=>{
"use strict";
const params=new URLSearchParams(location.search);
if((params.get("mode")||"").toLowerCase()!=="planning")return;
const summary=document.getElementById("pageSummary"),frame=document.getElementById("legacyFrame");
if(!summary||!frame)return;
const style=document.createElement("style");
style.textContent=`
  .iv-summary.iv-summary-with-pdf{grid-template-columns:repeat(6,minmax(0,1fr))!important}
  .iv-summary .iv-pdf-action{cursor:pointer;user-select:none;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;background:linear-gradient(145deg,#064e3b,#087654)!important;border-color:#064e3b!important}
  .iv-summary .iv-pdf-action.iv-pdf-all{background:linear-gradient(145deg,#12382e,#0d5f47)!important}
  .iv-summary .iv-pdf-action .iv-summary-icon{background:rgba(255,255,255,.15)!important;color:#fff!important;font-size:9px!important;letter-spacing:.03em}
  .iv-summary .iv-pdf-action .iv-summary-label,.iv-summary .iv-pdf-action .iv-summary-value{color:#fff!important}
  .iv-summary .iv-pdf-action .iv-summary-note{color:#c9efdf!important}
  .iv-summary .iv-pdf-action:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(4,78,59,.18)!important}
  .iv-summary .iv-pdf-action:focus{outline:3px solid rgba(5,150,105,.2);outline-offset:2px}
  @media(max-width:1320px){.iv-summary.iv-summary-with-pdf{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
  @media(max-width:760px){.iv-summary.iv-summary-with-pdf{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
`;
document.head.appendChild(style);
function callApi(method){try{const api=frame.contentWindow?.InovtecPlanningPDF;if(typeof api?.[method]==="function")return api[method]()}catch(e){console.error(e)}alert("Le générateur PDF du Planning n’est pas encore prêt. Réessaie dans quelques secondes.")}
function makeCard(id,all=false){const card=document.createElement("article");card.id=id;card.className="iv-summary-card iv-pdf-action"+(all?" iv-pdf-all":"");card.setAttribute("role","button");card.setAttribute("tabindex","0");card.setAttribute("aria-label",all?"Générer les plannings de tous les agents en PDF paysage":"Générer le planning de l’agent sélectionné en PDF paysage");card.innerHTML=all?'<span class="iv-summary-icon">PDF+</span><span class="iv-summary-copy"><small class="iv-summary-label">PDF tous</small><strong class="iv-summary-value">Tous agents</strong><span class="iv-summary-note">Lots prêts à imprimer</span></span>':'<span class="iv-summary-icon">PDF</span><span class="iv-summary-copy"><small class="iv-summary-label">PDF agent</small><strong class="iv-summary-value">Agent actif</strong><span class="iv-summary-note">Planning A4 paysage</span></span>';const run=()=>callApi(all?"generateAll":"generateSingle");card.addEventListener("click",run);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();run()}});return card}
function ensure(){summary.classList.add("iv-summary-with-pdf");if(!summary.children.length)return;const a=document.getElementById("planningPdfSingle"),b=document.getElementById("planningPdfAll");if(!a)summary.appendChild(makeCard("planningPdfSingle",false));if(!b)summary.appendChild(makeCard("planningPdfAll",true));}
const observer=new MutationObserver(()=>requestAnimationFrame(ensure));observer.observe(summary,{childList:true});frame.addEventListener("load",()=>{setTimeout(ensure,150);setTimeout(ensure,700)});setTimeout(ensure,300);setInterval(ensure,1600);
})();