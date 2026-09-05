(()=>{
"use strict";
const host=(()=>{try{return parent&&parent!==window?parent:window}catch{return window}})();
if(host.__INOVTEC_PLANNING_FIREBASE_WATCHDOG_V1__)return;
host.__INOVTEC_PLANNING_FIREBASE_WATCHDOG_V1__=true;

let user=null,serverState="loading",serverMessage="Vérification Firebase…",serverCheckedAt=0,lastAttemptAt=0,authResolved=false,checkBusy=false,mirrorWaitingSince=0;
const TIMEOUT_MS=8000;
const CHECK_EVERY_MS=15000;

function status(state,message){
  try{
    host.dispatchEvent(new host.CustomEvent("inovtec:firebase-status",{detail:{state,message,source:"planning-watchdog"}}));
    if(host.InovtecFirebaseIndicator?.setState)host.InovtecFirebaseIndicator.setState(state,message);
  }catch{}
}
function mirrorText(){try{return String(host.document.getElementById("syncMirror")?.textContent||"").trim()}catch{return""}}
function setMirror(text){try{const el=host.document.getElementById("syncMirror");if(el)el.textContent=text}catch{}}
function cloudState(){
  const t=mirrorText().toLowerCase();
  if(/erreur|impossible|refus|accès refusé|acces refuse|non connecté|non connecte|synchronisation bloquée|synchronisation bloquee/.test(t))return"error";
  if(/synchronisé|synchronise|données synchronisées|donnees synchronisees/.test(t))return"connected";
  return"loading";
}
function withTimeout(promise,ms){
  return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Object.assign(new Error("timeout"),{code:"timeout"})),ms))]);
}
async function serverCheck(){
  if(checkBusy||!authResolved)return;
  lastAttemptAt=Date.now();
  if(!navigator.onLine){serverState="error";serverMessage="Pas de connexion réseau";broadcast();return}
  if(!user){serverState="error";serverMessage="Compte Firebase non connecté";broadcast();return}
  if(!host.firebase||!host.INOVTEC_FIREBASE_CONFIG){serverState="error";serverMessage="Firebase indisponible";broadcast();return}
  checkBusy=true;serverState="loading";serverMessage="Vérification du serveur Firebase…";broadcast();
  try{
    if(!host.firebase.apps.length)host.firebase.initializeApp(host.INOVTEC_FIREBASE_CONFIG);
    const db=host.firebase.firestore();
    try{await withTimeout(db.enableNetwork(),3000)}catch{}
    await withTimeout(db.collection("kanban").doc(user.uid).get({source:"server"}),TIMEOUT_MS);
    serverState="connected";serverMessage="Serveur Firebase accessible";serverCheckedAt=Date.now();
  }catch(e){
    serverState="error";
    const code=String(e?.code||"");
    serverMessage=code==="timeout"?"Firebase ne répond pas":"Connexion Firebase impossible"+(code?" · "+code:"");
  }finally{checkBusy=false;broadcast()}
}
function broadcast(){
  if(!authResolved){status("loading","Connexion au compte Firebase…");return}
  if(!user){status("error","Compte Firebase non connecté");return}
  if(serverState==="error"){status("error",serverMessage);return}
  if(serverState!=="connected"){status("loading",serverMessage);return}
  const c=cloudState();
  if(c==="error"){status("error",mirrorText()||"Erreur de synchronisation Firebase");return}
  if(c==="connected"){
    mirrorWaitingSince=0;
    status("connected","Firebase serveur + Planning synchronisés");
    return;
  }
  if(!mirrorWaitingSince)mirrorWaitingSince=Date.now();
  const waited=Date.now()-mirrorWaitingSince;
  if(waited>7000){
    setMirror("Firebase — synchronisation bloquée");
    status("error","Firebase accessible mais synchronisation du Planning bloquée");
  }else status("loading","Firebase accessible · synchronisation du Planning en cours");
}
function bind(){
  if(!host.firebase||!host.INOVTEC_FIREBASE_CONFIG||!host.firebase.auth||!host.firebase.firestore){setTimeout(bind,150);return}
  try{
    if(!host.firebase.apps.length)host.firebase.initializeApp(host.INOVTEC_FIREBASE_CONFIG);
    host.firebase.auth().onAuthStateChanged(u=>{
      authResolved=true;user=u||null;serverState="loading";mirrorWaitingSince=0;serverCheckedAt=0;
      if(user)serverCheck();else broadcast();
    },()=>{authResolved=true;user=null;serverState="error";serverMessage="Problème d’authentification Firebase";broadcast()});
  }catch(e){authResolved=true;serverState="error";serverMessage="Firebase indisponible";broadcast()}
  host.addEventListener("online",()=>{serverState="loading";serverMessage="Reconnexion Firebase…";serverCheck()});
  host.addEventListener("offline",()=>{serverState="error";serverMessage="Pas de connexion réseau";broadcast()});
  host.addEventListener("focus",()=>{if(user&&Date.now()-lastAttemptAt>5000)serverCheck()});
  host.document.addEventListener("visibilitychange",()=>{if(!host.document.hidden&&user&&Date.now()-lastAttemptAt>5000)serverCheck()});
  setInterval(()=>{
    broadcast();
    if(!user||host.document.hidden||checkBusy)return;
    const now=Date.now();
    if(serverState==="error"&&navigator.onLine&&now-lastAttemptAt>5000)serverCheck();
    else if(serverState==="connected"&&now-serverCheckedAt>CHECK_EVERY_MS)serverCheck();
  },1500);
}
bind();
})();
