(()=>{
"use strict";
if(window.__INOVTEC_DASHBOARD_SHARED_METRICS_V1__)return;
window.__INOVTEC_DASHBOARD_SHARED_METRICS_V1__=true;
if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG)return;
if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
if(!firebase.auth||!firebase.firestore)return;
const auth=firebase.auth(),db=firebase.firestore(),SHARED_ID="__inovtec_shared_workspace_v1__",DISC_ID="__inovtec_shared_discipline_v1__";
const $=id=>document.getElementById(id);
const parse=s=>{try{return JSON.parse(String(s||""))}catch{return null}};
function agentsFrom(data){const a=parse(data?.moduleSyncV1?.agents?.payload||"");if(Array.isArray(a))return a;return Array.isArray(data?.referentialAgents)?data.referentialAgents:[]}
function disciplineFrom(data){if(Array.isArray(data?.recordsV9))return data.recordsV9;if(Array.isArray(data?.recordsV8))return data.recordsV8;if(Array.isArray(data?.records))return data.records;return[]}
async function refresh(user){if(!user)return;try{const [sitesSnap,workspace,disc,kontrol]=await Promise.all([db.collection("chantiers").get(),db.collection("chantiers").doc(SHARED_ID).get(),db.collection("chantiers").doc(DISC_ID).get(),db.collection("chantiers").where("_type","==","kontrolPdfMeta").get()]),sites=sitesSnap.docs.map(d=>d.data()||{}).filter(x=>!x._hidden),w=workspace.exists?(workspace.data()||{}):{},agents=agentsFrom(w),records=disc.exists?disciplineFrom(disc.data()||{}):[],opened=records.filter(x=>String(x?.statut||"Ouvert").toLocaleLowerCase("fr")!=="clos").length;if($("kpiSites"))$("kpiSites").textContent=String(sites.length);if($("kpiSitesSub"))$("kpiSitesSub").textContent="Infos chantier partagé";if($("kpiAgents"))$("kpiAgents").textContent=String(agents.length);if($("kpiAgentsSub"))$("kpiAgentsSub").textContent="Classeur agents partagé";if($("kpiDiscipline"))$("kpiDiscipline").textContent=String(opened);if($("kpiDisciplineSub"))$("kpiDisciplineSub").textContent=opened?"À suivre · partagé":"Aucun dossier ouvert";if($("kpiKontrol"))$("kpiKontrol").textContent=String(kontrol.size);if($("kpiKontrolSub"))$("kpiKontrolSub").textContent="PDF partagés en ligne"}catch(e){console.warn("Indicateurs partagés",e)}}
auth.onAuthStateChanged(u=>{if(u){setTimeout(()=>refresh(u),150);setTimeout(()=>refresh(u),1600)}});window.addEventListener("focus",()=>{if(auth.currentUser)refresh(auth.currentUser)});document.addEventListener("visibilitychange",()=>{if(!document.hidden&&auth.currentUser)refresh(auth.currentUser)});
})();
