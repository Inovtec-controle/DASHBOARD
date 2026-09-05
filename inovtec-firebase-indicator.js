(()=>{
"use strict";
let state="loading",message="Connexion à Firebase en cours",authResolved=false,currentUser=null,lastExternal=0,authoritativeUntil=0,lastVerify=0,verifyBusy=false;
const LABELS={loading:"Connexion à Firebase en cours",connected:"Firebase connecté",error:"Problème de connexion Firebase"};
const now=()=>Date.now();
function host(){return document.querySelector(".iv-date,.hero-date")}
function indicator(){
  const h=host();if(!h)return null;
  let el=document.getElementById("ivFirebaseIndicator");
  if(!el){el=document.createElement("span");el.id="ivFirebaseIndicator";el.className="iv-firebase-indicator";el.setAttribute("role","status");el.setAttribute("aria-live","polite");h.appendChild(el)}
  return el;
}
function renderSecondary(){
  const connected=state==="connected",loading=state==="loading";
  const heroText=document.getElementById("heroSyncText");
  if(heroText)heroText.textContent=connected?"Synchronisé":loading?"Connexion…":message;
  const heroIcon=document.getElementById("heroSyncIcon");
  if(heroIcon)heroIcon.classList.toggle("online",connected);
  const cloudDot=document.getElementById("cloudDot");
  if(cloudDot)cloudDot.classList.toggle("online",connected);
  const shared=document.getElementById("sharedStatus");
  if(shared&&(/firebase|connexion|synchron/i.test(shared.textContent||"")||!String(shared.textContent||"").trim()))shared.textContent=connected?"Firebase connecté":loading?"Connexion Firebase…":message;
}
function apply(next,detail="",external=false,ttl=0){
  if(!["loading","connected","error"].includes(next))next="loading";
  if(external)lastExternal=now();
  if(ttl>0)authoritativeUntil=Math.max(authoritativeUntil,now()+ttl);
  state=next;message=detail||LABELS[next];
  const el=indicator();
  if(el){el.dataset.state=next;el.title=message;el.setAttribute("aria-label",message)}
  renderSecondary();
}
window.InovtecFirebaseIndicator={
  setState:(s,m)=>apply(s,m,true,12000),
  getState:()=>state,
  getMessage:()=>message,
  verify:()=>verifyServer(true)
};
window.addEventListener("inovtec:firebase-status",e=>{const d=e.detail||{};apply(d.state||"loading",d.message||"",true,15000)});
window.addEventListener("inovtec:firebase-operational",e=>{const d=e.detail||{};apply(d.ok?"connected":"error",d.ok?"Firebase connecté":(d.error||"Connexion Firebase impossible"),true,20000)});
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
      const label=card.querySelector(".iv-summary-label")?.textContent||"";
      const value=card.querySelector(".iv-summary-value")?.textContent||"";
      if(/synchronisation/i.test(label)||(/synchronis/i.test(value)&&/firebase/i.test(card.textContent||""))){card.style.display="none";hiddenSummary=true}
    });
    const summary=document.getElementById("pageSummary");if(summary&&hiddenSummary)summary.style.gridTemplateColumns="repeat(auto-fit,minmax(180px,1fr))";
    const d=frameDoc();const sync=d?.getElementById("syncStatus");if(sync)sync.style.display="none";
    const kd=d?.getElementById("kontrolFrame")?.contentDocument;const old=kd?.getElementById("ivKontrolCloudState");if(old)old.style.display="none";const ksync=kd?.getElementById("syncStatus");if(ksync)ksync.style.display="none";
  }catch{}
}
function withTimeout(promise,ms){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error("timeout");e.code="timeout";reject(e)},ms)})]).finally(()=>clearTimeout(timer))}
async function verifyServer(force=false){
  if(verifyBusy||!authResolved||!currentUser||!window.firebase||!window.INOVTEC_FIREBASE_CONFIG||!firebase.firestore)return;
  if(!navigator.onLine){apply("error","Pas de connexion réseau",true,10000);return}
  if(!force&&now()-lastVerify<12000)return;
  verifyBusy=true;apply("loading","Vérification Firebase…");
  try{
    const db=firebase.firestore();
    try{await withTimeout(db.enableNetwork(),3000)}catch{}
    await withTimeout(Promise.all([
      db.collection("kanban").doc(currentUser.uid).get({source:"server"}),
      db.collection("chantiers").limit(1).get({source:"server"})
    ]),9000);
    lastVerify=now();
    apply("connected","Firebase connecté",true,18000);
  }catch(error){
    const code=String(error?.code||"");
    apply("error",code==="timeout"?"Firebase ne répond pas":"Connexion Firebase impossible"+(code?" · "+code:""),true,12000);
  }finally{verifyBusy=false}
}
function poll(){
  indicator();hideOldStatusUI();renderSecondary();
  if(!navigator.onLine){apply("error","Pas de connexion réseau");return}
  if(now()<authoritativeUntil)return;
  const local=mirrorStatus()||iframeStatus();
  if(local&&local.state!=="loading"){apply(local.state,local.message);return}
  if(authResolved&&!currentUser){apply("error","Compte Firebase non connecté");return}
  if(authResolved&&currentUser){verifyServer();if(state!=="connected")apply("loading",local?.message||"Connexion à Firebase en cours")}
}
function bindFirebase(){
  indicator();renderSecondary();apply("loading","Connexion à Firebase en cours");
  if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG){setTimeout(()=>{if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG)apply("error","Firebase indisponible")},1500);return}
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    firebase.auth().onAuthStateChanged(user=>{
      authResolved=true;currentUser=user||null;
      if(!navigator.onLine){apply("error","Pas de connexion réseau");return}
      if(user){apply("loading","Compte Firebase reconnu · vérification…");verifyServer(true)}
      else apply("error","Compte Firebase non connecté",true,10000);
    },()=>{authResolved=true;currentUser=null;apply("error","Problème de connexion Firebase",true,10000)});
  }catch(e){authResolved=true;currentUser=null;apply("error","Problème de connexion Firebase",true,10000)}
}
window.addEventListener("offline",()=>apply("error","Pas de connexion réseau",true,10000));
window.addEventListener("online",()=>{authoritativeUntil=0;apply("loading","Reconnexion à Firebase en cours");verifyServer(true)});
window.addEventListener("focus",()=>{if(currentUser&&now()-lastVerify>10000)verifyServer(true)});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&currentUser&&now()-lastVerify>10000)verifyServer(true)});
document.getElementById("legacyFrame")?.addEventListener("load",()=>{setTimeout(poll,250);setTimeout(poll,1000)});
bindFirebase();poll();setInterval(()=>{if(document.visibilityState==="visible")poll()},5000);
})();
