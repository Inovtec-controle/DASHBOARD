(()=>{
"use strict";
if(window.__INOVTEC_HISTORICAL_DATA_RECOVERY_V1__)return;
window.__INOVTEC_HISTORICAL_DATA_RECOVERY_V1__=true;
if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG)return;
if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
if(!firebase.auth||!firebase.firestore)return;

const auth=firebase.auth(),db=firebase.firestore();
const SHARED_WORKSPACE_ID="__inovtec_shared_workspace_v1__";
const SHARED_DISCIPLINE_ID="__inovtec_shared_discipline_v1__";
const MODULES={
  planning:{key:"inovtec_plannings_v2"},
  agents:{key:"kontrol_agents_classeur_v2"},
  heures:{key:"HSUPP_DUR_APP_V1"},
  conges:{key:"inovtec_absences_v1"}
};
const ORGA_KEY="orga_task_board_v2";
const DISC_LEGACY_KEYS=["inovtec_discipline_cache_v8","inovtec_discipline_cloud_cache_v5","inovtec_discipline_v2","discipline"];
let currentUser=null,busy=false,queued=false,lastRun=0;

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const parse=(s,f=null)=>{try{const v=JSON.parse(String(s||""));return v??f}catch{return f}};
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const nonEmpty=v=>v!==undefined&&v!==null&&v!==""&&!(Array.isArray(v)&&v.length===0);
function hash(value){let s="";try{s=typeof value==="string"?value:JSON.stringify(value??null)}catch{s=String(value??"")}let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)+":"+s.length}
function same(a,b){return hash(a)===hash(b)}
function updatedMs(v){const raw=v?.updatedAt||v?.updatedAtIso||v?.createdAt||v?.createdAtIso||v?.dateModified||"";const t=Date.parse(raw);return Number.isFinite(t)?t:Number(v?.updatedAtMs)||0}
function rowKey(item){if(item&&typeof item==="object"&&item.id!=null&&String(item.id)!=="")return"id:"+String(item.id);try{return"sig:"+hash(item)}catch{return"sig:"+String(item)}}
function mergeObjectConservative(base,incoming){
  if(!base||typeof base!=="object")return clone(incoming);
  if(!incoming||typeof incoming!=="object")return clone(base);
  const out=clone(base),bt=updatedMs(base),it=updatedMs(incoming),incomingNewer=it>bt;
  for(const [k,v] of Object.entries(incoming)){
    const old=out[k];
    if(Array.isArray(v)){if(!Array.isArray(old)||!old.length)out[k]=clone(v);continue}
    if(v&&typeof v==="object"){out[k]=mergeObjectConservative(old&&typeof old==="object"?old:{},v);continue}
    if(!nonEmpty(old)&&nonEmpty(v))out[k]=v;
    else if(incomingNewer&&nonEmpty(v))out[k]=v;
  }
  return out;
}
function mergeRows(...lists){
  const map=new Map(),order=[];
  for(const list of lists){
    for(const item of(Array.isArray(list)?list:[])){
      const key=rowKey(item);
      if(!map.has(key)){map.set(key,clone(item));order.push(key);continue}
      map.set(key,mergeObjectConservative(map.get(key),item));
    }
  }
  return order.map(k=>map.get(k));
}
function agentHasName(a){const i=a?.identity||{},label=[i.prenom,i.nom].filter(Boolean).join(" ").trim()||a?.displayName||a?.name||"";return !!label&&!/^(agent|sans nom|agent sans nom)$/i.test(String(label).trim())}
function mergeAgents(...lists){
  const rows=mergeRows(...lists);
  return rows.map(agent=>{
    if(!agent||typeof agent!=="object")return agent;
    const sources=lists.flatMap(x=>Array.isArray(x)?x:[]).filter(x=>x&&String(x.id||"")===String(agent.id||""));
    const deleted=sources.filter(x=>x?._deleted===true);
    const hasNamedSource=sources.some(agentHasName);
    if(deleted.length||!hasNamedSource){
      const identity=sources.reduce((o,x)=>({...o,...(x.identity||{})}),{}),deletedAt=(deleted.length?deleted:sources).map(x=>x?.deletedAt||x?.updatedAt||"").filter(Boolean).sort().pop()||new Date().toISOString(),named=deleted.find(x=>x.deletedDisplayName)||sources.find(x=>x?.deletedDisplayName)||sources[0]||agent;
      return{id:String(agent.id||named?.id||""),_deleted:true,deletedAt,updatedAt:deletedAt,createdAt:agent.createdAt||named?.createdAt||deletedAt,deletedDisplayName:named?.deletedDisplayName||[identity.prenom,identity.nom].filter(Boolean).join(" ").trim()||"Ancienne fiche sans nom",deletedReason:deleted.length?"suppression-synchronisee":"nettoyage-fiche-sans-nom",identity:{prenom:identity.prenom||"",nom:identity.nom||""},job:{},docs:[],incidents:[]};
    }
    let out=clone(agent),docs=[],incidents=[];
    for(const s of sources){out=mergeObjectConservative(out,s);docs=mergeRows(docs,s.docs||[]);incidents=mergeRows(incidents,s.incidents||[])}
    out.docs=docs;
    out.incidents=incidents.map(inc=>{const src=sources.flatMap(s=>s.incidents||[]).filter(x=>String(x?.id||"")===String(inc?.id||""));let z=clone(inc),photos=[];for(const x of src){z=mergeObjectConservative(z,x);photos=mergeRows(photos,x.photos||[])}z.photos=photos;return z});
    return out;
  });
}
function mergePlanning(...objs){
  const valid=objs.filter(x=>x&&typeof x==="object"&&!Array.isArray(x));
  if(!valid.length)return null;
  let out={};for(const v of valid)out=mergeObjectConservative(out,v);
  out.agents=mergeRows(...valid.map(v=>v.agents||[]));out.weeks={};
  const weeks=new Set(valid.flatMap(v=>Object.keys(v.weeks||{})));
  for(const w of weeks)out.weeks[w]=mergeRows(...valid.map(v=>v.weeks?.[w]||[]));
  return out;
}
function mergeHours(...objs){
  const valid=objs.filter(x=>x&&typeof x==="object"&&!Array.isArray(x));if(!valid.length)return null;
  let out={};for(const v of valid)out=mergeObjectConservative(out,v);out.entries=mergeRows(...valid.map(v=>v.entries||[]));
  const seen=new Set();out.employees=[];for(const v of valid)for(const name of(v.employees||[])){const k=norm(name);if(k&&!seen.has(k)){seen.add(k);out.employees.push(name)}}return out;
}
function mergeModule(mode,...payloads){
  const parsed=payloads.map(x=>typeof x==="string"?parse(x,null):x).filter(x=>x!=null);if(!parsed.length)return null;
  if(mode==="agents")return mergeAgents(...parsed);
  if(mode==="planning")return mergePlanning(...parsed);
  if(mode==="heures")return mergeHours(...parsed);
  if(mode==="conges")return mergeRows(...parsed);
  return parsed[parsed.length-1];
}
function stripBinary(value){
  if(Array.isArray(value))return value.map(stripBinary);
  if(!value||typeof value!=="object")return value;
  const out={};for(const [k,v] of Object.entries(value)){if(["dataUrl","previewUrl","base64","data"].includes(k)&&typeof v==="string"&&v.length>5000)continue;out[k]=stripBinary(v)}return out;
}
function localPayload(key){try{return localStorage.getItem(key)||""}catch{return""}}
function setLocalPayload(key,value){try{if(value) localStorage.setItem(key,value)}catch(e){console.warn("Restauration locale",key,e)}}
function moduleEntry(data,mode){return data?.moduleSyncV1?.[mode]||null}

async function recoverWorkspace(user){
  const personalRef=db.collection("kanban").doc(user.uid),sharedRef=db.collection("chantiers").doc(SHARED_WORKSPACE_ID);
  const [ps,ss]=await Promise.all([personalRef.get(),sharedRef.get()]),P=ps.exists?(ps.data()||{}):{},S=ss.exists?(ss.data()||{}):{};
  const mergedModules={...clone(S.moduleSyncV1||{}),...clone(P.moduleSyncV1||{})},counts={},now=Date.now();
  for(const [mode,cfg] of Object.entries(MODULES)){
    const local=localPayload(cfg.key),p=moduleEntry(P,mode)?.payload||"",s=moduleEntry(S,mode)?.payload||"",merged=mergeModule(mode,s,p,local);
    if(merged==null)continue;
    const full=JSON.stringify(merged),cloud=JSON.stringify(stripBinary(merged));setLocalPayload(cfg.key,full);
    mergedModules[mode]={...(moduleEntry(S,mode)||{}),...(moduleEntry(P,mode)||{}),payload:cloud,updatedAtMs:Math.max(Number(moduleEntry(S,mode)?.updatedAtMs)||0,Number(moduleEntry(P,mode)?.updatedAtMs)||0,now),client:"historical-recovery",reason:"restore-all-sources",recoveryVersion:1,version:2};
    counts[mode]=mode==="agents"?(Array.isArray(merged)?merged.filter(a=>a?._deleted!==true&&agentHasName(a)).length:0):mode==="conges"?(Array.isArray(merged)?merged.length:0):mode==="heures"?(merged.entries||[]).length:Object.values(merged.weeks||{}).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0);
  }
  const localTasks=parse(localPayload(ORGA_KEY),[]),tasks=mergeRows(S.tasks||[],P.tasks||[],Array.isArray(localTasks)?localTasks:[]);if(tasks.length||Array.isArray(S.tasks)||Array.isArray(P.tasks)){setLocalPayload(ORGA_KEY,JSON.stringify(tasks));counts.organisation=tasks.length}
  const sharedPatch={_hidden:true,_type:"inovtecSharedWorkspace",sharedVersion:1,moduleSyncV1:mergedModules,_ivHistoricalRecoveryV1:{atIso:new Date().toISOString(),byUid:user.uid,counts}};
  if(tasks.length||Array.isArray(S.tasks)||Array.isArray(P.tasks))sharedPatch.tasks=stripBinary(tasks);
  const personalPatch={moduleSyncV1:mergedModules,_ivHistoricalRecoveryV1:{atIso:new Date().toISOString(),counts}};if(tasks.length||Array.isArray(S.tasks)||Array.isArray(P.tasks))personalPatch.tasks=stripBinary(tasks);
  if(!same({moduleSyncV1:S.moduleSyncV1||{},tasks:S.tasks||[]},{moduleSyncV1:sharedPatch.moduleSyncV1,tasks:sharedPatch.tasks||[]}))await sharedRef.set(sharedPatch,{merge:true});
  if(!same({moduleSyncV1:P.moduleSyncV1||{},tasks:P.tasks||[]},{moduleSyncV1:personalPatch.moduleSyncV1,tasks:personalPatch.tasks||[]}))await personalRef.set(personalPatch,{merge:true});
  return counts;
}

function listFromDisciplineData(data){if(Array.isArray(data?.recordsV9))return data.recordsV9;if(Array.isArray(data?.recordsV8))return data.recordsV8;if(Array.isArray(data?.recordsV7))return data.recordsV7;if(Array.isArray(data?.records))return data.records;return[]}
function fallbackDiscipline(data){if(Array.isArray(data?.disciplineRecordsV9))return data.disciplineRecordsV9;if(Array.isArray(data?.disciplineRecordsV8))return data.disciplineRecordsV8;if(Array.isArray(data?.disciplineRecordsV7))return data.disciplineRecordsV7;return[]}
function localDisciplineLists(user){const out=[];const keys=[`inovtec_discipline_pending_v9_${user.uid}`,`inovtec_discipline_cache_v9_${user.uid}`,...DISC_LEGACY_KEYS];for(const key of keys){const raw=parse(localPayload(key),null);if(Array.isArray(raw))out.push(raw);else if(Array.isArray(raw?.records))out.push(raw.records)}return out}
async function recoverDiscipline(user){
  const primary=db.collection("discipline").doc(user.uid),fallback=db.collection("kanban").doc(user.uid),shared=db.collection("chantiers").doc(SHARED_DISCIPLINE_ID),[ps,fs,ss]=await Promise.all([primary.get(),fallback.get(),shared.get()]),P=ps.exists?(ps.data()||{}):{},F=fs.exists?(fs.data()||{}):{},S=ss.exists?(ss.data()||{}):{};
  const merged=mergeRows(listFromDisciplineData(S),listFromDisciplineData(P),fallbackDiscipline(F),...localDisciplineLists(user));if(!merged.length)return 0;
  const cloud=stripBinary(merged),stamp=new Date().toISOString(),sharedPatch={_hidden:true,_type:"disciplineShared",sharedVersion:1,recordsV9:cloud,disciplineUpdatedAtIso:stamp,_ivHistoricalRecoveryV1:{atIso:stamp,byUid:user.uid,count:merged.length},updatedAt:firebase.firestore.FieldValue.serverTimestamp()},personalPatch={recordsV9:cloud,disciplineUpdatedAtIso:stamp,storageVersion:9,_ivHistoricalRecoveryV1:{atIso:stamp,count:merged.length},updatedAt:firebase.firestore.FieldValue.serverTimestamp()},fallbackPatch={disciplineRecordsV9:cloud,disciplineUpdatedAtIso:stamp,disciplineStorageVersion:9};
  if(!same(listFromDisciplineData(S),cloud))await shared.set(sharedPatch,{merge:true});if(!same(listFromDisciplineData(P),cloud))await primary.set(personalPatch,{merge:true});if(!same(fallbackDiscipline(F),cloud))await fallback.set(fallbackPatch,{merge:true});
  try{localStorage.setItem(`inovtec_discipline_cache_v9_${user.uid}`,JSON.stringify({records:merged,updatedAtIso:stamp}))}catch{}
  return merged.length;
}

async function recover(user){
  if(!user)return;if(busy){queued=true;return}if(Date.now()-lastRun<2500)return;busy=true;lastRun=Date.now();
  try{const [workspace,discipline]=await Promise.all([recoverWorkspace(user),recoverDiscipline(user)]);try{window.dispatchEvent(new CustomEvent("inovtec:historical-data-recovered",{detail:{workspace,discipline}}))}catch{}console.info("Inovtec · récupération historique terminée",{workspace,discipline})}catch(e){console.warn("Récupération historique Inovtec",e)}finally{busy=false;if(queued){queued=false;setTimeout(()=>recover(user),250)}}
}
auth.onAuthStateChanged(u=>{currentUser=u||null;if(currentUser){setTimeout(()=>recover(currentUser),120);setTimeout(()=>recover(currentUser),1800)}});
window.addEventListener("online",()=>{if(currentUser)recover(currentUser)});window.addEventListener("focus",()=>{if(currentUser)recover(currentUser)});document.addEventListener("visibilitychange",()=>{if(!document.hidden&&currentUser)recover(currentUser)});
})();
