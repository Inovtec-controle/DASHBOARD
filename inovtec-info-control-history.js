(()=>{
"use strict";
if(window.__INOVTEC_INFO_CONTROL_HISTORY_V3__)return;
window.__INOVTEC_INFO_CONTROL_HISTORY_V3__=true;
if(!window.firebase||!firebase.firestore)return;
if(!firebase.apps.length&&window.INOVTEC_FIREBASE_CONFIG)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
const db=firebase.firestore(),auth=firebase.auth?.(),META_TYPE="kontrolPdfMeta",RECORD_TYPE="kontrolControlRecord";
const d=document;
const form=d.getElementById("siteForm");
if(!form)return;

let metas=[],records=[],unsubMeta=null,unsubRecords=null,unsubSite=null,lastSiteId="",migrationBusy=false,renderTimer=null,authUser=null,retryTimer=null;
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
    #ivControlHistoryCard .iv-control-history-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    #ivControlHistoryCard .iv-control-history-delete{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 auto;white-space:nowrap;min-height:38px;padding:8px 12px!important;border:1px solid #dc2626!important;border-radius:10px!important;background:#fff1f2!important;color:#b91c1c!important;font-weight:800!important;cursor:pointer!important;visibility:visible!important;opacity:1!important}
    #ivControlHistoryCard .iv-control-history-delete:hover{background:#fee2e2!important}
    #ivControlHistoryCard .iv-control-history-actions{min-width:max-content}
    #ivControlViewer .iv-control-viewer-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    #ivControlViewer .iv-control-viewer-delete{display:inline-flex!important;align-items:center;justify-content:center;min-height:38px;padding:8px 12px;border:1px solid #dc2626;border-radius:10px;background:#fff1f2;color:#b91c1c;font-weight:800;cursor:pointer}
    #ivControlViewer{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.58);padding:24px;overflow:auto}
    #ivControlViewer[hidden]{display:none!important}
    #ivControlViewer .iv-control-viewer-panel{max-width:1080px;margin:0 auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.28);overflow:hidden}
    #ivControlViewer .iv-control-viewer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px 22px;border-bottom:1px solid #e5ece8;background:#f7fbf9}
    #ivControlViewer .iv-control-viewer-title{margin:0;font-size:20px;color:#17392d}
    #ivControlViewer .iv-control-viewer-sub{margin-top:5px;font-size:12px;color:#6f7f77}
    #ivControlViewer .iv-control-viewer-body{padding:20px 22px;display:grid;gap:18px}
    #ivControlViewer .iv-control-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    #ivControlViewer .iv-control-summary-card{padding:11px 12px;border:1px solid #dce8e2;border-radius:12px;background:#fbfdfc}
    #ivControlViewer .iv-control-summary-card small{display:block;color:#78887f;font-size:10px;margin-bottom:4px}
    #ivControlViewer .iv-control-summary-card strong{display:block;color:#17392d;font-size:13px;overflow-wrap:anywhere}
    #ivControlViewer .iv-control-section h3{margin:0 0 10px;font-size:14px;color:#17392d}
    #ivControlViewer .iv-control-task-list{display:grid;gap:7px}
    #ivControlViewer .iv-control-task{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:10px 12px;border:1px solid #e3ebe7;border-radius:11px;background:#fff}
    #ivControlViewer .iv-control-task-title{font-size:12px;font-weight:800;color:#263d34}
    #ivControlViewer .iv-control-task-comment{font-size:10px;color:#74837c;margin-top:4px;white-space:pre-wrap}
    #ivControlViewer .iv-status-chip{align-self:start;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:800;white-space:nowrap;background:#eef2f0;color:#5e6f66}
    #ivControlViewer .iv-status-chip.ok{background:#e8f7ee;color:#087a40}
    #ivControlViewer .iv-status-chip.mid{background:#fff7db;color:#8b6a00}
    #ivControlViewer .iv-status-chip.bad{background:#fff0ee;color:#b13d2a}
    #ivControlViewer .iv-status-chip.na{background:#edf0f2;color:#35434c}
    #ivControlViewer .iv-control-observations{padding:12px;border-radius:12px;background:#f8fbf9;border:1px solid #dfe9e4;font-size:11px;color:#40574d;white-space:pre-wrap}
    #ivControlViewer .iv-control-photos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    #ivControlViewer .iv-control-photo{margin:0;border:1px solid #dfe8e4;border-radius:12px;overflow:hidden;background:#f8fbf9;min-width:0}
    #ivControlViewer .iv-control-photo img{display:block;width:100%;height:180px;object-fit:cover;cursor:zoom-in}
    #ivControlViewer .iv-control-photo img.iv-control-photo-expanded{height:auto;max-height:none;object-fit:contain;cursor:zoom-out}
    #ivControlViewer .iv-control-photo figcaption{padding:8px 9px;font-size:10px;color:#5f7068;overflow-wrap:anywhere}
    #ivControlViewer .iv-control-photo-loading{padding:14px;border:1px dashed #cedbd5;border-radius:12px;color:#6f7f77;font-size:11px}
    #ivControlViewer .iv-control-close{flex:0 0 auto}
    @media(max-width:760px){#ivControlViewer{padding:8px}#ivControlViewer .iv-control-viewer-head{padding:16px}#ivControlViewer .iv-control-viewer-body{padding:14px}#ivControlViewer .iv-control-summary{grid-template-columns:1fr 1fr}#ivControlViewer .iv-control-photos{grid-template-columns:1fr 1fr}#ivControlViewer .iv-control-photo img{height:150px}}
    @media(max-width:620px){
      #ivControlHistoryCard .iv-control-history-row{align-items:stretch;flex-direction:column}
      #ivControlHistoryCard .iv-control-history-open{width:100%}
      #ivControlHistoryCard .iv-control-history-actions{width:100%;min-width:0;display:grid;grid-template-columns:1fr}
      #ivControlHistoryCard .iv-control-history-delete{width:100%}
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
function statusLabel(value){
  return ({ok:"Bien fait",mid:"Passable",bad:"Mal fait",na:"Pas faits"})[String(value||"")]||"Non renseigné";
}
async function readControlPhoto(ref){
  const ids=Array.isArray(ref?.chunkIds)?ref.chunkIds.map(String).filter(Boolean):[];
  if(!ids.length)throw new Error("Photo sans contenu partagé");
  const snaps=[];
  for(let start=0;start<ids.length;start+=20){
    const part=await Promise.all(ids.slice(start,start+20).map(id=>db.collection("chantiers").doc(id).get()));
    snaps.push(...part);
  }
  const pieces=snaps.map(s=>{if(!s.exists)throw new Error("Une partie de la photo est manquante");return s.data()||{}})
    .sort((a,b)=>(Number(a.chunkIndex)||0)-(Number(b.chunkIndex)||0));
  const dataUrl=pieces.map(x=>String(x.data||"")).join("");
  if(!dataUrl.startsWith("data:image/"))throw new Error("Photo invalide");
  return dataUrl;
}
function ensureViewer(){
  let viewer=d.getElementById("ivControlViewer");
  if(viewer)return viewer;
  viewer=d.createElement("div");
  viewer.id="ivControlViewer";
  viewer.hidden=true;
  viewer.innerHTML='<section class="iv-control-viewer-panel" role="dialog" aria-modal="true" aria-labelledby="ivControlViewerTitle"><div class="iv-control-viewer-head"><div><h2 id="ivControlViewerTitle" class="iv-control-viewer-title">Contrôle qualité</h2><div id="ivControlViewerSub" class="iv-control-viewer-sub"></div></div><div class="iv-control-viewer-actions"><button id="ivControlViewerDelete" class="iv-control-viewer-delete" type="button">Supprimer</button><button id="ivControlViewerClose" class="btn btn-secondary iv-control-close" type="button">Fermer</button></div></div><div id="ivControlViewerBody" class="iv-control-viewer-body"></div></section>';
  d.body.appendChild(viewer);
  viewer.querySelector("#ivControlViewerClose")?.addEventListener("click",()=>{viewer.hidden=true});
  viewer.addEventListener("click",event=>{if(event.target===viewer)viewer.hidden=true});
  d.addEventListener("keydown",event=>{if(event.key==="Escape"&&!viewer.hidden)viewer.hidden=true});
  return viewer;
}
function summaryCard(label,value){
  const card=d.createElement("div");card.className="iv-control-summary-card";
  const small=d.createElement("small");small.textContent=label;
  const strong=d.createElement("strong");strong.textContent=String(value||"—");
  card.append(small,strong);return card;
}
async function openControlViewer(item,button){
  const viewer=ensureViewer(),body=viewer.querySelector("#ivControlViewerBody"),title=viewer.querySelector("#ivControlViewerTitle"),sub=viewer.querySelector("#ivControlViewerSub");
  viewer.hidden=false;
  title.textContent="Contrôle qualité — "+(item.site||selectedSiteName()||"Chantier");
  sub.textContent=[formatControlDate(item.controlDate),item.controlTime,item.createdByEmail?("Enregistré par "+item.createdByEmail):""].filter(Boolean).join(" • ");
  const viewerDelete=viewer.querySelector("#ivControlViewerDelete");
  if(viewerDelete){
    viewerDelete.onclick=()=>deleteControlRecord(item,viewerDelete);
    viewerDelete.disabled=false;
    viewerDelete.textContent="Supprimer";
  }
  body.innerHTML="";
  const summary=d.createElement("div");summary.className="iv-control-summary";
  summary.append(summaryCard("Note",item.score||"—"),summaryCard("Contrôleur",item.controller||"—"),summaryCard("Agent(s)",item.agents||"—"),summaryCard("Photos",String(Number(item.photoCount)||0)));
  body.appendChild(summary);

  const taskSection=d.createElement("section");taskSection.className="iv-control-section";
  const taskTitle=d.createElement("h3");taskTitle.textContent="Détail du contrôle";taskSection.appendChild(taskTitle);
  const taskList=d.createElement("div");taskList.className="iv-control-task-list";
  const tasks=Array.isArray(item.tasks)?item.tasks:[];
  if(!tasks.length){const empty=d.createElement("div");empty.className="iv-control-photo-loading";empty.textContent="Aucun détail de tâche enregistré pour ce contrôle.";taskList.appendChild(empty)}
  tasks.forEach(task=>{
    const row=d.createElement("div");row.className="iv-control-task";
    const copy=d.createElement("div"),name=d.createElement("div");name.className="iv-control-task-title";name.textContent=String(task.title||"Prestation");copy.appendChild(name);
    if(task.comment){const comment=d.createElement("div");comment.className="iv-control-task-comment";comment.textContent=String(task.comment);copy.appendChild(comment)}
    const chip=d.createElement("span");chip.className="iv-status-chip "+String(task.status||"");chip.textContent=statusLabel(task.status);
    row.append(copy,chip);taskList.appendChild(row);
  });
  taskSection.appendChild(taskList);body.appendChild(taskSection);

  const obsSection=d.createElement("section");obsSection.className="iv-control-section";
  const obsTitle=d.createElement("h3");obsTitle.textContent="Observations";obsSection.appendChild(obsTitle);
  const obs=d.createElement("div");obs.className="iv-control-observations";obs.textContent=item.observations||"Aucune observation.";obsSection.appendChild(obs);body.appendChild(obsSection);

  const photosSection=d.createElement("section");photosSection.className="iv-control-section";
  const photosTitle=d.createElement("h3");photosTitle.textContent="Photos du contrôle";photosSection.appendChild(photosTitle);
  const grid=d.createElement("div");grid.className="iv-control-photos";photosSection.appendChild(grid);body.appendChild(photosSection);
  const refs=Array.isArray(item.photoRefs)?item.photoRefs:[];
  if(!refs.length){const empty=d.createElement("div");empty.className="iv-control-photo-loading";empty.textContent="Aucune photo enregistrée pour ce contrôle.";grid.appendChild(empty);return}
  if(button){button.disabled=true;button.textContent="Chargement…"}
  for(let i=0;i<refs.length;i++){
    const ref=refs[i],figure=d.createElement("figure");figure.className="iv-control-photo";
    const loading=d.createElement("div");loading.className="iv-control-photo-loading";loading.textContent="Chargement de la photo "+(i+1)+"…";figure.appendChild(loading);grid.appendChild(figure);
    try{
      const dataUrl=await readControlPhoto(ref);
      figure.innerHTML="";
      const img=d.createElement("img");img.src=dataUrl;img.alt=ref.caption||("Photo du contrôle "+(i+1));
      img.addEventListener("click",()=>img.classList.toggle("iv-control-photo-expanded"));
      figure.appendChild(img);
      const caption=String(ref.caption||ref.name||"").trim();
      if(caption){const figcaption=d.createElement("figcaption");figcaption.textContent=caption;figure.appendChild(figcaption)}
    }catch(error){
      loading.textContent="Photo indisponible.";console.warn("Photo historique KONTROL",error);
    }
  }
  if(button){button.disabled=false;button.textContent="Visualiser le contrôle"}
}
async function deleteDocsByIds(ids){
  const clean=[...new Set((ids||[]).map(String).filter(Boolean))];
  for(let start=0;start<clean.length;start+=200){
    const batch=db.batch();
    clean.slice(start,start+200).forEach(id=>batch.delete(db.collection("chantiers").doc(id)));
    await batch.commit();
  }
}
async function deleteControlRecord(item,button){
  const recordId=String(item?.__docId||item?.recordId||"").trim();
  const chantierId=String(item?.chantierId||selectedSiteId()||"").trim();
  if(!recordId||!chantierId)return;
  const label=[formatControlDate(item.controlDate),item.controlTime].filter(Boolean).join(" à ");
  if(!confirm("Supprimer définitivement ce contrôle"+(label?" du "+label:"")+" ?\n\nLe contrôle et ses photos seront supprimés de l’historique."))return;
  if(button){button.disabled=true;button.textContent="Suppression…"}
  try{
    const photoChunkIds=[];
    (Array.isArray(item.photoRefs)?item.photoRefs:[]).forEach(ref=>{
      (Array.isArray(ref?.chunkIds)?ref.chunkIds:[]).forEach(id=>photoChunkIds.push(String(id)));
    });
    await deleteDocsByIds(photoChunkIds);
    const batch=db.batch();
    batch.delete(db.collection("chantiers").doc(recordId));
    batch.set(db.collection("chantiers").doc(chantierId),{
      kontrolHistoryRecordIds:firebase.firestore.FieldValue.arrayRemove(recordId),
      kontrolHistoryUpdatedAtMs:Date.now()
    },{merge:true});
    await batch.commit();
    records=records.filter(x=>String(x.__docId||x.recordId||"")!==recordId);
    const viewer=d.getElementById("ivControlViewer");if(viewer&&!viewer.hidden)viewer.hidden=true;
    scheduleRender(0);
  }catch(error){
    console.error("Suppression contrôle KONTROL impossible",error);
    alert("Impossible de supprimer ce contrôle pour le moment.");
    if(button){button.disabled=false;button.textContent="Supprimer"}
  }
}
async function deletePdfHistory(item,button){
  const metaId=String(item?.__docId||"").trim();
  const chantierId=String(item?.chantierId||item?.customMetadata?.chantierId||selectedSiteId()||"").trim();
  if(!metaId||!chantierId)return;
  const custom=item.customMetadata||{};
  const label=formatControlDate(custom.controlDate||item.controlDate);
  if(!confirm("Supprimer définitivement ce contrôle PDF"+(label?" du "+label:"")+" de l’historique ?"))return;
  if(button){button.disabled=true;button.textContent="Suppression…"}
  try{
    await deleteDocsByIds(Array.isArray(item.chunkIds)?item.chunkIds:[]);
    const batch=db.batch();
    batch.delete(db.collection("chantiers").doc(metaId));
    batch.set(db.collection("chantiers").doc(chantierId),{
      kontrolHistoryMetaIds:firebase.firestore.FieldValue.arrayRemove(metaId),
      kontrolHistoryUpdatedAtMs:Date.now()
    },{merge:true});
    await batch.commit();
    try{
      const path=String(item.storagePath||"").trim();
      if(path&&firebase.storage){await firebase.storage().ref().child(path).delete()}
    }catch(storageError){console.warn("PDF Storage conservé faute de droit",storageError)}
    metas=metas.filter(x=>String(x.__docId||"")!==metaId);
    scheduleRender(0);
  }catch(error){
    console.error("Suppression historique PDF KONTROL impossible",error);
    alert("Impossible de supprimer ce contrôle PDF pour le moment.");
    if(button){button.disabled=false;button.textContent="Supprimer"}
  }
}
function upsertMetas(rows){
  const map=new Map(metas.map(x=>[String(x.__docId||""),x]));
  (rows||[]).forEach(x=>{if(x?.__docId)map.set(String(x.__docId),x)});
  metas=[...map.values()];
}
function upsertRecords(rows){
  const map=new Map(records.map(x=>[String(x.__docId||x.recordId||""),x]));
  (rows||[]).forEach(x=>{
    const key=String(x?.__docId||x?.recordId||"");
    if(key)map.set(key,x);
  });
  records=[...map.values()];
}
async function loadIndexedMetas(siteId,siteData){
  const ids=Array.isArray(siteData?.kontrolHistoryMetaIds)?siteData.kontrolHistoryMetaIds.map(String).filter(Boolean):[];
  if(!ids.length)return;
  const rows=[];
  for(let start=0;start<ids.length;start+=20){
    const part=await Promise.all(ids.slice(start,start+20).map(async id=>{
      try{
        const snap=await db.collection("chantiers").doc(id).get();
        return snap.exists?{__docId:snap.id,...(snap.data()||{})}:null;
      }catch{return null}
    }));
    rows.push(...part.filter(Boolean));
  }
  upsertMetas(rows);
}
async function loadIndexedRecords(siteId,siteData){
  const ids=Array.isArray(siteData?.kontrolHistoryRecordIds)?siteData.kontrolHistoryRecordIds.map(String).filter(Boolean):[];
  if(!ids.length)return;
  const rows=[];
  for(let start=0;start<ids.length;start+=20){
    const part=await Promise.all(ids.slice(start,start+20).map(async id=>{
      try{
        const snap=await db.collection("chantiers").doc(id).get();
        return snap.exists?{__docId:snap.id,...(snap.data()||{})}:null;
      }catch{return null}
    }));
    rows.push(...part.filter(Boolean));
  }
  upsertRecords(rows);
}
function bindSelectedSiteIndex(){
  const siteId=selectedSiteId();
  if(unsubSite){try{unsubSite()}catch{}unsubSite=null}
  if(!siteId||!authUser)return;
  unsubSite=db.collection("chantiers").doc(siteId).onSnapshot(async snap=>{
    if(!snap.exists)return;
    const data=snap.data()||{};
    try{await Promise.all([loadIndexedMetas(siteId,data),loadIndexedRecords(siteId,data)])}catch(error){console.warn("Index historique KONTROL",error)}
    scheduleRender(0);
  },error=>console.warn("Lecture index historique KONTROL",error));
}
function matchingRows(siteId){
  const pdfRows=metas.filter(meta=>String(meta?.chantierId||meta?.customMetadata?.chantierId||"").trim()===siteId)
    .map(meta=>({...meta,__kind:"pdf"}));
  const controlRows=records.filter(row=>String(row?.chantierId||"").trim()===siteId)
    .map(row=>({...row,__kind:"record"}));
  return pdfRows.concat(controlRows).sort((a,b)=>createdMs(b)-createdMs(a));
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
  rows.forEach(item=>{
    const row=d.createElement("div");row.className="iv-control-history-row";
    const copy=d.createElement("div");copy.className="iv-control-history-copy";
    const title=d.createElement("div");title.className="iv-control-history-title";
    const details=d.createElement("div");details.className="iv-control-history-meta";

    if(item.__kind==="record"){
      title.textContent="Contrôle qualité";
      const bits=[];
      const fallbackDate=item.timeCreated||(item.createdAtMs?new Date(Number(item.createdAtMs)).toISOString():"");
      const displayDate=formatControlDate(item.controlDate||fallbackDate);
      if(displayDate)bits.push(displayDate);
      if(item.controlTime)bits.push(item.controlTime);
      if(item.score)bits.push("Note : "+item.score);
      if(item.controller)bits.push("Contrôleur : "+item.controller);
      if(item.agents)bits.push("Agent(s) : "+item.agents);
      details.textContent=bits.join(" • ")||"Contrôle KONTROL enregistré";
      copy.append(title,details);
      if(item.observations){
        const obs=d.createElement("div");
        obs.className="iv-control-history-meta";
        obs.style.marginTop="6px";
        obs.textContent="Observations : "+item.observations;
        copy.appendChild(obs);
      }
      const actions=d.createElement("div");actions.className="iv-control-history-actions";
      const badge=d.createElement("span");badge.className="status ok";badge.textContent=(Number(item.photoCount)||0)?((Number(item.photoCount)||0)+" photo"+((Number(item.photoCount)||0)>1?"s":"")):"Contrôle enregistré";
      const button=d.createElement("button");button.type="button";button.className="btn btn-secondary iv-control-history-open";button.textContent="Visualiser le contrôle";
      button.addEventListener("click",()=>openControlViewer(item,button));
      const del=d.createElement("button");del.type="button";del.className="iv-control-history-delete";del.textContent="Supprimer";del.title="Supprimer ce contrôle";del.setAttribute("aria-label","Supprimer ce contrôle");
      del.addEventListener("click",()=>deleteControlRecord(item,del));
      actions.append(badge,button,del);
      row.append(copy,actions);
    }else{
      const custom=item.customMetadata||{};
      title.textContent=formatControlDate(custom.controlDate||item.controlDate)||"Contrôle qualité";
      const bits=[];
      if(custom.controller)bits.push("Contrôleur : "+custom.controller);
      if(custom.agents)bits.push("Agent(s) : "+custom.agents);
      if(item.createdByEmail)bits.push("Enregistré par "+item.createdByEmail);
      details.textContent=bits.join(" • ")||String(item.originalName||custom.originalName||"PDF KONTROL");
      const actions=d.createElement("div");actions.className="iv-control-history-actions";
      const button=d.createElement("button");button.type="button";button.className="btn btn-secondary iv-control-history-open";button.textContent="Consulter le PDF";
      button.addEventListener("click",()=>openPdf(item,button));
      const del=d.createElement("button");del.type="button";del.className="iv-control-history-delete";del.textContent="Supprimer";del.title="Supprimer ce contrôle";del.setAttribute("aria-label","Supprimer ce contrôle");
      del.addEventListener("click",()=>deletePdfHistory(item,del));
      actions.append(button,del);
      copy.append(title,details);row.append(copy,actions);
    }
    list.appendChild(row);
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
    const ids=[];
    for(const meta of candidates){
      const metaId=String(meta.__docId||"");
      if(!metaId)continue;
      ids.push(metaId);
      await db.collection("chantiers").doc(metaId).set({
        chantierId:siteId,
        customMetadata:{...(meta.customMetadata||{}),chantierId:siteId},
        referenceVersion:2
      },{merge:true});
    }
    if(ids.length){
      await db.collection("chantiers").doc(siteId).set({
        kontrolHistoryMetaIds:firebase.firestore.FieldValue.arrayUnion(...ids),
        kontrolHistoryUpdatedAtMs:Date.now()
      },{merge:true});
    }
  }catch(error){console.warn("Rattachement ancien contrôle KONTROL",error)}
  finally{migrationBusy=false}
}
function subscribeMeta(){
  if(unsubMeta||!authUser)return;
  clearTimeout(retryTimer);
  unsubMeta=db.collection("chantiers").where("_type","==",META_TYPE).onSnapshot(snapshot=>{
    upsertMetas(snapshot.docs.map(x=>({__docId:x.id,...(x.data()||{})})));
    scheduleRender(0);
    setTimeout(migrateExactLegacyLinks,60);
  },error=>{
    console.error("Historique PDF des contrôles indisponible",error);
    try{unsubMeta?.()}catch{}
    unsubMeta=null;
    if(auth.currentUser)retryTimer=setTimeout(()=>subscribeMeta(),1500);
  });
}
function subscribeRecords(){
  if(unsubRecords||!authUser)return;
  unsubRecords=db.collection("chantiers").where("_type","==",RECORD_TYPE).onSnapshot(snapshot=>{
    upsertRecords(snapshot.docs.map(x=>({__docId:x.id,...(x.data()||{})})));
    scheduleRender(0);
  },error=>{
    console.error("Historique direct KONTROL indisponible",error);
    try{unsubRecords?.()}catch{}
    unsubRecords=null;
    if(auth.currentUser)setTimeout(()=>subscribeRecords(),1500);
  });
}
ensureCard();
const observer=new MutationObserver(muts=>{
  if(muts.some(m=>m.type==="attributes"&&(m.attributeName==="data-iv-chantier-id"||m.attributeName==="class"))){
    const id=selectedSiteId();
    if(id!==lastSiteId){lastSiteId=id;bindSelectedSiteIndex();scheduleRender(0);setTimeout(migrateExactLegacyLinks,70)}
  }
});
observer.observe(form,{attributes:true,attributeFilter:["data-iv-chantier-id","class"]});
d.addEventListener("click",event=>{
  if(event.target?.closest?.(".site-item"))setTimeout(()=>{lastSiteId=selectedSiteId();bindSelectedSiteIndex();scheduleRender(0);migrateExactLegacyLinks()},50);
},true);
d.addEventListener("iv:chantier-saved",()=>setTimeout(()=>{lastSiteId=selectedSiteId();bindSelectedSiteIndex();scheduleRender(0);migrateExactLegacyLinks()},70));
if(auth){
  auth.onAuthStateChanged(user=>{
    authUser=user||null;
    clearTimeout(retryTimer);
    if(unsubMeta){try{unsubMeta()}catch{}unsubMeta=null}
    if(unsubRecords){try{unsubRecords()}catch{}unsubRecords=null}
    if(unsubSite){try{unsubSite()}catch{}unsubSite=null}
    if(!user){
      metas=[];
      records=[];
      scheduleRender(0);
      return;
    }
    subscribeMeta();
    subscribeRecords();
    bindSelectedSiteIndex();
    setTimeout(()=>{
      if(auth.currentUser&&!unsubMeta)subscribeMeta();
      if(auth.currentUser&&!unsubRecords)subscribeRecords();
    },700);
  });
}else{
  authUser={uid:"compat"};
  subscribeMeta();
  subscribeRecords();
  bindSelectedSiteIndex();
}
scheduleRender(0);
})();