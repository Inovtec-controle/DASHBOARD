(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
const KEYS={planning:"inovtec_plannings_v2",agents:"kontrol_agents_classeur_v2",heures:"HSUPP_DUR_APP_V1"};
const key=KEYS[mode];if(!key)return;
const frame=document.getElementById("legacyFrame");
const client=sessionStorage.ivCloudClient||(sessionStorage.ivCloudClient="c"+Date.now()+Math.random().toString(16).slice(2));
const metaKey="iv_cloud_meta_"+mode;
let ref,user,ready=false,remoteApply=false,last="",timer;
const raw=()=>localStorage.getItem(key)||"";
const parse=s=>{try{return JSON.parse(s)}catch{return null}};
const sig=s=>{s=String(s||"");let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h+":"+s.length};
const meta=()=>{try{return JSON.parse(localStorage.getItem(metaKey)||"{}")||{}}catch{return{}}};
const setMeta=o=>localStorage.setItem(metaKey,JSON.stringify(Object.assign({},meta(),o)));
function mergeRows(a=[],b=[]){const m=new Map(),out=[];[...a,...b].forEach(x=>{if(!x||typeof x!=="object"){out.push(x);return}const id=String(x.id||"");if(!id){out.push(x);return}if(!m.has(id)){const c={...x};m.set(id,c);out.push(c)}else Object.assign(m.get(id),x)});return out}
function merge(remote,local){
 const r=parse(remote),l=parse(local);if(!r)return local;if(!l)return remote;
 if(mode==="agents"&&Array.isArray(r)&&Array.isArray(l))return JSON.stringify(mergeRows(r,l));
 if(mode==="planning"&&r&&l){const o={...r,...l};o.agents=mergeRows(r.agents||[],l.agents||[]);o.weeks={};new Set([...Object.keys(r.weeks||{}),...Object.keys(l.weeks||{})]).forEach(w=>o.weeks[w]=mergeRows(r.weeks?.[w]||[],l.weeks?.[w]||[]));return JSON.stringify(o)}
 if(mode==="heures"&&r&&l){const o={...r,...l};o.entries=mergeRows(r.entries||[],l.entries||[]);const seen=new Set();o.employees=[...(r.employees||[]),...(l.employees||[])].filter(n=>{const k=String(n).toLowerCase();if(seen.has(k))return false;seen.add(k);return true});return JSON.stringify(o)}
 return local;
}
function reload(){clearTimeout(timer);timer=setTimeout(()=>{try{frame?.contentWindow?.location.reload()}catch{}},150)}
async function push(value,reason){if(!ref||!user||remoteApply)return;const t=Date.now();try{await ref.set({moduleSyncV1:{[mode]:{payload:value,updatedAtMs:t,client,reason}}},{merge:true});setMeta({ts:t,hash:sig(value)});last=sig(value)}catch(e){console.warn("Firebase sync "+mode,e)}}
async function receive(snap){
 const entry=snap.exists?snap.data()?.moduleSyncV1?.[mode]:null;const local=raw(),lh=sig(local),m=meta();
 if(!entry){if(local)await push(local,"migration");ready=true;last=sig(raw());return}
 const cloud=String(entry.payload||""),ch=sig(cloud),ts=Number(entry.updatedAtMs)||0;
 if(entry.client===client){setMeta({ts:Math.max(Number(m.ts)||0,ts),hash:lh});ready=true;last=lh;return}
 if(!m.ts){const merged=local&&cloud&&lh!==ch?merge(cloud,local):(cloud||local);if(merged!==local){remoteApply=true;localStorage.setItem(key,merged);remoteApply=false;reload()}if(merged!==cloud)await push(merged,"first-merge");else setMeta({ts,hash:sig(merged)});ready=true;last=sig(merged);return}
 if(ts>Number(m.ts||0)&&ch!==lh){const changedHere=lh!==String(m.hash||"");if(changedHere){const merged=merge(cloud,local);if(merged!==local){remoteApply=true;localStorage.setItem(key,merged);remoteApply=false;reload()}await push(merged,"merge")}else{remoteApply=true;localStorage.setItem(key,cloud);remoteApply=false;setMeta({ts,hash:ch});last=ch;reload()}}
 ready=true;last=sig(raw());
}
function start(u){user=u||null;ready=false;if(!user)return;ref=firebase.firestore().collection("kanban").doc(user.uid);ref.onSnapshot(s=>receive(s).catch(console.warn),e=>{console.warn(e);ready=true})}
if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);firebase.auth().onAuthStateChanged(start);last=sig(raw());setInterval(()=>{if(!ready||!user||remoteApply)return;const v=raw(),h=sig(v);if(h!==last){last=h;clearTimeout(timer);timer=setTimeout(()=>push(v,"local-change"),450)}},800)}
})();
