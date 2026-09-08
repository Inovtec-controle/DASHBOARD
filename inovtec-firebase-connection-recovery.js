(()=>{
"use strict";
if(window.__INOVTEC_FIREBASE_CONNECTION_RECOVERY_V2__)return;
window.__INOVTEC_FIREBASE_CONNECTION_RECOVERY_V2__=true;
if(window.top!==window)return;

const CHECK_TIMEOUT=9000;
const RETRY_MS=3500;
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
let auth=null,db=null,user=null,checking=false,lastCheck=0,retryTimer=null,bootTimer=null,failures=0;

function emit(state,message,extra={}){
  const detail={state,message,source:"firebase-connection-recovery",...extra};
  try{window.dispatchEvent(new CustomEvent("inovtec:firebase-status",{detail}))}catch{}
}
function operational(ok,error=""){
  const detail={ok,checkedAt:new Date().toISOString(),projectId:window.INOVTEC_FIREBASE_CONFIG?.projectId||"",source:"firebase-connection-recovery",mode};
  if(error)detail.error=error;
  window.InovtecFirebaseOperational=detail;
  try{window.dispatchEvent(new CustomEvent("inovtec:firebase-operational",{detail}))}catch{}
}
function withTimeout(promise,ms=CHECK_TIMEOUT){
  let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error("Firebase timeout");e.code="timeout";reject(e)},ms)})]).finally(()=>clearTimeout(timer))
}
async function ensurePersistence(){
  if(!auth)return;
  const P=firebase.auth.Auth.Persistence;
  for(const persistence of [P.LOCAL,P.SESSION]){try{await auth.setPersistence(persistence);return}catch{}}
}
function probe(){
  if(mode==="infos"||!mode)return db.collection("chantiers").limit(1).get({source:"server"});
  return db.collection("kanban").doc(user.uid).get({source:"server"});
}
async function runProbe(){
  try{await withTimeout(db.enableNetwork(),3500)}catch{}
  return withTimeout(probe(),CHECK_TIMEOUT)
}
async function verify(force=false){
  if(checking||!auth||!db)return;
  if(!user){failures=0;emit("error","Compte Firebase non connecté");operational(false,"Compte Firebase non connecté");return}
  if(!navigator.onLine){failures=0;emit("error","Pas de connexion réseau");operational(false,"Pas de connexion réseau");return}
  if(!force&&Date.now()-lastCheck<8000)return;
  checking=true;emit("loading","Vérification de la connexion Firebase…");
  try{
    try{
      await runProbe();
    }catch(first){
      const code=String(first?.code||"");
      if(/unauthenticated|permission-denied/.test(code)){
        try{await withTimeout(user.getIdToken(true),6000)}catch{}
        await runProbe();
      }else throw first;
    }
    failures=0;lastCheck=Date.now();operational(true);emit("connected","Firebase connecté");
  }catch(error){
    failures+=1;
    const code=String(error?.code||"");
    const message=code==="timeout"?"Firebase ne répond pas":"Connexion Firebase impossible"+(code?" · "+code:"");
    operational(false,message);
    clearTimeout(retryTimer);
    if(failures<2){emit("loading","Reconnexion Firebase en cours…");retryTimer=setTimeout(()=>verify(true),RETRY_MS)}
    else{emit("error",message);retryTimer=setTimeout(()=>verify(true),12000)}
  }finally{checking=false}
}
function start(currentUser){
  user=currentUser||null;failures=0;clearTimeout(retryTimer);
  if(!user){emit("error","Compte Firebase non connecté");operational(false,"Compte Firebase non connecté");return}
  emit("loading","Compte Firebase reconnu · connexion en cours…");verify(true)
}
async function boot(){
  clearTimeout(bootTimer);
  if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG||!firebase.auth||!firebase.firestore){bootTimer=setTimeout(boot,150);return}
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    auth=firebase.auth();db=firebase.firestore();await ensurePersistence();
    auth.onAuthStateChanged(start,()=>{user=null;emit("error","Problème d’authentification Firebase");operational(false,"Problème d’authentification Firebase")});
    window.addEventListener("online",()=>{failures=0;if(user)verify(true);else emit("error","Compte Firebase non connecté")});
    window.addEventListener("offline",()=>{emit("error","Pas de connexion réseau");operational(false,"Pas de connexion réseau")});
    window.addEventListener("focus",()=>{if(user&&Date.now()-lastCheck>10000)verify(true)});
    document.addEventListener("visibilitychange",()=>{if(!document.hidden&&user&&Date.now()-lastCheck>10000)verify(true)});
    setInterval(()=>{if(user&&!document.hidden&&Date.now()-lastCheck>30000)verify(true)},15000);
  }catch(error){emit("error","Initialisation Firebase impossible");operational(false,String(error?.message||error||"Initialisation Firebase impossible"))}
}
boot();
})();
