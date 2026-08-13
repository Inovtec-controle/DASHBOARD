(()=>{
"use strict";
const $=id=>document.getElementById(id);
const fmtDate=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const fmtTime=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"});
function refreshClock(){const d=new Date();$("dateLabel").textContent=fmtDate.format(d).replace(/^./,c=>c.toUpperCase());$("timeLabel").textContent=fmtTime.format(d);}
refreshClock();setInterval(refreshClock,30000);
$("printBtn").addEventListener("click",()=>window.print());
$("bellBtn").addEventListener("click",()=>$("notifPanel").classList.toggle("open"));
document.addEventListener("click",e=>{if(!$("notifPanel").contains(e.target)&&!$("bellBtn").contains(e.target))$("notifPanel").classList.remove("open");});
const notices=[];
function addNotice(title,text,type="ok"){notices.push({title,text,type});renderNotices();}
function renderNotices(){const list=$("notifList");list.innerHTML="";if(!notices.length){list.innerHTML='<div class="notif-item">Aucune alerte pour le moment.</div>';}else notices.slice(-5).reverse().forEach(n=>{const el=document.createElement("div");el.className="notif-item "+n.type;const strong=document.createElement("strong");strong.textContent=n.title;const span=document.createElement("span");span.textContent=n.text;el.append(strong,span);list.appendChild(el);});$("bellBadge").textContent=String(notices.filter(n=>n.type==="warn").length);}
renderNotices();
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
    if(opened)addNotice("Discipline",opened+" dossier"+(opened>1?"s":"")+" ouvert"+(opened>1?"s":"")+" à suivre.","warn");
  }catch(err){console.warn("Indicateur Discipline",err);$("kpiDisciplineSub").textContent="Indisponible";}
  try{
    const root=firebase.storage().ref().child(`kontrol/${user.uid}/pdfs`);const result=await root.listAll();
    $("kpiKontrol").textContent=String(result.items.length);$("kpiKontrolSub").textContent="PDF archivés en ligne";
  }catch(err){console.warn("Indicateur KONTROL",err);$("kpiKontrolSub").textContent="Indisponible";}
}
if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){
  try{if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);const auth=firebase.auth();auth.onAuthStateChanged(user=>{if(user){$("cloudDot").classList.add("online");$("accountName").textContent=user.email?.split("@")[0]||"Compte Inovtec";$("accountStatus").textContent="Connecté";$("avatar").textContent=(user.email||"IN").slice(0,2).toUpperCase();addNotice("Connexion Firebase","Les indicateurs du dashboard sont synchronisés.","ok");loadMetrics(user);}else{$("cloudDot").classList.remove("online");$("accountStatus").textContent="Connexion via un module";addNotice("Indicateurs","Connectez-vous dans Infos chantier, Discipline ou KONTROL pour afficher les données synchronisées.","ok");}});}catch(err){console.warn(err);}
}
})();