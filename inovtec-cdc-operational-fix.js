(()=>{
"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame"),fb=window.firebase,db=fb?.firestore?.(),auth=fb?.auth?.();
const DAYS=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
let patchedDoc=null;
const txt=v=>String(v??"").trim(),uid=()=>"cdc_"+Date.now()+"_"+Math.random().toString(16).slice(2);
function D(){try{return frame?.contentDocument||null}catch{return null}}
async function site(d){
 let s=null;try{s=await window.InovtecCdcImport?.resolveSite?.()}catch(e){console.warn("CDC resolve",e)}
 if(s?.id){const f=d.getElementById("siteForm");if(f)f.dataset.ivChantierId=String(s.id);return s}
 const id=txt(d.getElementById("siteForm")?.dataset.ivChantierId);if(id){try{const snap=await db.collection("chantiers").doc(id).get();if(snap.exists)return{id:snap.id,...snap.data()}}catch{}}
 return null;
}
function resetModal(d){
 const o=d.getElementById("ivCdcOverlay");if(!o)return;o.dataset.rowId="";
 ["ivCdcZone","ivCdcPrestation","ivCdcFrequence","ivCdcMethode","ivCdcControle","ivCdcObservations"].forEach(id=>{const e=d.getElementById(id);if(e)e.value=""});
 const t=d.getElementById("ivCdcFrequenceType");if(t)t.value="jours";
 d.querySelectorAll("[data-iv-cdc-day]").forEach(x=>x.checked=false);
 const title=d.getElementById("ivCdcModalTitle");if(title)title.textContent="Ajouter une prestation";
 o.hidden=false;setTimeout(()=>d.getElementById("ivCdcPrestation")?.focus(),20);
}
async function save(d){
 const target=await site(d);if(!target?.id){alert("Sélectionne et enregistre d’abord le chantier.");return}
 const o=d.getElementById("ivCdcOverlay"),rowId=txt(o?.dataset.rowId),prestation=txt(d.getElementById("ivCdcPrestation")?.value);if(!prestation){d.getElementById("ivCdcPrestation")?.focus();return}
 const jours=[...d.querySelectorAll("[data-iv-cdc-day]:checked")].map(x=>x.dataset.ivCdcDay).filter(x=>DAYS.includes(x));
 const payload={zone:txt(d.getElementById("ivCdcZone")?.value),prestation,frequence:txt(d.getElementById("ivCdcFrequence")?.value),frequenceType:d.getElementById("ivCdcFrequenceType")?.value||"jours",jours,methodeConsigne:txt(d.getElementById("ivCdcMethode")?.value),controle:txt(d.getElementById("ivCdcControle")?.value),observations:txt(d.getElementById("ivCdcObservations")?.value),updatedAtMs:Date.now()};
 const btn=d.querySelector("#ivCdcForm button[type=submit]");if(btn){btn.disabled=true;btn.textContent="Enregistrement…"}
 try{
  await db.runTransaction(async tx=>{const ref=db.collection("chantiers").doc(String(target.id)),snap=await tx.get(ref);if(!snap.exists)throw Error("Chantier introuvable");const block=snap.data()?.cahierDesChargesV1||{},rows=Array.isArray(block.rows)?block.rows.map(r=>({...r})):[];if(rowId){const i=rows.findIndex(r=>String(r.id)===rowId);if(i>=0)rows[i]={...rows[i],...payload}}else{const ordre=Math.max(0,...rows.map(r=>Number(r.ordre)||0))+10;rows.push({id:uid(),...payload,ordre,sourceType:"manual",createdAtMs:Date.now()})}tx.update(ref,{"cahierDesChargesV1.schemaVersion":2,"cahierDesChargesV1.structuredSchedule":true,"cahierDesChargesV1.rows":rows,"cahierDesChargesV1.updatedAtMs":Date.now(),"cahierDesChargesV1.updatedBy":auth?.currentUser?.uid||""})});
  if(o){o.hidden=true;o.dataset.rowId=""}
 }catch(e){console.error("CDC manual save",e);alert("Impossible d’enregistrer le cahier des charges. Vérifie la connexion Firebase.")}
 finally{if(btn){btn.disabled=false;btn.textContent="Enregistrer"}}
}
function patchManual(d){
 const o=d.getElementById("ivCdcOverlay"),old=d.getElementById("ivCdcForm");if(!o||!old||old.dataset.ivOperationalFix==="1")return;
 const form=old.cloneNode(true);form.dataset.ivOperationalFix="1";old.replaceWith(form);
 const close=()=>{o.hidden=true;o.dataset.rowId=""};d.getElementById("ivCdcClose")?.addEventListener("click",close);d.getElementById("ivCdcCancel")?.addEventListener("click",close);form.addEventListener("submit",e=>{e.preventDefault();save(d)});
 let add=d.getElementById("ivCdcAdd");if(add&&add.dataset.ivOperationalFix!=="1"){const n=add.cloneNode(true);n.dataset.ivOperationalFix="1";n.textContent="✍️ Saisir manuellement";n.disabled=false;n.addEventListener("click",async e=>{e.preventDefault();const target=await site(d);if(!target?.id){alert("Sélectionne et enregistre d’abord le chantier.");return}resetModal(d)});add.replaceWith(n)}
}
function patchPdf(d){
 const b=d.getElementById("ivCdcImport"),input=d.getElementById("ivCdcFile");if(!b||!input)return;
 if(b.dataset.ivOperationalFix==="1")return;
 const n=b.cloneNode(true);n.dataset.ivOperationalFix="1";n.dataset.ivRealImport="1";n.textContent="📄 Importer un PDF";n.disabled=false;n.title="Importer le cahier des charges PDF de ce chantier";
 n.addEventListener("click",async e=>{e.preventDefault();const target=await site(d);if(!target?.id){alert("Sélectionne et enregistre d’abord le chantier.");return}input.accept="application/pdf,.pdf";input.click()});b.replaceWith(n);
}
function install(){const d=D();if(!d?.body)return;if(d!==patchedDoc)patchedDoc=d;patchManual(d);patchPdf(d)}
frame?.addEventListener("load",()=>{setTimeout(install,300);setTimeout(install,900);setTimeout(install,1700)});setTimeout(install,600);setInterval(install,900);
})();
