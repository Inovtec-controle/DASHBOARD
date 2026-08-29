(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame"),fb=window.firebase,db=fb?.firestore?.(),auth=fb?.auth?.();
if(!frame||!db)return;
const EXTRA_MAP={ivTypeChantier:"typeChantier",ivDateDebutPrestation:"dateDebutPrestation",ivDateFinContrat:"dateFinContrat",ivClientNom:"clientNom",ivClientTelephone:"clientTelephone",ivClientEmail:"clientEmail"};
const CONTAINER_FREQ={sortieOM:"frequenceSortieOM",rentreeOM:"frequenceRentreeOM",sortieTRI:"frequenceSortieTRI",rentreeTRI:"frequenceRentreeTRI"};
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let lastDoc=null,observer=null,saveToken=0,loadToken=0;
function doc(){try{return frame.contentDocument||null}catch{return null}}
function hubSites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function formValue(d,id){const e=d?.getElementById(id);return e&&"value" in e?String(e.value??"").trim():""}
function activeHubSite(d){const n=formValue(d,"nom"),a=formValue(d,"adresse");if(!n&&!a)return null;const list=hubSites();return list.find(s=>norm(s.nom)===norm(n)&&a&&norm(s.adresse)===norm(a))||list.find(s=>n&&norm(s.nom)===norm(n))||list.find(s=>a&&norm(s.adresse)===norm(a))||null}
async function resolveSite(d,{waitForNew=false,retries=24}={}){
 const form=d?.getElementById("siteForm");
 for(let i=0;i<retries;i++){
  const exact=String(form?.dataset.ivChantierId||"").trim();
  if(exact)return{id:exact};
  if(waitForNew){await wait(160);continue}
  const h=activeHubSite(d);if(h?.id)return h;
  const n=formValue(d,"nom"),a=formValue(d,"adresse");
  if(n){try{const q=await db.collection("chantiers").where("nom","==",n).limit(12).get(),rows=q.docs.map(x=>({id:x.id,...x.data()}));const exactAddress=rows.filter(x=>a&&norm(x.adresse)===norm(a));if(exactAddress.length===1)return exactAddress[0];if(rows.length===1)return rows[0]}catch{}}
  await wait(160);
 }
 return null;
}
function collect(d){
 const form=d?.getElementById("siteForm"),data={};if(!form)return data;
 form.querySelectorAll("input[id],textarea[id],select[id]").forEach(el=>{
  const id=el.id;if(!id||id.startsWith("ivCdc")||id==="search")return;
  if(id.startsWith("iv")&&!EXTRA_MAP[id])return;
  const key=EXTRA_MAP[id]||id;
  if(el.type==="checkbox"||el.type==="radio")return;
  data[key]=String(el.value??"").trim();
 });
 const contact=d.getElementById("ivContactTypeBlock");if(contact)data.contactType=String(contact.dataset.contactType||"").trim();
 const schedules={},freqs={};
 Object.entries(CONTAINER_FREQ).forEach(([id,prop])=>{
  const picker=d.querySelector(`.iv-container-picker[data-field="${id}"]`),select=picker?.querySelector(".iv-container-frequency-select"),raw=String(select?.value||"").trim();
  if(raw&&raw!=="mixte"){data[prop]=raw;freqs[id]=raw}
  try{const parse=window.InovtecContainerSchedule?.parseDays;if(typeof parse==="function")schedules[id]=parse(formValue(d,id))}catch{}
 });
 if(Object.keys(schedules).length){const now=Date.now(),uid=auth?.currentUser?.uid||"";data.conteneursPlanningV1={schemaVersion:2,...schedules,frequences:freqs,updatedAtMs:now,updatedBy:uid};data.conteneursFrequencesV1={schemaVersion:1,...freqs,updatedAtMs:now,updatedBy:uid}}
 const assignedSelect=d.getElementById("ivSiteAgentSelect");let assigned=null;try{const raw=form.dataset.ivAgentsAffectes;if(raw!==undefined){const parsed=JSON.parse(raw);if(Array.isArray(parsed))assigned=parsed}}catch{}if(!assigned&&assignedSelect)assigned=[...assignedSelect.selectedOptions].map(o=>o.value);if(Array.isArray(assigned))data.agentsAffectes=[...new Set(assigned.map(v=>String(v||"").trim()).filter(Boolean))];
 data.infoUnifiedSaveVersion=1;data.infoUnifiedUpdatedAtMs=Date.now();data.infoUnifiedUpdatedBy=auth?.currentUser?.uid||"";
 return data;
}
function setStatus(d,text,ok=false){const s=d?.getElementById("recordState");if(!s)return;s.textContent=text;s.className="status"+(ok?" ok":"")}
function saveButton(d){return d?.querySelector('#siteForm .sticky-save button[type="submit"]')||d?.querySelector('#siteForm button[type="submit"]')||null}
function setSaveState(d,state){const b=saveButton(d);if(!b)return;const states={idle:["Enregistrer","Aucune sauvegarde en cours"],dirty:["Enregistrer •","Modifications non sauvegardées"],saving:["Enregistrer ⏳","Enregistrement Firebase en cours"],saved:["Enregistrer ✓","Sauvegarde confirmée par Firebase"],error:["Enregistrer ⚠","Échec de la sauvegarde Firebase"]},cfg=states[state]||states.idle;b.textContent=cfg[0];b.title=cfg[1];b.setAttribute("aria-label",cfg[1]);b.dataset.firebaseSaveState=state;b.disabled=state==="saving"}
function primitiveMismatch(expected,actual){return Object.entries(expected).find(([key,value])=>{if(Array.isArray(value))return JSON.stringify(value.map(v=>String(v??"")))!==JSON.stringify((Array.isArray(actual?.[key])?actual[key]:[]).map(v=>String(v??"")));if(value!==null&&typeof value==="object")return false;return String(actual?.[key]??"")!==String(value??"")})||null}
async function persist(d,wasNew,token,dataSnapshot=null){
 const data=dataSnapshot&&typeof dataSnapshot==="object"?dataSnapshot:collect(d);if(!data.nom)return;
 setSaveState(d,"saving");
 try{
  const site=await resolveSite(d,{waitForNew:wasNew,retries:wasNew?55:20});if(token!==saveToken)return;
  if(!site?.id)throw new Error("ID chantier introuvable");
  const ref=db.collection("chantiers").doc(String(site.id));
  await ref.set(data,{merge:true});if(token!==saveToken)return;
  const snap=await ref.get({source:"server"});if(token!==saveToken)return;
  if(!snap.exists)throw new Error("Firebase n'a pas retrouvé le chantier après sauvegarde");
  const saved={id:snap.id,...snap.data()},mismatch=primitiveMismatch(data,saved);
  if(mismatch)throw new Error("Firebase n'a pas confirmé le champ "+mismatch[0]);
  d.getElementById("siteForm")?.setAttribute("data-iv-chantier-id",String(site.id));
  d.getElementById("siteForm")?.removeAttribute("data-iv-info-dirty");
  setStatus(d,"Enregistré",true);setSaveState(d,"saved");
 }catch(e){console.error("Sauvegarde unifiée Infos chantier impossible",e);if(token===saveToken){setStatus(d,"À réenregistrer",false);setSaveState(d,"error");try{d.defaultView?.alert("Certaines informations du chantier n'ont pas pu être confirmées par Firebase. Réessaie avec Enregistrer.")}catch{}}}
}
function normalizedType(v){const x=String(v||"").trim();if(x==="Copropriété")return"Copropriétés";if(x==="Industriel")return"Industriels";return x}
function applyContactUi(d,type){const block=d.getElementById("ivContactTypeBlock");if(!block)return;const t=String(type||"");block.dataset.contactType=t;block.querySelectorAll(".iv-contact-choice").forEach(b=>{const on=b.dataset.type===t;b.classList.toggle("active",on);b.setAttribute("aria-pressed",on?"true":"false")});const s=d.getElementById("ivSyndicContactFields"),c=d.getElementById("ivClientContactFields");if(s)s.hidden=t!=="syndic_cs";if(c)c.hidden=t!=="client"}
function applyExtras(d,site){
 const form=d.getElementById("siteForm");if(!form||!site)return;form.dataset.ivChantierId=String(site.id||form.dataset.ivChantierId||"");if(Array.isArray(site.agentsAffectes)&&form.dataset.ivInfoDirty!=="1"){form.dataset.ivAgentsAffectes=JSON.stringify([...new Set(site.agentsAffectes.map(v=>String(v||"").trim()).filter(Boolean))]);form.removeAttribute("data-iv-agents-draft");}
 const values={ivTypeChantier:normalizedType(site.typeChantier),ivDateDebutPrestation:site.dateDebutPrestation||"",ivDateFinContrat:site.dateFinContrat||"",ivClientNom:site.clientNom||"",ivClientTelephone:site.clientTelephone||"",ivClientEmail:site.clientEmail||"",accesLocalNettoyage:site.accesLocalNettoyage||"",observationsTechniques:site.observationsTechniques||"",airePresentation:site.airePresentation||""};
 Object.entries(values).forEach(([id,v])=>{const e=d.getElementById(id);if(!e)return;if(id==="ivTypeChantier"&&v&&![...e.options].some(o=>o.value===v)){const o=d.createElement("option");o.value=v;o.textContent=v;e.appendChild(o)}e.value=String(v??"")});
 applyContactUi(d,site.contactType||"");
}
async function loadSelected(d,force=false){
 const form=d?.getElementById("siteForm");if(!form||form.classList.contains("hidden"))return;if(!force&&form.dataset.ivInfoDirty==="1")return;
 const state=d.getElementById("recordState")?.textContent||"";if(/nouveau/i.test(state))return;
 const token=++loadToken,site=await resolveSite(d,{retries:18});if(token!==loadToken||!site?.id)return;
 try{const snap=await db.collection("chantiers").doc(String(site.id)).get({source:"server"});if(token!==loadToken||!snap.exists)return;applyExtras(d,{id:snap.id,...snap.data()});setSaveState(d,"saved")}catch(e){console.warn("Rechargement unifié Infos chantier",e)}
}
function bind(d){
 const form=d.getElementById("siteForm");if(!form||form.dataset.ivUnifiedPersistence==="1")return;form.dataset.ivUnifiedPersistence="1";
 form.addEventListener("input",()=>{form.dataset.ivInfoDirty="1";setSaveState(d,"dirty")},true);form.addEventListener("change",()=>{form.dataset.ivInfoDirty="1";setSaveState(d,"dirty")},true);
 form.addEventListener("submit",()=>{const wasNew=/nouveau/i.test(d.getElementById("recordState")?.textContent||"");const token=++saveToken,snapshot=collect(d);setSaveState(d,"saving");persist(d,wasNew,token,snapshot);setTimeout(()=>{if(token===saveToken&&form.dataset.ivInfoDirty==="1")persist(d,wasNew,token,snapshot)},900)},true);
 d.addEventListener("click",e=>{const site=e.target?.closest?.(".site-item"),fresh=e.target?.closest?.("#newBtn"),del=e.target?.closest?.("#deleteBtn");if(site){loadToken++;form.removeAttribute("data-iv-info-dirty");setTimeout(()=>loadSelected(d,true),180);setTimeout(()=>loadSelected(d,true),700)}else if(fresh||del){loadToken++;form.removeAttribute("data-iv-info-dirty");if(fresh)form.removeAttribute("data-iv-chantier-id")}},true);
}
function install(){const d=doc();if(!d?.body)return;if(d!==lastDoc){lastDoc=d;try{observer?.disconnect()}catch{}observer=new MutationObserver(()=>{bind(d)});observer.observe(d.body,{childList:true,subtree:true})}bind(d);setTimeout(()=>loadSelected(d,false),120)}
frame.addEventListener("load",()=>{setTimeout(install,120);setTimeout(install,600);setTimeout(install,1400)});setTimeout(install,450);try{window.InovtecDataHub?.subscribe?.(()=>{const d=doc();if(d&&d.getElementById("siteForm")?.dataset.ivInfoDirty!=="1")setTimeout(()=>loadSelected(d,false),90)})}catch{}
})();