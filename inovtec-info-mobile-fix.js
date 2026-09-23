/* Correctif mobile Infos chantier.
 * Aucun effet bureau : toutes les règles sont limitées aux téléphones.
 */
(()=>{
"use strict";
if(window.__IV_INFO_MOBILE_FIX__)return;
window.__IV_INFO_MOBILE_FIX__=true;

const style=document.createElement("style");
style.id="ivInfoMobileFix";
style.textContent=`
@media (max-width:760px){
  html,body{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    overflow-x:hidden!important;
    -webkit-text-size-adjust:100%!important;
  }
  html body.iv-mode-infos #app,
  html body.iv-mode-infos main.page,
  html body.iv-mode-infos .layout,
  html body.iv-mode-infos .layout>*,
  html body.iv-mode-infos #siteForm,
  html body.iv-mode-infos #siteForm>section.card,
  html body.iv-mode-infos #siteForm>.sticky-save{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
  }
  html body.iv-mode-infos main.page{
    padding:6px!important;
    overflow-x:hidden!important;
  }
  html body.iv-mode-infos .layout{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    gap:8px!important;
  }
  html body.iv-mode-infos .sidebar{
    position:static!important;
    top:auto!important;
    max-height:none!important;
    overflow:visible!important;
    padding:10px!important;
  }
  html body.iv-mode-infos #siteForm:not(.hidden){
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    gap:8px!important;
  }
  html body.iv-mode-infos #siteForm>section.card,
  html body.iv-mode-infos #siteForm>.sticky-save{
    grid-column:1!important;
    margin:0!important;
  }
  html body.iv-mode-infos .grid.grid-2,
  html body.iv-mode-infos .grid.grid-3{
    grid-template-columns:minmax(0,1fr)!important;
  }
  html body.iv-mode-infos .days{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    grid-template-columns:minmax(0,1fr)!important;
    overflow-x:hidden!important;
    gap:7px!important;
  }
  html body.iv-mode-infos .days .field{
    width:100%!important;
    min-width:0!important;
  }
  html body.iv-mode-infos .site-item{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
  }
  html body.iv-mode-infos .site-item strong,
  html body.iv-mode-infos .site-item span{
    max-width:100%!important;
    overflow-wrap:anywhere!important;
    word-break:break-word!important;
  }
  html body.iv-mode-infos input,
  html body.iv-mode-infos select,
  html body.iv-mode-infos textarea,
  html body.iv-mode-infos button{
    max-width:100%!important;
    min-width:0!important;
    font-size:16px!important;
  }
  html body.iv-mode-infos .actions,
  html body.iv-mode-infos .topbar-actions{
    width:100%!important;
    max-width:100%!important;
    flex-wrap:wrap!important;
  }
  html body.iv-mode-infos .actions .btn{
    flex:1 1 120px!important;
    min-width:0!important;
  }
  html body.iv-mode-infos #ivSiteAgentsCard .iv-agent-planning-row{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    width:100%!important;
  }
  html body.iv-mode-infos #ivSiteAgentsCard .iv-agent-picker{
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
  }
  html body.iv-mode-infos #ivContractFields{
    grid-template-columns:minmax(0,1fr)!important;
  }
  html body.iv-mode-infos .sticky-save{
    position:sticky!important;
    left:0!important;
    right:0!important;
    bottom:4px!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    gap:7px!important;
    padding:8px!important;
  }
  html body.iv-mode-infos .sticky-save .btn{
    width:100%!important;
    min-width:0!important;
  }
}
`;
document.head.appendChild(style);

const mobile=()=>window.matchMedia&&window.matchMedia("(max-width:760px)").matches;
function showForm(){
  if(!mobile())return;
  window.setTimeout(()=>{
    const form=document.getElementById("siteForm");
    if(!form||form.classList.contains("hidden"))return;
    try{form.scrollIntoView({behavior:"smooth",block:"start",inline:"nearest"});}catch{form.scrollIntoView(true);}
  },80);
}
document.addEventListener("click",event=>{
  if(!mobile())return;
  const target=event.target;
  if(!(target instanceof Element))return;
  if(target.closest(".site-item")||target.closest("#newBtn"))showForm();
});
})();
