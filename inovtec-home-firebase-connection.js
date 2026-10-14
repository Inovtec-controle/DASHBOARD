/* Optional Firebase sign-in/retry on the dashboard, including fresh mobile browsers.
   Authentication only: business data remain exclusively managed by existing modules. */
(()=>{
"use strict";
if(window.__IV_HOME_FIREBASE_CONNECTION_V1__)return;
window.__IV_HOME_FIREBASE_CONNECTION_V1__=true;
const host=document.querySelector(".c3-content");
if(!host)return;
const style=document.createElement("style");
style.textContent=`
#ivHomeFirebaseConnect{margin:0 0 18px;padding:16px 18px;background:#effaf3;color:#164734;border:1px solid #b9dfc8;border-radius:15px;box-shadow:0 3px 12px #065f4610}
#ivHomeFirebaseConnect[hidden],#ivHomeFirebaseConnect [hidden]{display:none!important}
#ivHomeFirebaseConnect h2{font-size:17px;margin:0 0 5px;color:#125438}
#ivHomeFirebaseConnect p{font-size:13px;line-height:1.45;margin:0 0 12px}
#ivHomeFirebaseConnect form{display:flex;flex-wrap:wrap;align-items:end;gap:10px}
#ivHomeFirebaseConnect label{display:grid;gap:4px;font-size:12px;font-weight:700;flex:1;min-width:165px}
#ivHomeFirebaseConnect input{width:100%;box-sizing:border-box;min-height:42px;border:1px solid #b4cfbf;border-radius:8px;background:white;color:#173c2c;font:16px system-ui;padding:8px 10px}
#ivHomeFirebaseConnect button{min-height:42px;cursor:pointer;border:0;border-radius:8px;background:#087849;color:white;font-weight:700;padding:10px 17px}
#ivHomeFirebaseConnect button:disabled{opacity:.65;cursor:wait}
#ivHomeFirebaseConnect [data-message]{margin:10px 0 0;color:#a13232;font-size:13px}
@media(max-width:620px){#ivHomeFirebaseConnect{padding:14px}#ivHomeFirebaseConnect form{display:grid}#ivHomeFirebaseConnect label{min-width:0}}
`;
document.head.appendChild(style);
const box=document.createElement("section");
box.id="ivHomeFirebaseConnect";box.hidden=true;box.setAttribute("aria-label","Connexion Firebase");
box.innerHTML=`<h2>Synchronisation Firebase</h2><p data-description>Connecte ce téléphone avec le même compte Inovtec que sur ton ordinateur pour retrouver les données partagées.</p>
<form data-login autocomplete="on">
<label>Adresse e-mail<input name="email" type="email" required autocomplete="username" autocapitalize="none" spellcheck="false"></label>
<label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
<button type="submit">Se connecter</button>
</form>
<button data-retry type="button" hidden>Réessayer la connexion Firebase</button>
<p data-message role="status" aria-live="polite" hidden></p>`;
host.insertBefore(box,host.firstChild);
const form=box.querySelector("[data-login]"),retry=box.querySelector("[data-retry]");
const desc=box.querySelector("[data-description]"),msg=box.querySelector("[data-message]");
function message(t){msg.textContent=t||"";msg.hidden=!t}
function explain(e){
 const code=String(e?.code||"");
 if(/network|unavailable|timeout/.test(code))return "Réseau indisponible : vérifie la connexion du téléphone puis réessaie.";
 if(/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code))return "Identifiants incorrects : utilise le compte Inovtec habituel.";
 if(/too-many-requests/.test(code))return "Trop de tentatives : réessaie ultérieurement.";
 return "Connexion impossible : "+(code||"réessaie après avoir vérifié le réseau.");
}
const sdk=window.firebase;
if(!sdk?.auth){
 box.hidden=false;form.hidden=true;
 desc.textContent="Firebase ne s'est pas chargé sur cet appareil. Recharge la page avec une connexion Internet.";
 return;
}
let auth;
try{
 // L'accueil utilise Firebase avant dashboard-index.js : initialiser l'app
 // ici évite qu'auth() échoue sur Chrome/Edge alors que les autres pages fonctionnent.
 if(!sdk.apps.length){
  if(!window.INOVTEC_FIREBASE_CONFIG)throw new Error("Configuration Firebase absente");
  sdk.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
 }
 auth=sdk.auth();
}catch(e){
 console.warn("Connexion Firebase accueil : initialisation indisponible",e);
 box.hidden=false;form.hidden=true;
 desc.textContent="Impossible de démarrer la connexion Firebase sur cet appareil.";
 return;
}
let signedIn=false;
function render(){
 const failure=window.InovtecFirebaseOperational?.ok===false;
 box.hidden=signedIn&&!failure;
 form.hidden=signedIn;retry.hidden=!signedIn||!failure;
 desc.textContent=signedIn
  ?"La lecture des données Firebase a échoué. Une nouvelle vérification peut rétablir la connexion sans modifier les données."
  :"Connecte ce téléphone avec le même compte Inovtec que sur ton ordinateur pour retrouver les données partagées.";
}
auth.onAuthStateChanged(user=>{
 signedIn=!!user;
 if(user){form.elements.namedItem("password").value="";message("")}
 render();
},e=>{signedIn=false;render();message(explain(e))});
form.addEventListener("submit",async e=>{
 e.preventDefault();const button=form.querySelector('button[type="submit"]');
 button.disabled=true;message("");
 try{
  const P=sdk.auth.Auth.Persistence;
  for(const mode of [P.LOCAL,P.SESSION,P.NONE]){
   try{await auth.setPersistence(mode);break}catch(_e){}
  }
  await auth.signInWithEmailAndPassword(
   form.elements.namedItem("email").value.trim(),
   form.elements.namedItem("password").value
  );
 }catch(error){message(explain(error))}
 finally{button.disabled=false}
});
retry.addEventListener("click",()=>{
 message("Nouvelle vérification Firebase en cours…");
 if(typeof window.InovtecFirebaseOperationalRetry==="function")window.InovtecFirebaseOperationalRetry();
 else message("Recharge la page pour relancer la connexion Firebase.");
});
window.addEventListener("inovtec:firebase-operational",()=>{render();if(window.InovtecFirebaseOperational?.ok===true)message("")});
window.addEventListener("online",render);
})();