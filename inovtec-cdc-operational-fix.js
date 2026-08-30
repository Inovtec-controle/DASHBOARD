(()=>{
"use strict";
if(window.__INOVTEC_CDC_OPERATIONAL_FIX_V5__)return;
window.__INOVTEC_CDC_OPERATIONAL_FIX_V5__=true;
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame"),fb=window.firebase;
let db=fb?.firestore?.(),auth=fb?.auth?.();
function refreshFirebase(){db=db||fb?.firestore?.();auth=auth||fb?.auth?.();return db}
const DAYS=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
let patchedDoc=null,suggestionSiteId="",suggestionRows=[],suggestionLoadedAt=0,suggestionLoadPromise=null,dismissedSuggestions={zone:new Set(),prestation:new Set()};
const GLOBAL_SUGGESTION_TTL=60000;
const txt=v=>String(v??"").trim(),uid=()=>"cdc_"+Date.now()+"_"+Math.random().toString(16).slice(2),norm=v=>txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function D(){try{return frame?.contentDocument||null}catch{return null}}
async function site(d){
 refreshFirebase();
 const form=d.getElementById("siteForm"),id=txt(form?.dataset.ivChantierId);
 if(id&&db){try{const snap=await db.collection("chantiers").doc(id).get({source:"server"});if(snap.exists)return{id:snap.id,...snap.data()}}catch(e){console.warn("CDC site id",e)}return{id}}
 let s=null;try{s=await window.InovtecCdcImport?.resolveSite?.()}catch(e){console.warn("CDC resolve",e)}
 if(s?.id){if(form)form.dataset.ivChantierId=String(s.id);return s}
 const nom=txt(d.getElementById("nom")?.value),adresse=txt(d.getElementById("adresse")?.value);
 if(db&&nom){try{const q=await db.collection("chantiers").where("nom","==",nom).limit(12).get(),found=q.docs.map(x=>({id:x.id,...x.data()})),sameAddress=found.filter(x=>adresse&&norm(x.adresse)===norm(adresse)),hit=sameAddress.length===1?sameAddress[0]:(found.length===1?found[0]:null);if(hit?.id){if(form)form.dataset.ivChantierId=String(hit.id);return hit}}catch(e){console.warn("CDC site fallback",e)}}
 return null;
}
function ensureStyle(d){
 if(d.getElementById("ivCdcManualErgoStyle"))return;
 const s=d.createElement("style");s.id="ivCdcManualErgoStyle";s.textContent=`
#ivCdcOverlay .iv-cdc-modal{width:min(950px,calc(100vw - 24px))!important;max-height:none!important;overflow:visible!important}
#ivCdcOverlay .iv-cdc-form-grid{gap:14px!important}
#ivCdcOverlay .iv-cdc-suggest-field{position:relative;z-index:30}
#ivCdcOverlay .iv-cdc-suggest{position:relative;left:auto;right:auto;top:auto;z-index:120;background:#fff;border:1px solid #cfe0d7;border-radius:11px;box-shadow:0 10px 26px rgba(15,50,38,.12);max-height:180px;overflow:auto;padding:5px;margin-top:5px}
#ivCdcOverlay .iv-cdc-suggest[hidden]{display:none}
#ivCdcOverlay .iv-cdc-suggest-item{display:flex;align-items:center;gap:4px}
#ivCdcOverlay .iv-cdc-suggest-choice{display:block;flex:1;min-width:0;border:0;background:#fff;text-align:left;padding:9px 10px;border-radius:8px;color:#24483a;font:inherit;font-size:11px;cursor:pointer}
#ivCdcOverlay .iv-cdc-suggest-choice:hover,#ivCdcOverlay .iv-cdc-suggest-choice:focus{background:#edf8f2;outline:none}
#ivCdcOverlay .iv-cdc-suggest-remove{flex:0 0 28px;width:28px;height:28px;border:0;background:#fff;color:#8a9a92;border-radius:8px;cursor:pointer;font-size:15px;line-height:1}
#ivCdcOverlay .iv-cdc-suggest-remove:hover,#ivCdcOverlay .iv-cdc-suggest-remove:focus{background:#fff1f1;color:#b42318;outline:none}
#ivCdcOverlay .iv-cdc-suggest-empty{padding:8px 10px;color:#7b8b83;font-size:10px}
#ivCdcOverlay .iv-cdc-suggest-hint{display:block;margin-top:4px;color:#7a8b82;font-size:9px}
@media(max-width:780px){#ivCdcOverlay .iv-cdc-modal{width:min(100%,calc(100vw - 18px))!important;padding:14px!important}}
`;d.head.appendChild(s);
}
function hideField(d,id){const e=d.getElementById(id),field=e?.closest?.(".field");if(field)field.hidden=true}
function ensureSuggestionUi(d,inputId,boxId,hint){
 const input=d.getElementById(inputId);if(!input)return null;const field=input.closest(".field");if(!field)return null;field.classList.add("iv-cdc-suggest-field");input.autocomplete="off";
 let box=d.getElementById(boxId);if(!box){box=d.createElement("div");box.id=boxId;box.className="iv-cdc-suggest";box.hidden=true;field.appendChild(box)}
 if(!field.querySelector(".iv-cdc-suggest-hint")){const h=d.createElement("small");h.className="iv-cdc-suggest-hint";h.textContent=hint;input.insertAdjacentElement("afterend",h)}
 return{input,box};
}
function isDismissed(kind,value){return Boolean(dismissedSuggestions?.[kind]?.has(norm(value)))}
function valuesFor(d,kind){
 const zone=norm(d.getElementById("ivCdcZone")?.value),map=new Map();
 suggestionRows.forEach(r=>{
  const value=txt(kind==="zone"?r.zone:r.prestation);if(!value||isDismissed(kind,value))return;
  const key=norm(value),current=map.get(key)||{value,count:0,sameZoneCount:0};
  current.count+=1;
  if(kind==="prestation"&&zone&&norm(r.zone)===zone)current.sameZoneCount+=1;
  map.set(key,current);
 });
 return [...map.values()].sort((a,b)=>{
  if(kind==="prestation"){
   const aSame=a.sameZoneCount>0?1:0,bSame=b.sameZoneCount>0?1:0;
   if(bSame!==aSame)return bSame-aSame;
   if(b.sameZoneCount!==a.sameZoneCount)return b.sameZoneCount-a.sameZoneCount;
  }
  return b.count-a.count||a.value.localeCompare(b.value,"fr",{sensitivity:"base"});
 });
}
async function dismissSuggestion(d,kind,value){
 const key=norm(value);if(!key)return;
 dismissedSuggestions[kind].add(key);
 const ref=globalSuggestionRef();if(!ref)return;
 const field=kind==="zone"?"zones":"prestations";
 try{
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),data=snap.exists?(snap.data()||{}):{},hidden=data?.cdcSuggestionHiddenV1||{},existing=Array.isArray(hidden[field])?hidden[field].slice():[];
   if(!existing.some(v=>norm(v)===key))existing.push(txt(value));
   tx.set(ref,{cdcSuggestionHiddenV1:{...hidden,[field]:existing,updatedAtMs:Date.now()}},{merge:true});
  });
 }catch(e){console.warn("CDC retrait suggestion",e)}
}
async function showSuggestions(d,kind,force=true){
 try{
  const stale=Date.now()-suggestionLoadedAt>=GLOBAL_SUGGESTION_TTL;
  if((!suggestionLoadedAt||stale)&&!suggestionLoadPromise){
   const target=await site(d);
   if(target?.id)await loadSuggestions(d,target,stale);
  }
 }catch(e){console.warn("CDC chargement suggestions au focus",e)}
 renderSuggestions(d,kind,force);
}
function renderSuggestions(d,kind,force=false){
 const cfg=kind==="zone"?{inputId:"ivCdcZone",boxId:"ivCdcZoneSuggestions"}:{inputId:"ivCdcPrestation",boxId:"ivCdcPrestationSuggestions"},ui=ensureSuggestionUi(d,cfg.inputId,cfg.boxId,kind==="zone"?"Suggestions communes à tous les chantiers, les plus utilisées d’abord.":"Suggestions communes ; celles de la zone choisie sont prioritaires.");if(!ui)return;
 const q=norm(ui.input.value),all=valuesFor(d,kind),matches=all.filter(item=>!q||norm(item.value).includes(q)).slice(0,10);ui.box.innerHTML="";
 if(!force&&!q){ui.box.hidden=true;return}
 if(!matches.length){const e=d.createElement("div");e.className="iv-cdc-suggest-empty";e.textContent="Aucune suggestion enregistrée";ui.box.appendChild(e);ui.box.hidden=false;return}
 matches.forEach(item=>{
  const row=d.createElement("div");row.className="iv-cdc-suggest-item";
  const choice=d.createElement("button");choice.type="button";choice.className="iv-cdc-suggest-choice";choice.textContent=item.value;choice.addEventListener("mousedown",e=>e.preventDefault());choice.addEventListener("click",()=>{ui.input.value=item.value;ui.box.hidden=true;ui.input.dispatchEvent(new Event("change",{bubbles:true}));if(kind==="zone"){const p=d.getElementById("ivCdcPrestation");if(p){p.focus();renderSuggestions(d,"prestation",true)}}});
  const remove=d.createElement("button");remove.type="button";remove.className="iv-cdc-suggest-remove";remove.textContent="×";remove.title="Retirer cette suggestion de la bibliothèque";remove.setAttribute("aria-label","Retirer cette suggestion");remove.addEventListener("mousedown",e=>e.preventDefault());remove.addEventListener("click",async e=>{e.preventDefault();e.stopPropagation();if(!confirm(`Retirer « ${item.value} » des suggestions ?`))return;await dismissSuggestion(d,kind,item.value);renderSuggestions(d,kind,true)});
  row.append(choice,remove);ui.box.appendChild(row);
 });
 ui.box.hidden=false;
}
function bindSuggestions(d){
 const config={ivCdcZone:"zone",ivCdcPrestation:"prestation"};
 [["ivCdcZone","zone"],["ivCdcPrestation","prestation"]].forEach(([id,kind])=>{
  const input=d.getElementById(id);if(!input)return;
  input.dataset.ivSuggestBound="1";
  input.oninput=()=>{renderSuggestions(d,kind,true);if(!suggestionLoadedAt||Date.now()-suggestionLoadedAt>=GLOBAL_SUGGESTION_TTL)showSuggestions(d,kind,true)};
  input.onfocus=()=>showSuggestions(d,kind,true);
  input.onblur=()=>learnSuggestion(d,kind,input.value);
  input.onchange=()=>learnSuggestion(d,kind,input.value);
  input.onkeydown=e=>{if(e.key==="Escape"){const box=d.getElementById(kind==="zone"?"ivCdcZoneSuggestions":"ivCdcPrestationSuggestions");if(box)box.hidden=true}};
 });
 if(d.body.dataset.ivCdcSuggestDelegated!=="1"){
  d.body.dataset.ivCdcSuggestDelegated="1";
  d.addEventListener("input",e=>{const kind=config[e.target?.id];if(kind){renderSuggestions(d,kind,true);if(!suggestionLoadedAt||Date.now()-suggestionLoadedAt>=GLOBAL_SUGGESTION_TTL)showSuggestions(d,kind,true)}},true);
  d.addEventListener("focusin",e=>{const kind=config[e.target?.id];if(kind)showSuggestions(d,kind,true)},true);
  d.addEventListener("focusout",e=>{const kind=config[e.target?.id];if(kind)learnSuggestion(d,kind,e.target.value)},true);
  d.addEventListener("change",e=>{const kind=config[e.target?.id];if(kind)learnSuggestion(d,kind,e.target.value)},true);
  d.addEventListener("keydown",e=>{const kind=config[e.target?.id];if(kind&&e.key==="Escape"){const box=d.getElementById(kind==="zone"?"ivCdcZoneSuggestions":"ivCdcPrestationSuggestions");if(box)box.hidden=true}},true);
  d.addEventListener("mousedown",e=>{if(e.target.closest?.(".iv-cdc-suggest-field"))return;["ivCdcZoneSuggestions","ivCdcPrestationSuggestions"].forEach(id=>{const box=d.getElementById(id);if(box)box.hidden=true})},true);
 }
}
function applyManualUi(d){
 ensureStyle(d);hideField(d,"ivCdcFrequence");hideField(d,"ivCdcControle");hideField(d,"ivCdcMethode");
 const title=d.getElementById("ivCdcModalTitle");if(title&&!d.getElementById("ivCdcOverlay")?.dataset.rowId)title.textContent="Saisir le cahier des charges";
 ensureSuggestionUi(d,"ivCdcZone","ivCdcZoneSuggestions","Suggestions communes à tous les chantiers, les plus utilisées d’abord.");ensureSuggestionUi(d,"ivCdcPrestation","ivCdcPrestationSuggestions","Suggestions communes ; celles de la zone choisie sont prioritaires.");bindSuggestions(d);
}
function suggestionRowsFromSites(sites=[]){
 const out=[];
 (Array.isArray(sites)?sites:[]).forEach(site=>{
  if(!site||site._hidden===true)return;
  const siteId=String(site.id||"");
  const rows=site?.cahierDesChargesV1?.rows;
  if(Array.isArray(rows))rows.forEach(row=>{
   const zone=txt(row?.zone),prestation=txt(row?.prestation);
   if(!zone&&!prestation)return;
   out.push({...row,zone,prestation,_suggestionSiteId:siteId,_suggestionSource:"row"});
  });
  const lib=site?.cdcSuggestionLibraryV1||{};
  (Array.isArray(lib.zones)?lib.zones:[]).forEach(zone=>{
   zone=txt(zone);if(zone)out.push({zone,prestation:"",_suggestionSiteId:siteId,_suggestionSource:"library"});
  });
  (Array.isArray(lib.prestations)?lib.prestations:[]).forEach(prestation=>{
   prestation=txt(prestation);if(prestation)out.push({zone:"",prestation,_suggestionSiteId:siteId,_suggestionSource:"library"});
  });
 });
 return out;
}
function globalSuggestionRef(){
 refreshFirebase();
 const u=auth?.currentUser;
 return u&&db?db.collection("kanban").doc(u.uid):null;
}
function rowsFromGlobalLibrary(data={}){
 const out=[],lib=data?.cdcSuggestionLibraryV1||{};
 (Array.isArray(lib.zones)?lib.zones:[]).forEach(zone=>{zone=txt(zone);if(zone)out.push({zone,prestation:"",_suggestionSource:"global-library"})});
 (Array.isArray(lib.prestations)?lib.prestations:[]).forEach(prestation=>{prestation=txt(prestation);if(prestation)out.push({zone:"",prestation,_suggestionSource:"global-library"})});
 return out;
}
function prefsFromGlobalLibrary(data={}){
 const hidden=data?.cdcSuggestionHiddenV1||{},zone=new Set(),prestation=new Set();
 (Array.isArray(hidden.zones)?hidden.zones:[]).forEach(v=>{const k=norm(v);if(k)zone.add(k)});
 (Array.isArray(hidden.prestations)?hidden.prestations:[]).forEach(v=>{const k=norm(v);if(k)prestation.add(k)});
 return{zone,prestation};
}
async function readGlobalSuggestionStore(){
 const ref=globalSuggestionRef();if(!ref)return{rows:[],prefs:{zone:new Set(),prestation:new Set()}};
 try{
  const snap=await ref.get(),data=snap.exists?(snap.data()||{}):{};
  return{rows:rowsFromGlobalLibrary(data),prefs:prefsFromGlobalLibrary(data)};
 }catch(e){
  console.warn("CDC lecture bibliothèque globale",e);
  return{rows:[],prefs:{zone:new Set(),prestation:new Set()}};
 }
}
async function learnSuggestion(d,kind,value){
 value=txt(value);if(!value)return;
 const key=norm(value);if(!key)return;
 dismissedSuggestions[kind].delete(key);
 const prop=kind==="zone"?"zone":"prestation";
 if(!suggestionRows.some(r=>norm(r?.[prop])===key&&r?._suggestionSource==="global-library")){
  suggestionRows.push({zone:kind==="zone"?value:"",prestation:kind==="prestation"?value:"",_suggestionSource:"global-library"});
 }
 suggestionLoadedAt=Date.now();
 const ref=globalSuggestionRef();if(!ref)return;
 const libField=kind==="zone"?"zones":"prestations";
 const hiddenField=kind==="zone"?"zones":"prestations";
 try{
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),data=snap.exists?(snap.data()||{}):{},lib=data?.cdcSuggestionLibraryV1||{},hidden=data?.cdcSuggestionHiddenV1||{};
   const values=Array.isArray(lib[libField])?lib[libField].slice():[],hiddenValues=Array.isArray(hidden[hiddenField])?hidden[hiddenField].slice():[];
   if(!values.some(v=>norm(v)===key))values.push(value);
   const nextHidden=hiddenValues.filter(v=>norm(v)!==key);
   tx.set(ref,{
    cdcSuggestionLibraryV1:{...lib,[libField]:values,updatedAtMs:Date.now()},
    cdcSuggestionHiddenV1:{...hidden,[hiddenField]:nextHidden,updatedAtMs:Date.now()}
   },{merge:true});
  });
 }catch(e){console.warn("CDC apprentissage suggestion",e)}
}
async function loadSuggestions(d,target,force=false){
 refreshFirebase();if(!target?.id||!db)return;
 suggestionSiteId=String(target.id);
 const fresh=!force&&suggestionRows.length&&Date.now()-suggestionLoadedAt<GLOBAL_SUGGESTION_TTL;
 if(fresh){applyManualUi(d);return}
 if(suggestionLoadPromise){try{await suggestionLoadPromise}finally{applyManualUi(d)}return}
 suggestionLoadPromise=(async()=>{
  try{
   let sites=[];
   try{sites=Array.from(window.InovtecDataHub?.chantiers||[])}catch{}
   let allRows=suggestionRowsFromSites(sites);
   if(!allRows.length||force||Date.now()-suggestionLoadedAt>=GLOBAL_SUGGESTION_TTL){
    const snap=await db.collection("chantiers").get();
    sites=snap.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x._hidden!==true);
    allRows=suggestionRowsFromSites(sites);
   }
   if(!allRows.some(r=>String(r._suggestionSiteId||"")===suggestionSiteId)){
    try{
     const current=await db.collection("chantiers").doc(suggestionSiteId).get();
     if(current.exists)allRows=allRows.concat(suggestionRowsFromSites([{id:current.id,...current.data()}]));
    }catch(e){console.warn("CDC suggestions chantier courant",e)}
   }
   const globalStore=await readGlobalSuggestionStore();
   suggestionRows=allRows.concat(globalStore.rows);
   dismissedSuggestions=globalStore.prefs;
   suggestionLoadedAt=Date.now();
  }catch(e){
   console.warn("CDC suggestions globales",e);
   try{
    const snap=await db.collection("chantiers").doc(suggestionSiteId).get(),data=snap.data()||{},rows=data?.cahierDesChargesV1?.rows,globalStore=await readGlobalSuggestionStore();
    suggestionRows=(Array.isArray(rows)?rows.map(r=>({...r,_suggestionSiteId:suggestionSiteId})):[]).concat(globalStore.rows);
    dismissedSuggestions=globalStore.prefs;
    suggestionLoadedAt=Date.now();
   }catch(_e){suggestionRows=[]}
  }
 })();
 try{await suggestionLoadPromise}finally{suggestionLoadPromise=null;applyManualUi(d)}
}
function resetModal(d){
 const o=d.getElementById("ivCdcOverlay");if(!o)return;o.dataset.rowId="";
 ["ivCdcZone","ivCdcPrestation","ivCdcObservations"].forEach(id=>{const e=d.getElementById(id);if(e)e.value=""});
 const t=d.getElementById("ivCdcFrequenceType");if(t)t.value="jours";
 d.querySelectorAll("[data-iv-cdc-day]").forEach(x=>x.checked=false);
 const title=d.getElementById("ivCdcModalTitle");if(title)title.textContent="Saisir le cahier des charges";
 applyManualUi(d);o.hidden=false;setTimeout(()=>{const z=d.getElementById("ivCdcZone");z?.focus();renderSuggestions(d,"zone",true)},20);
}
async function writeManual(targetId,rowId,payload){
 refreshFirebase();if(!db)throw Error("Firebase indisponible");
 const run=()=>db.runTransaction(async tx=>{
  const ref=db.collection("chantiers").doc(String(targetId)),snap=await tx.get(ref);if(!snap.exists)throw Error("Chantier introuvable");
  const data=snap.data()||{},block=data?.cahierDesChargesV1||{},rows=Array.isArray(block.rows)?block.rows.map(r=>({...r})):[];
  if(rowId){const i=rows.findIndex(r=>String(r.id)===rowId);if(i>=0)rows[i]={...rows[i],...payload};else rows.push({id:rowId,...payload,ordre:Math.max(0,...rows.map(r=>Number(r.ordre)||0))+10,sourceType:"manual",createdAtMs:Date.now()})}
  else{const ordre=Math.max(0,...rows.map(r=>Number(r.ordre)||0))+10;rows.push({id:uid(),...payload,ordre,sourceType:"manual",createdAtMs:Date.now()})}
  const now=Date.now();
  tx.set(ref,{
   cahierDesChargesV1:{...block,schemaVersion:2,structuredSchedule:true,rows,updatedAtMs:now,updatedBy:auth?.currentUser?.uid||""}
  },{merge:true});
 });
 try{return await run()}catch(e){if(["aborted","unavailable","deadline-exceeded"].includes(String(e?.code||"").toLowerCase())){await new Promise(r=>setTimeout(r,250));return run()}throw e}
}
async function save(d){
 const target=await site(d);if(!target?.id){alert("Sélectionne et enregistre d’abord le chantier.");return}
 const o=d.getElementById("ivCdcOverlay"),rowId=txt(o?.dataset.rowId),prestation=txt(d.getElementById("ivCdcPrestation")?.value);if(!prestation){d.getElementById("ivCdcPrestation")?.focus();return}
 const jours=[...d.querySelectorAll("[data-iv-cdc-day]:checked")].map(x=>x.dataset.ivCdcDay).filter(x=>DAYS.includes(x));
 const payload={zone:txt(d.getElementById("ivCdcZone")?.value),prestation,frequenceType:d.getElementById("ivCdcFrequenceType")?.value||"jours",jours,observations:txt(d.getElementById("ivCdcObservations")?.value),updatedAtMs:Date.now()};
 const btn=d.querySelector("#ivCdcForm button[type=submit]");if(btn?.dataset.ivSaving==="1")return;if(btn){btn.dataset.ivSaving="1";btn.disabled=true;btn.textContent="Enregistrement…"}
 try{
  await writeManual(target.id,rowId,payload);
  await learnSuggestion(d,"zone",payload.zone);
  await learnSuggestion(d,"prestation",payload.prestation);
  suggestionRows=suggestionRows.filter(r=>!(String(r._suggestionSiteId||"")===String(target.id)&&(rowId?String(r.id||"")===String(rowId):norm(r.zone)===norm(payload.zone)&&norm(r.prestation)===norm(payload.prestation))));
  suggestionRows.push({id:rowId||"",zone:payload.zone,prestation:payload.prestation,_suggestionSiteId:String(target.id),_suggestionSource:"row"});
  suggestionLoadedAt=Date.now();
  if(o){o.hidden=true;o.dataset.rowId=""}
 }catch(e){console.error("CDC manual save",e);alert("Impossible d’enregistrer le cahier des charges. Vérifie la connexion Firebase puis réessaie.")}
 finally{if(btn){delete btn.dataset.ivSaving;btn.disabled=false;btn.textContent="Enregistrer"}}
}
function patchManual(d){
 const o=d.getElementById("ivCdcOverlay"),old=d.getElementById("ivCdcForm");if(!o||!old)return;applyManualUi(d);
 if(old.dataset.ivOperationalFix!=="1"){
  const form=old.cloneNode(true);form.dataset.ivOperationalFix="1";delete form.dataset.ivStructuredSave;form.querySelectorAll("[data-iv-suggest-bound]").forEach(el=>delete el.dataset.ivSuggestBound);form.querySelectorAll(".iv-cdc-suggest").forEach(box=>{box.innerHTML="";box.hidden=true});old.replaceWith(form);applyManualUi(d);
  const close=()=>{o.hidden=true;o.dataset.rowId=""};d.getElementById("ivCdcClose")?.addEventListener("click",close);d.getElementById("ivCdcCancel")?.addEventListener("click",close);form.addEventListener("submit",e=>{e.preventDefault();e.stopImmediatePropagation();save(d)},true);
 }
 let add=d.getElementById("ivCdcAdd");if(add&&add.dataset.ivOperationalFix!=="1"){const n=add.cloneNode(true);n.dataset.ivOperationalFix="1";n.textContent="✍️ Saisir manuellement";n.disabled=false;n.addEventListener("click",async e=>{e.preventDefault();const target=await site(d);if(!target?.id){alert("Sélectionne et enregistre d’abord le chantier.");return}await loadSuggestions(d,target);resetModal(d)});add.replaceWith(n)}
 if(o.dataset.ivSuggestionObserver!=="1"){o.dataset.ivSuggestionObserver="1";new MutationObserver(async()=>{if(o.hidden)return;const target=await site(d);if(target?.id)await loadSuggestions(d,target);applyManualUi(d)}).observe(o,{attributes:true,attributeFilter:["hidden"]})}
}
function patchPdf(d){
 const b=d.getElementById("ivCdcImport"),input=d.getElementById("ivCdcFile");if(!b||!input)return;
 if(b.dataset.ivOperationalFix==="1")return;
 const n=b.cloneNode(true);n.dataset.ivOperationalFix="1";n.dataset.ivRealImport="1";n.textContent="📄 Importer un PDF";n.disabled=false;n.title="Importer le cahier des charges PDF de ce chantier";
 n.addEventListener("click",async e=>{e.preventDefault();const target=await site(d);if(!target?.id){alert("Sélectionne et enregistre d’abord le chantier.");return}input.accept="application/pdf,.pdf";input.click()});b.replaceWith(n);
}
window.InovtecCdcOperationalSave=d=>save(d);
function install(){refreshFirebase();const d=D();if(!d?.body)return;if(d!==patchedDoc)patchedDoc=d;patchManual(d);patchPdf(d)}
frame?.addEventListener("load",()=>{setTimeout(install,300);setTimeout(install,900);setTimeout(install,1700)});setTimeout(install,600);setInterval(install,900);
})();
