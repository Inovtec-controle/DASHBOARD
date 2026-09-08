(()=>{
"use strict";
if(window.__INOVTEC_FIREBASE_INDICATOR_V3__)return;
window.__INOVTEC_FIREBASE_INDICATOR_V3__=true;

let state="loading",message="Connexion à Firebase en cours",authResolved=false,currentUser=null,lastVerify=0,verifyBusy=false,lastConnectedAt=0,failureCount=0,retryTimer=null;
const LABELS={loading:"Connexion à Firebase en cours",connected:"Firebase connecté",error:"Problème de connexion Firebase"};
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
const now=()=>Date.now();

function host(){return document.querySelector(".iv-date,.hero-date")}
function indicator(){
  const h=host();if(!h)return null;
  let el=document.getElementById("ivFirebaseIndicator");
  if(!el){
    el=document.createElement("span");el.id="ivFirebaseIndicator";el.className="iv-firebase-indicator";el.setAttribute("role","button");el.setAttribute("tabindex","0");el.setAttribute("aria-live","polite");
    el.addEventListener("click",()=>verifyServer(true));
    el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();verifyServer(true)}});
    h.appendChild(el)
  }
  return el;
}
function renderSecondary(){
  const connected=state==="connected",loading=state==="loading";
  const heroText=document.getElementById("heroSyncText");
  if(heroText)heroText.textContent=connected?"Synchronisé":loading?"Connexion…":message;
  const heroIcon=document.getElementById("heroSyncIcon");if(heroIcon)heroIcon.classList.toggle("online",connected);
  const cloudDot=document.getElementById("cloudDot");if(cloudDot)cloudDot.classList.toggle("online",connected);
  const shared=document.getElementById("sharedStatus");
  if(shared&&(/firebase|connexion|synchron/i.test(shared.textContent||"")||!String(shared.textContent||"").trim()))shared.textContent=connected?"Firebase connecté":loading?"Connexion Firebase…":message;
}
function apply(next,detail=""){
  if(!["loading","connected","error"].includes(next))next="loading";
  state=next;message=detail||LABELS[next];
  const el=indicator();
  if(el){el.dataset.state=next;el.title=message+(next==="error"?" · Cliquer pour retenter":"");el.setAttribute("aria-label",el.title)}
  renderSecondary();
}
function markConnected(detail="Firebase connecté"){
  failureCount=0;lastConnectedAt=now();apply("connected",detail);
}
function scheduleRetry(delay=2500){clearTimeout(retryTimer);retryTimer=setTimeout(()=>verifyServer(true),delay)}

window.InovtecFirebaseIndicator={
  setState:(s,m)=>{
    if(s==="connected"){markConnected(m||"Firebase connecté");return}
    if(s==="error"&&authResolved&&currentUser&&navigator.onLine){apply("loading","Reconnexion Firebase…");scheduleRetry(400);return}
    apply(s,m)
  },
  getState:()=>state,
  getMessage:()=>message,
  verify:()=>verifyServer(true)
};

window.addEventListener("inovtec:firebase-status",e=>{
  const d=e.detail||{},next=d.state||"loading";
  if(next==="connected"){markConnected(d.message||"Firebase connecté");return}
  if(next==="error"&&authResolved&&currentUser&&navigator.onLine){
    apply("loading",d.message&&/sauvegarde/i.test(d.message)?"Reconnexion Firebase après sauvegarde interrompue…":"Reconnexion Firebase…");
    scheduleRetry(350);return;
  }
  apply(next,d.message||"")
});
window.addEventListener("inovtec:firebase-operational",e=>{
  const d=e.detail||{};
  if(d.ok){markConnected("Firebase connecté");return}
  if(authResolved&&currentUser&&navigator.onLine){apply("loading","Vérification Firebase…");scheduleRetry(300);return}
  apply("error",d.error||"Connexion Firebase impossible")
});

function infer(text){
  const t=String(text||"").trim().toLowerCase();if(!t)return null;
  if(/erreur|impossible|indisponible|hors[ -]?ligne|échec|echec|déconnect|deconnect|non connecté|non connecte|permission|refus|bloqu/.test(t))return{state:"error",message:String(text).trim()};
  if(/connexion|chargement|synchronisation en cours|synchronisation…|synchronisation\.\.\.|sauvegarde en cours|envoi en cours|patiente/.test(t)&&!/connecté|connecte|synchronisé|synchronise/.test(t))return{state:"loading",message:String(text).trim()};
  if(/synchronisé|synchronise|connecté|connecte|en ligne|firebase.*(?:ok|actif)|données synchronisées|donnees synchronisees/.test(t))return{state:"connected",message:String(text).trim()};
  return null;
}
function frameDoc(){try{return document.getElementById("legacyFrame")?.contentDocument||null}catch{return null}}
function iframeStatus(){
  try{
    const d=frameDoc();if(!d)return null;
    const direct=d.getElementById("syncStatus")||d.getElementById("syncBadge");
    const first=infer(direct?.textContent);if(first)return first;
    const kd=d.getElementById("kontrolFrame")?.contentDocument;
    if(kd){const r=infer(kd.getElementById("syncStatus")?.textContent||kd.getElementById("ivKontrolCloudState")?.textContent);if(r)return r}
  }catch{}
  return null;
}
function mirrorStatus(){return infer(document.getElementById("syncMirror")?.textContent)}
function hideOldStatusUI(){
  try{
    let hiddenSummary=false;
    document.querySelectorAll("#pageSummary .iv-summary-card").forEach(card=>{
      const label=card.querySelector(".iv-summary-label")?.textContent||"",value=card.querySelector(".iv-summary-value")?.textContent||"";
      if(/synchronisation/i.test(label)||(/synchronis/i.test(value)&&/firebase/i.test(card.textContent||""))){card.style.display="none";hiddenSummary=true}
    });
    const summary=document.getElementById("pageSummary");if(summary&&hiddenSummary)summary.style.gridTemplateColumns="repeat(auto-fit,minmax(180px,1fr))";
    const d=frameDoc();const sync=d?.getElementById("syncStatus");if(sync)sync.style.display="none";
    const kd=d?.getElementById("kontrolFrame")?.contentDocument;const old=kd?.getElementById("ivKontrolCloudState");if(old)old.style.display="none";const ksync=kd?.getElementById("syncStatus");if(ksync)ksync.style.display="none";
  }catch{}
}
function withTimeout(promise,ms){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error("timeout");e.code="timeout";reject(e)},ms)})]).finally(()=>clearTimeout(timer))}
function probe(db){
  if(mode==="infos"||!mode)return db.collection("chantiers").limit(1).get({source:"server"});
  return db.collection("kanban").doc(currentUser.uid).get({source:"server"});
}
async function runProbe(db){
  try{await withTimeout(db.enableNetwork(),3500)}catch{}
  return withTimeout(probe(db),9000)
}
async function verifyServer(force=false){
  if(verifyBusy||!authResolved||!currentUser||!window.firebase||!window.INOVTEC_FIREBASE_CONFIG||!firebase.firestore)return;
  if(!navigator.onLine){failureCount=0;apply("error","Pas de connexion réseau");return}
  if(!force&&now()-lastVerify<10000)return;
  verifyBusy=true;apply("loading","Vérification Firebase…");
  try{
    const db=firebase.firestore();
    try{
      await runProbe(db);
    }catch(first){
      const code=String(first?.code||"");
      if(/unauthenticated|permission-denied/.test(code)){
        try{await withTimeout(currentUser.getIdToken(true),6000)}catch{}
        await runProbe(db);
      }else throw first;
    }
    lastVerify=now();markConnected("Firebase connecté");
  }catch(error){
    const code=String(error?.code||"");failureCount+=1;
    if(failureCount<2){apply("loading","Reconnexion Firebase…");scheduleRetry(2200)}
    else apply("error",code==="timeout"?"Firebase ne répond pas":"Connexion Firebase impossible"+(code?" · "+code:""));
  }finally{verifyBusy=false}
}
function poll(){
  indicator();hideOldStatusUI();renderSecondary();
  if(!navigator.onLine){apply("error","Pas de connexion réseau");return}
  const local=mirrorStatus()||iframeStatus();
  if(local?.state==="connected"){markConnected(local.message);return}
  if(local?.state==="error"&&authResolved&&currentUser){if(now()-lastConnectedAt>12000)verifyServer();return}
  if(authResolved&&!currentUser){apply("error","Compte Firebase non connecté");return}
  if(authResolved&&currentUser&&now()-lastVerify>12000)verifyServer();
}
function bindFirebase(){
  indicator();renderSecondary();apply("loading","Connexion à Firebase en cours");
  if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG){setTimeout(()=>{if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG)apply("error","Firebase indisponible")},1800);return}
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    firebase.auth().onAuthStateChanged(user=>{
      authResolved=true;currentUser=user||null;failureCount=0;
      if(!navigator.onLine){apply("error","Pas de connexion réseau");return}
      if(user){apply("loading","Compte Firebase reconnu · vérification…");verifyServer(true)}
      else apply("error","Compte Firebase non connecté");
    },()=>{authResolved=true;currentUser=null;apply("error","Problème de connexion Firebase")});
  }catch(e){authResolved=true;currentUser=null;apply("error","Problème de connexion Firebase")}
}
window.addEventListener("offline",()=>apply("error","Pas de connexion réseau"));
window.addEventListener("online",()=>{failureCount=0;apply("loading","Reconnexion à Firebase en cours");verifyServer(true)});
window.addEventListener("focus",()=>{if(currentUser&&now()-lastVerify>10000)verifyServer(true)});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&currentUser&&now()-lastVerify>10000)verifyServer(true)});
document.getElementById("legacyFrame")?.addEventListener("load",()=>{setTimeout(poll,250);setTimeout(poll,1100)});
bindFirebase();poll();setInterval(()=>{if(document.visibilityState==="visible")poll()},5000);
})();
