(()=>{
"use strict";
const DAYS=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
const LABEL={lundi:"Lundi",mardi:"Mardi",mercredi:"Mercredi",jeudi:"Jeudi",vendredi:"Vendredi",samedi:"Samedi",dimanche:"Dimanche"};
const SHORT={lundi:"Lun",mardi:"Mar",mercredi:"Mer",jeudi:"Jeu",vendredi:"Ven",samedi:"Sam",dimanche:"Dim"};
const FIELDS=[
 {id:"sortieOM",label:"Sortie OM",action:"sortie",flux:"OM"},
 {id:"rentreeOM",label:"Rentrée OM",action:"rentree",flux:"OM"},
 {id:"sortieTRI",label:"Sortie TRI",action:"sortie",flux:"TRI"},
 {id:"rentreeTRI",label:"Rentrée TRI",action:"rentree",flux:"TRI"}
];
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
function parseDays(v){
 if(Array.isArray(v))return DAYS.filter(d=>v.map(norm).includes(d));
 const s=norm(v);if(!s)return[];
 const aliases={lundi:["lundi","lun"],mardi:["mardi","mar"],mercredi:["mercredi","mer"],jeudi:["jeudi","jeu"],vendredi:["vendredi","ven"],samedi:["samedi","sam"],dimanche:["dimanche","dim"]};
 return DAYS.filter(d=>aliases[d].some(a=>new RegExp(`(^|[^a-z])${a}([^a-z]|$)`).test(s)));
}
function serialize(days){return DAYS.filter(d=>days.includes(d)).map(d=>LABEL[d]).join(", ")}
function scheduleForSite(site){
 const b=site?.conteneursPlanningV1||{};const out={};
 FIELDS.forEach(f=>{const canonical=Array.isArray(b?.[f.id])?b[f.id]:null;out[f.id]=parseDays(canonical||site?.[f.id]||"")});
 return out;
}
function dayKeyFromDate(v){
 if(v instanceof Date){const i=(v.getDay()+6)%7;return DAYS[i]||""}
 const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return"";
 const d=new Date(+m[1],+m[2]-1,+m[3]);return DAYS[(d.getDay()+6)%7]||"";
}
function actionsForDay(site,day){const key=DAYS.includes(day)?day:dayKeyFromDate(day),s=scheduleForSite(site);return FIELDS.filter(f=>s[f.id]?.includes(key)).map(f=>({id:f.id,label:f.label,action:f.action,flux:f.flux,day:key}))}
function summary(days){return days?.length?days.map(d=>SHORT[d]).join(" · "):"Choisir les jours"}
window.InovtecContainerSchedule={DAYS,LABEL,SHORT,FIELDS,parseDays,serialize,scheduleForSite,dayKeyFromDate,actionsForDay,summary};

const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame"),fb=window.firebase,db=fb?.firestore?.(),auth=fb?.auth?.();
let currentSiteId="",dirty=false,saveTimer=null,lastSignature="";
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function hubSites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function activeHubSite(d){
 const n=norm(d?.getElementById("nom")?.value||""),a=norm(d?.getElementById("adresse")?.value||"");if(!n&&!a)return null;const list=hubSites();
 return list.find(c=>norm(c.nom)===n&&(!a||norm(c.adresse)===a))||list.find(c=>norm(c.nom)===n)||list.find(c=>a&&norm(c.adresse)===a)||null;
}
async function resolveSite(d){
 const form=d?.getElementById("siteForm"),known=String(form?.dataset.ivChantierId||currentSiteId||"").trim();
 if(known&&db){try{const snap=await db.collection("chantiers").doc(known).get();if(snap.exists)return{id:snap.id,...snap.data()}}catch{}}
 const h=activeHubSite(d);if(h?.id)return h;
 const n=d?.getElementById("nom")?.value.trim()||"",a=d?.getElementById("adresse")?.value.trim()||"";if(!n||!db)return null;
 try{const snap=await db.collection("chantiers").where("nom","==",n).limit(10).get(),rows=snap.docs.map(x=>({id:x.id,...x.data()}));return rows.find(x=>!a||norm(x.adresse)===norm(a))||rows[0]||null}catch{return null}
}
function ensureStyle(d){if(d.getElementById("ivContainerDaysStyle"))return;const s=d.createElement("style");s.id="ivContainerDaysStyle";s.textContent=`
.iv-container-source{display:none!important}.iv-container-picker{position:relative}.iv-container-trigger{width:100%;min-height:42px;border:1px solid #cfded6;border-radius:10px;background:#fff;color:#1f3d33;padding:9px 11px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;font:inherit;cursor:pointer}.iv-container-trigger:hover{border-color:#94b8a7}.iv-container-trigger strong{font-size:11px;font-weight:700}.iv-container-trigger span{font-size:10px;color:#5e746a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iv-container-trigger:after{content:"⌄";color:#0b6b43;font-weight:900}.iv-container-trigger[aria-expanded="true"]:after{content:"⌃"}.iv-container-menu{position:absolute;z-index:10020;left:0;right:0;top:calc(100% + 5px);padding:8px;border:1px solid #d8e5df;border-radius:12px;background:#fff;box-shadow:0 14px 34px rgba(15,52,39,.16)}.iv-container-menu[hidden]{display:none}.iv-container-day{display:flex;align-items:center;gap:9px;padding:8px;border-radius:8px;font-size:11px;color:#27473c;cursor:pointer}.iv-container-day:hover{background:#f1f8f4}.iv-container-day input{width:16px;height:16px;accent-color:#0b6b43}.iv-container-clear{width:100%;margin-top:5px;border:0;border-top:1px solid #e4ece8;background:transparent;padding:8px 5px 2px;color:#718179;font-size:9px;font-weight:750;cursor:pointer;text-align:left}@media(max-width:700px){.iv-container-menu{position:static;margin-top:5px}}
`;d.head.appendChild(s)}
function fieldState(d,id){return parseDays(d.getElementById(id)?.value||"")}
function updatePicker(d,id,days,emit=true){
 const input=d.getElementById(id),p=d.querySelector(`.iv-container-picker[data-field="${id}"]`);if(!input||!p)return;
 const ordered=DAYS.filter(x=>days.includes(x));input.value=serialize(ordered);p.querySelectorAll('input[type="checkbox"]').forEach(c=>c.checked=ordered.includes(c.value));const t=p.querySelector(".iv-container-trigger span");if(t)t.textContent=summary(ordered);
 if(emit){input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}))}
}
function closeMenus(d,except){d.querySelectorAll(".iv-container-picker").forEach(p=>{if(p===except)return;const m=p.querySelector(".iv-container-menu"),b=p.querySelector(".iv-container-trigger");if(m)m.hidden=true;if(b)b.setAttribute("aria-expanded","false")})}
function ensurePicker(d,f){
 const input=d.getElementById(f.id);if(!input)return;const wrap=input.closest(".field");if(!wrap||wrap.querySelector(`.iv-container-picker[data-field="${f.id}"]`))return;
 input.classList.add("iv-container-source");input.tabIndex=-1;input.setAttribute("aria-hidden","true");
 const p=d.createElement("div");p.className="iv-container-picker";p.dataset.field=f.id;
 const b=d.createElement("button");b.type="button";b.className="iv-container-trigger";b.setAttribute("aria-expanded","false");b.innerHTML=`<strong>${f.label}</strong><span>${summary(fieldState(d,f.id))}</span>`;
 const m=d.createElement("div");m.className="iv-container-menu";m.hidden=true;
 DAYS.forEach(day=>{const lab=d.createElement("label");lab.className="iv-container-day";const c=d.createElement("input");c.type="checkbox";c.value=day;c.checked=fieldState(d,f.id).includes(day);const text=d.createElement("span");text.textContent=LABEL[day];lab.append(c,text);m.appendChild(lab);c.addEventListener("change",()=>{const selected=[...m.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);updatePicker(d,f.id,selected);dirty=true;scheduleSave(d)})});
 const clear=d.createElement("button");clear.type="button";clear.className="iv-container-clear";clear.textContent="Tout décocher";clear.onclick=()=>{updatePicker(d,f.id,[]);dirty=true;scheduleSave(d)};m.appendChild(clear);
 b.onclick=e=>{e.preventDefault();const open=m.hidden;closeMenus(d,p);m.hidden=!open;b.setAttribute("aria-expanded",open?"true":"false")};p.append(b,m);input.insertAdjacentElement("afterend",p);
}
function installPickers(d){ensureStyle(d);FIELDS.forEach(f=>ensurePicker(d,f))}
function loadFromSite(d,site,force=false){
 installPickers(d);const sig=String(site?.id||"")+"|"+String(d.getElementById("nom")?.value||"")+"|"+String(d.getElementById("adresse")?.value||"");if(!force&&dirty&&sig===lastSignature)return;lastSignature=sig;currentSiteId=String(site?.id||"");if(currentSiteId)d.getElementById("siteForm")?.setAttribute("data-iv-chantier-id",currentSiteId);
 const s=site?scheduleForSite(site):Object.fromEntries(FIELDS.map(f=>[f.id,fieldState(d,f.id)]));FIELDS.forEach(f=>updatePicker(d,f.id,s[f.id]||[],false));dirty=false;
}
async function refresh(d,force=false){if(!d?.body)return;installPickers(d);const site=await resolveSite(d);loadFromSite(d,site,force)}
function currentSchedule(d){return Object.fromEntries(FIELDS.map(f=>[f.id,fieldState(d,f.id)]))}
function scheduleSave(d){clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(d),550)}
async function persist(d){
 if(!dirty||!db)return;const site=await resolveSite(d);if(!site?.id)return;const s=currentSchedule(d),now=Date.now(),legacy={};FIELDS.forEach(f=>legacy[f.id]=serialize(s[f.id]));
 try{await db.collection("chantiers").doc(site.id).set({...legacy,conteneursPlanningV1:{schemaVersion:1,...s,updatedAtMs:now,updatedBy:auth?.currentUser?.uid||""}},{merge:true});currentSiteId=String(site.id);d.getElementById("siteForm")?.setAttribute("data-iv-chantier-id",currentSiteId);dirty=false}catch(e){console.error("Sauvegarde planning conteneurs impossible",e)}
}
function bind(d){
 if(d.documentElement.dataset.ivContainerDaysBound==="1")return;d.documentElement.dataset.ivContainerDaysBound="1";
 d.addEventListener("click",e=>{if(!e.target.closest?.(".iv-container-picker"))closeMenus(d);if(e.target.closest?.(".site-item,#newBtn,#deleteBtn")){if(dirty)persist(d);setTimeout(()=>refresh(d,true),120);setTimeout(()=>refresh(d,true),600)}},true);
 d.getElementById("siteForm")?.addEventListener("submit",()=>{FIELDS.forEach(f=>updatePicker(d,f.id,fieldState(d,f.id),false));dirty=true;setTimeout(()=>persist(d),500);setTimeout(()=>persist(d),1400)},true);
}
function install(){const d=doc();if(!d?.body)return;installPickers(d);bind(d);refresh(d)}
frame?.addEventListener("load",()=>{setTimeout(install,180);setTimeout(install,750);setTimeout(install,1500)});setTimeout(install,650);try{window.InovtecDataHub?.subscribe?.(()=>{const d=doc();if(d)refresh(d)})}catch{}
})();
