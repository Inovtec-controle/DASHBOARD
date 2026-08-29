(()=>{
"use strict";
if(window.__INOVTEC_DASHBOARD_C3_V1__)return;
window.__INOVTEC_DASHBOARD_C3_V1__=true;
const $=id=>document.getElementById(id);
const parse=(s,f=null)=>{try{const v=JSON.parse(String(s||""));return v??f}catch{return f}};
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const localJson=(k,f)=>{try{return parse(localStorage.getItem(k)||"",f)}catch{return f}};
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const SHARED_ID="__inovtec_shared_workspace_v1__";
const monthKey=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
const isoDate=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
function dataOf(r){return r&&r.status==="fulfilled"&&r.value?.exists?(r.value.data()||{}):{}}
function modulePayload(d,k,f){return parse(d?.moduleSyncV1?.[k]?.payload||"",f)}
function agentName(a){return a?.name||a?.displayName||[a?.identity?.prenom,a?.identity?.nom].filter(Boolean).join(" ")||"Agent"}
function mergeRows(...lists){const out=[],seen=new Set();for(const list of lists)for(const x of(Array.isArray(list)?list:[])){if(!x||typeof x!=="object")continue;const key=String(x.id||x.pdfId||x.agentRefId||[x.title,x.date,x.startDate,x.agentName].join("|"));if(seen.has(key))continue;seen.add(key);out.push(x)}return out}
function agentsFrom(d){const p=modulePayload(d,"agents",null);if(Array.isArray(p))return p;return Array.isArray(d?.referentialAgents)?d.referentialAgents:[]}
function isOpenIncident(i){if(!i||i.deleted===true||i.archived===true)return false;const s=norm(i.statut||i.status||"ouvert");return !["clos","cloture","cloturee","ferme","fermee","archive","archivee"].includes(s)}
function isLateTask(t){if(!t||t.archived||t.status==="done"||!t.dueDate)return false;const d=new Date(String(t.dueDate)+"T23:59:59");return Number.isFinite(d.getTime())&&d.getTime()<Date.now()}
function todayInLeave(l){const t=isoDate(new Date());return l&&l.status!=="rejected"&&l.status!=="cancelled"&&String(l.startDate||"")<=t&&String(l.endDate||"")>=t}
function isoWeekKey(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const day=(x.getDay()+6)%7;x.setDate(x.getDate()+3-day);const y=new Date(x.getFullYear(),0,4),yd=(y.getDay()+6)%7,w=1+Math.round(((x-y)/86400000-3+yd)/7);return x.getFullYear()+"-W"+String(w).padStart(2,"0")}
function mondayIndex(d){return(d.getDay()+6)%7}
function mergePlanning(...items){const valid=items.filter(x=>x&&typeof x==="object"&&!Array.isArray(x));const out={agents:[],weeks:{}};out.agents=mergeRows(...valid.map(v=>v.agents||[]));const weeks=new Set(valid.flatMap(v=>Object.keys(v.weeks||{})));for(const week of weeks)out.weeks[week]=mergeRows(...valid.map(v=>v.weeks?.[week]||[]));return out}
function setText(id,v){const e=$(id);if(e)e.textContent=String(v)}
function formatAgo(ts){const n=typeof ts==="number"?ts:Date.parse(ts||"");if(!Number.isFinite(n))return"";const m=Math.max(0,Math.round((Date.now()-n)/60000));if(m<1)return"À l’instant";if(m<60)return"Il y a "+m+" min";const h=Math.round(m/60);if(h<24)return"Il y a "+h+" h";return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit"}).format(new Date(n))}
function showList(id,html){const box=$(id);if(box)box.innerHTML=html}
function alertRow(icon,title,sub,badge,tone=""){return '<div class="c3-alert"><span class="c3-alert-ico">'+esc(icon)+'</span><div><strong>'+esc(title)+'</strong><small>'+esc(sub)+'</small></div><span class="c3-badge '+esc(tone)+'">'+esc(badge)+'</span></div>'}
function feedRow(item){return '<div class="c3-feed-row"><time>'+esc(item.time)+'</time><span class="c3-feed-ico">'+esc(item.icon)+'</span><div><strong>'+esc(item.title)+'</strong><small>'+esc(item.sub)+'</small></div><span class="who">'+esc(item.who)+'</span></div>'}
function dayRow(e,agents){const a=agents.find(x=>String(x.id)===String(e.agentId));return '<div class="c3-day-row"><time>'+esc(e.start||"—")+'</time><span class="c3-day-dot">●</span><div><strong>'+esc(e.task||e.site||"Intervention")+'</strong><small>'+esc([e.site,a?.name].filter(Boolean).join(" • "))+'</small></div><span></span></div>'}
async function refresh(user){
 if(!user||!window.firebase?.firestore)return;
 const db=firebase.firestore();
 const res=await Promise.allSettled([
   db.collection("chantiers").doc(SHARED_ID).get(),
   db.collection("kanban").doc(user.uid).get(),
   db.collection("chantiers").where("_type","==","kontrolPdfMeta").get()
 ]);
 const shared=dataOf(res[0]),personal=dataOf(res[1]);
 const localAgents=localJson("kontrol_agents_classeur_v2",[]);
 const agents=mergeRows(agentsFrom(shared),agentsFrom(personal),Array.isArray(localAgents)?localAgents:[]).filter(a=>a&&a._deleted!==true&&norm(agentName(a))&&!["agent","sans nom","agent sans nom"].includes(norm(agentName(a))));
 const tasks=mergeRows(shared.tasks,personal.tasks,localJson("orga_task_board_v2",[])).filter(t=>t&&t.archived!==true);
 const variables=mergeRows(
   modulePayload(shared,"variables",{})?.entries||[],
   modulePayload(personal,"variables",{})?.entries||[],
   localJson("inovtec_variables_v1",{})?.entries||[]
 ).filter(v=>v&&v.deleted!==true);
 const conges=mergeRows(
   modulePayload(shared,"conges",[]),
   modulePayload(personal,"conges",[]),
   localJson("inovtec_absences_v1",[])
 );
 const incidents=[];
 agents.forEach(a=>(Array.isArray(a.incidents)?a.incidents:[]).filter(isOpenIncident).forEach(i=>incidents.push({...i,__agent:agentName(a)})));
 const late=tasks.filter(isLateTask);
 const absToday=conges.filter(todayInLeave);
 const mk=monthKey(new Date()),monthVars=variables.filter(v=>String(v.date||"").slice(0,7)===mk);
 const status={
   ...(modulePayload(shared,"variables",{})?.monthStatus||{}),
   ...(modulePayload(personal,"variables",{})?.monthStatus||{}),
   ...(localJson("inovtec_variables_v1",{})?.monthStatus||{})
 };
 const varAgents=[...new Set(monthVars.map(v=>String(v.agentRefId||"")).filter(Boolean))];
 const review=varAgents.filter(id=>!["verified","transmitted"].includes(String(status[mk+"|"+id]?.status||"draft"))).length;
 setText("c3AlertIncidentCount",incidents.length);setText("c3AlertTaskCount",late.length);setText("c3AlertVariableCount",review);setText("c3AlertAbsenceCount",absToday.length);
 const alertHtml=[
   alertRow("⚠","Incidents ouverts",incidents.length?(incidents.slice(0,2).map(x=>x.__agent).join(", ")):"Aucun incident ouvert",incidents.length,incidents.length?"":"green"),
   alertRow("◷","Variables à vérifier",review?review+" agent"+(review>1?"s":"")+" concerné"+(review>1?"s":""):"Aucune vérification en attente",review,review?"orange":"green"),
   alertRow("◎","Tâches en retard",late.length?(late[0]?.title||"Organisation"):"Aucun retard détecté",late.length,late.length?"orange":"green"),
   alertRow("☂","Absences aujourd’hui",absToday.length?(absToday.slice(0,2).map(x=>x.agentName||"Agent").join(", ")):"Aucune absence active",absToday.length,absToday.length?"orange":"green")
 ].join("");
 showList("c3Alerts",alertHtml);
 const controlDocs=res[2].status==="fulfilled"?res[2].value.docs.map(d=>d.data()||{}):[];
 const recent=[];
 controlDocs.forEach(x=>recent.push({ts:Number(x.createdAtMs)||Date.parse(x.timeCreated||"")||0,icon:"✓",title:"Contrôle KONTROL archivé",sub:x.customMetadata?.site||x.originalName||"Contrôle qualité",who:x.createdByEmail?.split("@")[0]||""}));
 tasks.forEach(x=>recent.push({ts:Date.parse(x.updatedAt||x.createdAt||"")||0,icon:"◎",title:"Tâche mise à jour",sub:x.title||"Organisation",who:""}));
 variables.forEach(x=>recent.push({ts:Date.parse(x.updatedAt||x.createdAt||"")||0,icon:"◷",title:"Variable agent saisie",sub:[x.agentName,x.siteName].filter(Boolean).join(" • ")||"Variables agents",who:""}));
 conges.forEach(x=>recent.push({ts:Date.parse(x.updatedAt||x.createdAt||"")||0,icon:"☂",title:"Absence / congé mis à jour",sub:x.agentName||x.type||"Congés & absences",who:""}));
 recent.sort((a,b)=>b.ts-a.ts);
 const feed=recent.filter(x=>x.ts>0).slice(0,5).map(x=>feedRow({time:formatAgo(x.ts),icon:x.icon,title:x.title,sub:x.sub,who:x.who})).join("");
 showList("c3Recent",feed||'<div class="c3-empty">Aucune activité récente disponible.</div>');
 const planning=mergePlanning(
   modulePayload(shared,"planning",{}),
   modulePayload(personal,"planning",{}),
   localJson("inovtec_plannings_v2",{})
 );
 const week=isoWeekKey(new Date()),day=mondayIndex(new Date());
 const today=(planning.weeks?.[week]||[]).filter(e=>Number(e.day)===day).sort((a,b)=>String(a.start||"").localeCompare(String(b.start||"")));
 const dayHtml=today.slice(0,6).map(e=>dayRow(e,planning.agents||[])).join("");
 showList("c3Today",dayHtml||'<div class="c3-empty">Aucune intervention prévue aujourd’hui.</div>');
 setText("c3TodayCount",today.length);
 setText("c3PilotTasks",tasks.filter(t=>t.status!=="done").length);
 setText("c3PilotLate",late.length);
}
function mirrorPilot(){
 const pairs=[["kpiSites","c3PilotSites"],["kpiAgents","c3PilotAgents"],["kpiKontrol","c3PilotKontrol"],["kpiVariables","c3PilotVariables"]];
 pairs.forEach(([a,b])=>{const s=$(a),d=$(b);if(s&&d)d.textContent=s.textContent||"0"});
}
["kpiSites","kpiAgents","kpiKontrol","kpiVariables"].forEach(id=>{const e=$(id);if(e)new MutationObserver(mirrorPilot).observe(e,{childList:true,subtree:true,characterData:true})});
mirrorPilot();
if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){
 try{
   if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
   firebase.auth().onAuthStateChanged(u=>{if(u){refresh(u);setTimeout(()=>refresh(u),1500)}});
 }catch(e){console.warn("Dashboard Concept 3",e)}
}
window.addEventListener("focus",()=>{try{const u=firebase.auth().currentUser;if(u)refresh(u)}catch{}});
document.addEventListener("visibilitychange",()=>{if(!document.hidden){try{const u=firebase.auth().currentUser;if(u)refresh(u)}catch{}}});
})();