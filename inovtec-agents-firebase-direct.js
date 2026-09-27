(()=>{
'use strict';
const mode=(new URLSearchParams(location.search).get('mode')||'').toLowerCase();
if(mode!=='agents')return;

const LIMIT=900000;
const parse=(s,f)=>{try{const v=JSON.parse(String(s||''));return v??f}catch{return f}};
const clone=v=>JSON.parse(JSON.stringify(v));
let user=null,db=null,ref=null,unsubscribe=null,readyResolve,readyReject;
let readyPromise=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject});

function status(text,ok=false){
  for(const id of ['syncMirror','liveMirror']){
    const el=document.getElementById(id);
    if(el){el.textContent=text;el.dataset.ok=ok?'1':'0'}
  }
}
function emit(type,detail){
  const data=detail||{};
  try{window.dispatchEvent(new CustomEvent(type,{detail:data}))}catch(e){}
  try{
    const frame=document.getElementById('legacyFrame');
    const w=frame?.contentWindow;
    if(w)w.dispatchEvent(new w.CustomEvent(type,{detail:data}));
  }catch(e){}
}
function activeRows(rows){
  return (Array.isArray(rows)?rows:[]).filter(x=>x&&typeof x==='object'&&x.id);
}
function payloadOf(rows){
  const raw=JSON.stringify(activeRows(rows));
  if(new Blob([raw]).size>LIMIT)throw Error('Les données Agents sont trop volumineuses pour Firebase');
  return raw;
}
function loginBox(){
  let box=document.getElementById('ivAgentsFirebaseLogin');
  if(box)return box;
  box=document.createElement('div');
  box.id='ivAgentsFirebaseLogin';
  box.style.cssText='position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:#0f172a77;padding:18px';
  box.innerHTML='<form style="width:min(390px,100%);background:white;border-radius:16px;padding:24px;font:14px system-ui"><h2>Connexion Inovtec</h2><p>Connecte-toi pour accéder aux agents enregistrés dans Firebase.</p><label>Adresse e-mail<input type="email" name="email" required autocomplete="username" style="display:block;width:100%;padding:10px;margin:6px 0 12px"></label><label>Mot de passe<input type="password" name="password" required autocomplete="current-password" style="display:block;width:100%;padding:10px;margin:6px 0 12px"></label><button type="submit" style="padding:10px;background:#065f46;color:white;border:0;border-radius:8px">Se connecter</button><p data-error style="color:#b91c1c"></p></form>';
  document.body.appendChild(box);
  box.querySelector('form').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget,err=form.querySelector('[data-error]');
    err.textContent='';
    try{
      await firebase.auth().signInWithEmailAndPassword(form.elements.email.value.trim(),form.elements.password.value);
      form.elements.password.value='';
    }catch(ex){err.textContent='Connexion impossible : '+(ex.code||ex.message||'erreur')}
  });
  return box;
}
async function waitReady(){
  if(ref&&user)return;
  await readyPromise;
  if(!ref||!user)throw Error('Firebase Agents indisponible');
}
async function readServer(){
  await waitReady();
  status('Firebase — lecture des agents…');
  const snap=await ref.get({source:'server'});
  const raw=snap.exists?snap.data()?.moduleSyncV1?.agents?.payload:'[]';
  const rows=parse(raw,'invalid');
  if(!Array.isArray(rows))throw Error('Liste Agents Firebase illisible');
  status('Firebase — synchronisé',true);
  return clone(rows);
}
async function writeRows(rows,reason='agents-direct-save'){
  await waitReady();
  const incoming=activeRows(rows);
  status('Firebase — enregistrement des agents…');
  let written='[]';
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    const raw=snap.exists?snap.data()?.moduleSyncV1?.agents?.payload:'[]';
    const remote=parse(raw,[]);
    if(!Array.isArray(remote))throw Error('Liste Agents Firebase illisible');
    const map=new Map(remote.filter(x=>x&&x.id).map(x=>[String(x.id),x]));
    for(const row of incoming)map.set(String(row.id),row);
    written=payloadOf(Array.from(map.values()));
    tx.set(ref,{moduleSyncV1:{agents:{payload:written,updatedAtMs:Date.now(),reason,version:7}}},{merge:true});
  });
  status('Firebase — synchronisé',true);
  emit('inovtec:agents-cloud-updated',{payload:written});
  return clone(parse(written,[]));
}
async function saveAgent(agent){
  if(!agent||!agent.id)throw Error('Fiche agent invalide');
  await waitReady();
  status('Firebase — enregistrement de l’agent…');
  let written='[]';
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    const raw=snap.exists?snap.data()?.moduleSyncV1?.agents?.payload:'[]';
    const rows=parse(raw,[]);
    if(!Array.isArray(rows))throw Error('Liste Agents Firebase illisible');
    const next=rows.slice();
    const idx=next.findIndex(x=>String(x?.id||'')===String(agent.id));
    const clean=clone(agent);
    if(idx>=0)next[idx]=clean;else next.push(clean);
    written=payloadOf(next);
    tx.set(ref,{moduleSyncV1:{agents:{payload:written,updatedAtMs:Date.now(),reason:'agent-direct-save',version:7}}},{merge:true});
  });
  status('Firebase — synchronisé',true);
  emit('inovtec:agent-cloud-saved',{id:String(agent.id),payload:written});
  emit('inovtec:agents-cloud-updated',{payload:written});
  return clone(agent);
}
async function replaceAll(rows,reason='agents-replace-all'){
  await waitReady();
  const raw=payloadOf(rows);
  status('Firebase — enregistrement des agents…');
  await ref.set({moduleSyncV1:{agents:{payload:raw,updatedAtMs:Date.now(),reason,version:7}}},{merge:true});
  status('Firebase — synchronisé',true);
  emit('inovtec:agents-cloud-updated',{payload:raw});
  return clone(parse(raw,[]));
}

window.InovtecAgentsCloud=Object.freeze({
  load:readServer,
  saveAgent,
  saveAll:writeRows,
  replaceAll,
  ready:waitReady
});

function start(u){
  if(unsubscribe){try{unsubscribe()}catch(e){}unsubscribe=null}
  user=u||null;
  if(!user){
    ref=null;
    status('Firebase — connexion requise');
    loginBox().style.display='grid';
    return;
  }
  const box=document.getElementById('ivAgentsFirebaseLogin');
  if(box)box.style.display='none';
  ref=db.collection('kanban').doc(user.uid);
  unsubscribe=ref.onSnapshot({includeMetadataChanges:true},snap=>{
    const raw=snap.exists?snap.data()?.moduleSyncV1?.agents?.payload:'[]';
    const rows=parse(raw,null);
    if(Array.isArray(rows)){
      emit('inovtec:agents-cloud-updated',{payload:raw,fromCache:!!snap.metadata?.fromCache,pending:!!snap.metadata?.hasPendingWrites});
      if(!snap.metadata?.hasPendingWrites)status('Firebase — synchronisé',true);
    }
  },err=>{
    console.error('Firebase Agents temps réel',err);
    status('Firebase — '+(err.code||err.message||'erreur'));
  });
  status('Firebase — connecté',true);
  readyResolve();
}
function boot(){
  if(!window.firebase?.auth||!window.firebase?.firestore||!window.INOVTEC_FIREBASE_CONFIG){
    setTimeout(boot,100);
    return;
  }
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    db=firebase.firestore();
    firebase.auth().onAuthStateChanged(start);
  }catch(e){
    status('Firebase — erreur : '+(e.message||e));
    readyReject(e);
  }
}
boot();
})();