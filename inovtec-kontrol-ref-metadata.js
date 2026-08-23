(()=>{
"use strict";
if(window.__INOVTEC_KONTROL_REF_METADATA_V1__)return;
window.__INOVTEC_KONTROL_REF_METADATA_V1__=true;
if(!window.firebase||!window.INOVTEC_FIREBASE_CONFIG)return;
if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
if(!firebase.auth||!firebase.firestore)return;
const auth=firebase.auth(),db=firebase.firestore(),SHARED_ID="__inovtec_shared_workspace_v1__";
let user=null,busy=false,timer=null;
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const parse=s=>{try{return JSON.parse(String(s||""))}catch{return null}};
const agentName=a=>[a?.identity?.prenom,a?.identity?.nom].filter(Boolean).join(" ").trim()||a?.displayName||a?.name||"";
const siteName=c=>String(c?.nom||c?.name||c?.adresse||"").trim();
function agentsFromWorkspace(data){const p=parse(data?.moduleSyncV1?.agents?.payload||"");if(Array.isArray(p))return p;return Array.isArray(data?.referentialAgents)?data.referentialAgents:[]}
function resolveAgents(raw,agents){const n=norm(raw);if(!n)return[];return agents.filter(a=>{const x=norm(agentName(a));return x&&(n===x||n.includes(x))}).map(a=>String(a.id)).filter(Boolean)}
function resolveSite(raw,sites){const n=norm(raw);if(!n)return null;return sites.find(c=>norm(siteName(c))===n||norm(c.adresse)===n)||sites.find(c=>{const x=norm(siteName(c));return x&&n.length>4&&(n.startsWith(x+" ")||x.startsWith(n+" "))})||null}
async function sync(){if(!user||busy)return;busy=true;try{const [workspace,allSites,metaSnap]=await Promise.all([db.collection("chantiers").doc(SHARED_ID).get(),db.collection("chantiers").get(),db.collection("chantiers").where("_type","==","kontrolPdfMeta").get()]),w=workspace.exists?(workspace.data()||{}):{},agents=agentsFromWorkspace(w),sites=allSites.docs.map(d=>({id:d.id,...(d.data()||{})})).filter(c=>!c._hidden),updates=[];for(const doc of metaSnap.docs){const data=doc.data()||{},custom=data.customMetadata||{},site=resolveSite(custom.site||data.site||"",sites),ids=resolveAgents(custom.agents||data.agents||"",agents),next={referenceVersion:1};if(site)next.chantierId=String(site.id);if(ids.length)next.agentRefIds=[...new Set(ids)];if((site&&String(data.chantierId||"")!==String(site.id))||(ids.length&&JSON.stringify(data.agentRefIds||[])!==JSON.stringify(next.agentRefIds))||Number(data.referenceVersion)!==1)updates.push(doc.ref.set(next,{merge:true}))}await Promise.all(updates)}catch(e){console.warn("Références KONTROL",e)}finally{busy=false}}
function schedule(delay=350){clearTimeout(timer);timer=setTimeout(sync,delay)}
auth.onAuthStateChanged(u=>{user=u||null;if(user){schedule(250);setTimeout(()=>schedule(0),1800)}});window.addEventListener("online",()=>schedule(150));window.addEventListener("focus",()=>schedule(180));document.addEventListener("visibilitychange",()=>{if(!document.hidden)schedule(180)});window.addEventListener("inovtec:kontrol-shared-archive-synced",()=>schedule(120));setInterval(()=>{if(user&&!document.hidden)schedule(0)},15000);
})();
