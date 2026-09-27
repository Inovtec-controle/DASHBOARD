(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_CONTAINER_BRIDGE_V1__)return;
window.__INOVTEC_PLANNING_CONTAINER_BRIDGE_V1__=true;

const SOURCE="kontrol-planning";
const DAYS=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
const pad=n=>String(n).padStart(2,"0");
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const slug=v=>norm(v).replace(/\s+/g,"-").replace(/^-+|-+$/g,"")||"agent";
const safe=v=>v==null?"":String(v);
let currentUser=null,planningReady=false,syncing=false,resync=false,timer=0,lastError="",latestPlanningState=null;

function planningState(){
  if(latestPlanningState)return latestPlanningState;
  try{return window.InovtecPlanningAPI?.getState?.()||null}catch{return null}
}
function hub(){
  try{
    if(parent&&parent!==window&&parent.InovtecDataHub)return parent.InovtecDataHub;
  }catch{}
  try{return window.InovtecDataHub||null}catch{return null}
}
function sites(){const h=hub();return h?.readyChantiers?Array.from(h.chantiers||[]):[]}
function dateFromWeek(key,day){
  const m=String(key||"").match(/^(\d{4})-W(\d{2})$/);
  if(!m)return null;
  const year=+m[1],week=+m[2],jan4=new Date(year,0,4),offset=(jan4.getDay()+6)%7;
  const monday=new Date(year,0,4-offset,12,0,0,0);
  monday.setDate(monday.getDate()+(week-1)*7+(Number(day)||0));
  return monday;
}
function dateISO(date){return date?`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`:""}
function siteForEvent(event,list){
  const id=safe(event?.chantierId);
  if(id){const exact=list.find(c=>safe(c.id)===id);if(exact)return exact}
  const task=norm(event?.task),place=norm(event?.site);
  return list.find(c=>task&&norm(c.nom)===task)
    ||list.find(c=>place&&(norm(c.adresse)===place||norm(c.nom)===place))
    ||null;
}
function validContainerTask(raw){
  if(!raw||typeof raw!=="object")return null;
  const action=raw.action==="rentree"?"rentree":raw.action==="sortie"?"sortie":"";
  const type=String(raw.typeConteneur||raw.flux||"").toUpperCase();
  if(!action||!["OM","TRI","OM/TRI"].includes(type))return null;
  return{
    id:safe(raw.id),
    action,
    typeConteneur:type,
    label:safe(raw.label||((action==="sortie"?"Sortie ":"Rentrée ")+type)),
    source:safe(raw.source||"infos-chantier")
  };
}
function validContainerTasks(event){
  const source=Array.isArray(event?.containerTasks)?event.containerTasks:(event?.containerTask?[event.containerTask]:[]);
  const out=[],seen=new Set();
  source.forEach(raw=>{
    const task=validContainerTask(raw);
    if(!task)return;
    const key=[task.id,task.action,task.typeConteneur].join("|");
    if(seen.has(key))return;
    seen.add(key);out.push(task);
  });
  return out;
}
function nameKeys(value){
  const n=norm(value);
  if(!n)return[];
  const tokens=n.split(/\s+/).filter(Boolean);
  return [...new Set([n,tokens.slice().sort().join(" ")])];
}
function putUnique(map,key,value){
  if(!key||!value)return;
  if(!map.has(key)){map.set(key,value);return}
  if(map.get(key)!==value)map.set(key,"");
}
function compactReplacement(value){
  if(!value||typeof value!=="object")return null;
  return{
    leaveId:safe(value.leaveId),
    originalAgentId:safe(value.originalAgentId),
    originalAgentName:safe(value.originalAgentName),
    replacedAt:safe(value.replacedAt)
  };
}
function sameDesired(current,desired){
  return Object.keys(desired).every(key=>JSON.stringify(current?.[key]??null)===JSON.stringify(desired[key]??null));
}
async function commitWrites(db,writes){
  for(let i=0;i<writes.length;i+=400){
    const batch=db.batch();
    writes.slice(i,i+400).forEach(w=>batch.set(w.ref,w.data,{merge:true}));
    await batch.commit();
  }
}
function mirrorStatus(message,ok=true){
  try{
    const badge=document.getElementById("syncBadge");
    if(badge){
      badge.textContent=message;
      badge.classList.toggle("ok",!!ok);
      badge.classList.toggle("warning",!ok);
    }
  }catch{}
  try{
    const mirror=parent&&parent!==window?parent.document?.getElementById("syncMirror"):null;
    if(mirror)mirror.textContent=message;
  }catch{}
}
function reportError(error){
  const msg=String(error?.code||error?.message||error||"erreur");
  if(msg===lastError)return;
  lastError=msg;
  console.error("Passerelle Planning → CONTENEURS",error);
  mirrorStatus("Planning enregistré · liaison CONTENEURS à vérifier",false);
  try{window.dispatchEvent(new CustomEvent("inovtec:container-missions-sync-failed",{detail:{message:msg}}))}catch{}
}
async function buildAgentResolver(db,existingPlans,state){
  const byName=new Map(),byPlanningRef=new Map();

  existingPlans.forEach(p=>{
    if(p.sourceSystem===SOURCE&&p.planningAgentRefId&&p.agentId){
      byPlanningRef.set(safe(p.planningAgentRefId),safe(p.agentId));
    }
    if(p.agentId&&p.agentNom){
      nameKeys(p.agentNom).forEach(k=>putUnique(byName,k,safe(p.agentId)));
    }
  });

  try{
    const snap=await db.collection("conteneurs_comptes").get();
    snap.forEach(doc=>{
      const a=doc.data()||{};
      if(!a.agentId||String(a.statut||"").toLowerCase()!=="approved")return;
      const id=safe(a.agentId);
      [`${safe(a.prenom)} ${safe(a.nom)}`,`${safe(a.nom)} ${safe(a.prenom)}`].forEach(n=>{
        nameKeys(n).forEach(k=>putUnique(byName,k,id));
      });
    });
  }catch(error){
    console.warn("Passerelle Planning → CONTENEURS : comptes agents non lisibles, correspondance par planning existant utilisée.",error);
  }

  const fallbackCount=new Map();
  (state.agents||[]).forEach(a=>{
    const base=slug(a.name||a.displayName||a.id);
    fallbackCount.set(base,(fallbackCount.get(base)||0)+1);
  });

  return agent=>{
    const ref=safe(agent?.refId||agent?.id);
    if(ref&&byPlanningRef.get(ref))return byPlanningRef.get(ref);
    for(const key of nameKeys(agent?.name||agent?.displayName)){
      const found=byName.get(key);
      if(found)return found;
    }
    const base=slug(agent?.name||agent?.displayName||agent?.id);
    if((fallbackCount.get(base)||0)<=1)return base;
    const suffix=safe(agent?.id||agent?.refId).replace(/[^a-zA-Z0-9]/g,"").slice(-6).toLowerCase();
    return suffix?`${base}-${suffix}`:base;
  };
}
function missionId(event,marker){
  const base="planning_"+safe(event?.id).replace(/\//g,"_").slice(0,950);
  const suffix=safe(marker?.id||((marker?.action||"mission")+"_"+(marker?.typeConteneur||""))).replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,180);
  return base+"__"+(suffix||"mission");
}
function containerTaskKey(task){
  return [safe(task?.id),safe(task?.action),safe(task?.typeConteneur)].join("|");
}
function sameContainerTaskSet(a,b){
  const aa=validContainerTasks(a).map(containerTaskKey).sort();
  const bb=validContainerTasks(b).map(containerTaskKey).sort();
  return JSON.stringify(aa)===JSON.stringify(bb);
}
function sameLinkedSlot(a,b){
  if(Number(a?.day)!==Number(b?.day))return false;
  if(safe(a?.start)!==safe(b?.start)||safe(a?.end)!==safe(b?.end))return false;
  const aSite=safe(a?.chantierId)||norm(a?.task)||norm(a?.site);
  const bSite=safe(b?.chantierId)||norm(b?.task)||norm(b?.site);
  return !!aSite&&aSite===bSite;
}
function isPassiveTeamClone(state,week,event){
  const sourceId=safe(event?._teamInheritedFrom);
  if(!sourceId)return false;
  const targetId=safe(event?.agentId);
  const teams=Array.isArray(state?.teamPlanning?.teams)?state.teamPlanning.teams:[];
  const team=teams.find(t=>
    safe(t?.referenceAgentId)===sourceId
    &&Array.isArray(t?.members)
    &&t.members.map(safe).includes(targetId)
  );
  if(!team)return false;
  const exceptions=Array.isArray(team?.exceptions?.[week])?team.exceptions[week].map(safe):[];
  if(exceptions.includes(targetId))return false;

  // Une copie liée n'est "passive" que si la tâche source porte exactement
  // les mêmes missions conteneurs. Si l'utilisateur coche une bulle propre
  // au membre lié, cette mission appartient bien à ce membre et doit monter.
  const rows=Array.isArray(state?.weeks?.[week])?state.weeks[week]:[];
  const sources=rows.filter(candidate=>
    safe(candidate?.agentId)===sourceId
    &&sameLinkedSlot(candidate,event)
  );
  if(!sources.length)return false;
  return sources.some(source=>sameContainerTaskSet(source,event));
}
function buildDesiredMissions(state,resolveAgent){
  const list=sites(),agents=Array.isArray(state.agents)?state.agents:[],desired=new Map();
  Object.entries(state.weeks||{}).forEach(([week,rows])=>{
    (Array.isArray(rows)?rows:[]).forEach(event=>{
      if(isPassiveTeamClone(state,week,event))return;
      const markers=validContainerTasks(event);
      if(!markers.length||!event?.id)return;
      const date=dateFromWeek(week,event.day);
      if(!date)return;
      const agent=agents.find(a=>safe(a.id)===safe(event.agentId))||null;
      const site=siteForEvent(event,list);
      const agentNom=safe(agent?.name||agent?.displayName||event.agentId||"Agent");
      const agentId=resolveAgent(agent||{id:event.agentId,name:agentNom});
      const remplacement=compactReplacement(event._replacementFor);
      markers.forEach(marker=>{
        const data={
          sourceSystem:SOURCE,
          sourceLabel:"Planning KONTROL",
          managedByPlanning:true,
          planningEventId:safe(event.id),
          planningWeek:safe(week),
          planningDate:dateISO(date),
          dateExacte:dateISO(date),
          planningAgentId:safe(event.agentId),
          planningAgentRefId:safe(agent?.refId||agent?.id||event.agentId),
          planningReplacement:remplacement,
          chantierId:safe(site?.id||event.chantierId),
          chantierNom:safe(site?.nom||event.task||"Chantier"),
          adresse:safe(site?.adresse||""),
          agentNom,
          agentId,
          action:marker.action,
          typeConteneur:marker.typeConteneur,
          jour:DAYS[Math.max(0,Math.min(6,Number(event.day)||0))],
          heureDebut:safe(event.start),
          heureFin:safe(event.end),
          frequence:"toutes",
          containerTaskId:marker.id,
          containerTaskLabel:marker.label,
          containerTaskSource:marker.source,
          actif:true,
          planningRemoved:false
        };
        desired.set(missionId(event,marker),data);
      });
    });
  });
  return desired;
}
async function syncNow(reason="planning"){
  if(syncing){resync=true;return}
  if(!planningReady||!currentUser)return;
  const state=planningState();
  if(!state||!state.weeks||!Array.isArray(state.agents))return;
  const h=hub();
  if(h&&!h.readyChantiers){schedule("waiting-sites",500);return}

  syncing=true;
  lastError="";
  try{
    const db=firebase.firestore();
    const snap=await db.collection("conteneurs_plannings").get();
    const existing=new Map(),existingRows=[];
    snap.forEach(doc=>{const row={id:doc.id,...(doc.data()||{})};existing.set(doc.id,row);existingRows.push(row)});

    const resolveAgent=await buildAgentResolver(db,existingRows,state);
    const desired=buildDesiredMissions(state,resolveAgent);
    const writes=[],stamp=firebase.firestore.FieldValue.serverTimestamp();

    desired.forEach((data,id)=>{
      const current=existing.get(id);
      if(sameDesired(current,data))return;
      const payload={...data,planningSyncAt:stamp,planningSyncReason:safe(reason)};
      if(!current)payload.createdAt=stamp;
      writes.push({ref:db.collection("conteneurs_plannings").doc(id),data:payload});
    });

    const today=dateISO(new Date());
    existingRows.forEach(row=>{
      if(row.sourceSystem!==SOURCE||desired.has(row.id)||row.actif===false)return;
      const exact=safe(row.dateExacte||row.planningDate);
      // Conserver les missions passées pour l'historique. Une tâche supprimée
      // aujourd'hui ou dans le futur cesse en revanche d'être proposée.
      if(exact&&exact<today)return;
      writes.push({
        ref:db.collection("conteneurs_plannings").doc(row.id),
        data:{actif:false,planningRemoved:true,planningSyncAt:stamp,planningSyncReason:"removed-from-planning"}
      });
    });

    if(writes.length)await commitWrites(db,writes);
    mirrorStatus("Planning + CONTENEURS synchronisés",true);
    window.dispatchEvent(new CustomEvent("inovtec:container-missions-synced",{detail:{count:desired.size,writes:writes.length,reason}}));
  }catch(error){
    reportError(error);
  }finally{
    syncing=false;
    if(resync){resync=false;schedule("queued",120)}
  }
}
function schedule(reason="planning",delay=220){
  clearTimeout(timer);
  timer=setTimeout(()=>syncNow(reason),delay);
}
function markPlanningReady(event){
  const payload=event?.detail?.payload;
  if(typeof payload==="string"){
    try{
      const parsed=JSON.parse(payload);
      if(parsed&&typeof parsed==="object"&&parsed.weeks&&Array.isArray(parsed.agents)){
        latestPlanningState=parsed;
        planningReady=true;
      }
    }catch{}
  }else{
    const state=planningState();
    if(state?.weeks&&Array.isArray(state.agents))planningReady=true;
  }
  if(planningReady)schedule(event?.detail?.source||"planning-ready");
}

if(!window.firebase?.auth||!window.firebase?.firestore){
  console.warn("Passerelle Planning → CONTENEURS : Firebase indisponible.");
  return;
}
firebase.auth().onAuthStateChanged(user=>{
  currentUser=user||null;
  if(currentUser&&planningReady)schedule("auth-ready",120);
});
window.addEventListener("inovtec:planning-cloud-payload",markPlanningReady);
window.addEventListener("inovtec:planning-cloud-saved",event=>{
  const payload=event?.detail?.payload;
  if(typeof payload==="string"){
    try{
      const parsed=JSON.parse(payload);
      if(parsed&&parsed.weeks&&Array.isArray(parsed.agents))latestPlanningState=parsed;
    }catch{}
  }
  planningReady=true;
  schedule(event?.detail?.source||"planning-saved",100);
});
try{hub()?.subscribe?.(()=>{if(planningReady)schedule("chantiers-updated",260)})}catch{}
// Demander explicitement une lecture serveur : la synchronisation ne démarre
// qu'après réception d'un payload Firebase valide, jamais depuis un état local vide.
setTimeout(()=>{try{window.InovtecPlanningAPI?.requestRefresh?.()}catch{}},180);
})();