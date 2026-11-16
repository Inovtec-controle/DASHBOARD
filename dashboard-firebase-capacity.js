/* Accueil INOVTEC : mesure du seul document personnel kanban/{uid}.
   Lecture serveur et exports locaux uniquement : aucune suppression Firebase. */
(()=>{
"use strict";
if(window.__IV_CAPACITY_DASHBOARD_V1__)return;
window.__IV_CAPACITY_DASHBOARD_V1__=true;
const MAX_BYTES=1048576, $=id=>document.getElementById(id);
const bytesOf=value=>new Blob([JSON.stringify(value)]).size;
const kib=n=>(n/1024).toFixed(0)+" Kio";
let signedUid="",docRef=null,unsubscribe=null,lastServerData=null,loading=false;
function setMessage(message,bad=false){
 const node=$("ivCapFeedback");
 if(node){node.textContent=message;node.dataset.error=bad?"1":"0"}
}
function level(pct){
 if(pct>=95)return {name:"critique",message:"Capacité critique : évite les nouvelles écritures volumineuses."};
 if(pct>=85)return {name:"urgent",message:"Alerte : prépare un archivage des anciennes données."};
 if(pct>=70)return {name:"warning",message:"Sauvegarde conseillée : le document dépasse 70 %."};
 return {name:"normal",message:"Marge disponible. Une sauvegarde régulière reste recommandée."};
}
function render(data,server=true){
 lastServerData=data;
 const bytes=bytesOf(data),pct=Math.round(bytes/MAX_BYTES*100),lvl=level(pct);
 const root=$("ivCapWidget"),label=$("ivCapText"),meter=$("ivCapFill");
 if(root){root.dataset.level=lvl.name;root.setAttribute("aria-label","Document Firebase principal : "+pct+" pour cent utilisé")}
 if(label)label.textContent=pct+" %";
 if(meter){meter.style.width=Math.min(100,Math.max(0,pct))+"%";meter.setAttribute("aria-valuenow",String(Math.max(0,Math.min(100,pct))))}
 const state=$("ivCapState"),size=$("ivCapSize"),alert=$("ivCapAlert"),details=$("ivCapBreakdown");
 if(state)state.textContent=server?"Document principal — "+pct+" %":"Mesure non vérifiée";
 if(size)size.textContent=kib(bytes)+" / 1 024 Kio (estimation JSON)";
 if(alert)alert.textContent=lvl.message;
 if(details){
   const modules=data&&data.moduleSyncV1&&typeof data.moduleSyncV1==="object"?data.moduleSyncV1:{};
   const arr=Object.entries(modules).map(([name,item])=>({name,size:bytesOf(item)})).sort((a,b)=>b.size-a.size);
   details.textContent=arr.slice(0,7).map(x=>x.name+" : "+kib(x.size)).join(" • ")||"Aucun module détaillé";
 }
}
function reset(message){
 lastServerData=null;
 const root=$("ivCapWidget"),label=$("ivCapText"),meter=$("ivCapFill");
 if(root)root.dataset.level="unknown";
 if(label)label.textContent="—";
 if(meter)meter.style.width="0%";
 if($("ivCapState"))$("ivCapState").textContent=message;
 if($("ivCapSize"))$("ivCapSize").textContent="—";
 if($("ivCapAlert"))$("ivCapAlert").textContent="Aucune donnée n'est modifiée par cette jauge.";
 if($("ivCapBreakdown"))$("ivCapBreakdown").textContent="—";
}
async function readServer(){
 if(!docRef||!signedUid)throw Error("Compte Firebase non connecté");
 const uid=signedUid,ref=docRef;
 const snap=await ref.get({source:"server"});
 if(uid!==signedUid)throw Error("Le compte a changé : relance l'opération");
 if(!snap.exists)throw Error("Document Firebase personnel introuvable");
 const data=snap.data()||{};
 render(data,true);
 return data;
}
async function refresh(){
 if(loading)return;
 loading=true;
 setMessage("Lecture des données Firebase en cours…");
 try{await readServer();setMessage("Mesure actualisée depuis le serveur.")}catch(err){setMessage("Impossible de vérifier la capacité : "+(err.code||err.message||"erreur"),true)}
 finally{loading=false}
}
function fileStamp(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function download(filename,content){
 const blob=new Blob([JSON.stringify(content,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename;a.style.display="none";document.body.appendChild(a);
 try{a.click()}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
}
async function exportPersonal(){
 if(loading)return;
 loading=true;
 setMessage("Préparation de la sauvegarde du document principal…");
 try{
   const data=await readServer();
   const backup={format:"inovtec-personal-backup-v1",createdAt:new Date().toISOString(),projectId:"inovtec-chantiers",scope:"kanban/{uid} (document principal seulement)",accountUid:signedUid,document:data};
   download("INOVTEC-sauvegarde-principale-"+fileStamp()+".json",backup);
   setMessage("Téléchargement lancé. Vérifie le fichier dans Téléchargements avant toute opération d'archivage.");
 }catch(err){setMessage("Sauvegarde non créée : "+(err.code||err.message||"erreur"),true)}
 finally{loading=false}
}
function mondayOfISOweek(key){
 const m=/^(\d{4})-W(\d{2})$/.exec(String(key));
 if(!m)return null;
 const y=Number(m[1]),w=Number(m[2]);
 if(y<2000||y>2100||w<1||w>53)return null;
 const jan4=new Date(Date.UTC(y,0,4));
 const dow=(jan4.getUTCDay()+6)%7;
 const monday=new Date(jan4.getTime()+(w-1)*604800000-dow*86400000);
 if(monday.getUTCFullYear()<y-1||monday.getUTCFullYear()>y+1)return null;
 return monday;
}
function oldWeeks(planning,months){
 const cutoff=new Date();
 cutoff.setMonth(cutoff.getMonth()-months);
 const list=Object.entries(planning.weeks||{}).filter(([key,value])=>{
  const date=mondayOfISOweek(key);
  return date&&date.getTime()<cutoff.getTime()&&Array.isArray(value)&&value.length>0;
 });
 list.sort((a,b)=>a[0].localeCompare(b[0]));
 return list;
}
async function exportOldWeeks(){
 if(loading)return;
 loading=true;
 setMessage("Recherche des anciennes semaines dans Firebase…");
 try{
   const data=await readServer(),str=data?.moduleSyncV1?.planning?.payload;
   if(typeof str!=="string")throw Error("Le Planning principal est absent");
   const planning=JSON.parse(str);
   if(!planning||typeof planning!=="object"||!planning.weeks||Array.isArray(planning.weeks))throw Error("Format Planning incompatible : aucune archive créée");
   const months=Number($("ivCapMonths")?.value||12);
   const list=oldWeeks(planning,months);
   if(!list.length){setMessage("Aucune semaine antérieure à "+months+" mois à exporter. Aucun changement réalisé.");return}
   const weeks=Object.fromEntries(list);
   const archive={format:"inovtec-planning-weeks-archive-v1",createdAt:new Date().toISOString(),projectId:"inovtec-chantiers",accountUid:signedUid,olderThanMonths:months,weekCount:list.length,agents:planning.agents||[],weeks};
   download("INOVTEC-anciennes-semaines-"+months+"mois-"+fileStamp()+".json",archive);
   setMessage(list.length+" semaine(s) copiée(s) dans une archive JSON. Rien n'a été effacé de Firebase.");
 }catch(err){setMessage("Export des anciennes semaines impossible : "+(err.code||err.message||"erreur"),true)}
 finally{loading=false}
}
function openModal(){
 $("ivCapModal").hidden=false;
 document.body.classList.add("iv-cap-modal-open");
 if(!signedUid)setMessage("Connecte-toi à Firebase pour consulter la capacité.",true);
 else setMessage("Sauvegarde recommandée sur ordinateur ; les fichiers peuvent contenir des informations confidentielles.");
 $("ivCapClose").focus();
}
function closeModal(){$("ivCapModal").hidden=true;document.body.classList.remove("iv-cap-modal-open");$("ivCapToggle").focus()}
function bindUser(user){
 if(unsubscribe){try{unsubscribe()}catch{}unsubscribe=null}
 signedUid=user?.uid||"";docRef=null;
 if(!signedUid){reset("Connexion Firebase requise");setMessage("Connecte-toi d'abord à Firebase.");return}
 docRef=firebase.firestore().collection("kanban").doc(signedUid);
 reset("Chargement depuis Firebase…");
 unsubscribe=docRef.onSnapshot({includeMetadataChanges:true},snapshot=>{
   if(snapshot.metadata?.fromCache||snapshot.metadata?.hasPendingWrites)return;
   if(snapshot.exists)render(snapshot.data()||{},true);
   else reset("Document personnel absent");
 },err=>{setMessage("Suivi de capacité interrompu : "+(err.code||err.message||"erreur"),true)});
}
function boot(){
 $("ivCapToggle")?.addEventListener("click",openModal);
 $("ivCapClose")?.addEventListener("click",closeModal);
 $("ivCapModal")?.addEventListener("click",ev=>{if(ev.target?.id==="ivCapModal")closeModal()});
 document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&!$("ivCapModal").hidden)closeModal()});
 $("ivCapRefresh")?.addEventListener("click",()=>void refresh());
 $("ivCapBackup")?.addEventListener("click",()=>void exportPersonal());
 $("ivCapArchive")?.addEventListener("click",()=>void exportOldWeeks());
 if(!window.firebase?.auth||!window.firebase?.firestore){reset("Firebase indisponible");return}
 try{if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);firebase.auth().onAuthStateChanged(bindUser)}
 catch(err){reset("Initialisation impossible");setMessage(String(err.message||err),true)}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();