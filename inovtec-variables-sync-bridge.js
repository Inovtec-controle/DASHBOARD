/* Synchronisation multi-appareils Variables : fusion conservatrice, sauvegardes et aucun effacement automatique. */
(()=>{
'use strict';
if((new URLSearchParams(location.search).get('mode')||'').toLowerCase()!=='variables')return;
if(window.__INOVTEC_VARIABLES_SYNC_BRIDGE_V1__)return;
window.__INOVTEC_VARIABLES_SYNC_BRIDGE_V1__=true;
const KEY='inovtec_variables_v1';
const SHARED='__inovtec_shared_workspace_v1__';
const LIMIT=400000;
const firebase=window.firebase;
if(!firebase?.auth||!firebase?.firestore||!window.INOVTEC_FIREBASE_CONFIG){console.warn('Variables : Firebase non initialisé');return}
if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
const auth=firebase.auth(),db=firebase.firestore();
let personal=null,shared=null,personalSnap=null,sharedSnap=null,stopPersonal=null,stopShared=null;
let user=null,working=false,again=false,timer=null,lastStatus='';
const parse=s=>{try{const o=typeof s==='string'?JSON.parse(s):s;return o&&typeof o==='object'&&!Array.isArray(o)&&Array.isArray(o.entries)?o:null}catch{return null}};
const readLocal=()=>{try{return localStorage.getItem(KEY)||''}catch{return''}};
const stamp=o=>{const n=Date.parse(o?.updatedAt||o?.createdAt||'');return Number.isFinite(n)?n:0};
const safeRows=o=>Array.isArray(o?.entries)?o.entries:[];
const safeStatus=o=>o?.monthStatus&&typeof o.monthStatus==='object'&&!Array.isArray(o.monthStatus)?o.monthStatus:{};
const safeMeta=o=>o?.meta&&typeof o.meta==='object'&&!Array.isArray(o.meta)?o.meta:{};
const serialized=o=>JSON.stringify(o);
const byteSize=s=>{try{return new Blob([s]).size}catch{return s.length}};
function status(s){
 if(s===lastStatus)return;lastStatus=s;
 const target=document.getElementById('syncMirror');
 if(target&&(s.startsWith('Variables :')||s.startsWith('Firebase :')))target.textContent=s;
 window.__INOVTEC_VARIABLES_SYNC_STATUS__=s;
}
function backup(label,raw){
 if(!raw)return;
 try{
  const sessionKey='iv_variables_backup_done_'+label;
  if(sessionStorage.getItem(sessionKey))return;
  localStorage.setItem('iv_variables_backup_'+label+'_'+new Date().toISOString().replace(/[:.]/g,'-'),raw);
  sessionStorage.setItem(sessionKey,'1');
 }catch(e){console.warn('Sauvegarde Variables impossible',label,e)}
}
function merged(sources){
 const valid=sources.filter(Boolean);
 if(!valid.length)return null;
 const byId=new Map(),anonymous=new Map(),statuses={},meta={};
 for(const source of valid){
  Object.assign(meta,safeMeta(source));
  for(const row of safeRows(source)){
   if(!row||typeof row!=='object')continue;
   const id=String(row.id||'');
   if(!id){const signature=serialized(row);anonymous.set(signature,row);continue}
   const prior=byId.get(id);
   if(!prior||stamp(row)>stamp(prior)||stamp(row)===stamp(prior)&&serialized(row).length>serialized(prior).length)byId.set(id,row);
  }
  for(const [id,entry] of Object.entries(safeStatus(source))){
   const prior=statuses[id];
   if(!prior||stamp(entry)>stamp(prior))statuses[id]=entry;
  }
 }
 return {version:1,entries:[...byId.values(),...anonymous.values()],monthStatus:statuses,meta};
}
function content(snapshot){
 const raw=snapshot?.data()?.moduleSyncV1?.variables?.payload||'';
 return {raw,state:raw?parse(raw):null};
}
function schedule(ms=100){clearTimeout(timer);timer=setTimeout(reconcile,ms)}
async function reconcile(){
 if(working){again=true;return}
 if(!user||!personalSnap||!sharedSnap)return;
 working=true;
 try{
  const localRaw=readLocal(),local=localRaw?parse(localRaw):null;
  const p=content(personalSnap),s=content(sharedSnap);
  if((p.raw&&!p.state)||(s.raw&&!s.state)||(localRaw&&!local)){
   status('Variables : données illisibles, synchronisation interrompue pour éviter un écrasement.');return;
  }
  const canonical=merged([s.state,p.state,local]);
  if(!canonical){status('Firebase : aucune variable enregistrée pour le moment.');return}
  const payload=serialized(canonical);
  if(byteSize(payload)>LIMIT){status('Variables : volume trop important pour la synchronisation ; les copies sont préservées.');return}
  if(localRaw!==payload){
   backup('local',localRaw);
   try{localStorage.setItem(KEY,payload);window.dispatchEvent(new CustomEvent('inovtec:variables-cloud-updated'))}catch(e){console.warn('Variables : écriture locale impossible',e);status('Variables : stockage local indisponible.');return}
  }
  const needsPersonal=p.raw!==payload,needsShared=s.raw!==payload;
  if(!needsPersonal&&!needsShared){status('Firebase : variables synchronisées sur les appareils connectés.');return}
  if(needsPersonal)backup('firebase_personnel',p.raw);
  if(needsShared)backup('firebase_partage',s.raw);
  const entry={payload,updatedAtMs:Date.now(),client:'variables-bridge',reason:'merge-conservateur',version:1};
  const patch={moduleSyncV1:{variables:entry}};
  const targets=[];
  if(needsPersonal)targets.push(personal.set(patch,{merge:true}));
  if(needsShared)targets.push(shared.set(patch,{merge:true}));
  await Promise.all(targets);
  status('Firebase : variables synchronisées sur les appareils connectés.');
 }catch(e){console.warn('Variables : synchronisation différée',e);status('Variables : synchronisation Firebase en attente, saisies locales conservées.');}
 finally{working=false;if(again){again=false;schedule(150)}}
}
function unsubscribe(){
 try{stopPersonal?.()}catch{}try{stopShared?.()}catch{}
 stopPersonal=stopShared=null;personalSnap=sharedSnap=null;personal=shared=null;clearTimeout(timer);
}
auth.onAuthStateChanged(u=>{
 unsubscribe();user=u||null;
 if(!user){status('Variables : connexion Firebase requise pour synchroniser téléphone et ordinateur.');return}
 personal=db.collection('kanban').doc(user.uid);
 shared=db.collection('chantiers').doc(SHARED);
 stopPersonal=personal.onSnapshot(s=>{personalSnap=s;schedule()},e=>{console.warn('Variables : accès Firebase personnel',e);status('Variables : lecture Firebase personnelle indisponible.');});
 stopShared=shared.onSnapshot(s=>{sharedSnap=s;schedule()},e=>{console.warn('Variables : accès Firebase partagé',e);status('Variables : lecture Firebase partagée indisponible.');});
});
window.addEventListener('storage',e=>{if(e.key===KEY)schedule()});
window.addEventListener('inovtec:variables-updated',()=>schedule());
window.addEventListener('inovtec:historical-data-recovered',()=>schedule(300));
window.addEventListener('focus',()=>schedule(100));
window.addEventListener('online',()=>schedule(100));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(100)});
setInterval(()=>{if(!document.hidden&&user)schedule(100)},5000);
})();
