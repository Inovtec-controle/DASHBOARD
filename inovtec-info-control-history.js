(()=>{
"use strict";
if(window.__INOVTEC_INFO_CONTROL_HISTORY_V2__)return;
window.__INOVTEC_INFO_CONTROL_HISTORY_V2__=true;
if(!window.firebase||!firebase.firestore)return;
if(!firebase.apps.length&&window.INOVTEC_FIREBASE_CONFIG)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
const db=firebase.firestore(),META_TYPE="kontrolPdfMeta";
const d=document;
const form=d.getElementById("siteForm");
if(!form)return;

let metas=[],unsubMeta=null,lastSiteId="",migrationBusy=false,renderTimer=null;
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

function selectedSiteId(){return String(form.dataset.ivChantierId||"").trim()}
function selectedSiteName(){return String(d.getElementById("nom")?.value||"").trim()}

function ensureStyle(){
  if(d.getElementById("ivControlHistoryStyle"))return;
  const s=d.createElement("style");s.id="ivControlHistoryStyle";
  s.textContent=`
    #ivControlHistoryCard{margin-top:14px}
    #ivControlHistoryCard .iv-control-history-list{display:grid;gap:8px;margin-top:10px}
    #ivControlHistoryCard .iv-control-history-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #dce8e2;border-radius:12px;background:#fff}
    #ivControlHistoryCard .iv-control-history-copy{min-width:0;flex:1}
    #ivControlHistoryCard .iv-control-history-title{font-size:12px;font-weight:800;color:#17392d}
    #ivControlHistoryCard .iv-control-history-meta{font-size:10px;line-height:1.45;color:#708078;margin-top:3px;overflow-wrap:anywhere}
    #ivControlHistoryCard .iv-control-history-empty{padding:14px;border:1px dashed #cedbd5;border-radius:12px;background:#f8fbf9;color:#6f7f77;font-size:11px;text-align:center}
    #ivControlHistoryCard .iv-control-history-open{flex:0 0 auto;white-space:nowrap}
    @media(max-width:620px){
      #ivControlHistoryCard .iv-control-history-row{align-items:stretch;flex-direction:column}
      #ivControlHistoryCard .iv-control-history-open{width:100%}
    }
  `;
  d.head.appendChild(s);
}
function ensureCard(){
  ensureStyle();
  let card=d.getElementById("ivControlHistoryCard");
  if(!card){
    card=d.createElement("section");card.id="ivControlHistoryCard";card.className="card";
    const head=d.createElement("div");head.className="section-title";
    const title=d.createElement("h2");title.textContent="Historique des contrôles";
    const count=d.createElement("span");count.id="ivControlHistoryCount";count.className="status";count.textContent="0";
    const list=d.createElement("div");list.id="ivControlHistoryList";list.className="iv-control-history-list";
    head.append(title,count);card.append(head,list);
  }
  const sticky=form.querySelector(".sticky-save");
  if(sticky&&card.nextElementSibling!==sticky)form.insertBefore(card,sticky);
  else if(!card.parentElement)form.appendChild(card);
  return card;
}
function formatControlDate(value){
  const raw=String(value||"").trim(),m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m)return `${m[3]}/${m[2]}/${m[1]}`;
  if(!raw)return"";
  const x=new Date(raw);
  return Number.isNaN(x.getTime())?raw:new Intl.DateTimeFormat("fr-FR",{dateStyle:"short"}).format(x);
}
function createdMs(meta){
  const n=Number(meta?.createdAtMs)||0;if(n)return n;
  const x=Date.parse(meta?.timeCreated||"");return Number.isNaN(x)?0:x;
}
function dataUrlToBlob(dataUrl){
  const i=dataUrl.indexOf(",");if(i<0)throw new Error("PDF partagé invalide");
  const head=dataUrl.slice(0,i),b64=dataUrl.slice(i+1),mime=(head.match(/^data:([^;]+)/)||[])[1]||"application/pdf";
  const bin=atob(b64),bytes=new Uint8Array(bin.length);
  for(let n=0;n<bin.length;n++)bytes[n]=bin.charCodeAt(n);
  return new Blob([bytes],{type:mime});
}
async function readSharedBlob(meta){
  const ids=Array.isArray(meta?.chunkIds)?meta.chunkIds:[];
  if(!ids.length)throw new Error("PDF sans contenu partagé");
  const snaps=[];
  for(let start=0;start<ids.length;start+=20){
    const part=await Promise.all(ids.slice(start,start+20).map(id=>db.collection("chantiers").doc(String(id)).get()));
    snaps.push(...part);
  }
  const pieces=snaps.map(s=>{
    if(!s.exists)throw new Error("Une partie du PDF est manquante");
    return s.data()||{};
  }).sort((a,b)=>(Number(a.chunkIndex)||0)-(Number(b.chunkIndex)||0));
  return dataUrlToBlob(pieces.map(x=>String(x.data||"")).join(""));
}
async function openPdf(meta,button){
  const popup=window.open("about:blank","_blank");
  if(button){button.disabled=true;button.textContent="Ouverture…"}
  try{
    const blob=await readSharedBlob(meta),url=URL.createObjectURL(blob);
    if(popup)popup.location.replace(url);
    else{const a=d.createElement("a");a.href=url;a.target="_blank";a.rel="noopener";a.click()}
    setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(error){
    if(popup)popup.close();
    console.error("Ouverture historique KONTROL impossible",error);
    alert("Impossible d’ouvrir ce PDF de contrôle. Réessaie dans quelques instants.");
  }finally{
    if(button){button.disabled=false;button.textContent="Consulter le PDF"}
  }
}
function matchingRows(siteId){
  return metas.filter(meta=>String(meta?.chantierId||meta?.customMetadata?.chantierId||"").trim()===siteId)
    .sort((a,b)=>createdMs(b)-createdMs(a));
}
function render(){
  const card=ensureCard(),list=d.getElementById("ivControlHistoryList"),count=d.getElementById("ivControlHistoryCount");
  if(!card||!list||!count)return;
  const siteId=selectedSiteId();
  if(form.classList.contains("hidden")||!siteId){
    count.textContent="0";
    list.innerHTML='<div class="iv-control-history-empty">Sélectionne un chantier enregistré pour afficher ses contrôles.</div>';
    return;
  }
  const rows=matchingRows(siteId);count.textContent=String(rows.length);list.innerHTML="";
  if(!rows.length){
    const empty=d.createElement("div");empty.className="iv-control-history-empty";empty.textContent="Aucun contrôle enregistré pour ce chantier.";list.appendChild(empty);return;
  }
  rows.forEach(meta=>{
    const custom=meta.customMetadata||{},row=d.createElement("div");row.className="iv-control-history-row";
    const copy=d.createElement("div");copy.className="iv-control-history-copy";
    const title=d.createElement("div");title.className="iv-control-history-title";
    title.textContent=formatControlDate(custom.controlDate||meta.controlDate)||"Contrôle qualité";
    const details=d.createElement("div");details.className="iv-control-history-meta";
    const bits=[];
    if(custom.controller)bits.push("Contrôleur : "+custom.controller);
    if(custom.agents)bits.push("Agent(s) : "+custom.agents);
    if(meta.createdByEmail)bits.push("Enregistré par "+meta.createdByEmail);
    details.textContent=bits.join(" • ")||String(meta.originalName||custom.originalName||"PDF KONTROL");
    const button=d.createElement("button");button.type="button";button.className="btn btn-secondary iv-control-history-open";button.textContent="Consulter le PDF";
    button.addEventListener("click",()=>openPdf(meta,button));
    copy.append(title,details);row.append(copy,button);list.appendChild(row);
  });
}
function scheduleRender(delay=30){clearTimeout(renderTimer);renderTimer=setTimeout(render,delay)}
async function migrateExactLegacyLinks(){
  if(migrationBusy)return;
  const siteId=selectedSiteId(),name=selectedSiteName();
  if(!siteId||!name)return;
  const candidates=metas.filter(meta=>{
    const linked=String(meta?.chantierId||meta?.customMetadata?.chantierId||"").trim();
    return !linked&&norm(meta?.customMetadata?.site||meta?.site||"")===norm(name);
  });
  if(!candidates.length)return;
  migrationBusy=true;
  try{
    const siteSnap=await db.collection("chantiers").doc(siteId).get();
    const savedName=siteSnap.exists?String(siteSnap.data()?.nom||"").trim():"";
    if(!savedName||norm(savedName)!==norm(name))return;
    for(const meta of candidates){
      await db.collection("chantiers").doc(String(meta.__docId)).set({
        chantierId:siteId,
        customMetadata:{...(meta.customMetadata||{}),chantierId:siteId},
        referenceVersion:1
      },{merge:true});
    }
  }catch(error){console.warn("Rattachement ancien contrôle KONTROL",error)}
  finally{migrationBusy=false}
}
function subscribeMeta(){
  if(unsubMeta)return;
  unsubMeta=db.collection("chantiers").where("_type","==",META_TYPE).onSnapshot(snapshot=>{
    metas=snapshot.docs.map(x=>({__docId:x.id,...(x.data()||{})}));
    scheduleRender(0);setTimeout(migrateExactLegacyLinks,60);
  },error=>{
    console.error("Historique des contrôles indisponible",error);
    const list=d.getElementById("ivControlHistoryList");
    if(list)list.innerHTML='<div class="iv-control-history-empty">Impossible de charger l’historique des contrôles.</div>';
  });
}
ensureCard();
const observer=new MutationObserver(muts=>{
  if(muts.some(m=>m.type==="attributes"&&(m.attributeName==="data-iv-chantier-id"||m.attributeName==="class"))){
    const id=selectedSiteId();
    if(id!==lastSiteId){lastSiteId=id;scheduleRender(0);setTimeout(migrateExactLegacyLinks,70)}
  }
});
observer.observe(form,{attributes:true,attributeFilter:["data-iv-chantier-id","class"]});
d.addEventListener("click",event=>{
  if(event.target?.closest?.(".site-item"))setTimeout(()=>{lastSiteId=selectedSiteId();scheduleRender(0);migrateExactLegacyLinks()},50);
},true);
d.addEventListener("iv:chantier-saved",()=>setTimeout(()=>{lastSiteId=selectedSiteId();scheduleRender(0);migrateExactLegacyLinks()},70));
subscribeMeta();scheduleRender(0);
})();