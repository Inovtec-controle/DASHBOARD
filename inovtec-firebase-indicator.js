(()=>{
"use strict";
let state="loading",message="Connexion à Firebase en cours",authResolved=false,lastExternal=0;
const LABELS={loading:"Connexion à Firebase en cours",connected:"Firebase connecté",error:"Problème de connexion Firebase"};
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
function iframeStatus(){
  try{
    const frame=document.getElementById("legacyFrame"),d=frame?.contentDocument;if(!d)return null;
    const candidates=[d.getElementById("syncStatus"),...d.querySelectorAll(".status.ok,.status.warning")];
    for(const el of candidates){const r=infer(el?.textContent);if(r)return r}
    const kd=d.getElementById("kontrolFrame")?.contentDocument;
    if(kd){const r=infer(kd.getElementById("syncStatus")?.textContent||kd.getElementById("ivKontrolCloudState")?.textContent);if(r)return r}
  }catch{}
  return null;
}
function mirrorStatus(){const el=document.getElementById("syncMirror");return infer(el?.textContent)}
function poll(){
  indicator();
  if(!navigator.onLine){apply("error","Pas de connexion réseau");return}
  const local=iframeStatus()||mirrorStatus();
  if(local){apply(local.state,local.message,true);return}
  if(Date.now()-lastExternal<2200)return;
  if(authResolved&&state==="loading")apply("connected","Firebase connecté");
}
function bindFirebase(){
  indicator();apply("loading","Connexion à Firebase en cours");
  if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG){setTimeout(()=>{if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG)apply("error","Firebase indisponible")},1200);return}
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    firebase.auth().onAuthStateChanged(user=>{
      authResolved=true;
      if(!navigator.onLine){apply("error","Pas de connexion réseau");return}
      if(user)apply("connected","Firebase connecté");
      else apply("error","Compte Firebase non connecté");
    },()=>{authResolved=true;apply("error","Problème de connexion Firebase")});
  }catch(e){authResolved=true;apply("error","Problème de connexion Firebase")}
}
window.addEventListener("offline",()=>apply("error","Pas de connexion réseau"));
window.addEventListener("online",()=>{apply("loading","Reconnexion à Firebase en cours");setTimeout(poll,300)});
document.getElementById("legacyFrame")?.addEventListener("load",()=>{apply("loading","Connexion à Firebase en cours");setTimeout(poll,180);setTimeout(poll,700)});
bindFirebase();poll();setInterval(poll,900);
})();
