(()=>{
'use strict';
const mode=(new URLSearchParams(location.search).get('mode')||'').toLowerCase();
if(mode!=='agents')return;

const LIMIT=900000;
const parse=(s,f)=>{try{const v=JSON.parse(String(s||''));return v??f}catch{return f}};
const clone=v=>JSON.parse(JSON.stringify(v));
let user=null,db=null,ref=null,unsubscribe=null,hubUnsubscribe=null,hubActive=false,lastRealtimePayload=null,readyResolve,readyReject;
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
async function setBestAuthPersistence(auth){
  try{
    const P=firebase.auth.Auth.Persistence;
    for(const mode of [P.LOCAL,P.SESSION,P.NONE]){
      try{await auth.setPersistence(mode);return mode}catch(_e){}
    }
  }catch(_e){}
  // Même si le navigateur refuse toute persistance, tenter quand même
  // l'authentification au lieu de bloquer l'utilisateur.
  return null;
}
function loginBox(){
  let box=document.getElementById('ivAgentsFirebaseLogin');
  if(box)return box;
  box=document.createElement('div');
  box.id='ivAgentsFirebaseLogin';
  box.style.cssText='position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:#0f172a77;padding:18px';
  box.innerHTML='<form style="width:min(390px,100%);background:white;border-radius:16px;padding:24px;font:14px system-ui"><h2>Connexion Inovtec</h2><p>Connecte-toi pour accéder aux agents enregistrés dans Firebase.</p><label>Adresse e-mail<input type="email" name="email" required autocomplete="username" autocapitalize="none" spellcheck="false" style="display:block;width:100%;padding:10px;margin:6px 0 12px"></label><label>Mot de passe<input type="password" name="password" required autocomplete="current-password" style="display:block;width:100%;padding:10px;margin:6px 0 12px"></label><button type="submit" style="padding:10px;background:#065f46;color:white;border:0;border-radius:8px">Se connecter</button><p data-error style="color:#b91c1c"></p></form>';
  document.body.appendChild(box);
  box.querySelector('form').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget,err=form.querySelector('[data-error]');
    err.textContent='';
    try{
      const auth=firebase.auth();
      await setBestAuthPersistence(auth);
      await auth.signInWithEmailAndPassword(form.elements.email.value.trim(),form.elements.password.value);
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
function hubRawAgents(){
  const hub=window.InovtecDataHub;
  if(!hub?.readyPersonal||typeof hub.getPersonalData!=='function')return null;
  const data=hub.getPersonalData();
  const raw=data?.moduleSyncV1?.agents?.payload;
  return typeof raw==='string'?raw:'[]';
}
function applyRealtimeRaw(raw,meta={}){
  const rows=parse(raw,null);
  if(!Array.isArray(rows))return false;
  if(raw!==lastRealtimePayload){
    lastRealtimePayload=raw;
    emit('inovtec:agents-cloud-updated',{payload:raw,fromCache:!!meta.fromCache,pending:!!meta.pending});
  }
  if(!meta.pending&&meta.confirmed!==false)status('Firebase — synchronisé',true);
  return true;
}
async function readServer(){
  await waitReady();
  const immediate=hubRawAgents();
  if(immediate!==null){
    const rows=parse(immediate,'invalid');
    if(!Array.isArray(rows))throw Error('Liste Agents Firebase illisible');
    status('Firebase — synchronisé',true);
    return clone(rows);
  }
  if(hubActive){
    status('Firebase — lecture des agents…');
    const started=Date.now();
    while(Date.now()-started<4000){
      await new Promise(resolve=>setTimeout(resolve,80));
      const raw=hubRawAgents();
      if(raw!==null){
        const rows=parse(raw,'invalid');
        if(!Array.isArray(rows))throw Error('Liste Agents Firebase illisible');
        status('Firebase — synchronisé',true);
        return clone(rows);
      }
    }
  }
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
  try{
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    const raw=snap.exists?snap.data()?.moduleSyncV1?.agents?.payload:'[]';
    const remote=parse(raw,[]);
    if(!Array.isArray(remote))throw Error('Liste Agents Firebase illisible');
    const map=new Map(remote.filter(x=>x&&x.id).map(x=>[String(x.id),x]));
    for(const row of incoming){
      const key=String(row.id),previous=map.get(key);
      const previousAt=Date.parse(previous?.updatedAt||previous?.deletedAt||previous?.createdAt||0)||0;
      const incomingAt=Date.parse(row?.updatedAt||row?.deletedAt||row?.createdAt||0)||0;
      if(!previous||incomingAt>=previousAt)map.set(key,row);
    }
    written=payloadOf(Array.from(map.values()));
    tx.set(ref,{moduleSyncV1:{agents:{payload:written,updatedAtMs:Date.now(),reason,version:7}}},{merge:true});
  });
  status('Firebase — synchronisé',true);
  emit('inovtec:agents-cloud-updated',{payload:written});
  return clone(parse(written,[]));
  }catch(e){
    console.error('Firebase Agents',e);
    status('Firebase — erreur : '+(e.code||e.message||'écriture impossible'));
    throw e;
  }
}
async function saveAgent(agent){
  if(!agent||!agent.id)throw Error('Fiche agent invalide');
  await waitReady();
  status('Firebase — enregistrement de l’agent…');
  let written='[]';
  try{
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
  }catch(e){
    console.error('Firebase Agent',e);
    status('Firebase — erreur : '+(e.code||e.message||'écriture impossible'));
    throw e;
  }
}
// Sauvegarde atomique d'un SEUL incident sur la fiche existante.
// Ne remplace jamais les autres incidents ni les autres champs de l'agent.
async function saveIncident(agentId,incident,action='add'){
  const id=String(agentId||''),incidentId=String(incident?.id||'');
  if(!id||!incidentId||!['add','update'].includes(action))throw Error('Incident invalide');
  await waitReady();
  status('Firebase — enregistrement de l’incident…');
  try{
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      const raw=snap.exists?snap.data()?.moduleSyncV1?.agents?.payload:'[]';
      const agents=parse(raw,null);
      if(!Array.isArray(agents))throw Error('Liste Agents Firebase illisible');
      const agentIndex=agents.findIndex(a=>a&&String(a.id)===id&&!a._deleted);
      if(agentIndex<0)throw Error('Fiche agent introuvable dans Firebase : enregistre d’abord la fiche agent.');
      const agent=agents[agentIndex];
      const incidents=Array.isArray(agent.incidents)?agent.incidents:[];
      const index=incidents.findIndex(item=>String(item?.id||'')===incidentId);
      let nextIncidents;
      if(action==='add'){
        if(index>=0){
          if(JSON.stringify(incidents[index])!==JSON.stringify(incident))throw Error('Identifiant d’incident déjà utilisé.');
          nextIncidents=incidents;
        }else nextIncidents=incidents.concat([clone(incident)]);
      }else{
        if(index<0)throw Error('Incident d’origine introuvable dans Firebase.');
        nextIncidents=incidents.map((item,i)=>i===index?clone(incident):item);
      }
      const next=agents.slice();
      next[agentIndex]={...agent,incidents:nextIncidents,updatedAt:new Date().toISOString()};
      tx.set(ref,{moduleSyncV1:{agents:{payload:payloadOf(next),updatedAtMs:Date.now(),reason:'incident-'+action,version:7}}},{merge:true});
    });

    // Seule une relecture du SERVEUR autorise l'affichage « enregistré ».
    const checked=await ref.get({source:'server'});
    const raw=checked.exists?checked.data()?.moduleSyncV1?.agents?.payload:'[]';
    const rows=parse(raw,null);
    if(!Array.isArray(rows))throw Error('Réponse de vérification Firebase illisible');
    const savedAgent=rows.find(a=>a&&String(a.id)===id&&!a._deleted);
    const saved=savedAgent?.incidents?.find(item=>String(item?.id||'')===incidentId);
    if(!saved||JSON.stringify(saved)!==JSON.stringify(incident)){
      throw Error('L’incident n’a pas pu être confirmé sur le serveur Firebase.');
    }
    status('Firebase — incident enregistré ✓',true);
    lastRealtimePayload=raw;
    emit('inovtec:agent-cloud-saved',{id,payload:raw});
    emit('inovtec:agents-cloud-updated',{payload:raw,confirmed:true});
    return clone(saved);
  }catch(error){
    console.error('Firebase : incident non confirmé',error);
    status('Firebase — incident non enregistré : '+(error.code||error.message||'erreur'));
    throw error;
  }
}
async function replaceAll(rows,reason='agents-replace-all'){
  await waitReady();
  const raw=payloadOf(rows);
  status('Firebase — enregistrement des agents…');
  try{
    await ref.set({moduleSyncV1:{agents:{payload:raw,updatedAtMs:Date.now(),reason,version:7}}},{merge:true});
    status('Firebase — synchronisé',true);
    emit('inovtec:agents-cloud-updated',{payload:raw});
    return clone(parse(raw,[]));
  }catch(e){
    console.error('Firebase Agents',e);
    status('Firebase — erreur : '+(e.code||e.message||'écriture impossible'));
    throw e;
  }
}

window.InovtecAgentsCloud=Object.freeze({
  load:readServer,
  saveAgent,
  saveIncident,
  saveAll:writeRows,
  replaceAll,
  ready:waitReady
});

function start(u){
  if(unsubscribe){try{unsubscribe()}catch(e){}unsubscribe=null}
  if(hubUnsubscribe){try{hubUnsubscribe()}catch(e){}hubUnsubscribe=null}
  hubActive=false;
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
  const hub=window.InovtecDataHub;
  if(hub?.subscribe&&typeof hub.getPersonalData==='function'){
    hubActive=true;
    hubUnsubscribe=hub.subscribe(detail=>{
      if(!detail?.readyPersonal)return;
      const raw=hubRawAgents();
      if(raw!==null)applyRealtimeRaw(raw,{confirmed:detail.firebasePersonalOk===true});
    });
  }else{
    unsubscribe=ref.onSnapshot({includeMetadataChanges:true},snap=>{
      const raw=snap.exists?snap.data()?.moduleSyncV1?.agents?.payload:'[]';
      applyRealtimeRaw(raw,{fromCache:!!snap.metadata?.fromCache,pending:!!snap.metadata?.hasPendingWrites,confirmed:!snap.metadata?.fromCache});
    },err=>{
      console.error('Firebase Agents temps réel',err);
      status('Firebase — '+(err.code||err.message||'erreur'));
    });
  }
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