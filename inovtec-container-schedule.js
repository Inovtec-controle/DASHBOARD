(()=>{
"use strict";
const DAYS=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
const LABEL={lundi:"Lundi",mardi:"Mardi",mercredi:"Mercredi",jeudi:"Jeudi",vendredi:"Vendredi",samedi:"Samedi",dimanche:"Dimanche"};
const SHORT={lundi:"Lun",mardi:"Mar",mercredi:"Mer",jeudi:"Jeu",vendredi:"Ven",samedi:"Sam",dimanche:"Dim"};
const FREQ_LABEL={toutes:"Toutes les semaines",paire:"Semaines paires",impaire:"Semaines impaires",mixte:"Fréquences différentes"};
const FIELDS=[
 {id:"sortieOM",label:"Sortie OM",action:"sortie",flux:"OM",freqProp:"frequenceSortieOM"},
 {id:"rentreeOM",label:"Rentrée OM",action:"rentree",flux:"OM",freqProp:"frequenceRentreeOM"},
 {id:"sortieTRI",label:"Sortie TRI",action:"sortie",flux:"TRI",freqProp:"frequenceSortieTRI"},
 {id:"rentreeTRI",label:"Rentrée TRI",action:"rentree",flux:"TRI",freqProp:"frequenceRentreeTRI"}
];
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const validFreq=v=>["toutes","paire","impaire"].includes(String(v||""))?String(v):"";
function parseDays(v){
 if(Array.isArray(v)){const a=v.map(norm);return DAYS.filter(d=>a.includes(d))}
 const s=norm(v);if(!s)return[];
 const aliases={lundi:["lundi","lun"],mardi:["mardi","mar"],mercredi:["mercredi","mer"],jeudi:["jeudi","jeu"],vendredi:["vendredi","ven"],samedi:["samedi","sam"],dimanche:["dimanche","dim"]};
 return DAYS.filter(d=>aliases[d].some(a=>new RegExp(`(^|[^a-z])${a}([^a-z]|$)`).test(s)));
}
function serialize(days){return DAYS.filter(d=>days.includes(d)).map(d=>LABEL[d]).join(", ")}
function dayKeyFromDate(v){
 if(v instanceof Date){const i=(v.getDay()+6)%7;return DAYS[i]||""}
 const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return"";
 const d=new Date(+m[1],+m[2]-1,+m[3]);return DAYS[(d.getDay()+6)%7]||"";
}
function dateFromValue(v){
 if(v instanceof Date)return v;
 const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3],12,0,0,0):new Date();
}
function weekNumber(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())),day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const start=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-start)/86400000)+1)/7)}
function frequencyActive(freq,date){const f=validFreq(freq)||"toutes",week=weekNumber(dateFromValue(date));return f==="toutes"||(f==="paire"?week%2===0:week%2!==0)}
function summary(days){return days?.length?days.map(d=>SHORT[d]).join(" · "):"Choisir les jours"}

const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
const frame=document.getElementById("legacyFrame"),fb=window.firebase,db=fb?.firestore?.(),auth=fb?.auth?.();
let legacyPlans=[],legacyUnsub=null,legacyAuthBound=false;
function hubSites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function siteKey(site){return String(site?.id||"")||`${norm(site?.nom)}|${norm(site?.adresse)}`}
function planMatchesSite(p,site){
 if(!p||!site)return false;const sid=String(site.id||""),pid=String(p.chantierId||p.sourceChantierId||"");if(sid&&pid&&sid===pid)return true;
 const sn=norm(site.nom),sa=norm(site.adresse),pn=norm(p.chantierNom),pa=norm(p.adresse);return !!((sn&&pn===sn&&(!sa||!pa||pa===sa))||(sa&&pa===sa));
}
function fieldMatchesPlan(f,p){const action=p?.action==="rentree"?"rentree":"sortie",type=String(p?.typeConteneur||"").toUpperCase();return action===f.action&&(type===f.flux||type==="OM/TRI")}
function legacyRows(site,f,day=""){return legacyPlans.filter(p=>p?.actif!==false&&planMatchesSite(p,site)&&fieldMatchesPlan(f,p)&&(!day||String(p.jour||"")===day))}
function legacyDays(site,f){const set=new Set(legacyRows(site,f).map(p=>String(p.jour||"")).filter(j=>DAYS.includes(j)));return DAYS.filter(d=>set.has(d))}
function legacyFrequency(site,f,day=""){
 const values=[...new Set(legacyRows(site,f,day).map(p=>validFreq(p.frequence)||"toutes"))];return values.length===1?values[0]:values.length>1?"mixte":"";
}
function canonicalDays(site,f){const b=site?.conteneursPlanningV1;if(b&&Array.isArray(b[f.id]))return{present:true,days:parseDays(b[f.id])};const raw=site?.[f.id];if(raw!==undefined&&raw!==null&&String(raw).trim())return{present:true,days:parseDays(raw)};return{present:false,days:[]}}
function canonicalFrequency(site,f){return validFreq(site?.[f.freqProp])||validFreq(site?.conteneursFrequencesV1?.[f.id])||validFreq(site?.conteneursPlanningV1?.frequences?.[f.id])||""}
function scheduleForSite(site){const out={};FIELDS.forEach(f=>{const c=canonicalDays(site,f);out[f.id]=c.present?c.days:legacyDays(site,f)});return out}
function frequencyForSite(site,id,day=""){
 const f=FIELDS.find(x=>x.id===id);if(!f)return"toutes";const c=canonicalFrequency(site,f);if(c)return c;return legacyFrequency(site,f,day)||legacyFrequency(site,f)||"toutes";
}
function frequencySource(site,id){const f=FIELDS.find(x=>x.id===id);if(!f)return"default";if(canonicalFrequency(site,f))return"infos";if(legacyFrequency(site,f))return"conteneurs";return"default"}
function fieldActiveForDate(site,f,dateValue){const date=dateFromValue(dateValue),day=dayKeyFromDate(date),days=scheduleForSite(site)[f.id]||[];if(!days.includes(day))return false;let freq=frequencyForSite(site,f.id,day);if(freq==="mixte")freq="toutes";return frequencyActive(freq,date)}
function actionsForDate(site,dateValue){return FIELDS.filter(f=>fieldActiveForDate(site,f,dateValue)).map(f=>({id:f.id,label:f.label,action:f.action,flux:f.flux,day:dayKeyFromDate(dateValue),frequence:frequencyForSite(site,f.id,dayKeyFromDate(dateValue))}))}
function actionsForDay(site,day){const key=DAYS.includes(day)?day:dayKeyFromDate(day),s=scheduleForSite(site);return FIELDS.filter(f=>s[f.id]?.includes(key)).map(f=>({id:f.id,label:f.label,action:f.action,flux:f.flux,day:key,frequence:frequencyForSite(site,f.id,key)}))}
function formatField(site,id){const days=scheduleForSite(site)[id]||[],freq=frequencyForSite(site,id);return `${summary(days)} · ${FREQ_LABEL[freq]||FREQ_LABEL.toutes}`}
window.InovtecContainerSchedule={DAYS,LABEL,SHORT,FREQ_LABEL,FIELDS,parseDays,serialize,scheduleForSite,dayKeyFromDate,actionsForDay,actionsForDate,frequencyForSite,frequencySource,frequencyActive,summary,formatField};

function notifyScheduleUpdate(){try{window.dispatchEvent(new CustomEvent("inovtec:container-schedule-updated"))}catch{}}
function startLegacyListener(){
 if(!db||!auth||legacyAuthBound||!["infos","planning"].includes(mode))return;legacyAuthBound=true;
 auth.onAuthStateChanged(user=>{if(legacyUnsub){try{legacyUnsub()}catch{}legacyUnsub=null}legacyPlans=[];if(!user){notifyScheduleUpdate();return}legacyUnsub=db.collection("conteneurs_plannings").onSnapshot(s=>{legacyPlans=s.docs.map(d=>({id:d.id,...d.data()}));notifyScheduleUpdate();if(mode==="infos")setTimeout(()=>{const d=doc();if(d)refresh(d)},80)},e=>console.warn("Lecture des fréquences CONTENEURS indisponible",e))});
}
startLegacyListener();
if(mode!=="infos")return;

let currentSiteId="",dirty=false,saveTimer=null,lastSignature="";
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function activeHubSite(d){
 const n=norm(d?.getElementById("nom")?.value||""),a=norm(d?.getElementById("adresse")?.value||"");if(!n&&!a)return null;const list=hubSites();
 return list.find(c=>norm(c.nom)===n&&(!a||norm(c.adresse)===a))||list.find(c=>norm(c.nom)===n)||list.find(c=>a&&norm(c.adresse)===a)||null;
}
async function resolveSite(d){
 const n=d?.getElementById("nom")?.value.trim()||"",a=d?.getElementById("adresse")?.value.trim()||"";if(!n&&!a)return null;
 const h=activeHubSite(d);if(h?.id)return h;
 const form=d?.getElementById("siteForm"),known=String(form?.dataset.ivChantierId||currentSiteId||"").trim();
 if(known&&db){try{const snap=await db.collection("chantiers").doc(known).get();if(snap.exists){const s={id:snap.id,...snap.data()};if((!n||norm(s.nom)===norm(n))&&(!a||norm(s.adresse)===norm(a)))return s}}catch{}}
 if(!n||!db)return null;
 try{const snap=await db.collection("chantiers").where("nom","==",n).limit(10).get(),rows=snap.docs.map(x=>({id:x.id,...x.data()}));return rows.find(x=>!a||norm(x.adresse)===norm(a))||rows[0]||null}catch{return null}
}
function ensureStyle(d){if(d.getElementById("ivContainerDaysStyle"))return;const s=d.createElement("style");s.id="ivContainerDaysStyle";s.textContent=`
.iv-container-source{display:none!important}.iv-container-picker{position:relative}.iv-container-trigger{width:100%;min-height:42px;border:1px solid #cfded6;border-radius:10px;background:#fff;color:#1f3d33;padding:9px 11px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;font:inherit;cursor:pointer}.iv-container-trigger:hover{border-color:#94b8a7}.iv-container-trigger strong{font-size:11px;font-weight:700}.iv-container-trigger span{font-size:10px;color:#5e746a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iv-container-trigger:after{content:"⌄";color:#0b6b43;font-weight:900}.iv-container-trigger[aria-expanded="true"]:after{content:"⌃"}.iv-container-frequency-summary{margin:5px 2px 0;font-size:9px;color:#64786e;font-weight:700}.iv-container-frequency-summary.from-app{color:#0b6b43}.iv-container-frequency-summary.mixed{color:#a16207}.iv-container-menu{position:absolute;z-index:10020;left:0;right:0;top:calc(100% + 5px);padding:8px;border:1px solid #d8e5df;border-radius:12px;background:#fff;box-shadow:0 14px 34px rgba(15,52,39,.16)}.iv-container-menu[hidden]{display:none}.iv-container-day{display:flex;align-items:center;gap:9px;padding:8px;border-radius:8px;font-size:11px;color:#27473c;cursor:pointer}.iv-container-day:hover{background:#f1f8f4}.iv-container-day input{width:16px;height:16px;accent-color:#0b6b43}.iv-container-frequency{margin-top:7px;padding:9px 8px 4px;border-top:1px solid #e4ece8}.iv-container-frequency label{display:block;margin-bottom:5px;font-size:9px;font-weight:800;color:#52675d;text-transform:uppercase;letter-spacing:.04em}.iv-container-frequency select{width:100%;min-height:36px;border:1px solid #cfded6;border-radius:9px;background:#fff;padding:6px 9px;color:#17392d;font:inherit;font-size:10px;font-weight:700}.iv-container-frequency-note{margin:5px 1px 0;font-size:8px;line-height:1.3;color:#73847b}.iv-container-clear{width:100%;margin-top:5px;border:0;border-top:1px solid #e4ece8;background:transparent;padding:8px 5px 2px;color:#718179;font-size:9px;font-weight:750;cursor:pointer;text-align:left}@media(max-width:700px){.iv-container-menu{position:static;margin-top:5px}}
`;d.head.appendChild(s)}
function fieldState(d,id){return parseDays(d.getElementById(id)?.value||"")}
function frequencyState(d,id){const p=d.querySelector(`.iv-container-picker[data-field="${id}"]`),v=p?.querySelector(".iv-container-frequency-select")?.value||"toutes";return v==="mixte"?"mixte":validFreq(v)||"toutes"}
function updateDays(d,id,days,emit=true){
 const input=d.getElementById(id),p=d.querySelector(`.iv-container-picker[data-field="${id}"]`);if(!input||!p)return;
 const ordered=DAYS.filter(x=>days.includes(x));input.value=serialize(ordered);p.querySelectorAll('.iv-container-day input[type="checkbox"]').forEach(c=>c.checked=ordered.includes(c.value));const t=p.querySelector(".iv-container-trigger span");if(t)t.textContent=summary(ordered);
 if(emit){input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}))}
}
function updateFrequency(d,site,f,freq){
 const p=d.querySelector(`.iv-container-picker[data-field="${f.id}"]`);if(!p)return;const select=p.querySelector(".iv-container-frequency-select"),sum=p.querySelector(".iv-container-frequency-summary"),note=p.querySelector(".iv-container-frequency-note");if(!select||!sum)return;
 const source=frequencySource(site,f.id),value=freq||"toutes";let mixed=select.querySelector('option[value="mixte"]');if(value==="mixte"&&!mixed){mixed=d.createElement("option");mixed.value="mixte";mixed.textContent="Fréquences différentes (ancien planning)";select.appendChild(mixed)}else if(value!=="mixte"&&mixed)mixed.remove();select.value=value;
 sum.textContent=`Fréquence : ${FREQ_LABEL[value]||FREQ_LABEL.toutes}`;sum.className="iv-container-frequency-summary"+(source==="conteneurs"?" from-app":"")+(value==="mixte"?" mixed":"");
 if(note){note.textContent=value==="mixte"?"L’ancien planning contient plusieurs fréquences. Choisis une fréquence ici pour les uniformiser.":source==="conteneurs"?"Reprise automatiquement depuis l’app CONTENEURS.":source==="infos"?"Fréquence enregistrée dans Infos chantier.":"Par défaut : toutes les semaines."}
}
function closeMenus(d,except){d.querySelectorAll(".iv-container-picker").forEach(p=>{if(p===except)return;const m=p.querySelector(".iv-container-menu"),b=p.querySelector(".iv-container-trigger");if(m)m.hidden=true;if(b)b.setAttribute("aria-expanded","false")})}
function ensurePicker(d,f){
 const input=d.getElementById(f.id);if(!input)return;const wrap=input.closest(".field");if(!wrap||wrap.querySelector(`.iv-container-picker[data-field="${f.id}"]`))return;
 input.classList.add("iv-container-source");input.tabIndex=-1;input.setAttribute("aria-hidden","true");
 const p=d.createElement("div");p.className="iv-container-picker";p.dataset.field=f.id;
 const b=d.createElement("button");b.type="button";b.className="iv-container-trigger";b.setAttribute("aria-expanded","false");b.innerHTML=`<strong>${f.label}</strong><span>${summary(fieldState(d,f.id))}</span>`;
 const freqSummary=d.createElement("div");freqSummary.className="iv-container-frequency-summary";freqSummary.textContent=`Fréquence : ${FREQ_LABEL.toutes}`;
 const m=d.createElement("div");m.className="iv-container-menu";m.hidden=true;
 DAYS.forEach(day=>{const lab=d.createElement("label");lab.className="iv-container-day";const c=d.createElement("input");c.type="checkbox";c.value=day;c.checked=fieldState(d,f.id).includes(day);const text=d.createElement("span");text.textContent=LABEL[day];lab.append(c,text);m.appendChild(lab);c.addEventListener("change",()=>{const selected=[...m.querySelectorAll('.iv-container-day input[type="checkbox"]:checked')].map(x=>x.value);updateDays(d,f.id,selected);dirty=true;scheduleSave(d)})});
 const fw=d.createElement("div");fw.className="iv-container-frequency";const fl=d.createElement("label");fl.textContent="Fréquence";const fs=d.createElement("select");fs.className="iv-container-frequency-select";fs.setAttribute("aria-label",`Fréquence ${f.label}`);[["toutes",FREQ_LABEL.toutes],["paire",FREQ_LABEL.paire],["impaire",FREQ_LABEL.impaire]].forEach(([v,l])=>{const o=d.createElement("option");o.value=v;o.textContent=l;fs.appendChild(o)});const fn=d.createElement("div");fn.className="iv-container-frequency-note";fw.append(fl,fs,fn);m.appendChild(fw);fs.addEventListener("change",()=>{dirty=true;updateFrequency(d,activeHubSite(d),f,fs.value);scheduleSave(d)});
 const clear=d.createElement("button");clear.type="button";clear.className="iv-container-clear";clear.textContent="Tout décocher";clear.onclick=()=>{updateDays(d,f.id,[]);dirty=true;scheduleSave(d)};m.appendChild(clear);
 b.onclick=e=>{e.preventDefault();const open=m.hidden;closeMenus(d,p);m.hidden=!open;b.setAttribute("aria-expanded",open?"true":"false")};p.append(b,freqSummary,m);input.insertAdjacentElement("afterend",p);
}
function installPickers(d){ensureStyle(d);FIELDS.forEach(f=>ensurePicker(d,f))}
function loadFromSite(d,site,force=false){
 installPickers(d);const sig=siteKey(site)+"|"+String(d.getElementById("nom")?.value||"")+"|"+String(d.getElementById("adresse")?.value||"");if(!force&&dirty&&sig===lastSignature)return;lastSignature=sig;currentSiteId=String(site?.id||"");const form=d.getElementById("siteForm");if(currentSiteId)form?.setAttribute("data-iv-chantier-id",currentSiteId);else form?.removeAttribute("data-iv-chantier-id");
 const s=site?scheduleForSite(site):Object.fromEntries(FIELDS.map(f=>[f.id,fieldState(d,f.id)]));FIELDS.forEach(f=>{updateDays(d,f.id,s[f.id]||[],false);updateFrequency(d,site,f,site?frequencyForSite(site,f.id):"toutes")});dirty=false;
}
async function refresh(d,force=false){if(!d?.body)return;installPickers(d);const site=await resolveSite(d);loadFromSite(d,site,force)}
function currentSchedule(d){return Object.fromEntries(FIELDS.map(f=>[f.id,fieldState(d,f.id)]))}
function currentFrequencies(d){return Object.fromEntries(FIELDS.map(f=>[f.id,frequencyState(d,f.id)]))}
function scheduleSave(d){clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(d),550)}
async function persist(d){
 if(!dirty||!db)return;const site=await resolveSite(d);if(!site?.id)return;const s=currentSchedule(d),freqRaw=currentFrequencies(d),freq={},now=Date.now(),legacy={},frequencyProps={};FIELDS.forEach(f=>{legacy[f.id]=serialize(s[f.id]);const v=validFreq(freqRaw[f.id]);if(v){freq[f.id]=v;frequencyProps[f.freqProp]=v}});
 try{await db.collection("chantiers").doc(site.id).set({...legacy,...frequencyProps,conteneursFrequencesV1:{schemaVersion:1,...freq,updatedAtMs:now,updatedBy:auth?.currentUser?.uid||""},conteneursPlanningV1:{schemaVersion:2,...s,frequences:freq,updatedAtMs:now,updatedBy:auth?.currentUser?.uid||""}},{merge:true});currentSiteId=String(site.id);d.getElementById("siteForm")?.setAttribute("data-iv-chantier-id",currentSiteId);dirty=false;notifyScheduleUpdate()}catch(e){console.error("Sauvegarde planning conteneurs impossible",e)}
}
function resetSelectionState(d){currentSiteId="";lastSignature="";dirty=false;clearTimeout(saveTimer);d.getElementById("siteForm")?.removeAttribute("data-iv-chantier-id");FIELDS.forEach(f=>{updateDays(d,f.id,[],false);updateFrequency(d,null,f,"toutes")})}
function bind(d){
 if(d.documentElement.dataset.ivContainerDaysBound==="1")return;d.documentElement.dataset.ivContainerDaysBound="1";
 d.addEventListener("click",e=>{if(!e.target.closest?.(".iv-container-picker"))closeMenus(d);const target=e.target.closest?.(".site-item,#newBtn,#deleteBtn");if(!target)return;if(dirty)persist(d);if(target.matches("#newBtn,#deleteBtn"))resetSelectionState(d);setTimeout(()=>refresh(d,true),140);setTimeout(()=>refresh(d,true),650)},true);
 d.getElementById("siteForm")?.addEventListener("submit",()=>{FIELDS.forEach(f=>updateDays(d,f.id,fieldState(d,f.id),false));dirty=true;setTimeout(()=>persist(d),600);setTimeout(()=>persist(d),1500)},true);
}
function install(){const d=doc();if(!d?.body)return;installPickers(d);bind(d);refresh(d)}
frame?.addEventListener("load",()=>{setTimeout(install,180);setTimeout(install,750);setTimeout(install,1500)});setTimeout(install,650);try{window.InovtecDataHub?.subscribe?.(()=>{const d=doc();if(d)refresh(d)})}catch{}window.addEventListener("inovtec:container-schedule-updated",()=>{const d=doc();if(d&&!dirty)refresh(d,true)});
})();
