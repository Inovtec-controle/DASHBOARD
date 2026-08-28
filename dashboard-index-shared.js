(()=>{
"use strict";
if(window.__INOVTEC_DASHBOARD_SHARED_METRICS_V2__)return;
window.__INOVTEC_DASHBOARD_SHARED_METRICS_V2__=true;
if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG)return;
if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
if(!firebase.auth||!firebase.firestore)return;

const auth=firebase.auth();
const db=firebase.firestore();
const storage=firebase.storage?firebase.storage():null;
const SHARED_ID="__inovtec_shared_workspace_v1__";
const DISC_ID="__inovtec_shared_discipline_v1__";
const $=id=>document.getElementById(id);
const set=(id,value)=>{const e=$(id);if(e)e.textContent=String(value)};
const parse=(s,f=null)=>{try{const v=JSON.parse(String(s||""));return v??f}catch{return f}};
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

function localJson(key,fallback){
  try{return parse(localStorage.getItem(key)||"",fallback)}catch{return fallback}
}
function dataOf(result){
  return result&&result.status==="fulfilled"&&result.value?.exists?(result.value.data()||{}):{};
}
function modulePayload(data,mode,fallback){
  return parse(data?.moduleSyncV1?.[mode]?.payload||"",fallback);
}
function mergeRows(...lists){
  const out=[],seen=new Set();
  for(const list of lists){
    for(const row of(Array.isArray(list)?list:[])){
      if(!row||typeof row!=="object")continue;
      const fallback=[row.name,row.displayName,row.agent,row.agentName,row.title,row.date].filter(Boolean).join("|");
      const key=String(row.id||row.agentRefId||row.pdfId||fallback||JSON.stringify(row));
      if(seen.has(key))continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}
function agentsFrom(data){
  const rows=modulePayload(data,"agents",null);
  if(Array.isArray(rows))return rows;
  return Array.isArray(data?.referentialAgents)?data.referentialAgents:[];
}
function disciplineFrom(data){
  if(Array.isArray(data?.recordsV9))return data.recordsV9;
  if(Array.isArray(data?.recordsV8))return data.recordsV8;
  if(Array.isArray(data?.recordsV7))return data.recordsV7;
  if(Array.isArray(data?.records))return data.records;
  if(Array.isArray(data?.disciplineRecordsV9))return data.disciplineRecordsV9;
  if(Array.isArray(data?.disciplineRecordsV8))return data.disciplineRecordsV8;
  return[];
}
function localDiscipline(uid){
  const keys=[
    "inovtec_discipline_cache_v9_"+uid,
    "inovtec_discipline_pending_v9_"+uid,
    "inovtec_discipline_cache_v8",
    "inovtec_discipline_cloud_cache_v5",
    "inovtec_discipline_v2",
    "discipline"
  ];
  const lists=[];
  for(const key of keys){
    const value=localJson(key,null);
    if(Array.isArray(value))lists.push(value);
    else if(Array.isArray(value?.records))lists.push(value.records);
  }
  return mergeRows(...lists);
}
function isOpenRecord(record){
  if(record?.deleted===true||record?.archived===true)return false;
  const s=norm(record?.statut||record?.status||"ouvert");
  return !["clos","cloture","cloturee","ferme","fermee","archive","archivee"].includes(s);
}
function mirror(){
  const pairs=[
    ["kpiSites","opSites"],["kpiAgents","opAgents"],["kpiKontrol","opKontrol"],["kpiDiscipline","opDiscipline"],
    ["kpiSites","summarySites"],["kpiAgents","summaryAgents"],["kpiKontrol","summaryKontrol"],["kpiDiscipline","summaryDiscipline"]
  ];
  pairs.forEach(([a,b])=>{const x=$(a),y=$(b);if(x&&y)y.textContent=x.textContent||"0"});
}
async function kontrolCount(user){
  const counts=[];
  try{
    const snap=await db.collection("chantiers").where("_type","==","kontrolPdfMeta").get();
    counts.push(snap.size);
  }catch(e){
    console.warn("Compteur KONTROL partagé",e);
  }
  if(storage){
    try{
      const list=await storage.ref().child("kontrol/"+user.uid+"/pdfs").listAll();
      counts.push(list.items.length);
    }catch(e){
      console.warn("Compteur KONTROL Storage",e);
    }
  }
  if(!counts.length)throw new Error("Aucune source KONTROL accessible");
  return Math.max(...counts);
}

let refreshSeq=0;
async function refresh(user){
  if(!user)return;
  const seq=++refreshSeq;
  const requests=[
    db.collection("chantiers").orderBy("nom").get(),
    db.collection("chantiers").doc(SHARED_ID).get(),
    db.collection("kanban").doc(user.uid).get(),
    db.collection("chantiers").doc(DISC_ID).get(),
    db.collection("chantiers").doc("__discipline_data__"+user.uid).get(),
    db.collection("discipline").doc(user.uid).get()
  ];
  const [sitesR,sharedR,personalR,discSharedR,discHiddenR,discPersonalR]=await Promise.allSettled(requests);
  if(seq!==refreshSeq)return;

  if(sitesR.status==="fulfilled"){
    const sites=sitesR.value.docs.map(d=>d.data()||{}).filter(x=>x._hidden!==true);
    set("kpiSites",sites.length);
    set("kpiSitesSub","Synchronisé");
  }else{
    set("kpiSitesSub","Synchronisation en cours");
  }

  const shared=dataOf(sharedR),personal=dataOf(personalR);
  const localAgents=localJson("kontrol_agents_classeur_v2",[]);
  const agents=mergeRows(agentsFrom(shared),agentsFrom(personal),Array.isArray(localAgents)?localAgents:[]);
  if(agents.length||sharedR.status==="fulfilled"||personalR.status==="fulfilled"){
    set("kpiAgents",agents.length);
    set("kpiAgentsSub","Synchronisé");
  }else{
    set("kpiAgentsSub","Synchronisation en cours");
  }

  const discLists=[
    disciplineFrom(dataOf(discSharedR)),
    disciplineFrom(dataOf(discHiddenR)),
    disciplineFrom(dataOf(discPersonalR)),
    disciplineFrom(personal),
    localDiscipline(user.uid)
  ];
  const records=mergeRows(...discLists);
  const disciplineSourceAvailable=[discSharedR,discHiddenR,discPersonalR,personalR].some(r=>r.status==="fulfilled")||records.length>0;
  if(disciplineSourceAvailable){
    const opened=records.filter(isOpenRecord).length;
    set("kpiDiscipline",opened);
    set("kpiDisciplineSub",opened?(opened+" à suivre"):"Aucun dossier ouvert");
  }else{
    set("kpiDisciplineSub","Synchronisation en cours");
  }

  try{
    const count=await kontrolCount(user);
    if(seq!==refreshSeq)return;
    set("kpiKontrol",count);
    set("kpiKontrolSub",count?(count+" PDF archivés"):"Aucun PDF archivé");
  }catch(e){
    console.warn("Indicateur KONTROL",e);
    set("kpiKontrolSub","Synchronisation en cours");
  }

  mirror();
}

function schedule(user){
  if(!user)return;
  setTimeout(()=>refresh(user),100);
  setTimeout(()=>refresh(user),1200);
  setTimeout(()=>refresh(user),3500);
}
auth.onAuthStateChanged(schedule);
window.addEventListener("focus",()=>{if(auth.currentUser)refresh(auth.currentUser)});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&auth.currentUser)refresh(auth.currentUser)});
window.addEventListener("inovtec:historical-data-recovered",()=>{if(auth.currentUser)setTimeout(()=>refresh(auth.currentUser),100)});
window.addEventListener("inovtec:kontrol-shared-archive-synced",()=>{if(auth.currentUser)setTimeout(()=>refresh(auth.currentUser),100)});
})();