(()=>{
'use strict';
if(window.__INOVTEC_MATERIEL_TRANSACTIONAL_SYNC_V1__)return;
window.__INOVTEC_MATERIEL_TRANSACTIONAL_SYNC_V1__=true;
const FIELD_IDS=['name','category','brand','reference','serial','status','quantity','minStock','site','location','supplier','supplierContact','price','purchaseDate','warrantyEnd','maintenanceFreq','nextMaintenance','notes'];
const $=id=>document.getElementById(id);
const parse=(s)=>{try{const x=JSON.parse(s);return x&&Array.isArray(x.items)?x:null}catch{return null}};
let db=null,auth=null,doc=null,uid=null,unsubscribe=null,confirmed=false,busy=false,ready=false;
const report=(message)=>{const node=$('syncStatus');if(node)node.textContent=message;};
const backup=(value)=>{try{const k='inovtec_materiel_backup_'+(uid||'unconnected');if(value&&localStorage.getItem(k)!==value)localStorage.setItem(k,value)}catch{}};
function values(){const item={};for(const f of FIELD_IDS){const field=$(f);item[f]=field?String(field.value||'').trim():'';}for(const f of ['quantity','minStock','price']){const n=Number(item[f]);if(!Number.isFinite(n)||n<0||((f!=='price')&&!Number.isSafeInteger(n)))throw Error('Quantité, seuil ou prix incorrect.');item[f]=n;}if(!item.name)throw Error('La désignation est obligatoire.');return item;}
function reset(){try{$('newBtn')?.click()}catch{}}
async function change(kind){
 if(busy)return;
 if(!ready||!confirmed||!db||!doc||!auth?.currentUser||auth.currentUser.uid!==uid){report('Firebase non confirmé : aucune modification effectuée. Vérifiez la connexion.');return;}
 const id=String($('id')?.value||'').trim(),item=kind==='upsert'?values():null;
 if(kind==='delete'&&!id)return;
 if(kind==='delete'&&!confirm('Supprimer ce matériel ?'))return;
 busy=true;report('Enregistrement Firebase en cours…');
 const submit=$('materialForm')?.querySelector('[type="submit"]'),del=$('deleteBtn');
 if(submit)submit.disabled=true;if(del)del.disabled=true;
 try{
  await db.runTransaction(async tx=>{
   const snap=await tx.get(doc),root=snap.exists?(snap.data()||{}):{};
   const entry=root.moduleSyncV1?.materiel;
   const current=entry?.payload?parse(entry.payload):{items:[]};
   if(!current)throw Error('Inventaire distant illisible : aucune donnée remplacée.');
   const items=current.items.slice(),now=new Date().toISOString();
   if(kind==='delete'){
    const index=items.findIndex(x=>String(x?.id||'')===id);
    if(index<0)throw Error('Ce matériel a déjà été supprimé sur un autre appareil. Actualisez la page.');
    items.splice(index,1);
   }else{
    const newId=id||('m_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,11));
    const index=items.findIndex(x=>String(x?.id||'')===newId);
    if(id&&index<0)throw Error('La fiche a été supprimée sur un autre appareil. Actualisez avant de recréer une fiche.');
    const previous=index>=0?items[index]:{};
    const next={...previous,...item,id:newId,updatedAt:now};
    if(index>=0)items[index]=next;else items.push(next);
   }
   tx.set(doc,{moduleSyncV1:{materiel:{...entry,payload:JSON.stringify({...current,items,updatedAt:now}),updatedAt:now,updatedAtMs:Date.now()}}},{merge:true});
  });
  report('Firebase synchronisé · enregistrement confirmé');reset();
 }catch(e){console.warn('Matériel : transaction non enregistrée',e);report('Sauvegarde refusée : '+String(e?.message||e?.code||'Firebase indisponible'));}
 finally{busy=false;if(submit)submit.disabled=false;if(del)del.disabled=false;}
}
function interceptSubmit(event){if(event.target?.id!=='materialForm')return;event.preventDefault();event.stopImmediatePropagation();try{change('upsert')}catch(e){report(String(e?.message||e))}}
function interceptDelete(event){if(!event.target?.closest?.('#deleteBtn'))return;event.preventDefault();event.stopImmediatePropagation();change('delete');}
// Capture avant les anciens gestionnaires : ils remplacent sinon le document entier
// avec une copie du navigateur, ce qui peut annuler une réception Réassort concurrente.
document.addEventListener('submit',interceptSubmit,true);
document.addEventListener('click',interceptDelete,true);
function start(user){
 if(unsubscribe){try{unsubscribe()}catch{}unsubscribe=null;}
 uid=user?.uid||null;doc=null;confirmed=false;ready=false;
 if(!uid){report('Connexion Firebase requise · aucune écriture locale non partagée');return;}
 doc=db.collection('kanban').doc(uid);report('Vérification de la connexion Firebase…');
 unsubscribe=doc.onSnapshot({includeMetadataChanges:true},snap=>{
  const entry=snap.exists?snap.data()?.moduleSyncV1?.materiel:null;
  if(entry?.payload&&!parse(entry.payload)){confirmed=false;ready=false;report('Inventaire Firebase illisible · écriture bloquée');return;}
  confirmed=!snap.metadata?.fromCache&&!snap.metadata?.hasPendingWrites;
  ready=true;
  if(!busy)report(confirmed?'Firebase synchronisé · serveur confirmé':'Firebase en cache ou écriture en attente · modifications suspendues');
 },error=>{confirmed=false;ready=false;console.warn('Matériel : lecture Firebase',error);report('Connexion Firebase indisponible · modifications suspendues');});
}
function boot(){
 if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG||!firebase.auth||!firebase.firestore){setTimeout(boot,150);return;}
 try{if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);auth=firebase.auth();db=firebase.firestore();auth.onAuthStateChanged(start);
 window.addEventListener('offline',()=>{confirmed=false;report('Hors ligne · modifications suspendues pour éviter toute perte');});
 window.addEventListener('online',()=>{if(uid)doc.get({source:'server'}).then(()=>{}).catch(e=>{confirmed=false;report('Firebase indisponible : '+String(e?.code||e?.message||e));});});
 }catch(e){console.warn('Matériel : initialisation Firebase',e);report('Initialisation Firebase impossible · modifications suspendues');}
}
boot();
})();