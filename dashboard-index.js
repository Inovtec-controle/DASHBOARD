(()=>{
"use strict";
const $=id=>document.getElementById(id);
const fmtDate=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const fmtTime=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"});
function refreshClock(){const d=new Date();$("dateLabel").textContent=fmtDate.format(d).replace(/^./,c=>c.toUpperCase());$("timeLabel").textContent=fmtTime.format(d);}
refreshClock();setInterval(refreshClock,30000);
$("printBtn").addEventListener("click",()=>window.print());
function normalizeDiscipline(data){if(Array.isArray(data?.recordsV9))return data.recordsV9;if(Array.isArray(data?.recordsV8))return data.recordsV8;if(Array.isArray(data?.recordsV7))return data.recordsV7;if(Array.isArray(data?.records))return data.records;return [];}
async function loadMetrics(user){
  try{
    const db=firebase.firestore();
    const snap=await db.collection("chantiers").get();
    const sites=snap.docs.map(d=>d.data()||{}).filter(x=>x._type!=="disciplinePhotoChunk"&&x._hidden!==true);
    $("kpiSites").textContent=String(sites.length);
    const agents=new Set(sites.map(x=>String(x.agentNom||"").trim()).filter(Boolean).map(x=>x.toLocaleLowerCase("fr")));
    $("kpiAgents").textContent=String(agents.size);
    $("kpiSitesSub").textContent="Synchronisé";$("kpiAgentsSub").textContent="Synchronisé";
  }catch(err){console.warn("Indicateurs chantiers",err);$("kpiSitesSub").textContent="Indisponible";$("kpiAgentsSub").textContent="Indisponible";}
  try{
    const db=firebase.firestore();
    const doc=await db.collection("discipline").doc(user.uid).get();
    const list=doc.exists?normalizeDiscipline(doc.data()||{}):[];
    const opened=list.filter(x=>String(x?.statut||"Ouvert").toLocaleLowerCase("fr")!=="clos").length;
    $("kpiDiscipline").textContent=String(opened);$("kpiDisciplineSub").textContent=opened?"À suivre":"Aucun dossier ouvert";
  }catch(err){console.warn("Indicateur Discipline",err);$("kpiDisciplineSub").textContent="Indisponible";}
  try{
    const root=firebase.storage().ref().child(`kontrol/${user.uid}/pdfs`);const result=await root.listAll();
    $("kpiKontrol").textContent=String(result.items.length);$("kpiKontrolSub").textContent="PDF archivés en ligne";
  }catch(err){console.warn("Indicateur KONTROL",err);$("kpiKontrolSub").textContent="Indisponible";}
}
if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){
  try{if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);const auth=firebase.auth();auth.onAuthStateChanged(user=>{if(user){$("cloudDot").classList.add("online");$("accountName").textContent=user.email?.split("@")[0]||"Compte Inovtec";$("accountStatus").textContent="Connecté";$("avatar").textContent=(user.email||"IN").slice(0,2).toUpperCase();loadMetrics(user);}else{$("cloudDot").classList.remove("online");$("accountStatus").textContent="Non connecté";}});}catch(err){console.warn(err);}
}
})();