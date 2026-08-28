(()=>{
"use strict";
if(window.__INOVTEC_DASHBOARD_MARK1_V2__)return;
window.__INOVTEC_DASHBOARD_MARK1_V2__=true;

const recovery=document.createElement("script");
recovery.src="inovtec-historical-data-recovery.js?v=20260828-agentdelete1";
recovery.async=false;
document.head.appendChild(recovery);

const $=id=>document.getElementById(id);
const set=(id,v)=>{const e=$(id);if(e)e.textContent=String(v)};
const parse=(s,f=null)=>{try{const v=JSON.parse(String(s||""));return v??f}catch{return f}};
const localJson=(key,f)=>{try{return parse(localStorage.getItem(key)||"",f)}catch{return f}};
const SHARED_ID="__inovtec_shared_workspace_v1__";

function monthKey(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}
function minutesLabel(min){
  min=Math.max(0,Number(min)||0);
  const h=Math.floor(min/60),m=Math.round(min%60);
  return m?(h+"h"+String(m).padStart(2,"0")):(h+"h");
}
function overdue(t){
  if(!t||t.archived||t.status==="done"||!t.dueDate)return false;
  const due=new Date(String(t.dueDate)+"T23:59:59");
  return Number.isFinite(due.getTime())&&due.getTime()<Date.now();
}
function dataOf(result){
  return result&&result.status==="fulfilled"&&result.value?.exists?(result.value.data()||{}):{};
}
function modulePayload(data,mode,fallback){
  return parse(data?.moduleSyncV1?.[mode]?.payload||"",fallback);
}
function mergeRows(...lists){
  const map=new Map(),order=[];
  for(const list of lists){
    for(const row of(Array.isArray(list)?list:[])){
      if(!row||typeof row!=="object")continue;
      const fallback=[row.employee,row.agentName,row.date,row.type,row.site,row.title].filter(Boolean).join("|");
      const key=String(row.id||row.legacyHourId||fallback||JSON.stringify(row));
      if(!map.has(key)){map.set(key,{...row});order.push(key)}
      else map.set(key,{...map.get(key),...row});
    }
  }
  return order.map(k=>map.get(k));
}
function mergePlanning(...items){
  const valid=items.filter(x=>x&&typeof x==="object"&&!Array.isArray(x));
  if(!valid.length)return{agents:[],weeks:{}};
  const out={agents:[],weeks:{}};
  out.agents=mergeRows(...valid.map(v=>v.agents||[]));
  const weeks=new Set(valid.flatMap(v=>Object.keys(v.weeks||{})));
  for(const week of weeks)out.weeks[week]=mergeRows(...valid.map(v=>v.weeks?.[week]||[]));
  return out;
}
function variablesEntries(data){
  const v=modulePayload(data,"variables",{});
  return Array.isArray(v?.entries)?v.entries:[];
}
function legacyHoursEntries(data){
  const h=modulePayload(data,"heures",{});
  return Array.isArray(h?.entries)?h.entries:[];
}
function mergedHours(shared,personal){
  const legacy=mergeRows(
    legacyHoursEntries(shared),
    legacyHoursEntries(personal),
    localJson("HSUPP_DUR_APP_V1",{})?.entries||[]
  );
  const vars=mergeRows(
    variablesEntries(shared),
    variablesEntries(personal),
    localJson("inovtec_variables_v1",{})?.entries||[]
  ).filter(e=>e&&e.deleted!==true&&e.type==="heures_supplementaires");

  const claimedLegacy=new Set(vars.map(e=>String(e.legacyHourId||"")).filter(Boolean));
  const rows=[];
  for(const e of vars){
    rows.push({
      id:"var:"+String(e.id||e.legacyHourId||Math.random()),
      date:e.date||"",
      minutes:Number(e.minutes)||0
    });
  }
  for(const e of legacy){
    if(e?.id&&claimedLegacy.has(String(e.id)))continue;
    rows.push({
      id:"legacy:"+String(e.id||[e.employee,e.date,e.minutes,e.site].join("|")),
      date:e.date||"",
      minutes:Number(e.minutes)||0
    });
  }
  return rows;
}
function mergedTasks(shared,personal){
  return mergeRows(
    Array.isArray(shared?.tasks)?shared.tasks:[],
    Array.isArray(personal?.tasks)?personal.tasks:[],
    localJson("orga_task_board_v2",[])
  );
}
function updateMirror(){
  const pairs=[
    ["kpiSites","opSites"],["kpiAgents","opAgents"],["kpiKontrol","opKontrol"],["kpiDiscipline","opDiscipline"],
    ["hsLines","hsLines2"],["taskLate","taskLateAlert"]
  ];
  pairs.forEach(([src,dst])=>{
    const s=$(src),d=$(dst);
    if(s&&d)d.textContent=s.textContent||"0";
  });
}

let refreshSeq=0;
async function refresh(user){
  if(!user||!window.firebase?.firestore)return;
  const seq=++refreshSeq;
  try{
    const db=firebase.firestore();
    const results=await Promise.allSettled([
      db.collection("chantiers").doc(SHARED_ID).get(),
      db.collection("kanban").doc(user.uid).get()
    ]);
    if(seq!==refreshSeq)return;
    const shared=dataOf(results[0]),personal=dataOf(results[1]);

    const hours=mergedHours(shared,personal);
    const now=new Date(),mk=monthKey(now);
    const monthEntries=hours.filter(e=>String(e?.date||"").slice(0,7)===mk);
    const monthMin=monthEntries.reduce((a,e)=>a+(Number(e?.minutes)||0),0);
    set("kpiHours",minutesLabel(monthMin));
    set("kpiHoursSub",monthEntries.length+" ligne"+(monthEntries.length>1?"s":"")+" ce mois");
    set("hsLines",monthEntries.length);
    set("hsHours",minutesLabel(monthMin));

    const tasks=mergedTasks(shared,personal);
    const active=tasks.filter(t=>!t?.archived&&t?.status!=="done");
    const todo=tasks.filter(t=>!t?.archived&&t?.status==="todo").length;
    const doing=tasks.filter(t=>!t?.archived&&(t?.status==="inprogress"||t?.status==="doing")).length;
    const done=tasks.filter(t=>!t?.archived&&t?.status==="done").length;
    const late=tasks.filter(overdue).length;
    set("kpiTasks",active.length);
    set("kpiTasksSub",late?(late+" en retard"):"Aucun retard détecté");
    set("taskTodo",todo);
    set("taskDoing",doing);
    set("taskDone",done);
    set("taskLate",late);

    const planning=mergePlanning(
      modulePayload(shared,"planning",{}),
      modulePayload(personal,"planning",{}),
      localJson("inovtec_plannings_v2",{})
    );
    const agents=Array.isArray(planning.agents)?planning.agents:[];
    const weekEntries=Object.values(planning.weeks||{}).flat().filter(Boolean);
    set("planningAgents",agents.length);
    set("planningEntries",weekEntries.length);
    set("planningSummary",agents.length?(agents.length+" agent"+(agents.length>1?"s":"")+" dans le planning"):"Planning prêt à être renseigné");

    set("sharedStatus","Données partagées à jour");
    updateMirror();
  }catch(e){
    console.warn("MARK 1 données",e);
    set("sharedStatus","Synchronisation momentanément indisponible");
  }
}
function observeKpis(){
  ["kpiSites","kpiAgents","kpiKontrol","kpiDiscipline"].forEach(id=>{
    const e=$(id);
    if(e)new MutationObserver(updateMirror).observe(e,{childList:true,subtree:true,characterData:true});
  });
  updateMirror();
}
observeKpis();

if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    firebase.auth().onAuthStateChanged(u=>{
      if(u){
        set("sharedStatus","Récupération et synchronisation des données…");
        setTimeout(()=>refresh(u),250);
        setTimeout(()=>refresh(u),1200);
        setTimeout(()=>refresh(u),3200);
      }
    });
  }catch(e){
    console.warn("MARK 1 Firebase",e);
  }
}
window.addEventListener("inovtec:historical-data-recovered",()=>{
  try{
    const u=firebase.auth().currentUser;
    if(u){set("sharedStatus","Anciennes données récupérées et partagées");setTimeout(()=>refresh(u),100)}
  }catch{}
});
window.addEventListener("focus",()=>{try{const u=firebase.auth().currentUser;if(u)refresh(u)}catch{}});
document.addEventListener("visibilitychange",()=>{if(!document.hidden){try{const u=firebase.auth().currentUser;if(u)refresh(u)}catch{}}});
})();