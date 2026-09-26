/* Firestore is the source of truth; browser storage is only a working copy. */
(()=>{
'use strict';
const mode=(new URLSearchParams(location.search).get('mode')||'').toLowerCase();
const keys={planning:'inovtec_plannings_v2',agents:'kontrol_agents_classeur_v2',heures:'HSUPP_DUR_APP_V1',kontrol:'cq_app_state_bottomnote_v1'};
const key=keys[mode];if(!key)return;
const frame=document.getElementById('legacyFrame');
const client=sessionStorage.ivCloudClient||(sessionStorage.ivCloudClient='c'+Date.now()+Math.random().toString(36).slice(2));
const LIMIT=420000,parse=s=>{try{return JSON.parse(s)}catch{return null}},json=JSON.stringify;
const same=(a,b)=>json(a)===json(b);
const hash=s=>{s=String(s||'');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)+':'+s.length};
const local=()=>localStorage.getItem(key)||'',size=s=>new Blob([s]).size;
const baseKey=uid=>'iv_cloud_base_v2_'+mode+'_'+uid;
const activeKey='iv_cloud_active_user_v2_'+mode;
let user=null,ref=null,unsubscribe=null,initialized=false,base='',busy=false,applying=false,queued=false,writeTimer=null,reloadTimer=null,activity=0,lastLocalPlanningSave=0,generation=0,lastStatus='',switching=false,pendingPlanningPayload='';
function report(message,ok=false){
  if(message===lastStatus)return;lastStatus=message;
  for(const id of ['syncMirror','liveMirror']){const el=document.getElementById(id);if(el)el.textContent=message}
  let doc;try{doc=frame?.contentDocument||(mode==='planning'?document:null)}catch{}
  if(mode==='planning'&&doc){
    const label=[...doc.querySelectorAll('label')].find(x=>x.textContent.trim().toLowerCase()==='sauvegarde');
    const status=label?.parentElement?.querySelector('.status');if(status){status.textContent=message;status.classList.toggle('ok',ok);status.classList.toggle('warning',!ok)}
    const notice=[...doc.querySelectorAll('.notice')].find(x=>/navigateur|exporter|firebase/i.test(x.textContent||''));
    if(notice){notice.textContent=ok?'Sauvegarde confirmée sur Firebase. Copie locale conservée.':'Sauvegarde Firebase non confirmée : les modifications restent locales.';notice.classList.toggle('warning',!ok)}
  }
}
function packed(raw){
  if(!raw)return '';
  if(size(raw)<=LIMIT)return raw;
  if(mode==='agents'){
    const items=parse(raw);if(!Array.isArray(items))throw Error('Agents locaux illisibles');
    const result=json(items.map(a=>a?._deleted?a:{...a,docs:(a.docs||[]).map(d=>{const x={...d};delete x.dataUrl;return x}),incidents:(a.incidents||[]).map(i=>({...i,photos:(i.photos||[]).map(p=>{const x={...p};delete x.dataUrl;return x})}))}));
    if(size(result)<=LIMIT)return result;
  }
  if(mode==='kontrol'){
    const state=parse(raw);if(state&&typeof state==='object'){const result=json({...state,photos:[]});if(size(result)<=LIMIT)return result}
  }
  throw Error('Document trop volumineux pour Firebase ; copie locale conservée');
}
function preserveBinary(cloud,old){
  if(mode!=='agents')return cloud;
  const a=parse(cloud),b=parse(old);if(!Array.isArray(a)||!Array.isArray(b))return cloud;
  const prior=new Map(b.map(x=>[String(x?.id||''),x]));
  return json(a.map(item=>{
    if(item?._deleted)return item;const previous=prior.get(String(item?.id||''));if(!previous||previous._deleted)return item;
    return {...item,docs:(item.docs||[]).map(d=>{const x=(previous.docs||[]).find(y=>y.id===d.id);return x?.dataUrl&&!d.dataUrl?{...d,dataUrl:x.dataUrl}:d}),incidents:(item.incidents||[]).map(i=>{const x=(previous.incidents||[]).find(y=>y.id===i.id);return {...i,photos:(i.photos||[]).map(p=>{const y=(x?.photos||[]).find(z=>z.id===p.id);return y?.dataUrl&&!p.dataUrl?{...p,dataUrl:y.dataUrl}:p})}})};
  }));
}
function backup(uid,value){
  if(!value)return;
  try{const k='iv_cloud_backup_v2_'+mode+'_'+uid;if(!localStorage.getItem(k))localStorage.setItem(k,value)}catch(e){console.warn('Copie de sécurité indisponible',e)}
}
function render(){
  // Le Planning reçoit déjà le payload Firebase directement.
  // Un second rafraîchissement différé de localStorage créait une course qui
  // pouvait remettre brièvement puis supprimer définitivement une nouvelle tâche.
  if(mode==='planning')return;
  clearTimeout(reloadTimer);
  const run=()=>{
    let doc;try{doc=frame?.contentDocument}catch{}
    const active=doc?.activeElement;
    if((active&&/^(INPUT|SELECT|TEXTAREA)$/i.test(active.tagName))||Date.now()-activity<1800){reloadTimer=setTimeout(run,1900);return}
    try{frame?.contentWindow?.location.reload()}catch(e){console.warn('Actualisation après synchronisation',e)}
  };reloadTimer=setTimeout(run,300);
}
function apply(payload){
  const old=local(),value=preserveBinary(payload,switching?'':old);
  if(mode==='planning'&&pendingPlanningPayload&&value!==pendingPlanningPayload){
    // Une lecture Firebase arrivée pendant qu'une sauvegarde locale est encore
    // en attente ne doit jamais écraser cette sauvegarde.
    schedule(20);
    return;
  }
  let stored=old===value;
  if(old!==value){
    backup(user.uid,old);
    applying=true;
    try{
      localStorage.setItem(key,value);
      stored=true;
    }catch(e){
      stored=false;
      console.warn('Copie locale Firebase indisponible pour '+mode,e);
    }finally{applying=false}
  }
  if(mode==='planning'){
    window.dispatchEvent(new CustomEvent('inovtec:planning-cloud-payload',{detail:{payload:value,stored,source:'firebase-remote'}}));
  }else if(old!==value&&stored){
    render();
  }
}
// Three-way merge protects independently changed shifts, agents, and properties.
// Deletions beat stale browser records; no union that resurrects removed rows.
const ABSENT=Symbol('absent');
function merge3(b,l,r){
  if(same(l,b))return r;
  if(same(r,b))return l;
  if(same(l,r))return l;
  if(l===ABSENT||r===ABSENT)return ABSENT;
  if(Array.isArray(l)&&Array.isArray(r)&&Array.isArray(b)){
    const rows=[...b,...l,...r];
    if(rows.every(x=>x&&typeof x==='object'&&x.id!=null)){
      const ids=new Set(rows.map(x=>String(x.id))),idx=a=>new Map(a.map(x=>[String(x.id),x]));
      const B=idx(b),L=idx(l),R=idx(r),out=[];
      for(const id of ids){const v=merge3(B.has(id)?B.get(id):ABSENT,L.has(id)?L.get(id):ABSENT,R.has(id)?R.get(id):ABSENT);if(v!==ABSENT)out.push(v)}
      return out;
    }return l;
  }
  if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)){
    const B=b&&typeof b==='object'&&!Array.isArray(b)?b:{},out={};
    for(const k of new Set([...Object.keys(B),...Object.keys(l),...Object.keys(r)])){
      const v=merge3(Object.hasOwn(B,k)?B[k]:ABSENT,Object.hasOwn(l,k)?l[k]:ABSENT,Object.hasOwn(r,k)?r[k]:ABSENT);
      if(v!==ABSENT)out[k]=v;
    }return out;
  }
  return l;
}
function mergePayload(b,l,r){
  const B=parse(b),L=parse(l),R=parse(r);
  if(B==null||L==null||R==null)throw Error('Fusion impossible : document illisible');
  if(mode==='agents'&&Array.isArray(B)&&Array.isArray(L)&&Array.isArray(R)){
    const ids=new Set([...B,...L,...R].map(a=>String(a?.id||'')).filter(Boolean));
    const idx=a=>new Map(a.map(x=>[String(x?.id||''),x]));
    const BM=idx(B),LM=idx(L),RM=idx(R),out=[];
    for(const id of ids){
      const vals=[BM.get(id),LM.get(id),RM.get(id)].filter(Boolean);
      const deleted=vals.filter(x=>x?._deleted===true).sort((a,b)=>Date.parse(b.deletedAt||b.updatedAt||0)-Date.parse(a.deletedAt||a.updatedAt||0))[0];
      const live=vals.filter(x=>x?._deleted!==true).sort((a,b)=>Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0))[0];
      if(deleted){
        const dt=Date.parse(deleted.deletedAt||deleted.updatedAt||0)||0,lt=Date.parse(live?.updatedAt||live?.createdAt||0)||0;
        if(!live||dt>=lt){out.push(deleted);continue}
      }
      const v=merge3(BM.has(id)?BM.get(id):ABSENT,LM.has(id)?LM.get(id):ABSENT,RM.has(id)?RM.get(id):ABSENT);
      if(v!==ABSENT)out.push(v);
    }
    return json(out);
  }
  return json(merge3(B,L,R));
}
function remember(payload){
  base=payload;
  try{localStorage.setItem(baseKey(user.uid),payload);localStorage.setItem('iv_cloud_meta_'+mode,json({hash:hash(payload),ts:Date.now(),uid:user.uid,verified:true}))}catch(e){console.warn('Métadonnées locales non conservées',e)}
}
function schedule(delay=350){
  clearTimeout(writeTimer);if(!user||!initialized||applying)return;
  report('Firebase — sauvegarde en cours…');writeTimer=setTimeout(()=>{void send()},delay);
}
async function send(){
  if(!user||!ref||!initialized||applying)return;
  if(busy){queued=true;return}
  const directPlanningPayload=mode==='planning'&&pendingPlanningPayload?pendingPlanningPayload:'';
  let draft;
  try{draft=packed(directPlanningPayload||local())}catch(e){
    report('Firebase — '+e.message);
    if(mode==='planning')window.dispatchEvent(new CustomEvent('inovtec:planning-cloud-save-failed',{detail:{message:e.message||String(e)}}));
    return;
  }
  if(draft===base){
    if(directPlanningPayload&&pendingPlanningPayload===directPlanningPayload)pendingPlanningPayload='';
    report('Firebase — synchronisé',true);
    if(mode==='planning')window.dispatchEvent(new CustomEvent('inovtec:planning-cloud-saved',{detail:{at:Date.now(),payload:draft}}));
    return;
  }
  busy=true;const token=generation,doc=ref,prior=base;
  report('Firebase — enregistrement sur le serveur…');
  try{
    let written='';
    await firebase.firestore().runTransaction(async tx=>{
      const snap=await tx.get(doc),entry=snap.exists?snap.data()?.moduleSyncV1?.[mode]:null;
      const remote=entry&&typeof entry.payload==='string'?entry.payload:null;
      if(entry&&remote===null)throw Error('Document Firebase illisible');
      if(remote===null||remote===prior)written=draft;
      else if(!prior)throw Error('Version serveur modifiée : actualisation nécessaire');
      else written=mergePayload(prior,draft,remote);
      if(size(written)>LIMIT)throw Error('Document trop volumineux pour Firebase');
      tx.set(doc,{moduleSyncV1:{[mode]:{payload:written,updatedAtMs:Date.now(),client,reason:'confirmed-cross-device',version:5}}},{merge:true});
    });
    if(token!==generation)return;
    const check=await doc.get({source:'server'});if(token!==generation)return;
    const actual=check.data()?.moduleSyncV1?.[mode]?.payload;
    if(actual!==written){report('Firebase — modification distante détectée');await receive(actual);return}
    remember(written);
    if(mode==='planning'){
      if(directPlanningPayload&&pendingPlanningPayload===directPlanningPayload)pendingPlanningPayload='';
      try{
        if(local()!==written)localStorage.setItem(key,written);
      }catch(e){
        console.warn('Planning Firebase confirmé mais copie locale indisponible',e);
      }
      report('Firebase — synchronisé',true);
      window.dispatchEvent(new CustomEvent('inovtec:planning-cloud-payload',{detail:{payload:written,stored:true,source:'firebase-confirmed'}}));
      window.dispatchEvent(new CustomEvent('inovtec:planning-cloud-saved',{detail:{at:Date.now(),payload:written}}));
    }else{
      if(packed(local())===draft&&written!==draft)apply(written);
      if(packed(local())!==written)schedule(150);
      else report('Firebase — synchronisé',true);
    }
  }catch(e){
    if(token!==generation)return;
    console.warn('Échec sauvegarde Firebase '+mode,e);
    report('Firebase — sauvegarde non confirmée : '+(e.code||e.message||'erreur'));
    if(mode==='planning')window.dispatchEvent(new CustomEvent('inovtec:planning-cloud-save-failed',{detail:{message:e.code||e.message||'erreur'}}));
    if(/actualisation nécessaire/.test(e.message||''))void refresh();
  }finally{busy=false;if(queued){queued=false;schedule(100)}}
}
async function receive(remote){
  if(!user||!initialized||typeof remote!=='string')return;
  if(mode==='planning'&&pendingPlanningPayload){
    schedule(100);
    return;
  }
  let current;try{current=packed(local())}catch(e){report('Firebase — '+e.message);return}
  if(remote===base){if(current!==base)schedule(100);return}
  // No established baseline: server wins rather than endlessly retrying an old migration.
  if(!base&&remote){remember(remote);apply(remote);report('Firebase — synchronisé',true);return}
  if(current!==base){queued=true;schedule(100);return}
  remember(remote);apply(remote);report('Firebase — synchronisé',true);
}
async function refresh(){
  if(!ref||!user||!initialized)return;
  try{const snap=await ref.get({source:'server'}),entry=snap.data()?.moduleSyncV1?.[mode];
    if(entry&&typeof entry.payload==='string')await receive(entry.payload);
    else if(!entry&&packed(local())!==base)schedule(100);
  }catch(e){report('Firebase — lecture impossible : '+(e.code||e.message||'erreur'))}
}
async function boot(uid,token){
  const doc=firebase.firestore().collection('kanban').doc(uid);
  try{
    const snap=await doc.get({source:'server'});if(token!==generation)return;
    ref=doc;const entry=snap.data()?.moduleSyncV1?.[mode];
    if(entry&&typeof entry.payload!=='string')throw Error('Données serveur illisibles');
    const remote=entry?entry.payload:null;
    const stored=switching?null:localStorage.getItem(baseKey(uid));
    const browser=switching?'':packed(mode==='planning'&&pendingPlanningPayload?pendingPlanningPayload:local());
    if(remote!==null){
      if(mode==='planning'&&pendingPlanningPayload){
        base=stored!==null?stored:remote;
        initialized=true;
        schedule(20);
      }else if(mode==='planning'&&browser&&Date.now()-lastLocalPlanningSave<5000){
        base=stored!==null?stored:remote;
        initialized=true;
        schedule(20);
      }else if(mode==='agents'){
        // Firebase est la source de vérité du Classeur Agents au démarrage.
        // Une ancienne copie locale / ancien cache ne doit jamais écraser la liste serveur.
        initialized=true;remember(remote);apply(remote);report('Firebase — synchronisé',true)
      }else if(stored!==null&&stored!==browser){base=stored;initialized=true;schedule(20)}
      else{initialized=true;remember(remote);apply(remote);report('Firebase — synchronisé',true)}
    }else{
      initialized=true;base='';
      if(browser)schedule(20);
      else{remember('');report('Firebase — synchronisé',true)}
    }
    switching=false;
    unsubscribe=doc.onSnapshot(s=>{
      if(token!==generation||s.metadata.fromCache||s.metadata.hasPendingWrites)return;
      const data=s.data()?.moduleSyncV1?.[mode];if(data&&typeof data.payload==='string')void receive(data.payload);
    },e=>{if(token===generation)report('Firebase — écoute interrompue : '+(e.code||e.message||'erreur'))});
  }catch(e){if(token===generation){console.warn('Initialisation Firebase '+mode,e);report('Firebase — connexion ou lecture impossible : '+(e.code||e.message||'erreur'))}}
}
function login(){
  let box=document.getElementById('ivCloudLogin');if(box)return box;
  box=document.createElement('div');box.id='ivCloudLogin';box.style.cssText='position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:#0f172a77;padding:18px';
  box.innerHTML='<form style="width:min(390px,100%);background:white;border-radius:16px;padding:24px;font:14px system-ui"><h2>Connexion Inovtec</h2><p>Connecte-toi au même compte sur chaque appareil.</p><label>Adresse e-mail<input type="email" name="email" required autocomplete="username" style="display:block;width:100%;padding:10px;margin:6px 0 12px"></label><label>Mot de passe<input type="password" name="password" required autocomplete="current-password" style="display:block;width:100%;padding:10px;margin:6px 0 12px"></label><button type="submit" style="padding:10px;background:#065f46;color:white;border:0;border-radius:8px">Se connecter</button><p data-error style="color:#b91c1c"></p></form>';
  document.body.appendChild(box);
  box.querySelector('form').addEventListener('submit',async ev=>{
    ev.preventDefault();const form=ev.currentTarget;form.querySelector('[data-error]').textContent='';
    try{await firebase.auth().signInWithEmailAndPassword(form.elements.email.value.trim(),form.elements.password.value);form.elements.password.value=''}
    catch(e){form.querySelector('[data-error]').textContent='Connexion impossible : '+(e.code||e.message)}
  });return box;
}
function start(u){
  generation++;if(unsubscribe){unsubscribe();unsubscribe=null}clearTimeout(writeTimer);clearTimeout(reloadTimer);
  user=u||null;ref=null;initialized=false;busy=false;queued=false;base='';lastStatus='';
  if(!user){report('Firebase — connexion requise');if(['planning','agents','heures'].includes(mode))login().style.display='grid';return}
  const box=document.getElementById('ivCloudLogin');if(box)box.style.display='none';
  const lastUser=localStorage.getItem(activeKey);switching=!!lastUser&&lastUser!==user.uid;
  try{localStorage.setItem(activeKey,user.uid)}catch{}
  report('Firebase — lecture du serveur…');void boot(user.uid,generation);
}
if(!window.firebase?.auth||!window.firebase?.firestore||!window.INOVTEC_FIREBASE_CONFIG){report('Firebase — configuration manquante');return}
if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
firebase.auth().onAuthStateChanged(start);
frame?.addEventListener('load',()=>{
  try{frame.contentDocument?.addEventListener('input',()=>{activity=Date.now();setTimeout(()=>schedule(),200)},true)}catch{}
  try{const ok=initialized&&base===packed(local());lastStatus='';report(initialized?(ok?'Firebase — synchronisé':'Firebase — sauvegarde en attente'):'Firebase — connexion au serveur…',ok)}
  catch(e){report('Firebase — '+e.message)}
});
if(mode==='planning'&&!frame){
  // Pendant l'édition du Planning, on note uniquement l'activité.
  // La sauvegarde Firebase est déclenchée explicitement par inovtec:planning-local-saved.
  document.addEventListener('input',()=>{activity=Date.now()},true);
}
setInterval(()=>{if(user&&initialized&&!applying){try{if((mode==='planning'&&pendingPlanningPayload)||packed(local())!==base)schedule(50)}catch(e){report('Firebase — '+e.message)}}},6000);
window.addEventListener('online',()=>{if(user){if(!initialized)void boot(user.uid,generation);else if(mode==='planning'&&pendingPlanningPayload)schedule(20);else void refresh()}});
window.addEventListener('inovtec:planning-local-saved',ev=>{
  if(mode!=='planning')return;
  lastLocalPlanningSave=Date.now();
  activity=Date.now();
  const payload=ev?.detail?.payload;
  if(typeof payload==='string'&&payload){
    pendingPlanningPayload=payload;
  }
  if(initialized)schedule(20);
});
window.addEventListener('inovtec:planning-request-cloud-refresh',()=>{
  if(mode!=='planning'||!user)return;
  if(!initialized)void boot(user.uid,generation);
  else void refresh();
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&user){if(!initialized)void boot(user.uid,generation);else void refresh()}});
})();
