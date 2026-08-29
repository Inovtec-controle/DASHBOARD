(()=>{
"use strict";
if(window.__INOVTEC_CDC_OPERATIONAL_FIX_V3__)return;
window.__INOVTEC_CDC_OPERATIONAL_FIX_V3__=true;
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame"),fb=window.firebase;
let db=fb?.firestore?.(),auth=fb?.auth?.();
function refreshFirebase(){db=db||fb?.firestore?.();auth=auth||fb?.auth?.();return db}
const DAYS=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
let patchedDoc=null,suggestionSiteId="",suggestionRows=[],suggestionLoadedAt=0,suggestionLoadPromise=null;
const GLOBAL_SUGGESTION_TTL=60000;
const txt=v=>String(v??"").trim(),uid=()=>"cdc_"+Date.now()+"_"+Math.random().toString(16).slice(2),norm=v=>txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function D(){try{return frame?.contentDocument||null}catch{return null}}
async function site(d){
 refreshFirebase();
 let s=null;try{s=await window.InovtecCdcImport?.resolveSite?.()}catch(e){console.warn("CDC resolve",e)}
 if(s?.id){const f=d.getElementById("siteForm");if(f)f.dataset.ivChantierId=String(s.id);return s}
 const id=txt(d.getElementById("siteForm")?.dataset.ivChantierId);
 if(id&&db){try{const snap=await db.collection("chantiers").doc(id).get();if(snap.exists)return{id:snap.id,...snap.data()}}catch(e){console.warn("CDC site id",e)}}
 const nom=txt(d.getElementById("nom")?.value),adresse=txt(d.getElementById("adresse")?.value);
 if(db&&nom){try{const q=await db.collection("chantiers").where("nom","==",nom).limit(12).get(),found=q.docs.map(x=>({id:x.id,...x.data()})),hit=found.find(x=>!adresse||norm(x.adresse)===norm(adresse))||found[0];if(hit?.id){const f=d.getElementById("siteForm");if(f)f.dataset.ivChantierId=String(hit.id);return hit}}catch(e){console.warn("CDC site fallback",e)}}
 return null;
}
function ensureStyle(d){
 if(d.getElementById("ivCdcManualErgoStyle"))return;
 const s=d.createElement("style");s.id="ivCdcManualErgoStyle";s.textContent=`
#ivCdcOverlay .iv-cdc-modal{width:min(950px,calc(100vw - 24px))!important;max-height:none!important;overflow:visible!important}
#ivCdcOverlay .iv-cdc-form-grid{gap:14px!important}
#ivCdcOverlay .iv-cdc-suggest-field{position:relative}
#ivCdcOverlay .iv-cdc-suggest{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:120;background:#fff;border:1px solid #cfe0d7;border-radius:11px;box-shadow:0 14px 35px rgba(15,50,38,.16);max-height:220px;overflow:auto;padding:5px}
#ivCdcOverlay .iv-cdc-suggest[hidden]{display:none}
#ivCdcOverlay .iv-cdc-suggest button{display:block;width:100%;border:0;background:#fff;text-align:left;padding:9px 10px;border-radius:8px;color:#24483a;font:inherit;font-size:11px;cursor:pointer}
#ivCdcOverlay .iv-cdc-suggest button:hover,#ivCdcOverlay .iv-cdc-suggest button:focus{background:#edf8f2;outline:none}
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
function unique(values){const seen=new Set(),out=[];values.forEach(v=>{v=txt(v);const k=norm(v);if(v&&!seen.has(k)){seen.add(k);out.push(v)}});return out}
function valuesFor(d,kind){
 if(kind==="zone")return unique(suggestionRows.map(r=>r.zone)).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
 const zone=norm(d.getElementById("ivCdcZone")?.value),same=[],other=[];
 suggestionRows.forEach(r=>{const p=txt(r.prestation);if(!p)return;(zone&&norm(r.zone)===zone?same:other).push(p)});
 const sort=v=>unique(v).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
 return sort(same).concat(sort(other).filter(p=>!same.some(x=>norm(x)===norm(p))));
}
function suggestionRank(value,query){
 const v=norm(value),q=norm(query);
 if(!q)return 50;
 if(v===q)return 0;
 if(v.startsWith(q))return 1;
 const words=v.split(/\s+/).filter(Boolean);
 if(words.some(w=>w.startsWith(q)))return 2;
 if(v.includes(q))return 3;
 const tokens=q.split(/\s+/).filter(Boolean);
 if(tokens.length>1&&tokens.every(t=>v.includes(t)))return 4;
 return 99;
}
function smartMatches(values,query){
 const q=norm(query);
 return values
   .map((value,index)=>({value,index,rank:suggestionRank(value,q)}))
   .filter(x=>!q||x.rank<99)
   .sort((a,b)=>a.rank-b.rank||a.index-b.index||a.value.localeCompare(b.value,"fr",{sensitivity:"base"}))
   .map(x=>x.value);
}
function renderSuggestions(d,kind,force=false){
 const cfg=kind==="zone"?{inputId:"ivCdcZone",boxId:"ivCdcZoneSuggestions"}:{inputId:"ivCdcPrestation",boxId:"ivCdcPrestationSuggestions"},ui=ensureSuggestionUi(d,cfg.inputId,cfg.boxId,kind==="zone"?"Tape quelques lettres : les zones déjà saisies sur tous les chantiers sont proposées.":"Tape quelques lettres : les prestations les plus proches sont proposées en premier.");if(!ui)return;
 const q=norm(ui.input.value),all=valuesFor(d,kind),matches=smartMatches(all,q).slice(0,10);ui.box.innerHTML="";
 if(!force&&!q){ui.box.hidden=true;return}
 if(!matches.length){const e=d.createElement("div");e.className="iv-cdc-suggest-empty";e.textContent="Aucune suggestion correspondante";ui.box.appendChild(e);ui.box.hidden=false;return}
 matches.forEach(v=>{const b=d.createElement("button");b.type="button";b.textContent=v;b.addEventListener("mousedown",e=>e.preventDefault());b.addEventListener("click",()=>{ui.input.value=v;ui.box.hidden=true;ui.input.dispatchEvent(new Event("change",{bubbles:true}));if(kind==="zone"){const p=d.getElementById("ivCdcPrestation");if(p){p.focus();renderSuggestions(d,"prestation",true)}}});ui.box.appendChild(b)});ui.box.hidden=false;
}
function bindSuggestions(d){
 [["ivCdcZone","zone"],["ivCdcPrestation","prestation"]].forEach(([id,kind])=>{const input=d.getElementById(id);if(!input||input.dataset.ivSuggestBound==="1")return;input.dataset.ivSuggestBound="1";input.addEventListener("input",()=>renderSuggestions(d,kind,true));input.addEventListener("focus",()=>renderSuggestions(d,kind,true));input.addEventListener("keydown",e=>{if(e.key==="Escape"){const box=d.getElementById(kind==="zone"?"ivCdcZoneSuggestions":"ivCdcPrestationSuggestions");if(box)box.hidden=true}})});
 if(d.body.dataset.ivCdcSuggestOutside!=="1"){d.body.dataset.ivCdcSuggestOutside="1";d.addEventListener("mousedown",e=>{if(e.target.closest?.(".iv-cdc-suggest-field"))return;["ivCdcZoneSuggestions","ivCdcPrestationSuggestions"].forEach(id=>{const box=d.getElementById(id);if(box)box.hidden=true})},true)}
}
function applyManualUi(d){
 ensureStyle(d);hideField(d,"ivCdcFrequence");hideField(d,"ivCdcControle");hideField(d,"ivCdcMethode");
 const title=d.getElementById("ivCdcModalTitle");if(title&&!d.getElementById("ivCdcOverlay")?.dataset.rowId)title.textContent="Saisir le cahier des charges";
 ensureSuggestionUi(d,"ivCdcZone","ivCdcZoneSuggestions","Tape quelques lettres : les zones déjà saisies sur tous les chantiers sont proposées.");ensureSuggestionUi(d,"ivCdcPrestation","ivCdcPrestationSuggestions","Tape quelques lettres : les prestations les plus proches sont proposées en premier.");bindSuggestions(d);
}
function suggestionRowsFromSites(sites=[]){
 const out=[];
 (Array.isArray(sites)?sites:[]).forEach(site=>{
  if(!site||site._hidden===true)return;
  const rows=site?.cahierDesChargesV1?.rows;
  if(!Array.isArray(rows))return;
  rows.forEach(row=>{
   const zone=txt(row?.zone),prestation=txt(row?.prestation);
   if(!zone&&!prestation)return;
   out.push({...row,zone,prestation,_suggestionSiteId:String(site.id||"")});
  });
 });
 return out;
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
    const snap=await db.collection("chantiers").orderBy("nom").get();
    sites=snap.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x._hidden!==true);
    allRows=suggestionRowsFromSites(sites);
   }
   if(!allRows.some(r=>String(r._suggestionSiteId||"")===suggestionSiteId)){
    try{
     const current=await db.collection("chantiers").doc(suggestionSiteId).get();
     if(current.exists)allRows=allRows.concat(suggestionRowsFromSites([{id:current.id,...current.data()}]));
    }catch(e){console.warn("CDC suggestions chantier courant",e)}
   }
   suggestionRows=allRows;
   suggestionLoadedAt=Date.now();
  }catch(e){
   console.warn("CDC suggestions globales",e);
   try{
    const snap=await db.collection("chantiers").doc(suggestionSiteId).get(),rows=snap.data()?.cahierDesChargesV1?.rows;
    suggestionRows=Array.isArray(rows)?rows.map(r=>({...r,_suggestionSiteId:suggestionSiteId})):[];
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
  const block=snap.data()?.cahierDesChargesV1||{},rows=Array.isArray(block.rows)?block.rows.map(r=>({...r})):[];
  if(rowId){const i=rows.findIndex(r=>String(r.id)===rowId);if(i>=0)rows[i]={...rows[i],...payload};else rows.push({id:rowId,...payload,ordre:Math.max(0,...rows.map(r=>Number(r.ordre)||0))+10,sourceType:"manual",createdAtMs:Date.now()})}
  else{const ordre=Math.max(0,...rows.map(r=>Number(r.ordre)||0))+10;rows.push({id:uid(),...payload,ordre,sourceType:"manual",createdAtMs:Date.now()})}
  const now=Date.now();
  tx.set(ref,{cahierDesChargesV1:{...block,schemaVersion:2,structuredSchedule:true,rows,updatedAtMs:now,updatedBy:auth?.currentUser?.uid||""}},{merge:true});
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
  suggestionRows=suggestionRows.filter(r=>!(String(r._suggestionSiteId||"")===String(target.id)&&(rowId?String(r.id||"")===String(rowId):norm(r.zone)===norm(payload.zone)&&norm(r.prestation)===norm(payload.prestation))));suggestionRows.push({id:rowId||"",zone:payload.zone,prestation:payload.prestation,_suggestionSiteId:String(target.id)});suggestionLoadedAt=Date.now();
  if(o){o.hidden=true;o.dataset.rowId=""}
 }catch(e){console.error("CDC manual save",e);alert("Impossible d’enregistrer le cahier des charges. Vérifie la connexion Firebase puis réessaie.")}
 finally{if(btn){delete btn.dataset.ivSaving;btn.disabled=false;btn.textContent="Enregistrer"}}
}
function patchManual(d){
 const o=d.getElementById("ivCdcOverlay"),old=d.getElementById("ivCdcForm");if(!o||!old)return;applyManualUi(d);
 if(old.dataset.ivOperationalFix!=="1"){
  const form=old.cloneNode(true);form.dataset.ivOperationalFix="1";delete form.dataset.ivStructuredSave;old.replaceWith(form);applyManualUi(d);
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
