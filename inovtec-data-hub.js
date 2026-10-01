(()=>{
"use strict";
try{if(parent&&parent!==window&&parent.InovtecDataHub){window.InovtecDataHub=parent.InovtecDataHub;return}}catch{}
const client="hub_"+Date.now()+"_"+Math.random().toString(16).slice(2);
let user=null,docRef=null,agentRecords=[],chantiers=[],referentialLinks={},referentialUnresolvedSites=[],readyAgents=false,readyChantiers=false,firebaseAgentsOk=false,firebaseSitesOk=false,unsubDoc=null,unsubSites=null;
const listeners=new Set();
let lastEmitSignature="";
const clone=v=>JSON.parse(JSON.stringify(v));
const parse=s=>{try{return JSON.parse(s)}catch{return null}};
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function displayName(a){const i=a?.identity||{};return [i.prenom,i.nom].filter(Boolean).join(" ").trim()||a?.deletedDisplayName||a?.displayName||a?.name||"Agent sans nom"}
const isDeletedAgent=a=>!!(a&&a._deleted===true);
const isArchivedAgent=a=>!!(a&&a.archivedAt);
const agentHasName=a=>!!([a?.identity?.prenom,a?.identity?.nom,a?.displayName,a?.name].map(v=>String(v||"").trim()).filter(v=>v&&!/^(agent|sans nom|agent sans nom)$/i.test(v)).join(" "));
function compactAgent(a){return{id:String(a.id||""),createdAt:a.createdAt||new Date().toISOString(),updatedAt:a.updatedAt||new Date().toISOString(),identity:clone(a.identity||{}),job:clone(a.job||{}),displayName:displayName(a),source:"classeur"}}
function splitName(label){const p=String(label||"").trim().split(/\s+/).filter(Boolean);return{prenom:p.shift()||"",nom:p.join(" ")}}
function publicAgents(){return agentRecords.filter(a=>a&&a.id&&!isDeletedAgent(a)&&!isArchivedAgent(a)&&agentHasName(a)).map(a=>({...compactAgent(a),name:displayName(a)})).sort((a,b)=>displayName(a).localeCompare(displayName(b),"fr",{sensitivity:"base",numeric:true}))}
function publicSites(){return chantiers.slice().sort((a,b)=>String(a.nom||a.adresse||"").localeCompare(String(b.nom||b.adresse||""),"fr",{sensitivity:"base",numeric:true}))}
function emit(force=false){const detail={agents:publicAgents(),chantiers:publicSites(),referentialLinks:clone(referentialLinks),referentialUnresolvedSites:clone(referentialUnresolvedSites),readyAgents,readyChantiers,firebaseAgentsOk,firebaseSitesOk};let signature="";try{signature=JSON.stringify([readyAgents,readyChantiers,detail.agents,detail.chantiers,detail.referentialLinks,detail.referentialUnresolvedSites])}catch{}if(!force&&signature&&signature===lastEmitSignature)return;if(signature)lastEmitSignature=signature;listeners.forEach(fn=>{try{fn(detail)}catch{}});try{window.dispatchEvent(new CustomEvent("inovtec:datahub",{detail}))}catch{}if(firebaseAgentsOk&&firebaseSitesOk&&window.InovtecFirebaseOperational?.ok!==true){window.InovtecFirebaseOperational={ok:true,checkedAt:new Date().toISOString(),projectId:window.INOVTEC_FIREBASE_CONFIG?.projectId||"",source:"datahub"};try{window.dispatchEvent(new CustomEvent("inovtec:firebase-operational",{detail:window.InovtecFirebaseOperational}))}catch{}}}
function readAgentsFromDoc(data){const entry=data?.moduleSyncV1?.agents,payload=parse(entry?.payload||"");if(Array.isArray(payload))return payload;const refs=Array.isArray(data?.referentialAgents)?data.referentialAgents:null;if(refs)return refs.map(a=>({...a,docs:[],incidents:[]}));return[]}
function start(u){if(unsubDoc){try{unsubDoc()}catch{}unsubDoc=null}if(unsubSites){try{unsubSites()}catch{}unsubSites=null}user=u||null;docRef=null;readyAgents=false;readyChantiers=false;firebaseAgentsOk=false;firebaseSitesOk=false;referentialLinks={};referentialUnresolvedSites=[];if(!user){agentRecords=[];chantiers=[];readyAgents=false;readyChantiers=false;emit();return}docRef=firebase.firestore().collection("kanban").doc(user.uid);unsubDoc=docRef.onSnapshot(s=>{const data=s.exists?(s.data()||{}):{};agentRecords=readAgentsFromDoc(data);referentialLinks=data?.referentialLinks&&typeof data.referentialLinks==="object"?clone(data.referentialLinks):{};referentialUnresolvedSites=Array.isArray(data?.referentialUnresolvedSites)?clone(data.referentialUnresolvedSites):[];readyAgents=true;firebaseAgentsOk=true;emit()},e=>{console.warn("DataHub agents",e);agentRecords=[];readyAgents=false;firebaseAgentsOk=false;emit()});unsubSites=firebase.firestore().collection("chantiers").orderBy("nom").onSnapshot(s=>{chantiers=s.docs.map(d=>({id:d.id,...(d.data()||{})})).filter(c=>c._hidden!==true);readyChantiers=true;firebaseSitesOk=true;emit()},e=>{console.warn("DataHub chantiers",e);readyChantiers=true;firebaseSitesOk=false;emit()})}
async function mutateAgents(mutator,reason){
  if(!docRef||!user)throw new Error("Connexion Firebase requise");
  let committed=[];
  await firebase.firestore().runTransaction(async tx=>{
    const snap=await tx.get(docRef);
    const current=readAgentsFromDoc(snap.exists?(snap.data()||{}):{});
    const next=mutator(clone(current));
    if(!Array.isArray(next))throw new Error("Mutation Agents invalide");
    const now=Date.now(),refs=next.filter(a=>!isDeletedAgent(a)&&!isArchivedAgent(a)&&agentHasName(a)).map(compactAgent);
    tx.set(docRef,{moduleSyncV1:{agents:{payload:JSON.stringify(next),updatedAtMs:now,client,reason:reason||"data-hub",compact:false,version:8}},referentialAgents:refs,referentialUpdatedAtIso:new Date(now).toISOString()},{merge:true});
    committed=next;
  });
  agentRecords=clone(committed);
  readyAgents=true;
  emit();
  return committed;
}
async function createAgent(label){
  label=String(label||"").trim();
  if(!label||/^(agent|sans nom|agent sans nom)$/i.test(label))throw new Error("Nom d’agent requis");
  const n=splitName(label),now=new Date().toISOString(),a={id:"agent_"+Math.random().toString(16).slice(2)+"_"+Date.now().toString(16),createdAt:now,updatedAt:now,identity:{prenom:n.prenom,nom:n.nom,telephone:"",email:"",adresse:"",dateNaissance:"",secu:"",permis:"",vehicule:""},job:{poste:"",typeContrat:"",dateEntree:"",sitePrincipal:"",disponibilites:"",notes:"",planningCopies:2},docs:[],incidents:[]};
  await mutateAgents(rows=>[...rows,a],"create-agent-from-planning");
  return compactAgent(a);
}
async function renameAgent(id,label){
  label=String(label||"").trim();
  if(!label||/^(agent|sans nom|agent sans nom)$/i.test(label))return false;
  let changed=false;
  const n=splitName(label);
  await mutateAgents(rows=>rows.map(a=>{
    if(a?.id!==id||isDeletedAgent(a))return a;
    const next=clone(a);next.identity=next.identity||{};next.identity.prenom=n.prenom;next.identity.nom=n.nom;next.updatedAt=new Date().toISOString();changed=true;return next;
  }),"rename-agent-from-planning");
  return changed;
}
async function setAgentPlanningCopies(id,value){
  const n=Math.max(2,Math.min(10,Math.round(Number(value)||2)));
  let changed=false;
  await mutateAgents(rows=>rows.map(a=>{
    if(a?.id!==id||isDeletedAgent(a))return a;
    const next=clone(a);next.job=next.job||{};next.job.planningCopies=n;next.updatedAt=new Date().toISOString();changed=true;return next;
  }),"planning-copies");
  return changed?n:false;
}
async function deleteAgent(id){
  let changed=false;
  await mutateAgents(rows=>rows.map(current=>{
    if(current?.id!==id||isDeletedAgent(current))return current;
    const now=new Date().toISOString(),i=current.identity||{},name=displayName(current);changed=true;
    return{id:String(current.id),_deleted:true,deletedAt:now,updatedAt:now,createdAt:current.createdAt||now,deletedDisplayName:name,identity:{prenom:i.prenom||"",nom:i.nom||""},job:{},docs:[],incidents:[]};
  }),"delete-agent-from-planning");
  return changed;
}
function findChantier(value){const n=norm(value);if(!n)return null;return chantiers.find(c=>String(c.id)===String(value)||norm(c.nom)===n||norm(c.adresse)===n)||null}
function subscribe(fn){if(typeof fn!=="function")return()=>{};listeners.add(fn);try{fn({agents:publicAgents(),chantiers:publicSites(),referentialLinks:clone(referentialLinks),referentialUnresolvedSites:clone(referentialUnresolvedSites),readyAgents,readyChantiers,firebaseAgentsOk,firebaseSitesOk})}catch{}return()=>listeners.delete(fn)}
window.InovtecDataHub={get agents(){return publicAgents()},get chantiers(){return publicSites()},get referentialLinks(){return clone(referentialLinks)},get referentialUnresolvedSites(){return clone(referentialUnresolvedSites)},get readyAgents(){return readyAgents},get readyChantiers(){return readyChantiers},get firebaseAgentsOk(){return firebaseAgentsOk},get firebaseSitesOk(){return firebaseSitesOk},displayName,findChantier,subscribe,createAgent,renameAgent,setAgentPlanningCopies,deleteAgent};
if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);firebase.auth().onAuthStateChanged(start)}else{agentRecords=[];readyAgents=false;emit()}
})();
