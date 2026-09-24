(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_FIREBASE_DIRECT_V1__)return;
window.__INOVTEC_PLANNING_FIREBASE_DIRECT_V1__=true;

const client=sessionStorage.ivPlanningFirebaseClient||(sessionStorage.ivPlanningFirebaseClient="pf_"+Date.now()+"_"+Math.random().toString(36).slice(2));
let user=null,ref=null,unsubscribe=null,generation=0,saving=false,queuedPayload="",lastConfirmedPayload="",lastStatus="",directProtocolActive=false;
const parse=s=>{try{return JSON.parse(s)}catch{return null}};
const validPayload=s=>{
  if(typeof s!=="string"||!s)return false;
  const p=parse(s);
  return !!(p&&typeof p==="object"&&!Array.isArray(p)&&p.weeks&&typeof p.weeks==="object"&&Array.isArray(p.agents));
};
const ABSENT=Symbol("absent");
function merge3(base,local,remote){
  if(JSON.stringify(local)===JSON.stringify(base))return remote;
  if(JSON.stringify(remote)===JSON.stringify(base))return local;
  if(JSON.stringify(local)===JSON.stringify(remote))return local;
  if(local===ABSENT||remote===ABSENT)return ABSENT;
  if(Array.isArray(local)&&Array.isArray(remote)&&Array.isArray(base)){
    const rows=[...base,...local,...remote];
    if(rows.every(x=>x&&typeof x==="object"&&x.id!=null)){
      const ids=new Set(rows.map(x=>String(x.id)));
      const index=a=>new Map(a.map(x=>[String(x.id),x]));
      const B=index(base),L=index(local),R=index(remote),out=[];
      for(const id of ids){
        const value=merge3(B.has(id)?B.get(id):ABSENT,L.has(id)?L.get(id):ABSENT,R.has(id)?R.get(id):ABSENT);
        if(value!==ABSENT)out.push(value);
      }
      return out;
    }
    return local;
  }
  if(local&&remote&&typeof local==="object"&&typeof remote==="object"&&!Array.isArray(local)&&!Array.isArray(remote)){
    const B=base&&typeof base==="object"&&!Array.isArray(base)?base:{},out={};
    for(const key of new Set([...Object.keys(B),...Object.keys(local),...Object.keys(remote)])){
      const value=merge3(
        Object.hasOwn(B,key)?B[key]:ABSENT,
        Object.hasOwn(local,key)?local[key]:ABSENT,
        Object.hasOwn(remote,key)?remote[key]:ABSENT
      );
      if(value!==ABSENT)out[key]=value;
    }
    return out;
  }
  return local;
}
function mergePlanningPayload(basePayload,localPayload,remotePayload){
  const local=parse(localPayload),remote=parse(remotePayload);
  if(!local||!remote)return localPayload;
  const base=validPayload(basePayload)?parse(basePayload):{agents:[],weeks:{},selected:null};
  return JSON.stringify(merge3(base,local,remote));
}
function report(message,ok=false){
  if(message===lastStatus)return;
  lastStatus=message;
  const badge=document.getElementById("syncBadge");
  if(badge){
    badge.textContent=message;
    badge.classList.toggle("ok",ok);
    badge.classList.toggle("warning",!ok);
  }
  try{
    const p=parent&&parent!==window?parent:null;
    for(const id of ["syncMirror","liveMirror"]){
      const el=p?.document?.getElementById(id);
      if(el)el.textContent=message;
    }
  }catch{}
  const notice=[...document.querySelectorAll(".notice")].find(x=>/navigateur|firebase|sauvegarde/i.test(x.textContent||""));
  if(notice){
    notice.textContent=ok?"Planning enregistré et confirmé sur Firebase.":"Planning Firebase : "+message.replace(/^Firebase\s*[—:-]?\s*/i,"");
    notice.classList.toggle("warning",!ok);
  }
}
function emitPayload(payload,source){
  if(!validPayload(payload))return;
  window.dispatchEvent(new CustomEvent("inovtec:planning-cloud-payload",{detail:{payload,source,stored:false}}));
}
function login(){
  let box=document.getElementById("ivPlanningFirebaseLogin");
  if(box)return box;
  box=document.createElement("div");
  box.id="ivPlanningFirebaseLogin";
  box.style.cssText="position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:#0f172a77;padding:18px";
  box.innerHTML='<form style="width:min(390px,100%);background:white;border-radius:16px;padding:24px;font:14px system-ui"><h2>Connexion Inovtec</h2><p>Connecte-toi au même compte Firebase sur chaque appareil.</p><label>Adresse e-mail<input type="email" name="email" required autocomplete="username" style="display:block;width:100%;padding:10px;margin:6px 0 12px"></label><label>Mot de passe<input type="password" name="password" required autocomplete="current-password" style="display:block;width:100%;padding:10px;margin:6px 0 12px"></label><button type="submit" style="padding:10px;background:#065f46;color:white;border:0;border-radius:8px">Se connecter</button><p data-error style="color:#b91c1c"></p></form>';
  document.body.appendChild(box);
  box.querySelector("form").addEventListener("submit",async ev=>{
    ev.preventDefault();
    const form=ev.currentTarget,err=form.querySelector("[data-error]");
    err.textContent="";
    try{
      await firebase.auth().signInWithEmailAndPassword(form.elements.email.value.trim(),form.elements.password.value);
      form.elements.password.value="";
    }catch(e){err.textContent="Connexion impossible : "+(e.code||e.message||"erreur")}
  });
  return box;
}
async function readServer(source="firebase-refresh"){
  if(!ref||!user)return;
  const token=generation;
  try{
    report("Firebase — lecture du serveur…");
    const snap=await ref.get({source:"server"});
    if(token!==generation)return;
    const data=snap.exists?(snap.data()||{}):{};
    const entry=data?.moduleSyncV1?.planning||null;
    const directBackup=data?.planningDirectV1||null;
    const backupPayload=typeof directBackup?.payload==="string"&&validPayload(directBackup.payload)?directBackup.payload:"";
    if(backupPayload){
      const isDirect=Number(entry?.version)>=6&&entry?.protocol==="firebase-direct"&&entry?.payload===backupPayload;
      directProtocolActive=true;
      lastConfirmedPayload=backupPayload;
      if(!isDirect){
        report("Firebase — restauration de la version directe…");
        void writeFirebase(backupPayload,"restore-direct-backup");
        return;
      }
      emitPayload(backupPayload,source);
      report("Firebase — synchronisé",true);
      return;
    }
    if(!entry){
      const empty=JSON.stringify({agents:[],weeks:{},selected:null});
      lastConfirmedPayload=empty;
      emitPayload(empty,source);
      report("Firebase — synchronisé",true);
      return;
    }
    if(typeof entry.payload!=="string"||!validPayload(entry.payload))throw new Error("planning serveur illisible");
    const isDirect=Number(entry.version)>=6&&entry.protocol==="firebase-direct";
    if(directProtocolActive&&!isDirect&&lastConfirmedPayload&&entry.payload!==lastConfirmedPayload){
      report("Firebase — ancienne écriture détectée, restauration…");
      void writeFirebase(lastConfirmedPayload,"reject-legacy-refresh");
      return;
    }
    directProtocolActive=directProtocolActive||isDirect;
    lastConfirmedPayload=entry.payload;
    emitPayload(entry.payload,source);
    report("Firebase — synchronisé",true);
  }catch(e){
    report("Firebase — lecture impossible : "+(e.code||e.message||"erreur"));
  }
}
async function writeFirebase(payload,source="planning"){
  if(!validPayload(payload)){
    window.dispatchEvent(new CustomEvent("inovtec:planning-cloud-save-failed",{detail:{message:"payload planning invalide"}}));
    return;
  }
  if(!user||!ref){
    queuedPayload=payload;
    report("Firebase — connexion requise");
    window.dispatchEvent(new CustomEvent("inovtec:planning-cloud-save-failed",{detail:{message:"connexion Firebase requise"}}));
    return;
  }
  if(saving){
    queuedPayload=payload;
    return;
  }
  saving=true;
  const token=generation,doc=ref,baseBeforeWrite=lastConfirmedPayload;
  const writeId=client+"_"+Date.now()+"_"+Math.random().toString(36).slice(2);
  let written=payload;
  report("Firebase — enregistrement sur le serveur…");
  try{
    await firebase.firestore().runTransaction(async tx=>{
      const snap=await tx.get(doc);
      const current=snap.exists?(snap.data()||{}):{};
      const primary=current?.moduleSyncV1?.planning||null;
      const backup=current?.planningDirectV1||null;
      const primaryPayload=typeof primary?.payload==="string"&&validPayload(primary.payload)?primary.payload:"";
      const backupPayload=typeof backup?.payload==="string"&&validPayload(backup.payload)?backup.payload:"";
      const remote=backupPayload||primaryPayload;
      written=remote&&remote!==baseBeforeWrite&&remote!==payload
        ?mergePlanningPayload(baseBeforeWrite,payload,remote)
        :payload;
      const stamp=Date.now();
      tx.set(doc,{
        moduleSyncV1:{planning:{
          payload:written,
          updatedAtMs:stamp,
          client,
          writeId,
          reason:String(source||"planning-direct"),
          version:7,
          protocol:"firebase-direct"
        }},
        planningDirectV1:{
          payload:written,
          updatedAtMs:stamp,
          client,
          writeId,
          version:2,
          protocol:"firebase-direct"
        }
      },{merge:true});
    });
    if(token!==generation)return;
    const check=await doc.get({source:"server"});
    if(token!==generation)return;
    const data=check.exists?(check.data()||{}):{};
    const entry=data?.moduleSyncV1?.planning||null;
    const backup=data?.planningDirectV1||null;
    const actual=typeof entry?.payload==="string"&&validPayload(entry.payload)?entry.payload:"";
    const direct=typeof backup?.payload==="string"&&validPayload(backup.payload)?backup.payload:"";
    const confirmed=entry?.writeId===writeId||backup?.writeId===writeId||direct===written||actual===written;
    if(!confirmed){
      // Une autre page/appareil a écrit juste après notre transaction.
      // Ce n'est pas un échec Firebase : on refusionne silencieusement avec
      // la nouvelle version serveur au lieu de recharger et faire disparaître la tâche.
      report("Firebase — nouvelle version détectée, fusion en cours…");
      if(!queuedPayload)queuedPayload=payload;
      return;
    }
    lastConfirmedPayload=written;
    directProtocolActive=true;
    report("Firebase — synchronisé",true);
    emitPayload(written,"firebase-confirmed");
    window.dispatchEvent(new CustomEvent("inovtec:planning-cloud-saved",{detail:{at:Date.now(),payload:written}}));
  }catch(e){
    console.error("Planning Firebase direct",e);
    report("Firebase — sauvegarde non confirmée : "+(e.code||e.message||"erreur"));
    window.dispatchEvent(new CustomEvent("inovtec:planning-cloud-save-failed",{detail:{message:e.code||e.message||"erreur"}}));
  }finally{
    saving=false;
    if(queuedPayload){
      const next=queuedPayload;
      queuedPayload="";
      if(next!==lastConfirmedPayload)void writeFirebase(next,"queued-direct");
    }
  }
}
function bindSnapshot(doc,token){
  if(unsubscribe){try{unsubscribe()}catch{}unsubscribe=null}
  unsubscribe=doc.onSnapshot({includeMetadataChanges:true},snap=>{
    if(token!==generation||snap.metadata?.fromCache||snap.metadata?.hasPendingWrites)return;
    const data=snap.exists?(snap.data()||{}):{};
    const entry=data?.moduleSyncV1?.planning||null;
    const backup=data?.planningDirectV1||null;
    const backupPayload=typeof backup?.payload==="string"&&validPayload(backup.payload)?backup.payload:"";
    if(saving)return;
    if(backupPayload){
      directProtocolActive=true;
      lastConfirmedPayload=backupPayload;
      const isDirect=Number(entry?.version)>=6&&entry?.protocol==="firebase-direct"&&entry?.payload===backupPayload;
      if(!isDirect){
        report("Firebase — ancienne écriture détectée, restauration…");
        void writeFirebase(backupPayload,"reject-legacy-snapshot");
        return;
      }
      emitPayload(backupPayload,"firebase-snapshot");
      report("Firebase — synchronisé",true);
      return;
    }
    if(!entry||typeof entry.payload!=="string"||!validPayload(entry.payload))return;
    const isDirect=Number(entry.version)>=6&&entry.protocol==="firebase-direct";
    if(directProtocolActive&&!isDirect&&lastConfirmedPayload&&entry.payload!==lastConfirmedPayload){
      report("Firebase — ancienne écriture détectée, restauration…");
      void writeFirebase(lastConfirmedPayload,"reject-legacy-snapshot");
      return;
    }
    directProtocolActive=directProtocolActive||isDirect;
    lastConfirmedPayload=entry.payload;
    emitPayload(entry.payload,"firebase-snapshot");
    report("Firebase — synchronisé",true);
  },e=>report("Firebase — écoute interrompue : "+(e.code||e.message||"erreur")));
}
async function start(nextUser){
  generation++;
  const token=generation;
  if(unsubscribe){try{unsubscribe()}catch{}unsubscribe=null}
  user=nextUser||null;
  ref=null;
  saving=false;
  lastConfirmedPayload="";
  directProtocolActive=false;
  if(!user){
    report("Firebase — connexion requise");
    login().style.display="grid";
    return;
  }
  const box=document.getElementById("ivPlanningFirebaseLogin");
  if(box)box.style.display="none";
  ref=firebase.firestore().collection("kanban").doc(user.uid);
  await readServer("firebase-initial");
  if(token!==generation||!ref)return;
  bindSnapshot(ref,token);
  if(queuedPayload){
    const next=queuedPayload;
    queuedPayload="";
    void writeFirebase(next,"queued-after-login");
  }
}
if(!window.firebase?.auth||!window.firebase?.firestore||!window.INOVTEC_FIREBASE_CONFIG){
  report("Firebase — configuration manquante");
  return;
}
if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
firebase.auth().onAuthStateChanged(start);
window.addEventListener("inovtec:planning-save-request",e=>{
  const payload=e?.detail?.payload;
  if(typeof payload==="string")void writeFirebase(payload,e?.detail?.source||"planning");
});
window.addEventListener("inovtec:planning-local-saved",e=>{
  // Compatibilité avec d'anciens modules : l'événement est routé directement
  // vers Firebase, sans écrire le planning dans le navigateur.
  const payload=e?.detail?.payload;
  if(typeof payload==="string")void writeFirebase(payload,e?.detail?.source||"legacy-module");
});
window.addEventListener("inovtec:planning-request-cloud-refresh",()=>void readServer("firebase-refresh"));
window.addEventListener("online",()=>void readServer("firebase-online"));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void readServer("firebase-visible")});
})();