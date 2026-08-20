(()=>{
"use strict";
if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG)return;
if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
const auth=firebase.auth();
const params=new URLSearchParams(location.search);
const mode=(params.get("mode")||"").toLowerCase();
const frame=document.getElementById("legacyFrame");
const AUTH_OPTIONAL=new Set(["temps","salaire"]);
const requireAuth=!AUTH_OPTIONAL.has(mode);
let reloadedUid="",booted=false;

function setStatus(state,message){
  try{window.InovtecFirebaseIndicator?.setState?.(state,message)}catch{}
  try{window.dispatchEvent(new CustomEvent("inovtec:firebase-status",{detail:{state,message}}))}catch{}
  const mirror=document.getElementById("syncMirror");
  if(mirror&&message)mirror.textContent=message;
}
async function setBestPersistence(){
  const P=firebase.auth.Auth.Persistence;
  for(const value of [P.LOCAL,P.SESSION,P.NONE]){
    try{await auth.setPersistence(value);return value}catch{}
  }
  return null;
}
function friendlyError(error){
  const code=String(error?.code||"");
  if(code.includes("invalid-credential")||code.includes("wrong-password")||code.includes("user-not-found"))return"Adresse email ou mot de passe incorrect.";
  if(code.includes("too-many-requests"))return"Trop de tentatives. Réessaie un peu plus tard.";
  if(code.includes("network-request-failed"))return"Connexion réseau indisponible. Vérifie Internet puis réessaie.";
  if(code.includes("user-disabled"))return"Ce compte est désactivé.";
  return"Connexion impossible. Vérifie les identifiants et la connexion Internet.";
}
function overlay(){
  let el=document.getElementById("ivGlobalAuthGateway");
  if(el)return el;
  if(!document.body)return null;
  el=document.createElement("div");
  el.id="ivGlobalAuthGateway";
  el.style.cssText="position:fixed;inset:0;z-index:2147483000;display:none;place-items:center;background:rgba(3,33,25,.58);backdrop-filter:blur(6px);padding:16px";
  el.innerHTML='<form id="ivGlobalAuthForm" style="width:min(410px,100%);box-sizing:border-box;background:#fff;border:1px solid #dce9e3;border-radius:20px;padding:20px;box-shadow:0 26px 70px rgba(3,33,25,.30);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif"><div style="font-size:10px;letter-spacing:.13em;color:#059669;font-weight:850">INOVTEC</div><h2 style="margin:5px 0 6px;color:#123d30;font-size:21px">Connexion au Dashboard</h2><p style="margin:0 0 15px;color:#667b70;font-size:13px;line-height:1.45">Une seule connexion permet d’utiliser les modules synchronisés sur ordinateur et téléphone.</p><label style="display:block;margin:8px 0 5px;font-size:12px;font-weight:800;color:#28473c">Adresse email</label><input id="ivGlobalAuthEmail" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required style="width:100%;box-sizing:border-box;border:1px solid #cfe0d7;border-radius:11px;padding:12px;font-size:16px"><label style="display:block;margin:11px 0 5px;font-size:12px;font-weight:800;color:#28473c">Mot de passe</label><input id="ivGlobalAuthPassword" type="password" autocomplete="current-password" required style="width:100%;box-sizing:border-box;border:1px solid #cfe0d7;border-radius:11px;padding:12px;font-size:16px"><button id="ivGlobalAuthSubmit" type="submit" style="width:100%;margin-top:15px;border:0;border-radius:11px;background:linear-gradient(135deg,#065f46,#059669);color:#fff;padding:12px;font-size:14px;font-weight:850;cursor:pointer">Se connecter</button><div id="ivGlobalAuthError" role="alert" style="min-height:18px;margin-top:9px;color:#b91c1c;font-size:12px;line-height:1.35"></div><div id="ivGlobalAuthNetwork" style="margin-top:3px;color:#64748b;font-size:11px"></div></form>';
  document.body.appendChild(el);
  el.querySelector("#ivGlobalAuthForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const error=el.querySelector("#ivGlobalAuthError"),button=el.querySelector("#ivGlobalAuthSubmit");
    error.textContent="";button.disabled=true;button.textContent="Connexion…";setStatus("loading","Connexion à Firebase en cours…");
    try{
      await setBestPersistence();
      await auth.signInWithEmailAndPassword(el.querySelector("#ivGlobalAuthEmail").value.trim(),el.querySelector("#ivGlobalAuthPassword").value);
    }catch(ex){
      console.error("Connexion globale Inovtec",ex);
      error.textContent=friendlyError(ex);
      setStatus("error","Connexion Firebase impossible");
    }finally{button.disabled=false;button.textContent="Se connecter"}
  });
  return el;
}
function showLogin(){
  if(!requireAuth)return;
  const el=overlay();
  if(!el)return;
  el.style.display="grid";
  const n=el.querySelector("#ivGlobalAuthNetwork");if(n)n.textContent=navigator.onLine?"":"Aucune connexion Internet détectée.";
}
function hideLogin(){const el=document.getElementById("ivGlobalAuthGateway");if(el)el.style.display="none"}
function childStillLoggedOut(){
  try{
    const d=frame?.contentDocument;if(!d)return false;
    const login=d.getElementById("loginScreen");
    const childView=frame?.contentWindow;
    if(login&&!login.classList.contains("hidden")&&childView?.getComputedStyle(login).display!=="none")return true;
    const modal=d.getElementById("loginModal");
    if(modal&&(modal.classList.contains("open")||modal.getAttribute("aria-hidden")==="false"))return true;
  }catch{}
  return false;
}
function syncFrame(user){
  if(!frame||!user)return;
  setTimeout(async()=>{
    try{
      const childAuth=frame.contentWindow?.firebase?.auth?.();
      if(childAuth&&!childAuth.currentUser){try{await childAuth.updateCurrentUser(user)}catch{}}
      if(childStillLoggedOut()&&reloadedUid!==user.uid){
        reloadedUid=user.uid;
        const u=new URL(frame.src,location.href);u.searchParams.set("authSync",String(Date.now()));frame.src=u.href;
      }
    }catch(error){console.warn("Synchronisation de session du module",error)}
  },500);
}
function boot(){
  if(booted)return;booted=true;
  overlay();
  setBestPersistence().catch(()=>{});
  auth.onAuthStateChanged(user=>{
    if(user){
      hideLogin();
      setStatus("connected","Firebase connecté");
      syncFrame(user);
    }else{
      reloadedUid="";
      if(requireAuth){showLogin();setStatus("error","Connexion Firebase requise")}
      else{hideLogin();setStatus("loading","Outil local")}
    }
  },error=>{
    console.error("État Firebase",error);
    if(requireAuth)showLogin();
    setStatus("error","Firebase indisponible");
  });
  frame?.addEventListener("load",()=>{const user=auth.currentUser;if(user)syncFrame(user)});
  window.addEventListener("offline",()=>{const el=document.getElementById("ivGlobalAuthNetwork");if(el)el.textContent="Aucune connexion Internet détectée.";setStatus("error","Pas de connexion réseau")});
  window.addEventListener("online",()=>{const el=document.getElementById("ivGlobalAuthNetwork");if(el)el.textContent="";if(auth.currentUser)setStatus("connected","Firebase connecté")});
}
if(document.body)boot();else document.addEventListener("DOMContentLoaded",boot,{once:true});
})();
