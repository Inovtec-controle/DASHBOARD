(()=>{
'use strict';
const mode=(new URLSearchParams(location.search).get('mode')||'').toLowerCase();
if(mode!=='agents')return;

const LIMIT=900000;
const parse=(s,f)=>{try{const v=JSON.parse(String(s||''));return v??f}catch{return f}};
const clone=v=>JSON.parse(JSON.stringify(v));
let user=null,db=null,ref=null,unsubscribe=null,hubUnsubscribe=null,hubActive=false,lastRealtimePayload=null,readyResolve,readyReject;
let readyPromise=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject});
let incidentRef=null,unsubIncidents=null,overlayLoaded=false,overlayRows=[],lastBaseRaw=null,authEpoch=0,incidentSaveInFlight=new Map();
const INCIDENT_FIELD='agentIncidentRecordsV1';
const INCIDENT_MAX_BYTES=850000;
const agentRefKey=(agentId,incidentId)=>String(agentId)+'\u0000'+String(incidentId);
function recordRowsFromDoc(value){
  const data=value?.[INCIDENT_FIELD];
  if(data===undefined||data===null)return [];
  if(!Array.isArray(data))throw Error('Données des incidents Firebase illisibles.');
  return data;
}
function mergeIncidentRows(agentRows,rows=overlayRows){
  const overrides=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    if(!row?.agentId||!row?.incidentId)continue;
    overrides.set(agentRefKey(row.agentId,row.incidentId),row);
  }
  return (Array.isArray(agentRows)?agentRows:[]).map(agent=>{
    if(!agent?.id)return agent;
    const incidents=[];
    for(const legacy of Array.isArray(agent.incidents)?agent.incidents:[]){
      const record=overrides.get(agentRefKey(agent.id,legacy?.id));
      if(record){
        if(!record.deleted&&record.incident)incidents.push(clone(record.incident));
        overrides.delete(agentRefKey(agent.id,legacy?.id));
      }else incidents.push(legacy);
    }
    for(const record of overrides.values()){
      if(String(record.agentId)===String(agent.id)&&!record.deleted&&record.incident)incidents.push(clone(record.incident));
    }
    return {...agent,incidents};
  });
}
function publishMerged(){
  if(lastBaseRaw===null||!overlayLoaded)return;
  const base=parse(lastBaseRaw,null);
  if(!Array.isArray(base))return;
  const payload=JSON.stringify(mergeIncidentRows(base));
  if(payload!==lastRealtimePayload){
    lastRealtimePayload=payload;
    emit('inovtec:agents-cloud-updated',{payload,confirmed:true});
  }
}
async function loadIncidentRows(){
  if(!incidentRef)throw Error('Connexion incidents Firebase indisponible');
  const snap=await incidentRef.get({source:'server'});
  overlayRows=recordRowsFromDoc(snap.exists?snap.data():{});
  overlayLoaded=true;
  publishMerged();
  return overlayRows;
}
function incidentRowsSize(doc,rows){
  const combined={...(doc||{}),[INCIDENT_FIELD]:rows};
  return new Blob([JSON.stringify(combined)]).size;
}

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
  if(meta.fromCache||meta.pending||meta.confirmed===false)return false;
  const rows=parse(raw,null);
  if(!Array.isArray(rows))return false;
  lastBaseRaw=raw;
  publishMerged();
  if(!meta.pending)status('Firebase — synchronisé',true);
  return true;
}

async function readServer(){
  await waitReady();
  let baseRaw=null;
  const immediate=hubRawAgents();
  if(immediate!==null&&window.InovtecDataHub?.firebasePersonalOk===true){
    baseRaw=immediate;
  }else if(lastBaseRaw!==null){
    baseRaw=lastBaseRaw;
  }else{
    status('Firebase — lecture des agents…');
    const snap=await ref.get({source:'server'});
    baseRaw=snap.exists?snap.data()?.moduleSyncV1?.agents?.payload:'[]';
  }
  const rows=parse(baseRaw,null);
  if(!Array.isArray(rows))throw Error('Liste Agents Firebase illisible');
  lastBaseRaw=baseRaw;
  if(!overlayLoaded)await loadIncidentRows();
  status('Firebase — synchronisé',true);
  return mergeIncidentRows(rows);
}

/* Médias Agents : les photos et PDF volumineux vivent dans Firebase Storage,
   et non plus dans le document kanban/{uid} limité à 1 Mio.
   On réutilise UNIQUEMENT les chemins Storage déjà autorisés par les règles du projet,
   pour ne jamais déposer de pièces confidentielles dans la collection chantiers partagée. */
const MEDIA_TARGET_BYTES=680000;
const mediaCache=new Map();
const byteSize=str=>new Blob([String(str)]).size;
const safePath=value=>String(value||'media').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,90)||'media';
function mediaType(item){
  const match=String(item?.dataUrl||'').match(/^data:([^;,]+)[;,]/i);
  return (match?.[1]||String(item?.type||'application/octet-stream')).toLowerCase();
}
function mediaStoragePath(item,agent,kind,incident){
  const mime=mediaType(item),uid=safePath(user?.uid);
  const agentId=safePath(agent?.id),itemId=safePath(item?.id||item?.name||'file');
  if(/^image\//.test(mime)){
    const group=kind==='photo'?'agentIncident_'+agentId+'_'+safePath(incident?.id):'agentDocument_'+agentId;
    return 'discipline/'+uid+'/'+group+'/'+itemId;
  }
  if(kind==='document'&&mime==='application/pdf')
    return 'kontrol/'+uid+'/pdfs/agentDocument_'+agentId+'_'+itemId+'.pdf';
  return null;
}
function toDataBlob(dataUrl){
  const raw=String(dataUrl||''),comma=raw.indexOf(',');
  if(!raw.startsWith('data:')||comma<0)throw Error('Pièce jointe illisible');
  const header=raw.slice(0,comma),mime=header.match(/^data:([^;,]+)/i)?.[1]||'application/octet-stream';
  const encoded=raw.slice(comma+1);
  if(!header.includes(';base64'))return new Blob([decodeURIComponent(encoded)],{type:mime});
  const binary=atob(encoded),out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return new Blob([out],{type:mime});
}
async function uploadAgentMedia(item,agent,kind,incident){
  if(!item?.dataUrl||item?.ivStorageV1?.path)return item;
  const path=mediaStoragePath(item,agent,kind,incident);
  if(!path)return item;
  if(!firebase.storage)throw Error('Le service Firebase Storage n’est pas chargé. Actualise la page.');
  const blob=toDataBlob(item.dataUrl);
  if(blob.size>12*1024*1024)throw Error('Fichier trop lourd (maximum 12 Mo).');
  try{
    await firebase.storage().ref().child(path).put(blob,{contentType:blob.type});
  }catch(error){
    throw Error('Impossible de stocker la pièce jointe dans Firebase Storage : '+(error?.code||error?.message||'accès refusé'));
  }
  mediaCache.set(path,item.dataUrl);
  const result={...item,ivStorageV1:{version:1,path,type:blob.type,size:blob.size}};
  delete result.dataUrl;
  return result;
}
async function compactAgentMedia(rows,forceUpload=false,maxAgentBytes=MEDIA_TARGET_BYTES,forceIncidentId=''){
  const result=clone(rows),candidates=[];
  for(const agent of result){
    if(!agent||typeof agent!=='object')continue;
    const append=(item,kind,incident,index,array)=>{
      if(!item||typeof item!=='object')return;
      if(item.ivStorageV1?.path){
        if(item.dataUrl){mediaCache.set(item.ivStorageV1.path,item.dataUrl);delete item.dataUrl}
        return;
      }
      if(item.dataUrl){
        const path=mediaStoragePath(item,agent,kind,incident);
        if(path)candidates.push({item,agent,kind,incident,index,array,bytes:byteSize(item.dataUrl)});
      }
    };
    (agent.docs||[]).forEach((item,index,array)=>append(item,'document',null,index,array));
    (agent.incidents||[]).forEach(incident=>(incident.photos||[]).forEach((item,index,array)=>append(item,'photo',incident,index,array)));
  }
  let bytes=byteSize(JSON.stringify(result));
  // Toujours sortir les nouvelles photos d'incident si demandé, même avant le seuil.
  candidates.sort((a,b)=>{
    const ap=forceUpload&&String(a.incident?.id||'')===String(forceIncidentId);
    const bp=forceUpload&&String(b.incident?.id||'')===String(forceIncidentId);
    return Number(bp)-Number(ap)||b.bytes-a.bytes;
  });
  for(const c of candidates){
    const required=forceUpload&&c.kind==='photo'&&String(c.incident?.id||'')===String(forceIncidentId);
    if(!required&&bytes<=maxAgentBytes)break;
    const before=c.array[c.index];
    c.array[c.index]=await uploadAgentMedia(before,c.agent,c.kind,c.incident);
    bytes=byteSize(JSON.stringify(result));
  }
  if(bytes>maxAgentBytes)throw Error('Le document Firebase reste trop volumineux ('+Math.ceil(bytes/1024)+' Ko de données agents). Les photos/PDF compatibles ont été séparés ; vérifie les autres documents volumineux.');

  return result;
}
async function mutateAgentRows(reason,makeNext,{forceUpload=false,forceIncidentId='',verify}={}){
  await waitReady();
  status('Firebase — enregistrement…');
  for(let attempt=0;attempt<3;attempt++){
    const server=await ref.get({source:'server'});
    const currentRaw=server.exists?server.data()?.moduleSyncV1?.agents?.payload:'[]';
    const current=parse(currentRaw,null);
    if(!Array.isArray(current))throw Error('Liste Agents Firebase illisible');
    const proposed=makeNext(clone(current));
    const entireDoc=server.exists?server.data()||{}:{};
    const outsideAgents={...entireDoc,moduleSyncV1:{...(entireDoc.moduleSyncV1||{})}};
    delete outsideAgents.moduleSyncV1.agents;
    // Réserver de la place pour les autres modules de ce même document kanban.
    // Une cible calculée sur les seuls agents ne suffit pas si Planning/Organisation est déjà volumineux.
    const fixedBytes=byteSize(JSON.stringify(outsideAgents));
    const maxAgentBytes=Math.min(MEDIA_TARGET_BYTES,Math.max(15000,930000-fixedBytes-35000));
    const compact=await compactAgentMedia(proposed,forceUpload,maxAgentBytes,forceIncidentId);
    const written=payloadOf(compact);
    try{
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        const raw=snap.exists?snap.data()?.moduleSyncV1?.agents?.payload:'[]';
        if(raw!==currentRaw)throw Error('AGENTS_SNAPSHOT_CHANGED');
        tx.set(ref,{moduleSyncV1:{agents:{payload:written,updatedAtMs:Date.now(),reason,version:8}}},{merge:true});
      });
    }catch(error){
      if(error?.message==='AGENTS_SNAPSHOT_CHANGED'&&attempt<2)continue;
      status('Firebase — enregistrement impossible : '+(error?.code||error?.message||'erreur'));
      throw error;
    }
    const verifiedSnap=await ref.get({source:'server'});
    const actual=verifiedSnap.exists?verifiedSnap.data()?.moduleSyncV1?.agents?.payload:'[]';
    const rows=parse(actual,null);
    if(!Array.isArray(rows)||verify&&!verify(rows))throw Error('Firebase n’a pas confirmé les données enregistrées.');
    status('Firebase — synchronisé',true);
    lastRealtimePayload=actual;
    emit('inovtec:agents-cloud-updated',{payload:actual,confirmed:true});
    return rows;
  }
  throw Error('Modifications simultanées : réessaye l’enregistrement.');
}
async function readMedia(item){
  if(item?.dataUrl)return item.dataUrl;
  const path=item?.ivStorageV1?.path;
  if(!path)return '';
  if(mediaCache.has(path))return mediaCache.get(path);
  if(!firebase.storage)throw Error('Firebase Storage indisponible');
  const url=await firebase.storage().ref().child(path).getDownloadURL();
  const response=await fetch(url);
  if(!response.ok)throw Error('Lecture Firebase Storage impossible ('+response.status+')');
  const blob=await response.blob();
  const dataUrl=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error||Error('Fichier illisible'));
    reader.readAsDataURL(blob);
  });
  mediaCache.set(path,dataUrl);
  return dataUrl;
}
async function writeRows(rows,reason='agents-direct-save'){
  const incoming=activeRows(rows);
  const results=await mutateAgentRows(reason,remote=>{
    const map=new Map(remote.filter(x=>x?.id).map(x=>[String(x.id),x]));
    for(const row of incoming){
      const key=String(row.id),previous=map.get(key);
      const previousAt=Date.parse(previous?.updatedAt||previous?.deletedAt||previous?.createdAt||0)||0;
      const incomingAt=Date.parse(row?.updatedAt||row?.deletedAt||row?.createdAt||0)||0;
      if(!previous||incomingAt>=previousAt){
        // Les incidents ajoutés au document privé ne doivent jamais être
        // dupliqués dans le document principal lors d'une sauvegarde globale.
        map.set(key,previous?{...row,incidents:Array.isArray(previous.incidents)?previous.incidents:[]}:row);
      }
    }
    return Array.from(map.values());
  });
  return clone(results);
}
async function saveAgent(agent){
  if(!agent?.id)throw Error('Fiche agent invalide');
  const id=String(agent.id);
  const results=await mutateAgentRows('agent-direct-save',remote=>{
    const idx=remote.findIndex(x=>String(x?.id||'')===id);
    if(idx>=0){
      const updated=clone(agent);
      updated.incidents=Array.isArray(remote[idx]?.incidents)?remote[idx].incidents:[];
      remote[idx]=updated;
    }else remote.push(clone(agent));
    return remote;
  },{verify:rows=>rows.some(a=>String(a?.id||'')===id)});
  emit('inovtec:agent-cloud-saved',{id});
  return clone(results.find(a=>String(a?.id||'')===id));
}
async function saveIncident(agentId,incident,action='add'){
  const agentKey=String(agentId||''),incidentId=String(incident?.id||'');
  if(!agentKey||!incidentId||!['add','update'].includes(action))throw Error('Incident invalide');
  await waitReady();
  const flightKey=agentRefKey(agentKey,incidentId);
  if(incidentSaveInFlight.has(flightKey))return incidentSaveInFlight.get(flightKey);
  const operation=(async()=>{
    status('Firebase — sauvegarde de l’incident…');
    try{
      if(!incidentRef)throw Error('Dossier Firebase des incidents inaccessible');
      // Aucune migration des anciennes photos ni écriture du gros document kanban.
      const photos=Array.isArray(incident.photos)?incident.photos:[];
      const prepared=clone(incident);
      prepared.photos=await Promise.all(photos.map(photo=>
        photo?.dataUrl&&!photo?.ivStorageV1?.path
          ?uploadAgentMedia(photo,{id:agentKey},'photo',incident)
          :Promise.resolve((()=>{const x=clone(photo);if(x.ivStorageV1?.path)delete x.dataUrl;return x})())
      ));
      let saved=null;
      await db.runTransaction(async tx=>{
        const snap=await tx.get(incidentRef);
        const doc=snap.exists?snap.data()||{}:{};
        const rows=recordRowsFromDoc(doc).slice();
        const index=rows.findIndex(row=>String(row?.agentId)===agentKey&&String(row?.incidentId)===incidentId);
        if(action==='update'&&index<0){
          // Modification d'un incident historique : il reste dans kanban et
          // sa nouvelle version devient prioritaire dans le document privé.
          const historical=parse(lastBaseRaw,null)?.find(a=>String(a?.id)===agentKey)?.incidents?.some(i=>String(i?.id)===incidentId);
          if(!historical)throw Error('Incident à modifier introuvable.');
        }
        // Un deuxième clic / une reprise réseau sur un ajout déjà enregistré
        // ne crée jamais de doublon (même identifiant).
        const record={agentId:agentKey,incidentId,incident:prepared,updatedAt:new Date().toISOString()};
        if(index>=0)rows[index]=record;else rows.push(record);
        if(incidentRowsSize(doc,rows)>INCIDENT_MAX_BYTES)throw Error('Le dossier des incidents est plein : contactez le support pour étendre le stockage.');
        tx.set(incidentRef,{[INCIDENT_FIELD]:rows},{merge:true});
        saved=prepared;
      });
      if(!saved)throw Error('Firebase n’a pas confirmé l’incident.');
      // L'achèvement de la transaction est un accusé de réception serveur.
      const pos=overlayRows.findIndex(row=>String(row?.agentId)===agentKey&&String(row?.incidentId)===incidentId);
      const record={agentId:agentKey,incidentId,incident:prepared,updatedAt:new Date().toISOString()};
      if(pos>=0)overlayRows[pos]=record;else overlayRows.push(record);
      overlayLoaded=true;
      publishMerged();
      status('Firebase — incident enregistré ✓',true);
      return clone(saved);
    }catch(error){
      status('Firebase — incident non enregistré : '+(error?.code||error?.message||'erreur'));
      throw error;
    }
  })();
  incidentSaveInFlight.set(flightKey,operation);
  try{return await operation}finally{incidentSaveInFlight.delete(flightKey)}
}
async function deleteIncident(agentId,incidentId){
  const agentKey=String(agentId||''),id=String(incidentId||'');
  if(!agentKey||!id)throw Error('Incident invalide');
  await waitReady();
  const tombstone={agentId:agentKey,incidentId:id,deleted:true,updatedAt:new Date().toISOString()};
  await db.runTransaction(async tx=>{
    const snap=await tx.get(incidentRef),doc=snap.exists?snap.data()||{}:{};
    const rows=recordRowsFromDoc(doc).slice();
    const i=rows.findIndex(x=>String(x?.agentId)===agentKey&&String(x?.incidentId)===id);
    if(i>=0)rows[i]=tombstone;else rows.push(tombstone);
    if(incidentRowsSize(doc,rows)>INCIDENT_MAX_BYTES)throw Error('Dossier incidents Firebase trop volumineux.');
    tx.set(incidentRef,{[INCIDENT_FIELD]:rows},{merge:true});
  });
  const i=overlayRows.findIndex(x=>String(x?.agentId)===agentKey&&String(x?.incidentId)===id);
  if(i>=0)overlayRows[i]=tombstone;else overlayRows.push(tombstone);
  overlayLoaded=true;
  publishMerged();
  return true;
}

async function replaceAll(rows,reason='agents-replace-all'){
  if(!Array.isArray(rows))throw Error('Liste Agents invalide');
  // Conserver les mêmes protections de taille, d'écriture et de relecture serveur.
  return clone(await mutateAgentRows(reason,()=>clone(rows)));
}

window.InovtecAgentsCloud=Object.freeze({
  load:readServer,
  saveAgent,
  saveIncident,
  deleteIncident,
  readMedia,
  saveAll:writeRows,
  replaceAll,
  ready:waitReady
});

function start(u){
  if(unsubscribe){try{unsubscribe()}catch(e){}unsubscribe=null}
  if(unsubIncidents){try{unsubIncidents()}catch(e){}unsubIncidents=null}
  if(hubUnsubscribe){try{hubUnsubscribe()}catch(e){}hubUnsubscribe=null}
  hubActive=false;
  authEpoch++;lastBaseRaw=null;lastRealtimePayload=null;overlayRows=[];overlayLoaded=false;incidentSaveInFlight.clear();
  user=u||null;
  if(!user){
    ref=null;incidentRef=null;
    status('Firebase — connexion requise');
    loginBox().style.display='grid';
    return;
  }
  const box=document.getElementById('ivAgentsFirebaseLogin');
  if(box)box.style.display='none';
  ref=db.collection('kanban').doc(user.uid);
  // Les incidents sont désormais conservés dans le document privé Discipline,
  // déjà autorisé par les règles Firebase de cette application.
  incidentRef=db.collection('discipline').doc(user.uid);
  const startEpoch=authEpoch;
  unsubIncidents=incidentRef.onSnapshot({includeMetadataChanges:true},snap=>{
    if(startEpoch!==authEpoch||snap.metadata?.fromCache||snap.metadata?.hasPendingWrites)return;
    try{
      overlayRows=recordRowsFromDoc(snap.exists?snap.data():{});
      overlayLoaded=true;
      publishMerged();
    }catch(error){console.error('Lecture des incidents Firebase',error)}
  },err=>console.error('Synchronisation des incidents Firebase',err));
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