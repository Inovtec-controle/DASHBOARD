(()=>{
"use strict";
const params=new URLSearchParams(location.search);
if((params.get("mode")||"").toLowerCase()!=="infos")return;
if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG)return;
if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
const auth=firebase.auth();
const db=firebase.firestore();
const frame=document.getElementById("legacyFrame");
let verifiedUid="",frameSyncTimer=null,reloadedForUid="",verifyBusy=false;
const VERIFY_TIMEOUT=9000;

function setIndicator(state,message){
  try{window.InovtecFirebaseIndicator?.setState?.(state,message)}catch{}
  try{window.dispatchEvent(new CustomEvent("inovtec:firebase-status",{detail:{state,message,source:"info-auth-bridge"}}))}catch{}
  const mirror=document.getElementById("syncMirror");if(mirror)mirror.textContent=message||"Firebase";
}
function withTimeout(promise,ms=VERIFY_TIMEOUT){
  let timer;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error("Firebase timeout");e.code="timeout";reject(e)},ms)})
  ]).finally(()=>clearTimeout(timer));
}
async function setBestPersistence(){
  const P=firebase.auth.Auth.Persistence;
  for(const mode of [P.LOCAL,P.SESSION,P.NONE]){try{await auth.setPersistence(mode);return mode}catch{}}
  return null;
}
function box(){
  let el=document.getElementById("ivInfosAuthBridge");
  if(el)return el;
  el=document.createElement("div");
  el.id="ivInfosAuthBridge";
  el.style.cssText="position:fixed;inset:0;z-index:100000;display:none;place-items:center;background:rgba(3,33,25,.52);backdrop-filter:blur(5px);padding:16px";
  el.innerHTML='<form id="ivInfosAuthForm" style="width:min(410px,100%);background:#fff;border:1px solid #dce9e3;border-radius:20px;padding:20px;box-shadow:0 26px 70px rgba(3,33,25,.28);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif"><h2 style="margin:0 0 6px;color:#123d30;font-size:21px">Connexion Inovtec</h2><p style="margin:0 0 15px;color:#667b70;font-size:13px;line-height:1.45">Connecte-toi ici pour utiliser Infos chantier sur ordinateur et téléphone avec les mêmes données Firebase.</p><label style="display:block;margin:8px 0 5px;font-size:12px;font-weight:800;color:#28473c">Adresse email</label><input id="ivInfosAuthEmail" type="email" autocomplete="username" required style="width:100%;box-sizing:border-box;border:1px solid #cfe0d7;border-radius:11px;padding:12px;font-size:16px"><label style="display:block;margin:11px 0 5px;font-size:12px;font-weight:800;color:#28473c">Mot de passe</label><input id="ivInfosAuthPassword" type="password" autocomplete="current-password" required style="width:100%;box-sizing:border-box;border:1px solid #cfe0d7;border-radius:11px;padding:12px;font-size:16px"><button id="ivInfosAuthSubmit" type="submit" style="width:100%;margin-top:15px;border:0;border-radius:11px;background:linear-gradient(135deg,#065f46,#059669);color:#fff;padding:12px;font-size:14px;font-weight:850;cursor:pointer">Se connecter</button><div id="ivInfosAuthError" role="alert" style="min-height:18px;margin-top:9px;color:#b91c1c;font-size:12px;line-height:1.35"></div></form>';
  document.body.appendChild(el);
  el.querySelector("#ivInfosAuthForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const err=el.querySelector("#ivInfosAuthError"),btn=el.querySelector("#ivInfosAuthSubmit");
    err.textContent="";btn.disabled=true;btn.textContent="Connexion…";setIndicator("loading","Connexion à Firebase en cours…");
    try{
      await setBestPersistence();
      await auth.signInWithEmailAndPassword(el.querySelector("#ivInfosAuthEmail").value.trim(),el.querySelector("#ivInfosAuthPassword").value);
    }catch(ex){
      console.error("Connexion Infos chantier",ex);
      err.textContent="Connexion impossible. Vérifie l’adresse email et le mot de passe.";
      setIndicator("error","Connexion Firebase impossible");
    }finally{btn.disabled=false;btn.textContent="Se connecter"}
  });
  return el;
}
function showLogin(){box().style.display="grid"}
function hideLogin(){const el=document.getElementById("ivInfosAuthBridge");if(el)el.style.display="none"}

async function firestoreProbe(user){
  try{await withTimeout(db.enableNetwork(),3500)}catch{}
  try{
    return await withTimeout(db.collection("chantiers").limit(1).get({source:"server"}));
  }catch(first){
    const code=String(first?.code||"");
    if(/unauthenticated|permission-denied/.test(code)){
      try{await withTimeout(user.getIdToken(true),6000)}catch{}
      return withTimeout(db.collection("chantiers").limit(1).get({source:"server"}));
    }
    throw first;
  }
}
async function verifyFirestore(user,force=false){
  if(!user)return false;
  if(!force&&verifiedUid===user.uid){setIndicator("connected","Firebase connecté · chantiers synchronisés");return true}
  if(verifyBusy)return false;
  if(!navigator.onLine){setIndicator("error","Pas de connexion réseau");return false}
  verifyBusy=true;
  setIndicator("loading","Vérification Firebase…");
  try{
    try{
      await firestoreProbe(user);
    }catch(first){
      setIndicator("loading","Reconnexion Firebase…");
      await new Promise(resolve=>setTimeout(resolve,1200));
      await firestoreProbe(user);
    }
    verifiedUid=user.uid;
    setIndicator("connected","Firebase connecté · chantiers synchronisés");
    return true;
  }catch(error){
    console.error("Vérification Firestore Infos chantier",error);
    const code=String(error?.code||"");
    setIndicator("error",code==="timeout"?"Firebase ne répond pas":"Firebase connecté mais accès aux chantiers impossible");
    return false;
  }finally{verifyBusy=false}
}
function forceFrameReload(user){
  if(!frame||!user||reloadedForUid===user.uid)return;
  reloadedForUid=user.uid;
  try{const u=new URL(frame.src,location.href);u.searchParams.set("authSync",String(Date.now()));frame.src=u.href}catch{}
}
async function syncFrameAuth(){
  clearTimeout(frameSyncTimer);
  const user=auth.currentUser;if(!user||!frame)return;
  frameSyncTimer=setTimeout(async()=>{
    try{
      const w=frame.contentWindow,d=frame.contentDocument,childAuth=w?.firebase?.auth?.();
      if(childAuth&&!childAuth.currentUser){
        try{await childAuth.updateCurrentUser(user)}catch(e){console.warn("Pont Auth vers Infos chantier",e)}
      }
      if(childAuth?.currentUser){
        const login=d?.getElementById("loginScreen"),app=d?.getElementById("app");
        if(login&&app){login.classList.add("hidden");app.classList.remove("hidden")}
        return;
      }
      setTimeout(()=>{
        try{const ca=frame.contentWindow?.firebase?.auth?.();if(auth.currentUser&&!ca?.currentUser)forceFrameReload(auth.currentUser)}catch{}
      },650);
    }catch(e){console.warn("Synchronisation iframe Infos chantier",e)}
  },300);
}

setBestPersistence().catch(()=>{});
auth.onAuthStateChanged(async user=>{
  if(!user){verifiedUid="";reloadedForUid="";showLogin();setIndicator("error","Compte Firebase non connecté");return}
  hideLogin();
  await verifyFirestore(user,true);
  syncFrameAuth();
});
frame?.addEventListener("load",()=>syncFrameAuth());
window.addEventListener("online",()=>{const u=auth.currentUser;if(u){verifiedUid="";verifyFirestore(u,true)}});
window.addEventListener("offline",()=>setIndicator("error","Pas de connexion réseau"));
window.addEventListener("focus",()=>{const u=auth.currentUser;if(u)verifyFirestore(u,false)});
box();
})();
