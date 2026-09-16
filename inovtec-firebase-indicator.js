(()=>{
"use strict";
let state="loading",message="Vérification de Firebase en cours",authResolved=false,signedIn=false,lastExternal=0;
const LABELS={loading:"Vérification de Firebase en cours",connected:"Firebase accessible",error:"Problème de connexion Firebase"};
function host(){return document.querySelector(".iv-date,.hero-date")}
function indicator(){
  const h=host();if(!h)return null;
  let el=document.getElementById("ivFirebaseIndicator");
  if(!el){el=document.createElement("span");el.id="ivFirebaseIndicator";el.className="iv-firebase-indicator";el.setAttribute("role","status");el.setAttribute("aria-live","polite");h.appendChild(el)}
  return el;
}
function apply(next,detail="",external=false){
  if(!["loading","connected","error"].includes(next))next="loading";
  if(external)lastExternal=Date.now();
  state=next;message=detail||LABELS[next];
  const el=indicator();if(!el)return;
  el.dataset.state=next;el.title=message;el.setAttribute("aria-label",message);
}
window.InovtecFirebaseIndicator={setState:(s,m)=>apply(s,m,true),getState:()=>state};
window.addEventListener("inovtec:firebase-status",e=>{const d=e.detail||{};apply(d.state||"loading",d.message||"",true)});
function infer(text){
  const t=String(text||"").trim().toLowerCase();if(!t)return null;
  if(/erreur|impossible|indisponible|hors[ -]?ligne|échec|echec|déconnect|deconnect|non connecté|non connecte|permission|refus/.test(t))return{state:"error",message:String(text).trim()};
  if(/connexion|chargement|synchronisation en cours|synchronisation…|synchronisation\.\.\.|sauvegarde en cours|envoi en cours|patiente/.test(t)&&!/connecté|connecte|synchronisé|synchronise/.test(t))return{state:"loading",message:String(text).trim()};
  if(/synchronisé|synchronise|connecté|connecte|en ligne|firebase.*(?:ok|actif)|données synchronisées|donnees synchronisees/.test(t))return{state:"connected",message:String(text).trim()};
  return null;
}
function frameDoc(){try{return document.getElementById("legacyFrame")?.contentDocument||null}catch{return null}}
function iframeStatus(){
  try{
    const d=frameDoc();if(!d)return null;
    const candidates=[d.getElementById("syncStatus"),...d.querySelectorAll(".status.ok,.status.warning")];
    for(const el of candidates){const r=infer(el?.textContent);if(r)return r}
    const kd=d.getElementById("kontrolFrame")?.contentDocument;
    if(kd){const r=infer(kd.getElementById("syncStatus")?.textContent||kd.getElementById("ivKontrolCloudState")?.textContent);if(r)return r}
  }catch{}
  return null;
}
function mirrorStatus(){const el=document.getElementById("syncMirror");return infer(el?.textContent)}
function hideOldStatusUI(){
  try{
    let hiddenSummary=false;
    document.querySelectorAll("#pageSummary .iv-summary-card").forEach(card=>{
      const label=card.querySelector(".iv-summary-label")?.textContent||"";
      const value=card.querySelector(".iv-summary-value")?.textContent||"";
      if(/synchronisation/i.test(label)||(/synchronis/i.test(value)&&/firebase/i.test(card.textContent||""))){card.style.display="none";hiddenSummary=true}
    });
    const summary=document.getElementById("pageSummary");if(summary&&hiddenSummary)summary.style.gridTemplateColumns="repeat(auto-fit,minmax(180px,1fr))";
    const d=frameDoc();
    const sync=d?.getElementById("syncStatus");if(sync)sync.style.display="none";
    const kd=d?.getElementById("kontrolFrame")?.contentDocument;
    const old=kd?.getElementById("ivKontrolCloudState");if(old)old.style.display="none";
    const ksync=kd?.getElementById("syncStatus");if(ksync)ksync.style.display="none";
  }catch{}
}
function poll(){
  indicator();hideOldStatusUI();
  if(!navigator.onLine){apply("error","Pas de connexion réseau");return}
  if(!authResolved){apply("loading","Authentification Firebase en cours");return}
  if(!signedIn){apply("error","Compte Firebase non connecté");return}
  const health=window.InovtecFirebaseOperational;
  if(health?.ok===false){apply("error","Lecture Firebase impossible : "+String(health.error||"accès refusé"));return}
  const local=iframeStatus()||mirrorStatus();
  if(local?.state==="error"){apply("error",local.message);return}
  if(local?.state==="loading"){apply("loading",local.message);return}
  // Une session Auth ouverte, ou un badge d'une page, ne prouve pas que Firestore répond.
  if(health?.ok!==true){apply("loading","Compte connecté · lecture Firestore non encore confirmée");return}
  if(local?.state==="connected"){
    apply("connected","Firebase accessible · "+local.message+" (état annoncé par la rubrique)");return;
  }
  if(Date.now()-lastExternal<1000)return;
  apply("connected","Firebase accessible · lecture Firestore confirmée ; enregistrement de cette rubrique non vérifié");
}
function bindFirebase(){
  indicator();apply("loading","Connexion à Firebase en cours");
  if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG){setTimeout(()=>{if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG)apply("error","Firebase indisponible")},1200);return}
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    firebase.auth().onAuthStateChanged(user=>{
      authResolved=true;signedIn=!!user;
      poll();
    },()=>{authResolved=true;signedIn=false;apply("error","Problème de connexion Firebase")});
  }catch(e){authResolved=true;signedIn=false;apply("error","Problème de connexion Firebase")}
}
window.addEventListener("inovtec:firebase-operational",poll);
window.addEventListener("offline",()=>apply("error","Pas de connexion réseau"));
window.addEventListener("online",()=>{apply("loading","Reconnexion à Firebase en cours");setTimeout(poll,300)});
document.getElementById("legacyFrame")?.addEventListener("load",()=>{apply("loading","Vérification Firebase en cours");setTimeout(poll,180);setTimeout(poll,700)});
bindFirebase();poll();setInterval(()=>{if(document.visibilityState==="visible")poll()},5000);
})();