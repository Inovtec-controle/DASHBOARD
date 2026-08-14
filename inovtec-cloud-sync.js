(()=>{
"use strict";

const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
const KEYS={
  planning:"inovtec_plannings_v2",
  agents:"kontrol_agents_classeur_v2",
  heures:"HSUPP_DUR_APP_V1",
  kontrol:"cq_app_state_bottomnote_v1"
};
const key=KEYS[mode];
if(!key)return;

const frame=document.getElementById("legacyFrame");
const client=sessionStorage.ivCloudClient||(sessionStorage.ivCloudClient="c"+Date.now()+Math.random().toString(16).slice(2));
const metaKey="iv_cloud_meta_"+mode;
const CLOUD_LIMIT=420000;
let ref=null,user=null,ready=false,remoteApply=false,last="",pushTimer=null,reloadTimer=null,unsubscribe=null;

const rawLocal=()=>localStorage.getItem(key)||"";
const parse=s=>{try{return JSON.parse(s)}catch{return null}};
const sig=s=>{s=String(s||"");let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h+":"+s.length};
const byteSize=s=>{try{return new Blob([String(s||"")]).size}catch{return String(s||"").length}};
const meta=()=>{try{return JSON.parse(localStorage.getItem(metaKey)||"{}")||{}}catch{return{}}};
const setMeta=o=>localStorage.setItem(metaKey,JSON.stringify(Object.assign({},meta(),o)));

function mergeRows(a=[],b=[]){
  const m=new Map(),out=[];
  [...a,...b].forEach(x=>{
    if(!x||typeof x!=="object"){out.push(x);return}
    const id=String(x.id||"");
    if(!id){out.push(x);return}
    if(!m.has(id)){const c={...x};m.set(id,c);out.push(c)}
    else Object.assign(m.get(id),x);
  });
  return out;
}

function mergeAgentRecords(remoteAgents=[],localAgents=[]){
  const merged=mergeRows(remoteAgents,localAgents);
  return merged.map(agent=>{
    const r=remoteAgents.find(x=>x?.id===agent.id)||{};
    const l=localAgents.find(x=>x?.id===agent.id)||{};
    const out={...r,...l,...agent};
    out.identity={...(r.identity||{}),...(l.identity||{})};
    out.job={...(r.job||{}),...(l.job||{})};
    out.docs=mergeRows(r.docs||[],l.docs||[]);
    out.incidents=mergeRows(r.incidents||[],l.incidents||[]).map(inc=>{
      const ri=(r.incidents||[]).find(x=>x?.id===inc.id)||{};
      const li=(l.incidents||[]).find(x=>x?.id===inc.id)||{};
      return {...ri,...li,...inc,photos:mergeRows(ri.photos||[],li.photos||[])};
    });
    return out;
  });
}

function merge(remote,local){
  const r=parse(remote),l=parse(local);
  if(!r)return local;
  if(!l)return remote;
  if(mode==="agents"&&Array.isArray(r)&&Array.isArray(l))return JSON.stringify(mergeAgentRecords(r,l));
  if(mode==="planning"&&r&&l){
    const o={...r,...l};
    o.agents=mergeRows(r.agents||[],l.agents||[]);
    o.weeks={};
    new Set([...Object.keys(r.weeks||{}),...Object.keys(l.weeks||{})]).forEach(w=>o.weeks[w]=mergeRows(r.weeks?.[w]||[],l.weeks?.[w]||[]));
    return JSON.stringify(o);
  }
  if(mode==="heures"&&r&&l){
    const o={...r,...l};
    o.entries=mergeRows(r.entries||[],l.entries||[]);
    const seen=new Set();
    o.employees=[...(r.employees||[]),...(l.employees||[])].filter(n=>{const k=String(n).toLowerCase();if(seen.has(k))return false;seen.add(k);return true});
    return JSON.stringify(o);
  }
  if(mode==="kontrol"&&r&&l){
    const o={...r,...l,form:{...(r.form||{}),...(l.form||{})},dataByCategory:{...(r.dataByCategory||{})}};
    new Set([...Object.keys(r.dataByCategory||{}),...Object.keys(l.dataByCategory||{})]).forEach(cat=>{
      o.dataByCategory[cat]=mergeRows(r.dataByCategory?.[cat]||[],l.dataByCategory?.[cat]||[]);
    });
    o.photos=mergeRows(r.photos||[],l.photos||[]);
    return JSON.stringify(o);
  }
  return local;
}

function compactAgents(raw){
  const arr=parse(raw);
  if(!Array.isArray(arr))return raw;
  const clean=arr.map(a=>{
    const out={...a};
    out.docs=(a.docs||[]).map(d=>{const x={...d};delete x.dataUrl;return x});
    out.incidents=(a.incidents||[]).map(i=>{
      const x={...i};
      x.photos=(i.photos||[]).map(p=>{const ph={...p};delete ph.dataUrl;return ph});
      return x;
    });
    return out;
  });
  return JSON.stringify(clean);
}

function compactKontrol(raw){
  const s=parse(raw);
  if(!s||typeof s!=="object")return raw;
  const out={...s,photos:[]};
  return JSON.stringify(out);
}

function prepared(){
  const local=rawLocal();
  if(!local)return {payload:"",compact:false};
  if(byteSize(local)<=CLOUD_LIMIT)return {payload:local,compact:false};
  if(mode==="agents")return {payload:compactAgents(local),compact:true};
  if(mode==="kontrol")return {payload:compactKontrol(local),compact:true};
  return {payload:local,compact:false};
}

function restoreBinary(cloud,local){
  const c=parse(cloud),l=parse(local);
  if(!c||!l)return cloud;
  if(mode==="agents"&&Array.isArray(c)&&Array.isArray(l)){
    const out=c.map(agent=>{
      const localAgent=l.find(x=>x?.id===agent?.id);
      if(!localAgent)return agent;
      const a={...agent};
      a.docs=(agent.docs||[]).map(d=>{
        const ld=(localAgent.docs||[]).find(x=>x?.id===d?.id);
        return ld?.dataUrl&&!d.dataUrl?{...d,dataUrl:ld.dataUrl}:d;
      });
      a.incidents=(agent.incidents||[]).map(inc=>{
        const li=(localAgent.incidents||[]).find(x=>x?.id===inc?.id);
        if(!li)return inc;
        return {...inc,photos:(inc.photos||[]).map(p=>{
          const lp=(li.photos||[]).find(x=>x?.id===p?.id);
          return lp?.dataUrl&&!p.dataUrl?{...p,dataUrl:lp.dataUrl}:p;
        })};
      });
      return a;
    });
    return JSON.stringify(out);
  }
  if(mode==="kontrol"&&c&&l){
    if((c.photos||[]).length===0&&(l.photos||[]).length)c.photos=l.photos;
    return JSON.stringify(c);
  }
  return cloud;
}

function frameDoc(){try{return frame?.contentDocument||null}catch{return null}}
function nestedKontrolDoc(){try{return frameDoc()?.getElementById("kontrolFrame")?.contentDocument||null}catch{return null}}

function updateLegacyStatus(text,tone="ok",compact=false){
  const d=frameDoc();
  if(mode==="planning"&&d){
    const labels=[...d.querySelectorAll("label")];
    const lab=labels.find(x=>(x.textContent||"").trim().toLowerCase()==="sauvegarde");
    const box=lab?.parentElement?.querySelector(".status");
    if(box){box.textContent=text;box.classList.remove("warning","ok");box.classList.add(tone==="ok"?"ok":"warning")}
    const notice=[...d.querySelectorAll(".notice")].find(x=>/navigateur|exporter/i.test(x.textContent||""));
    if(notice){notice.textContent="Données synchronisées avec Firebase pour le compte connecté. Une copie locale reste conservée comme sécurité.";notice.classList.toggle("warning",tone!=="ok")}
  }
  const top=document.getElementById("syncMirror");
  if(top)top.textContent=text;
  const live=document.getElementById("liveMirror");
  if(live&&/firebase|connexion|synchron/i.test(text))live.textContent=text;
  if(mode==="kontrol"){
    const kd=nestedKontrolDoc();
    if(kd?.body){
      let badge=kd.getElementById("ivKontrolCloudState");
      if(!badge){
        badge=kd.createElement("div");badge.id="ivKontrolCloudState";
        badge.style.cssText="position:fixed;right:10px;bottom:10px;z-index:9999;padding:7px 10px;border-radius:999px;background:#ecfdf5;border:1px solid #bbf7d0;color:#166534;font:700 11px Inter,system-ui,sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.10)";
        kd.body.appendChild(badge);
      }
      badge.textContent=compact?"Firebase · données synchronisées":"Firebase · synchronisé";
      badge.style.display=tone==="ok"?"block":"none";
    }
  }
}

function ensureLoginBox(){
  if(!["planning","agents","heures"].includes(mode))return null;
  let box=document.getElementById("ivCloudLogin");
  if(box)return box;
  box=document.createElement("div");
  box.id="ivCloudLogin";
  box.style.cssText="position:fixed;inset:0;z-index:10000;display:none;place-items:center;background:rgba(15,23,42,.42);backdrop-filter:blur(4px);padding:18px";
  box.innerHTML='<form id="ivCloudLoginForm" style="width:min(390px,100%);background:#fff;border:1px solid #dfeae4;border-radius:20px;padding:20px;box-shadow:0 24px 70px rgba(15,23,42,.22);font-family:Inter,system-ui,sans-serif"><h2 style="margin:0 0 6px;font-size:20px;color:#0f172a">Connexion Inovtec</h2><p style="margin:0 0 14px;color:#64748b;font-size:13px">Connecte-toi avec le même compte pour retrouver les mêmes données sur téléphone et ordinateur.</p><label style="display:block;font-size:12px;font-weight:700;margin:8px 0 5px">Adresse email</label><input id="ivCloudEmail" type="email" autocomplete="username" required style="width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:11px;font-size:15px"><label style="display:block;font-size:12px;font-weight:700;margin:10px 0 5px">Mot de passe</label><input id="ivCloudPassword" type="password" autocomplete="current-password" required style="width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:11px;font-size:15px"><button type="submit" style="width:100%;margin-top:14px;padding:11px;border:0;border-radius:11px;background:#16a34a;color:#fff;font-weight:800;font-size:14px;cursor:pointer">Se connecter</button><div id="ivCloudLoginError" style="min-height:18px;margin-top:9px;color:#b91c1c;font-size:12px"></div></form>';
  document.body.appendChild(box);
  box.querySelector("#ivCloudLoginForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const err=box.querySelector("#ivCloudLoginError");err.textContent="";
    try{
      await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      await firebase.auth().signInWithEmailAndPassword(box.querySelector("#ivCloudEmail").value.trim(),box.querySelector("#ivCloudPassword").value);
    }catch(ex){err.textContent="Connexion impossible : "+(ex?.message||"vérifie les identifiants.")}
  });
  return box;
}

function showLogin(){const b=ensureLoginBox();if(b)b.style.display="grid"}
function hideLogin(){const b=document.getElementById("ivCloudLogin");if(b)b.style.display="none"}
let lastFrameActivity=0;
function markFrameActivity(){lastFrameActivity=Date.now()}
function bindFrameActivity(d){if(!d?.body||d.body.dataset.ivCloudActivity==="1")return;d.body.dataset.ivCloudActivity="1";["pointerdown","mousedown","touchstart","keydown","input","change","focusin"].forEach(type=>d.addEventListener(type,markFrameActivity,true));const nested=d.getElementById("kontrolFrame");if(nested){nested.addEventListener("load",()=>{try{bindFrameActivity(nested.contentDocument)}catch{}});try{bindFrameActivity(nested.contentDocument)}catch{}}}
function frameIsBusy(){try{for(const d of [frameDoc(),nestedKontrolDoc()].filter(Boolean)){const a=d.activeElement;if(a&&(/^(SELECT|INPUT|TEXTAREA)$/i.test(a.tagName)||a.isContentEditable))return true;if(d.querySelector?.('.editor-popover.open,.modal.open,.modal.show,[role="dialog"][open],dialog[open]'))return true}}catch{}return false}
function reload(){clearTimeout(reloadTimer);bindFrameActivity(frameDoc());const attempt=()=>{const idle=Date.now()-lastFrameActivity;if(frameIsBusy()||idle<5000){reloadTimer=setTimeout(attempt,Math.max(800,5000-idle));return}try{frame?.contentWindow?.location.reload()}catch{}};reloadTimer=setTimeout(attempt,1000)}

async function push(reason){
  if(!ref||!user||remoteApply)return;
  const p=prepared(),value=p.payload,t=Date.now();
  try{
    await ref.set({moduleSyncV1:{[mode]:{payload:value,updatedAtMs:t,client,reason,compact:!!p.compact,version:2}}},{merge:true});
    const h=sig(value);setMeta({ts:t,hash:h,compact:!!p.compact});last=h;
    updateLegacyStatus(p.compact?"Firebase — données synchronisées":"Firebase — synchronisé","ok",p.compact);
  }catch(e){
    console.warn("Firebase sync "+mode,e);
    updateLegacyStatus("Firebase — erreur de sauvegarde","warning");
  }
}

async function receive(snap){
  const entry=snap.exists?snap.data()?.moduleSyncV1?.[mode]:null;
  const localFull=rawLocal(),preparedLocal=prepared(),localSync=preparedLocal.payload,lh=sig(localSync),m=meta();
  if(!entry){
    if(localSync)await push("migration");
    ready=true;last=sig(prepared().payload);
    updateLegacyStatus(preparedLocal.compact?"Firebase — données synchronisées":"Firebase — synchronisé","ok",preparedLocal.compact);
    return;
  }
  const cloud=String(entry.payload||""),ch=sig(cloud),ts=Number(entry.updatedAtMs)||0;
  if(entry.client===client){
    setMeta({ts:Math.max(Number(m.ts)||0,ts),hash:lh,compact:!!entry.compact});
    ready=true;last=lh;
    updateLegacyStatus(entry.compact?"Firebase — données synchronisées":"Firebase — synchronisé","ok",!!entry.compact);
    return;
  }
  if(!m.ts){
    const merged=localSync&&cloud&&lh!==ch?merge(cloud,localFull):(cloud||localFull);
    const restored=restoreBinary(merged,localFull);
    if(restored!==localFull){remoteApply=true;localStorage.setItem(key,restored);remoteApply=false;reload()}
    const mergedPrepared=(()=>{const full=restored;if(byteSize(full)<=CLOUD_LIMIT)return full;if(mode==="agents")return compactAgents(full);if(mode==="kontrol")return compactKontrol(full);return full})();
    if(mergedPrepared!==cloud)await push("first-merge");
    else setMeta({ts,hash:sig(mergedPrepared),compact:!!entry.compact});
    ready=true;last=sig(prepared().payload);
    updateLegacyStatus(entry.compact?"Firebase — données synchronisées":"Firebase — synchronisé","ok",!!entry.compact);
    return;
  }
  if(ts>Number(m.ts||0)&&ch!==lh){
    const changedHere=lh!==String(m.hash||"");
    if(changedHere){
      const merged=merge(cloud,localFull),restored=restoreBinary(merged,localFull);
      if(restored!==localFull){remoteApply=true;localStorage.setItem(key,restored);remoteApply=false;reload()}
      await push("merge");
    }else{
      const restored=restoreBinary(cloud,localFull);
      remoteApply=true;localStorage.setItem(key,restored);remoteApply=false;
      const ph=sig((()=>{if(byteSize(restored)<=CLOUD_LIMIT)return restored;if(mode==="agents")return compactAgents(restored);if(mode==="kontrol")return compactKontrol(restored);return restored})());
      setMeta({ts,hash:ph,compact:!!entry.compact});last=ph;reload();
    }
  }
  ready=true;last=sig(prepared().payload);
  updateLegacyStatus(entry.compact?"Firebase — données synchronisées":"Firebase — synchronisé","ok",!!entry.compact);
}

function start(u){
  if(unsubscribe){try{unsubscribe()}catch{}unsubscribe=null}
  user=u||null;ready=false;ref=null;
  if(!user){updateLegacyStatus("Connexion Firebase requise","warning");showLogin();return}
  hideLogin();
  updateLegacyStatus("Connexion Firebase…","warning");
  ref=firebase.firestore().collection("kanban").doc(user.uid);
  unsubscribe=ref.onSnapshot(s=>receive(s).catch(e=>{console.warn(e);ready=true;updateLegacyStatus("Firebase — erreur de lecture","warning")}),e=>{console.warn(e);ready=true;updateLegacyStatus("Firebase — accès refusé","warning")});
}

if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){
  if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
  firebase.auth().onAuthStateChanged(start);
  last=sig(prepared().payload);
  setInterval(()=>{
    if(!ready||!user||remoteApply)return;
    const h=sig(prepared().payload);
    if(h!==last){last=h;clearTimeout(pushTimer);pushTimer=setTimeout(()=>push("local-change"),500)}
  },800);
  frame?.addEventListener("load",()=>{setTimeout(()=>bindFrameActivity(frameDoc()),80);setTimeout(()=>{
    if(user)updateLegacyStatus(meta().compact?"Firebase — données synchronisées":"Firebase — synchronisé","ok",!!meta().compact);
    else updateLegacyStatus("Connexion Firebase requise","warning");
  },200)});
}
})();
