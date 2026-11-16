/* Nettoyage conservateur du doublon du planning. Aucun champ métier n'est effacé. */
(()=>{
"use strict";
if(window.top!==window||window.__IV_FIREBASE_CAPACITY_V1__)return;
window.__IV_FIREBASE_CAPACITY_V1__=true;
let authBound=false,busy=false,doneUid="",lastAttemptUid="",lastAttemptTime=0;
function publish(state,detail=""){
  const event={state,detail,checkedAt:new Date().toISOString()};
  window.InovtecFirebaseCapacityFix=event;
  try{window.dispatchEvent(new CustomEvent("inovtec:firebase-capacity",{detail:event}))}catch(_e){}
}
async function repair(uid){
  if(!uid||busy||doneUid===uid||navigator.onLine===false)return;
  if(lastAttemptUid===uid&&Date.now()-lastAttemptTime<15000)return;
  lastAttemptUid=uid;lastAttemptTime=Date.now();busy=true;
  const db=firebase.firestore(),ref=db.collection("kanban").doc(uid);
  let outcome="not-needed";
  try{
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      const data=snap.exists?(snap.data()||{}):{};
      const primary=data?.moduleSyncV1?.planning?.payload;
      const backup=data?.planningDirectV1?.payload;
      if(typeof backup!=="string"||!backup){outcome="not-needed";return}
      if(typeof primary!=="string"||!primary||primary!==backup){
        outcome="different-copies";return;
      }
      tx.update(ref,{planningDirectV1:firebase.firestore.FieldValue.delete()});
      outcome="removed-identical-backup";
    });
    if(outcome==="removed-identical-backup"){
      const verified=await ref.get({source:"server"});
      if(verified.data()?.planningDirectV1?.payload){
        throw Error("La suppression du doublon n'a pas été confirmée par Firebase");
      }
      publish("repaired","Copie secondaire identique supprimée ; planning principal conservé");
    }else if(outcome==="different-copies"){
      publish("blocked","Copies du Planning différentes : aucune donnée modifiée");
    }else{
      publish("ok","Pas de doublon de Planning à retirer");
    }
    if(outcome!=="different-copies")doneUid=uid;
  }catch(error){
    console.warn("Réparation de capacité Firebase non confirmée",error?.code||error?.message||error);
    publish("error",String(error?.code||error?.message||"Erreur de transaction"));
  }finally{busy=false}
}
function boot(){
  if(authBound)return;
  if(!window.firebase?.auth||!window.firebase?.firestore||!window.INOVTEC_FIREBASE_CONFIG){
    setTimeout(boot,250);return;
  }
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    authBound=true;
    firebase.auth().onAuthStateChanged(user=>{
      if(!user){doneUid="";publish("signed-out");return}
      void repair(user.uid);
    });
    window.addEventListener("online",()=>{const uid=firebase.auth().currentUser?.uid;if(uid)void repair(uid)});
  }catch(error){authBound=false;console.warn("Initialisation réparation Firebase",error)}
}
boot();
})();