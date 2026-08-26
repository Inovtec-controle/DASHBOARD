(()=>{
"use strict";
if(window.__INOVTEC_FIREBASE_OPERATIONAL_GUARD_V1__)return;
window.__INOVTEC_FIREBASE_OPERATIONAL_GUARD_V1__=true;
if(window.top!==window)return;

const SHARED_WORKSPACE_ID="__inovtec_shared_workspace_v1__";
const AGENTS_KEY="kontrol_agents_classeur_v2";
const VARIABLE_MODE="variables";
const CHUNK_SIZE=180000;
const MAX_BINARY_SIZE=12*1024*1024;
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
let auth=null,db=null,user=null,unsubs=[],busyVariables=false,variablesQueued=false,busyBinaries=false,binaryTimer=null;

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const parse=(s,f=null)=>{try{const v=JSON.parse(String(s||""));return v??f}catch{return f}};
function hash(value){const s=String(value||"");let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)+":"+s.length}
function updatedMs(v){const t=Date.parse(v?.updatedAt||v?.updatedAtIso||v?.createdAt||v?.createdAtIso||v?.addedAt||"");return Number.isFinite(t)?t:0}
function mergeRows(a=[],b=[]){const out=[],map=new Map();for(const item of [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]){if(!item||typeof item!=="object"){out.push(clone(item));continue}const id=String(item.id||"");if(!id){out.push(clone(item));continue}if(!map.has(id)){const c=clone(item);map.set(id,c);out.push(c);continue}const old=map.get(id),ot=updatedMs(old),nt=updatedMs(item);if(nt>ot){Object.keys(old).forEach(k=>delete old[k]);Object.assign(old,clone(item))}else if(nt===ot){Object.assign(old,clone(item))}}return out}
function mergeVariables(a,b){const A=a&&typeof a==="object"?a:{},B=b&&typeof b==="object"?b:{};const monthStatus={...(A.monthStatus||{})};Object.entries(B.monthStatus||{}).forEach(([k,v])=>{const old=monthStatus[k];if(!old||updatedMs(v)>=updatedMs(old))monthStatus[k]=clone(v)});return{version:Math.max(Number(A.version)||1,Number(B.version)||1),entries:mergeRows(A.entries||[],B.entries||[]),monthStatus,meta:{...(A.meta||{}),...(B.meta||{})}}}
function entryHash(entry){return hash(String(entry?.payload||""))}
function variableEntryFrom(payload,a,b,reason){return{...(a||{}),...(b||{}),payload:JSON.stringify(payload),updatedAtMs:Math.max(Number(a?.updatedAtMs)||0,Number(b?.updatedAtMs)||0,Date.now()),client:"firebase-operational-guard",reason,version:1,sharedVersion:1}}
async function reconcileVariables(){
  if(!user||!db)return;
  if(busyVariables){variablesQueued=true;return}
  busyVariables=true;
  try{
    const personal=db.collection("kanban").doc(user.uid),shared=db.collection("chantiers").doc(SHARED_WORKSPACE_ID);
    const [ps,ss]=await Promise.all([personal.get(),shared.get()]);
    const P=ps.exists?(ps.data()||{}):{},S=ss.exists?(ss.data()||{}):{};
    const pe=P.moduleSyncV1?.[VARIABLE_MODE]||null,se=S.moduleSyncV1?.[VARIABLE_MODE]||null;
    if(!pe&&!se)return;
    const marker=P._ivVariablesSharedV1||{},baseHash=String(marker.hash||"");
    const ph=entryHash(pe),sh=entryHash(se),pc=!!pe&&ph!==baseHash,sc=!!se&&sh!==baseHash;
    let target=null,reason="variables-share";
    if(!baseHash){
      if(pe&&se){target=variableEntryFrom(mergeVariables(parse(se.payload,{}),parse(pe.payload,{})),se,pe,"variables-first-merge")}
      else target=clone(pe||se);
    }else if(pc&&!sc)target=clone(pe);
    else if(sc&&!pc)target=clone(se);
    else if(!pc&&!sc)target=clone(se||pe);
    else{target=variableEntryFrom(mergeVariables(parse(se?.payload,{}),parse(pe?.payload,{})),se,pe,"variables-concurrent-merge");reason="variables-concurrent-merge"}
    if(!target)return;
    const targetHash=entryHash(target),sharedEntry=S.moduleSyncV1?.[VARIABLE_MODE]||null,personalEntry=P.moduleSyncV1?.[VARIABLE_MODE]||null;
    if(entryHash(sharedEntry)!==targetHash){await shared.set({_hidden:true,_type:"inovtecSharedWorkspace",sharedVersion:1,moduleSyncV1:{[VARIABLE_MODE]:target}},{merge:true})}
    const personalNeeds=entryHash(personalEntry)!==targetHash||String(marker.hash||"")!==targetHash;
    if(personalNeeds){await personal.set({moduleSyncV1:{[VARIABLE_MODE]:target},_ivVariablesSharedV1:{version:1,hash:targetHash,updatedAtIso:new Date().toISOString(),reason}},{merge:true})}
    window.dispatchEvent(new CustomEvent("inovtec:variables-shared-synced",{detail:{ok:true}}));
  }catch(e){console.warn("Synchronisation Firebase Variables",e);window.dispatchEvent(new CustomEvent("inovtec:variables-shared-synced",{detail:{ok:false,error:String(e?.message||e)}}))}
  finally{busyVariables=false;if(variablesQueued){variablesQueued=false;setTimeout(reconcileVariables,100)}}
}

function binaryFingerprint(item,dataUrl){const s=String(dataUrl||""),sample=s.slice(0,50000)+"|"+s.slice(-50000)+"|"+s.length+"|"+String(item?.name||"")+"|"+String(item?.size||0);return hash(sample).split(":")[0]}
function binaryChunkIds(id,count){return Array.from({length:count},(_,i)=>`__agent_binary_chunk__${id}_${String(i).padStart(3,"0")}`)}
async function storeBinary(item){
  const dataUrl=String(item?.dataUrl||"");if(!dataUrl||item?.ivBinaryV1?.chunkIds?.length)return false;
  const size=Number(item?.size)||0;if(size>MAX_BINARY_SIZE)return false;
  const binaryId="ab_"+binaryFingerprint(item,dataUrl),parts=[];for(let i=0;i<dataUrl.length;i+=CHUNK_SIZE)parts.push(dataUrl.slice(i,i+CHUNK_SIZE));if(!parts.length)return false;
  const ids=binaryChunkIds(binaryId,parts.length),first=await db.collection("chantiers").doc(ids[0]).get();
  if(!first.exists){for(let start=0;start<parts.length;start+=20){const batch=db.batch();parts.slice(start,start+20).forEach((data,j)=>{const index=start+j;batch.set(db.collection("chantiers").doc(ids[index]),{_hidden:true,_type:"agentBinaryChunk",binaryId,chunkIndex:index,totalChunks:parts.length,data})});await batch.commit()}}
  item.ivBinaryV1={version:1,binaryId,chunkIds:ids,size:Number(item.size)||0,type:String(item.type||"application/octet-stream"),name:String(item.name||""),storedAtIso:new Date().toISOString()};
  return true;
}
async function restoreBinary(item){
  if(item?.dataUrl||!Array.isArray(item?.ivBinaryV1?.chunkIds)||!item.ivBinaryV1.chunkIds.length)return false;
  const ids=item.ivBinaryV1.chunkIds,snaps=[];for(let start=0;start<ids.length;start+=20){snaps.push(...await Promise.all(ids.slice(start,start+20).map(id=>db.collection("chantiers").doc(id).get())))}
  if(snaps.some(s=>!s.exists))return false;
  const dataUrl=snaps.map(s=>s.data()||{}).sort((a,b)=>(Number(a.chunkIndex)||0)-(Number(b.chunkIndex)||0)).map(x=>String(x.data||"")).join("");if(!dataUrl.startsWith("data:"))return false;item.dataUrl=dataUrl;return true;
}
function eachAgentBinary(agents,fn){const jobs=[];(Array.isArray(agents)?agents:[]).forEach(agent=>{(agent.docs||[]).forEach(item=>jobs.push(fn(item,agent,"document")));(agent.incidents||[]).forEach(inc=>(inc.photos||[]).forEach(item=>jobs.push(fn(item,agent,"photo",inc))))});return jobs}
async function syncAgentBinaries(){
  if(!user||!db||busyBinaries||mode!=="agents")return;
  busyBinaries=true;
  try{
    const agents=parse(localStorage.getItem(AGENTS_KEY)||"[]",[]);if(!Array.isArray(agents)||!agents.length)return;
    let changed=false;
    for(const job of eachAgentBinary(agents,async item=>{try{if(item?.dataUrl&&!item?.ivBinaryV1?.chunkIds?.length)return await storeBinary(item);if(!item?.dataUrl&&item?.ivBinaryV1?.chunkIds?.length)return await restoreBinary(item)}catch(e){console.warn("Synchronisation pièce agent",item?.name||item?.id,e)}return false}))if(await job)changed=true;
    if(changed){const payload=JSON.stringify(agents);localStorage.setItem(AGENTS_KEY,payload);try{window.dispatchEvent(new StorageEvent("storage",{key:AGENTS_KEY,newValue:payload,storageArea:localStorage,url:location.href}))}catch{}setTimeout(refreshAgentsFrame,900)}
    patchAgentsMessage();
  }finally{busyBinaries=false}
}
function refreshAgentsFrame(){if(mode!=="agents")return;try{const f=document.getElementById("legacyFrame"),d=f?.contentDocument;if(!d?.body)return;if(d.activeElement&&/INPUT|TEXTAREA|SELECT/.test(d.activeElement.tagName))return;f.contentWindow.location.reload()}catch{}}
function patchAgentsMessage(){if(mode!=="agents")return;try{const d=document.getElementById("legacyFrame")?.contentDocument;if(!d?.body)return;const input=d.getElementById("docUpload");const note=input?.parentElement?.querySelector(".muted");if(note&&/stockés dans le navigateur/i.test(note.textContent||""))note.textContent="Les documents sont synchronisés en ligne pour rester disponibles sur ordinateur et téléphone."}catch{}}
function scheduleBinaries(delay=350){clearTimeout(binaryTimer);binaryTimer=setTimeout(syncAgentBinaries,delay)}

async function connectivityCheck(){if(!user||!db)return;try{await Promise.all([db.collection("kanban").doc(user.uid).get(),db.collection("chantiers").limit(1).get()]);window.InovtecFirebaseOperational={ok:true,checkedAt:new Date().toISOString(),projectId:window.INOVTEC_FIREBASE_CONFIG?.projectId||""};window.dispatchEvent(new CustomEvent("inovtec:firebase-operational",{detail:window.InovtecFirebaseOperational}))}catch(e){window.InovtecFirebaseOperational={ok:false,checkedAt:new Date().toISOString(),error:String(e?.message||e)};window.dispatchEvent(new CustomEvent("inovtec:firebase-operational",{detail:window.InovtecFirebaseOperational}))}}
function clearSubs(){unsubs.forEach(fn=>{try{fn()}catch{}});unsubs=[]}
function start(u){clearSubs();user=u||null;if(!user)return;const p=db.collection("kanban").doc(user.uid),s=db.collection("chantiers").doc(SHARED_WORKSPACE_ID);unsubs.push(p.onSnapshot(()=>reconcileVariables(),()=>{}),s.onSnapshot(()=>reconcileVariables(),()=>{}));reconcileVariables();scheduleBinaries(500);connectivityCheck()}
function boot(){
  if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG||!firebase.auth||!firebase.firestore){setTimeout(boot,120);return}
  try{if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);auth=firebase.auth();db=firebase.firestore();auth.onAuthStateChanged(start);window.addEventListener("online",()=>{if(user){reconcileVariables();scheduleBinaries(150);connectivityCheck()}});window.addEventListener("focus",()=>{if(user){reconcileVariables();scheduleBinaries(180)}});document.addEventListener("visibilitychange",()=>{if(!document.hidden&&user){reconcileVariables();scheduleBinaries(180)}});document.getElementById("legacyFrame")?.addEventListener("load",()=>{scheduleBinaries(250);setTimeout(patchAgentsMessage,350)});setInterval(()=>{if(user&&mode==="agents"&&!document.hidden)scheduleBinaries(0)},2500)}catch(e){console.warn("Démarrage garde-fou Firebase",e)}
}
boot();
})();
