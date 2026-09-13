(()=>{
"use strict";

const FRAME_ID="kontrolFrame";
const STYLE_ID="ivKontrolQualityBarsStyle";
let activeDoc=null;
let observer=null;
let scheduled=false;

const CSS=`
/* KONTROL — synthèse minimaliste, blanche et tout en bas de la page */
body.iv-quality-summary-bottom main{
  padding-bottom:24px!important;
}

#summaryCard.iv-quality-summary{
  display:block!important;
  width:calc(100% - 24px)!important;
  max-width:900px!important;
  margin:12px auto 24px!important;
  padding:16px!important;
  border:1px solid rgba(148,163,184,.4)!important;
  border-radius:16px!important;
  background:#ffffff!important;
  background-image:none!important;
  box-shadow:0 10px 30px rgba(15,23,42,.04)!important;
  color:#0f172a!important;
}

#summaryCard.iv-quality-summary,
#summaryCard.iv-quality-summary .summary,
#summaryCard.iv-quality-summary .summary>div,
#summaryCard.iv-quality-summary #barsWrap,
#summaryCard.iv-quality-summary #barsChart{
  background:#ffffff!important;
  background-image:none!important;
}

#summaryCard.iv-quality-summary .summary{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:16px!important;
}

#summaryCard.iv-quality-summary .summary>div:first-child{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  column-gap:18px!important;
  row-gap:4px!important;
  align-items:end!important;
  padding-bottom:14px!important;
  border-bottom:1px solid #e2e8f0!important;
}

#summaryCard.iv-quality-summary .summary>div:first-child>label.lbl{
  grid-column:1!important;
  margin:0!important;
  color:#64748b!important;
  font-size:11px!important;
  font-weight:800!important;
  letter-spacing:.08em!important;
  text-transform:uppercase!important;
}

#summaryCard.iv-quality-summary .score{
  grid-column:2!important;
  grid-row:1 / span 2!important;
  align-self:center!important;
  margin:0!important;
  font-size:34px!important;
  line-height:1!important;
  letter-spacing:-.035em!important;
  background:transparent!important;
}

#summaryCard.iv-quality-summary .iv-quality-target{
  grid-column:1!important;
  margin:0!important;
  color:#84928b!important;
  font-size:12px!important;
  line-height:1.35!important;
  background:transparent!important;
}

#summaryCard.iv-quality-summary .legend,
#summaryCard.iv-quality-summary .display-switch,
#summaryCard.iv-quality-summary #pieWrap,
#summaryCard.iv-quality-summary #pieFallback{
  display:none!important;
}

#summaryCard.iv-quality-summary #barsWrap{
  display:block!important;
  width:100%!important;
  max-width:none!important;
  margin:0!important;
}

#summaryCard.iv-quality-summary .iv-quality-bars-heading{
  display:flex!important;
  align-items:flex-end!important;
  justify-content:space-between!important;
  gap:12px!important;
  margin:0 0 14px!important;
  background:transparent!important;
}

#summaryCard.iv-quality-summary .iv-quality-bars-heading strong{
  color:#1f3d31!important;
  font-size:14px!important;
  font-weight:800!important;
}

#summaryCard.iv-quality-summary .iv-quality-bars-heading span{
  color:#819088!important;
  font-size:11px!important;
}

#summaryCard.iv-quality-summary .bars{
  display:grid!important;
  gap:13px!important;
  width:100%!important;
  color:#334155!important;
  font-size:12px!important;
}

#summaryCard.iv-quality-summary .bars .bar{
  display:grid!important;
  grid-template-columns:minmax(105px,145px) minmax(120px,1fr) 84px!important;
  gap:12px!important;
  align-items:center!important;
  background:transparent!important;
}

#summaryCard.iv-quality-summary .bars .bar .top{
  display:contents!important;
}

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
  width:8px;
  height:8px;
  flex:0 0 8px;
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
  height:8px!important;
  margin:0!important;
  border-radius:999px!important;
  background:#edf1f3!important;
  overflow:hidden!important;
}

#summaryCard.iv-quality-summary .bars .bar .fill{
  height:100%!important;
  min-width:0!important;
  border-radius:999px!important;
  box-shadow:none!important;
}

#summaryCard.iv-quality-summary .bars .bar:nth-child(4) .fill{
  background:#cbd5e1!important;
  outline:none!important;
}

#summaryCard.iv-quality-summary .bars .bar .top>span:last-child{
  grid-column:3!important;
  display:flex!important;
  align-items:baseline!important;
  justify-content:flex-end!important;
  gap:6px!important;
  color:#14251e!important;
  text-align:right!important;
  white-space:nowrap!important;
}

#summaryCard.iv-quality-summary .bars .bar .top>span:last-child strong{
  font-size:13px!important;
  font-weight:850!important;
}

#summaryCard.iv-quality-summary .bars .bar .top>span:last-child small{
  color:#96a19b!important;
  font-size:9px!important;
  font-weight:650!important;
}

@media(max-width:600px){
  body.iv-quality-summary-bottom main{padding-bottom:16px!important}
  #summaryCard.iv-quality-summary{
    width:calc(100% - 16px)!important;
    margin:8px auto 18px!important;
    padding:14px!important;
  }
  #summaryCard.iv-quality-summary .score{font-size:30px!important}
  #summaryCard.iv-quality-summary .iv-quality-bars-heading{display:block!important;margin-bottom:12px!important}
  #summaryCard.iv-quality-summary .iv-quality-bars-heading span{display:block!important;margin-top:2px!important}
  #summaryCard.iv-quality-summary .bars .bar{
    grid-template-columns:minmax(0,1fr) auto!important;
    gap:6px 10px!important;
  }
  #summaryCard.iv-quality-summary .bars .bar .top>span:first-child{grid-column:1!important;grid-row:1!important}
  #summaryCard.iv-quality-summary .bars .bar .top>span:last-child{grid-column:2!important;grid-row:1!important}
  #summaryCard.iv-quality-summary .bars .bar .track{grid-column:1 / -1!important;grid-row:2!important}
}
`;

function getNestedDoc(){
  try{return document.getElementById(FRAME_ID)?.contentDocument||null}
  catch(_){return null}
}

function ensureStyle(doc){
  if(!doc?.head)return;
  let style=doc.getElementById(STYLE_ID);
  if(!style){
    style=doc.createElement("style");
    style.id=STYLE_ID;
    doc.head.appendChild(style);
  }
  if(style.textContent!==CSS)style.textContent=CSS;
}

function normalizeRows(doc){
  doc.querySelectorAll("#barsChart .bar").forEach(row=>{
    const value=row.querySelector(".top>span:last-child");
    if(!value||value.querySelector("strong"))return;
    const match=(value.textContent||"").trim().match(/^(\d+)\s*\/\s*(\d+)\s*\((\d+)%\)$/);
    if(!match)return;
    value.innerHTML=`<strong>${match[3]}%</strong><small>${match[1]}/${match[2]}</small>`;
  });
}

function applyLayout(doc){
  if(!doc?.body)return false;
  const summary=doc.getElementById("summaryCard");
  if(!summary)return false;

  ensureStyle(doc);
  doc.body.classList.add("iv-quality-summary-bottom");
  summary.classList.add("iv-quality-summary");

  /* Dernier élément visible de la page : après les actions, les photos et tout le contrôle. */
  if(doc.body.lastElementChild!==summary)doc.body.appendChild(summary);

  const title=summary.querySelector(".summary>div:first-child>label.lbl");
  if(title&&title.textContent!=="Synthèse du contrôle")title.textContent="Synthèse du contrôle";

  const target=summary.querySelector(".score")?.nextElementSibling;
  if(target){
    target.classList.add("iv-quality-target");
    if(target.textContent.trim()!=="Objectif de référence : 95%")target.textContent="Objectif de référence : 95%";
  }

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
      heading.innerHTML="<strong>Répartition des résultats</strong><span>Lecture du contrôle en un coup d’œil</span>";
      barsWrap.insertBefore(heading,barsWrap.firstChild);
    }
  }

  normalizeRows(doc);
  return true;
}

function scheduleApply(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    if(activeDoc)applyLayout(activeDoc);
  });
}

function attach(doc){
  if(!doc?.body)return;
  if(activeDoc!==doc){
    try{observer?.disconnect()}catch(_){ }
    activeDoc=doc;
    observer=new MutationObserver(scheduleApply);
    observer.observe(doc.body,{childList:true,subtree:true});
  }
  applyLayout(doc);
  setTimeout(scheduleApply,100);
  setTimeout(scheduleApply,500);
  setTimeout(scheduleApply,1200);
}

function hookFrame(){
  const frame=document.getElementById(FRAME_ID);
  if(!frame)return;
  const sync=()=>{
    const doc=getNestedDoc();
    if(doc?.body)attach(doc);
  };
  if(!frame.dataset.ivQualityBarsHooked){
    frame.dataset.ivQualityBarsHooked="1";
    frame.addEventListener("load",()=>setTimeout(sync,40));
  }
  sync();
  setTimeout(sync,250);
  setTimeout(sync,1000);
  setTimeout(sync,2500);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hookFrame,{once:true});
else hookFrame();
})();
