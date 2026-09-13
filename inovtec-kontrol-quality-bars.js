(()=>{
"use strict";

const FRAME_ID="kontrolFrame";
const STYLE_ID="ivKontrolQualityBarsStyle";
let activeDoc=null;
let observer=null;
let scheduled=false;

const CSS=`
/* KONTROL — synthèse intégrée au contrôle, même largeur et même style que les autres cartes */
body.iv-mode-kontrol #summaryCard.iv-quality-summary[hidden],
#summaryCard.iv-quality-summary[hidden]{display:none!important}

body.iv-mode-kontrol #summaryCard.iv-quality-summary,
#summaryCard.iv-quality-summary{
  grid-column:1 / -1!important;
  grid-row:auto!important;
  position:relative!important;
  top:auto!important;
  z-index:auto!important;
  display:block!important;
  width:100%!important;
  max-width:none!important;
  margin:12px 0 0!important;
  padding:14px!important;
  border:1px solid var(--v2-line,rgba(148,163,184,.4))!important;
  border-radius:16px!important;
  background:#fff!important;
  background-image:none!important;
  box-shadow:var(--v2-shadow,0 8px 24px rgba(15,23,42,.055))!important;
  color:var(--v2-text,#153b30)!important;
}

#summaryCard.iv-quality-summary .summary,
#summaryCard.iv-quality-summary .summary>div,
#summaryCard.iv-quality-summary #barsWrap,
#summaryCard.iv-quality-summary #barsChart{
  background:transparent!important;
  background-image:none!important;
}

#summaryCard.iv-quality-summary .summary{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:14px!important;
}

#summaryCard.iv-quality-summary .summary>div:first-child{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  grid-template-rows:auto auto!important;
  column-gap:14px!important;
  row-gap:3px!important;
  align-items:center!important;
  padding:0 0 12px!important;
  border-bottom:1px solid #e7efeb!important;
  color:var(--v2-text,#153b30)!important;
}

#summaryCard.iv-quality-summary .summary>div:first-child>label.lbl{
  grid-column:1!important;
  grid-row:1!important;
  margin:0!important;
  color:#587066!important;
  font-size:12px!important;
  line-height:1.2!important;
  font-weight:800!important;
  letter-spacing:0!important;
  text-transform:none!important;
}

#summaryCard.iv-quality-summary .score{
  grid-column:2!important;
  grid-row:1 / span 2!important;
  align-self:center!important;
  min-width:64px!important;
  margin:0!important;
  padding:7px 10px!important;
  border:1px solid #dce9e3!important;
  border-radius:999px!important;
  background:#f7fbf9!important;
  font-size:20px!important;
  line-height:1!important;
  font-weight:850!important;
  letter-spacing:-.02em!important;
  text-align:center!important;
}

#summaryCard.iv-quality-summary .score-badge:not(.good):not(.avg):not(.poor){color:#94a3b8!important}
#summaryCard.iv-quality-summary .score-badge.good{color:#15935f!important}
#summaryCard.iv-quality-summary .score-badge.avg{color:#c69200!important}
#summaryCard.iv-quality-summary .score-badge.poor{color:#c92a2a!important}

#summaryCard.iv-quality-summary .iv-quality-target{
  grid-column:1!important;
  grid-row:2!important;
  margin:0!important;
  color:#819088!important;
  font-size:11px!important;
  line-height:1.3!important;
  background:transparent!important;
}

#summaryCard.iv-quality-summary .legend,
#summaryCard.iv-quality-summary .display-switch,
#summaryCard.iv-quality-summary #pieWrap,
#summaryCard.iv-quality-summary #pieFallback{display:none!important}

#summaryCard.iv-quality-summary #barsWrap{
  display:block!important;
  width:100%!important;
  max-width:none!important;
  margin:0!important;
}

#summaryCard.iv-quality-summary .iv-quality-bars-heading{
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:12px!important;
  margin:0 0 12px!important;
}

#summaryCard.iv-quality-summary .iv-quality-bars-heading strong{
  color:#214b3c!important;
  font-size:13px!important;
  font-weight:800!important;
}

#summaryCard.iv-quality-summary .iv-quality-bars-heading span{
  color:#819088!important;
  font-size:10px!important;
}

#summaryCard.iv-quality-summary .bars{
  display:grid!important;
  gap:10px!important;
  width:100%!important;
  color:#40554c!important;
  font-size:12px!important;
}

#summaryCard.iv-quality-summary .bars .bar{
  display:grid!important;
  grid-template-columns:minmax(110px,145px) minmax(140px,1fr) 78px!important;
  gap:12px!important;
  align-items:center!important;
  min-height:20px!important;
  background:transparent!important;
}

#summaryCard.iv-quality-summary .bars .bar .top{display:contents!important}

#summaryCard.iv-quality-summary .bars .bar .top>span:first-child{
  grid-column:1!important;
  display:flex!important;
  align-items:center!important;
  gap:8px!important;
  min-width:0!important;
  color:#40554c!important;
  font-weight:750!important;
  white-space:nowrap!important;
}

#summaryCard.iv-quality-summary .bars .bar .top>span:first-child::before{
  content:"";
  width:7px;
  height:7px;
  flex:0 0 7px;
  border-radius:50%;
  background:#16a34a;
}
#summaryCard.iv-quality-summary .bars .bar:nth-child(2) .top>span:first-child::before{background:#eab308}
#summaryCard.iv-quality-summary .bars .bar:nth-child(3) .top>span:first-child::before{background:#dc2626}
#summaryCard.iv-quality-summary .bars .bar:nth-child(4) .top>span:first-child::before{background:#cbd5e1}

#summaryCard.iv-quality-summary .bars .bar .track{
  grid-column:2!important;
  grid-row:1!important;
  width:100%!important;
  height:7px!important;
  margin:0!important;
  border-radius:999px!important;
  background:#edf2ef!important;
  overflow:hidden!important;
}

#summaryCard.iv-quality-summary .bars .bar .fill{
  height:100%!important;
  min-width:0!important;
  border-radius:999px!important;
  box-shadow:none!important;
}

#summaryCard.iv-quality-summary .bars .bar:nth-child(4) .fill{background:#cbd5e1!important;outline:none!important}

#summaryCard.iv-quality-summary .bars .bar .top>span:last-child{
  grid-column:3!important;
  display:flex!important;
  align-items:baseline!important;
  justify-content:flex-end!important;
  gap:5px!important;
  color:#214b3c!important;
  text-align:right!important;
  white-space:nowrap!important;
}

#summaryCard.iv-quality-summary .bars .bar .top>span:last-child strong{font-size:12px!important;font-weight:850!important}
#summaryCard.iv-quality-summary .bars .bar .top>span:last-child small{color:#96a19b!important;font-size:9px!important;font-weight:650!important}

@media(max-width:600px){
  body.iv-mode-kontrol #summaryCard.iv-quality-summary,
  #summaryCard.iv-quality-summary{width:100%!important;margin:10px 0 0!important;padding:12px!important;border-radius:14px!important}
  #summaryCard.iv-quality-summary .summary{gap:12px!important}
  #summaryCard.iv-quality-summary .score{min-width:58px!important;font-size:18px!important;padding:6px 9px!important}
  #summaryCard.iv-quality-summary .iv-quality-bars-heading{display:block!important;margin-bottom:10px!important}
  #summaryCard.iv-quality-summary .iv-quality-bars-heading span{display:block!important;margin-top:2px!important}
  #summaryCard.iv-quality-summary .bars .bar{grid-template-columns:minmax(0,1fr) auto!important;gap:5px 10px!important}
  #summaryCard.iv-quality-summary .bars .bar .top>span:first-child{grid-column:1!important;grid-row:1!important}
  #summaryCard.iv-quality-summary .bars .bar .top>span:last-child{grid-column:2!important;grid-row:1!important}
  #summaryCard.iv-quality-summary .bars .bar .track{grid-column:1 / -1!important;grid-row:2!important}
}
`;

function getNestedDoc(){
  try{return document.getElementById(FRAME_ID)?.contentDocument||null}catch(_){return null}
}

function ensureStyle(doc){
  if(!doc?.head)return;
  let style=doc.getElementById(STYLE_ID);
  if(!style){style=doc.createElement("style");style.id=STYLE_ID;doc.head.appendChild(style)}
  if(style.textContent!==CSS)style.textContent=CSS;
}

function normalizeRows(doc){
  doc.querySelectorAll("#barsChart .bar").forEach(row=>{
    const value=row.querySelector(".top>span:last-child");
    if(!value||value.querySelector("strong"))return;
    const match=(value.textContent||"").trim().match(/^(\d+)\s*\/\s*(\d+)\s*\((\d+)%\)$/);
    if(match)value.innerHTML=`<strong>${match[3]}%</strong><small>${match[1]}/${match[2]}</small>`;
  });
}

function applyLayout(doc){
  if(!doc?.body)return false;
  const summary=doc.getElementById("summaryCard");
  const site=doc.getElementById("site");
  const main=doc.querySelector("main");
  if(!summary||!site||!main)return false;

  ensureStyle(doc);
  summary.classList.add("iv-quality-summary");

  const hasControl=!!String(site.value||"").trim();
  if(!hasControl){summary.hidden=true;return true}
  summary.hidden=false;

  /* La synthèse reste dans le contrôle, après les photos. Le bouton PDF reste ensuite le dernier élément de la page. */
  if(summary.parentNode!==main || main.lastElementChild!==summary)main.appendChild(summary);

  const title=summary.querySelector(".summary>div:first-child>label.lbl");
  if(title)title.textContent="Synthèse du contrôle";

  const target=summary.querySelector(".score")?.nextElementSibling;
  if(target){target.classList.add("iv-quality-target");target.textContent="Objectif de référence : 95%"}

  const switcher=summary.querySelector(".display-switch");
  if(switcher)switcher.style.setProperty("display","none","important");
  const pie=doc.getElementById("pieWrap");
  if(pie)pie.style.setProperty("display","none","important");
  const fallback=doc.getElementById("pieFallback");
  if(fallback)fallback.style.setProperty("display","none","important");

  const barsWrap=doc.getElementById("barsWrap");
  if(barsWrap){
    barsWrap.style.setProperty("display","block","important");
    barsWrap.style.setProperty("max-width","none","important");
    barsWrap.style.setProperty("width","100%","important");
    let heading=doc.getElementById("ivQualityBarsHeading");
    if(!heading){
      heading=doc.createElement("div");
      heading.id="ivQualityBarsHeading";
      heading.className="iv-quality-bars-heading";
      heading.innerHTML="<strong>Répartition des résultats</strong><span>Lecture rapide du contrôle</span>";
      barsWrap.insertBefore(heading,barsWrap.firstChild);
    }
  }

  normalizeRows(doc);
  return true;
}

function scheduleApply(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;if(activeDoc)applyLayout(activeDoc)});
}

function attach(doc){
  if(!doc?.body)return;
  if(activeDoc!==doc){
    try{observer?.disconnect()}catch(_){ }
    activeDoc=doc;
    observer=new MutationObserver(scheduleApply);
    observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
    const site=doc.getElementById("site");
    if(site&&!site.dataset.ivQualityBarsBound){
      site.dataset.ivQualityBarsBound="1";
      site.addEventListener("input",scheduleApply);
      site.addEventListener("change",scheduleApply);
    }
  }
  applyLayout(doc);
  setTimeout(scheduleApply,120);
  setTimeout(scheduleApply,600);
}

function hookFrame(){
  const frame=document.getElementById(FRAME_ID);
  if(!frame)return;
  const sync=()=>{const doc=getNestedDoc();if(doc?.body)attach(doc)};
  if(!frame.dataset.ivQualityBarsHooked){
    frame.dataset.ivQualityBarsHooked="1";
    frame.addEventListener("load",()=>setTimeout(sync,50));
  }
  sync();
  setTimeout(sync,300);
  setTimeout(sync,1200);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hookFrame,{once:true});
else hookFrame();
})();
