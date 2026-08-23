(()=>{
"use strict";
if(window.__INOVTEC_DASHBOARD_MARK1__)return;window.__INOVTEC_DASHBOARD_MARK1__=true;
const recovery=document.createElement("script");recovery.src="inovtec-historical-data-recovery.js?v=20260823-recovery1";recovery.async=false;document.head.appendChild(recovery);
const $=id=>document.getElementById(id),parse=s=>{try{return JSON.parse(String(s||""))}catch{return null}},SHARED_ID="__inovtec_shared_workspace_v1__";
const set=(id,v)=>{const e=$(id);if(e)e.textContent=String(v)};
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
function minutesLabel(min){min=Math.max(0,Number(min)||0);const h=Math.floor(min/60),m=Math.round(min%60);return m?`${h}h${String(m).padStart(2,"0")}`:`${h}h`}
function overdue(t){if(!t||t.archived||t.status==="done"||!t.dueDate)return false;const due=new Date(String(t.dueDate)+"T23:59:59");return Number.isFinite(due.getTime())&&due.getTime()<Date.now()}
function hoursData(w){const p=parse(w?.moduleSyncV1?.heures?.payload||"");return p&&typeof p==="object"?p:{entries:[]}}
function planningData(w){const p=parse(w?.moduleSyncV1?.planning?.payload||"");return p&&typeof p==="object"?p:{agents:[],weeks:{}}}
function updateMirror(){
  const pairs=[["kpiSites","opSites"],["kpiAgents","opAgents"],["kpiKontrol","opKontrol"],["kpiDiscipline","opDiscipline"]];
  pairs.forEach(([src,dst])=>{const s=$(src),d=$(dst);if(s&&d)d.textContent=s.textContent||"—"});
}
async function refresh(user){
  if(!user||!window.firebase?.firestore)return;
  try{
    const db=firebase.firestore(),snap=await db.collection("chantiers").doc(SHARED_ID).get(),w=snap.exists?(snap.data()||{}):{};
    const hs=hoursData(w),entries=Array.isArray(hs.entries)?hs.entries:[],now=new Date(),mk=monthKey(now),monthEntries=entries.filter(e=>String(e?.date||"").slice(0,7)===mk),monthMin=monthEntries.reduce((a,e)=>a+(Number(e?.minutes)||0),0);
    set("kpiHours",minutesLabel(monthMin));set("kpiHoursSub",`${monthEntries.length} ligne${monthEntries.length>1?"s":""} ce mois`);set("hsLines",monthEntries.length);set("hsHours",minutesLabel(monthMin));
    const tasks=Array.isArray(w.tasks)?w.tasks:[],active=tasks.filter(t=>!t?.archived&&t?.status!=="done"),todo=tasks.filter(t=>!t?.archived&&t?.status==="todo").length,doing=tasks.filter(t=>!t?.archived&&(t?.status==="inprogress"||t?.status==="doing")).length,done=tasks.filter(t=>!t?.archived&&t?.status==="done").length,late=tasks.filter(overdue).length;
    set("kpiTasks",active.length);set("kpiTasksSub",late?`${late} en retard`:"Aucun retard détecté");set("taskTodo",todo);set("taskDoing",doing);set("taskDone",done);set("taskLate",late);
    const planning=planningData(w),agents=Array.isArray(planning.agents)?planning.agents:[],weekEntries=Object.values(planning.weeks||{}).flat().filter(Boolean);
    set("planningAgents",agents.length);set("planningEntries",weekEntries.length);set("planningSummary",agents.length?`${agents.length} agent${agents.length>1?"s":""} dans le planning`:"Planning prêt à être renseigné");
    set("sharedStatus","Données partagées à jour");
    updateMirror();
  }catch(e){console.warn("MARK 1 données",e);set("sharedStatus","Synchronisation momentanément indisponible")}
}
function observeKpis(){["kpiSites","kpiAgents","kpiKontrol","kpiDiscipline"].forEach(id=>{const e=$(id);if(e)new MutationObserver(updateMirror).observe(e,{childList:true,subtree:true,characterData:true})});updateMirror()}
observeKpis();
if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){try{if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);firebase.auth().onAuthStateChanged(u=>{if(u){set("sharedStatus","Récupération et synchronisation des données…");setTimeout(()=>refresh(u),350);setTimeout(()=>refresh(u),2200)}})}catch(e){console.warn(e)}}
window.addEventListener("inovtec:historical-data-recovered",()=>{try{const u=firebase.auth().currentUser;if(u){set("sharedStatus","Anciennes données récupérées et partagées");setTimeout(()=>refresh(u),120)}}catch{}});
window.addEventListener("focus",()=>{try{const u=firebase.auth().currentUser;if(u)refresh(u)}catch{}});
document.addEventListener("visibilitychange",()=>{if(!document.hidden){try{const u=firebase.auth().currentUser;if(u)refresh(u)}catch{}}});
})();
