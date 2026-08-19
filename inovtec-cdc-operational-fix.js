(()=>{
"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame"),fb=window.firebase,db=fb?.firestore?.(),auth=fb?.auth?.();
if(!frame||!db)return;
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const uid=()=>"cdc_"+Date.now()+"_"+Math.random().toString(16).slice(2);
function doc(){try{return frame.contentDocument}catch{return null}}
function hubSites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function visible(d){return{nom:d?.getElementById("nom")?.value.trim()||"",adresse:d?.getElementById("adresse")?.value.trim()||""}}
async function resolveSite(d){
 const form=d?.getElementById("siteForm"),{nom,adresse}=visible(d);if(!form||(!nom&&!adresse))return null;
 try{const viaImporter=await window.InovtecCdcImport?.resolveSite?.();if(viaImporter?.id){form.dataset.ivChantierId=viaImporter.id;return viaImporter}}catch{}
 const known=String(form.dataset.ivChantierId||"").trim();
 if(known){try{const s=await db.collection("chantiers").doc(known).get();if(s.exists){const x={id:s.id,...s.data()};if((!nom||norm(x.nom)===norm(nom))&&(!adresse||norm(x.adresse)===norm(adresse)))return x}}catch{}}
 const list=hubSites();let x=list.find(c=>norm(c.nom)===norm(nom)&&(!adresse||norm(c.adresse)===norm(adresse)))||list.find(c=>nom&&norm(c.nom)===norm(nom))||list.find(c=>adresse&&norm(c.adresse)===norm(adresse));
 if(x?.id){form.dataset.ivChantierId=x.id;return x}
 try{if(nom){const snap=await db.collection("chantiers").where("nom","==",nom).limit(10).get(),found=snap.docs.map(s=>({id:s.id,...s.data()}));x=found.find(c=>!adresse||norm(c.adresse)===norm(adresse))||found[0]||null}if(!x){const snap=await db.collection("chantiers").limit(500).get(),all=snap.docs.map(s=>({id:s.id,...s.data()}));x=all.find(c=>norm(c.nom)===norm(nom)&&(!adresse||norm(c.adresse)===norm(adresse)))||all.find(c=>nom&&norm(c.nom)===norm(nom))||all.find(c=>adresse&&norm(c.adresse)===norm(adresse))||null}if(x?.id)form.dataset.ivChantierId=x.id;return x}catch(e){console.error("Résolution chantier CDC impossible",e);return null}
}
function setMessage(d,msg,ok=true){let n=d.getElementById("ivCdcFixMessage");if(!n){n=d.createElement("div");n.id="ivCdcFixMessage";n.style.cssText="margin:10px 0;padding:8px 10px;border-radius:10px;font-size:10px;font-weight:700";d.getElementById("ivCdcCard")?.querySelector(".iv-cdc-head")?.insertAdjacentElement("afterend",n)}if(!n)return;n.textContent=msg;n.style.background=ok?"#f2fbf6":"#fff6f6";n.style.color=ok?"#17623f":"#9b2c2c";n.style.border="1px solid "+(ok?"#cce9d8":"#f0cccc")}
function openManual(d){const o=d.getElementById("ivCdcOverlay");if(!o)return false;o.dataset.rowId="";d.getElementById("ivCdcModalTitle")&&(d.getElementById("ivCdcModalTitle").textContent="Ajouter une prestation");["ivCdcZone","ivCdcPrestation","ivCdcFrequence","ivCdcControle","ivCdcMethode","ivCdcObservations"].forEach(id=>{const e=d.getElementById(id);if(e)e.value=""});const t=d.getElementById("ivCdcFrequenceType");if(t)t.value="jours";d.querySelectorAll("[data-iv-cdc-day]").forEach(c=>c.checked=false);o.hidden=false;setTimeout(()=>d.getElementById("ivCdcPrestation")?.focus(),20);return true}
async function saveManual(d){const site=await resolveSite(d);if(!site?.id){setMessage(d,"Impossible d’identifier le chantier. Enregistre la fiche puis resélectionne-la.",false);return}const prestation=d.getElementById("ivCdcPrestation")?.value.trim()||"";if(!prestation){d.getElementById("ivCdcPrestation")?.focus();return}const o=d.getElementById("ivCdcOverlay"),rowId=o?.dataset.rowId||"",jours=[...d.querySelectorAll("[data-iv-cdc-day]:checked")].map(x=>x.dataset.ivCdcDay),payload={zone:d.getElementById("ivCdcZone")?.value.trim()||"",prestation,frequence:d.getElementById("ivCdcFrequence")?.value.trim()||"",frequenceType:d.getElementById("ivCdcFrequenceType")?.value||"jours",jours,methodeConsigne:d.getElementById("ivCdcMethode")?.value.trim()||"",controle:d.getElementById("ivCdcControle")?.value.trim()||"",observations:d.getElementById("ivCdcObservations")?.value.trim()||""},now=Date.now();
 try{await db.runTransaction(async tx=>{const ref=db.collection("chantiers").doc(site.id),snap=await tx.get(ref);if(!snap.exists)throw Error("Chantier introuvable");const old=snap.data()?.cahierDesChargesV1?.rows||[],next=old.map(r=>({...r}));if(rowId){const i=next.findIndex(r=>String(r.id)===String(rowId));if(i>=0)next[i]={...next[i],...payload,updatedAtMs:now}}else{const ordre=Math.max(0,...next.map(r=>Number(r.ordre)||0))+10;next.push({id:uid(),...payload,ordre,sourceType:"manual",createdAtMs:now,updatedAtMs:now})}tx.update(ref,{"cahierDesChargesV1.schemaVersion":2,"cahierDesChargesV1.structuredSchedule":true,"cahierDesChargesV1.rows":next,"cahierDesChargesV1.updatedAtMs":now,"cahierDesChargesV1.updatedBy":auth?.currentUser?.uid||""})});if(o){o.hidden=true;o.dataset.rowId=""}setMessage(d,"Cahier des charges enregistré dans Firebase.",true)}catch(e){console.error(e);setMessage(d,"Échec de l’enregistrement du cahier des charges.",false);alert("Impossible d’enregistrer le cahier des charges.")}
}
function patch(d){
 const card=d.getElementById("ivCdcCard");if(!card)return;
 const add=d.getElementById("ivCdcAdd"),imp=d.getElementById("ivCdcImport"),form=d.getElementById("ivCdcForm");
 if(add){add.disabled=false;add.textContent="＋ Saisir manuellement"}
 if(imp){imp.textContent="📄 Importer PDF / Excel";imp.title="Importer un cahier des charges PDF ou Excel"}
 if(d.body.dataset.ivCdcOperationalFix!=="1"){
  d.body.dataset.ivCdcOperationalFix="1";
  d.addEventListener("click",async e=>{
   const b=e.target.closest?.("#ivCdcAdd");if(!b)return;e.preventDefault();e.stopImmediatePropagation();const s=await resolveSite(d);if(!s?.id){alert("Enregistre ou sélectionne d’abord un chantier.");return}openManual(d)
  },true);
  d.addEventListener("submit",e=>{if(e.target?.id!=="ivCdcForm")return;e.preventDefault();e.stopImmediatePropagation();saveManual(d)},true);
 }
 if(form)form.dataset.ivOperationalFix="1";
}
function install(){const d=doc();if(!d?.body)return;patch(d)}
frame.addEventListener("load",()=>{setTimeout(install,180);setTimeout(install,700);setTimeout(install,1400)});setInterval(install,900);setTimeout(install,450);
})();
