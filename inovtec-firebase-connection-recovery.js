(()=>{
"use strict";
if(window.__INOVTEC_FIREBASE_CONNECTION_RECOVERY_V1__)return;
window.__INOVTEC_FIREBASE_CONNECTION_RECOVERY_V1__=true;
if(window.top!==window)return;

const CHECK_TIMEOUT=9000;
const RETRY_MS=12000;
let auth=null,db=null,user=null,checking=false,lastCheck=0,retryTimer=null,bootTimer=null;

function emit(state,message,extra={}){
  const detail={state,message,source:"firebase-connection-recovery",...extra};
  try{window.dispatchEvent(new CustomEvent("inovtec:firebase-status",{detail}))}catch{}
  try{window.InovtecFirebaseIndicator?.setState?.(state,message)}catch{}
}
function operational(ok,error=""){
  const detail={ok,checkedAt:new Date().toISOString(),projectId:window.INOVTEC_FIREBASE_CONFIG?.projectId||"",source:"firebase-connection-recovery"};
  if(error)detail.error=error;
  window.InovtecFirebaseOperational=detail;
  try{window.dispatchEvent(new CustomEvent("inovtec:firebase-operational",{detail}))}catch{}
}
function withTimeout(promise,ms=CHECK_TIMEOUT){
  let timer;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error("Firebase timeout");e.code="timeout";reject(e)},ms)})
  ]).finally(()=>clearTimeout(timer));
}
async function ensurePersistence(){
  if(!auth)return;
  const P=firebase.auth.Auth.Persistence;
  for(const mode of [P.LOCAL,P.SESSION]){
    try{await auth.setPersistence(mode);return}catch{}
  }
}
async function verify(force=false){
  if(checking||!auth||!db)return;
  if(!user){emit("error","Compte Firebase non connecté");operational(false,"Compte Firebase non connecté");return}
  if(!navigator.onLine){emit("error","Pas de connexion réseau");operational(false,"Pas de connexion réseau");return}
  if(!force&&Date.now()-lastCheck<7000)return;
  checking=true;
  emit("loading","Vérification de la connexion Firebase…");
  try{
    try{await withTimeout(db.enableNetwork(),3000)}catch{}
    await withTimeout(Promise.all([
      db.collection("kanban").doc(user.uid).get({source:"server"}),
      db.collection("chantiers").limit(1).get({source:"server"})
    ]));
    lastCheck=Date.now();
    operational(true);
    emit("connected","Firebase connecté");
  }catch(error){
    const code=String(error?.code||"");
    const message=code==="timeout"?"Firebase ne répond pas":"Connexion Firebase impossible"+(code?" · "+code:"");
    operational(false,message);
    emit("error",message);
    clearTimeout(retryTimer);
    retryTimer=setTimeout(()=>verify(true),RETRY_MS);
  }finally{
    checking=false;
  }
}
function start(currentUser){
  user=currentUser||null;
  clearTimeout(retryTimer);
  if(!user){emit("error","Compte Firebase non connecté");operational(false,"Compte Firebase non connecté");return}
  emit("loading","Compte Firebase reconnu · connexion en cours…");
  verify(true);
}
async function boot(){
  clearTimeout(bootTimer);
  if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG||!firebase.auth||!firebase.firestore){bootTimer=setTimeout(boot,150);return}
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    auth=firebase.auth();
    db=firebase.firestore();
    await ensurePersistence();
    auth.onAuthStateChanged(start,()=>{user=null;emit("error","Problème d’authentification Firebase");operational(false,"Problème d’authentification Firebase")});
    window.addEventListener("online",()=>{if(user)verify(true);else emit("error","Compte Firebase non connecté")});
    window.addEventListener("offline",()=>{emit("error","Pas de connexion réseau");operational(false,"Pas de connexion réseau")});
    window.addEventListener("focus",()=>{if(user&&Date.now()-lastCheck>10000)verify(true)});
    document.addEventListener("visibilitychange",()=>{if(!document.hidden&&user&&Date.now()-lastCheck>10000)verify(true)});
    setInterval(()=>{if(user&&!document.hidden&&Date.now()-lastCheck>30000)verify(true)},15000);
  }catch(error){
    emit("error","Initialisation Firebase impossible");
    operational(false,String(error?.message||error||"Initialisation Firebase impossible"));
  }
}
boot();
})();
