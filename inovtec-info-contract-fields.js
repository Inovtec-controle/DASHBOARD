(()=>{
"use strict";
const params=new URLSearchParams(location.search);
if((params.get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame");
const fb=window.firebase;
const db=fb?.firestore?.();
const auth=fb?.auth?.();
let lastDoc=null,observer=null,loadedSiteId="",dirty=false,syncTimer=null;
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function sites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function siteIdOf(site){return String(site?.id||site?.refId||"")}
function activeSite(d){
  const nom=d?.getElementById("nom")?.value.trim()||"";
  const adresse=d?.getElementById("adresse")?.value.trim()||"";
  if(!nom&&!adresse)return null;
  const list=sites();
  return list.find(s=>norm(s.nom)===norm(nom)&&adresse&&norm(s.adresse)===norm(adresse))
    ||list.find(s=>norm(s.nom)===norm(nom))
    ||list.find(s=>adresse&&norm(s.adresse)===norm(adresse))
    ||null;
}
function fmtDate(value){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||""));
  return m?`${m[3]}/${m[2]}/${m[1]}`:String(value||"");
}
function generalCard(d){
  return [...(d?.querySelectorAll("#siteForm section.card")||[])].find(card=>/informations?\s+g[eé]n[eé]rales?/i.test((card.querySelector("h2")?.textContent||"").trim()))||null;
}
function ensureStyle(d){
  if(!d?.head||d.getElementById("ivContractFieldsStyle"))return;
  const s=d.createElement("style");
  s.id="ivContractFieldsStyle";
  s.textContent=`
    #ivContractFields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px;padding:12px;border:1px solid #dce9e2;border-radius:14px;background:#f9fcfa}
    #ivContractFields .field{min-width:0}#ivContractFields label{font-weight:800;color:#28473c}
    #ivDateFinContrat:not(:placeholder-shown){border-color:#ef9a9a}
    .site-item.iv-contract-ending{position:relative;padding-right:38px!important}
    .site-item.iv-contract-ending.active{border-color:#dc2626!important;background:#fff1f2!important;box-shadow:0 0 0 4px rgba(220,38,38,.13)!important}
    .site-item.iv-contract-ending.active strong{color:#991b1b!important}
    .site-item .iv-contract-lost-mark{position:absolute;right:10px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:999px;border:1px solid #fecaca;background:#fff;color:#dc2626;font-size:12px;font-weight:900;line-height:1;box-shadow:0 1px 3px rgba(15,23,42,.06)}
    .site-item.iv-contract-ending.active .iv-contract-lost-mark{border-color:#dc2626;background:#dc2626;color:#fff}
    @media(max-width:760px){#ivContractFields{grid-template-columns:1fr;padding:10px}.site-item.iv-contract-ending{padding-right:34px!important}.site-item .iv-contract-lost-mark{right:8px}}
  `;
  d.head.appendChild(s);
}
function ensureUi(d){
  if(!d?.body)return;
  ensureStyle(d);
  const card=generalCard(d);if(!card)return;
  let row=d.getElementById("ivContractFields");
  if(!row){
    const baseGrid=card.querySelector(".grid.grid-2")||card.querySelector(".grid");if(!baseGrid)return;
    row=d.createElement("div");row.id="ivContractFields";
    row.innerHTML=`<div class="field"><label for="ivTypeChantier">Type de chantier</label><select id="ivTypeChantier"><option value="">— Sélectionner —</option><option>Copropriété</option><option>Tertiaire</option><option>Résidence</option><option>Autre</option></select></div><div class="field"><label for="ivDateDebutPrestation">Début de prestation</label><input id="ivDateDebutPrestation" type="date"></div><div class="field"><label for="ivDateFinContrat">Fin de contrat</label><input id="ivDateFinContrat" type="date"></div>`;
    baseGrid.insertAdjacentElement("afterend",row);
    ["ivTypeChantier","ivDateDebutPrestation","ivDateFinContrat"].forEach(id=>d.getElementById(id)?.addEventListener("change",()=>{dirty=true;decorateSiteList(d)}));
  }
  const form=d.getElementById("siteForm");
  if(form&&form.dataset.ivContractFieldsBound!=="1"){
    form.dataset.ivContractFieldsBound="1";
    form.addEventListener("submit",()=>{
      const wasNew=/nouveau/i.test(d.getElementById("recordState")?.textContent||"");
      saveAfterBase(d,collect(d),wasNew);
    });
  }
  const newBtn=d.getElementById("newBtn");
  if(newBtn&&newBtn.dataset.ivContractFieldsBound!=="1"){
    newBtn.dataset.ivContractFieldsBound="1";
    newBtn.addEventListener("click",()=>setTimeout(()=>resetDraft(d),0));
  }
}
function collect(d){
  return {
    typeChantier:d.getElementById("ivTypeChantier")?.value.trim()||"",
    dateDebutPrestation:d.getElementById("ivDateDebutPrestation")?.value||"",
    dateFinContrat:d.getElementById("ivDateFinContrat")?.value||""
  };
}
function applySite(d,site,force=false){
  if(!site)return;
  const id=siteIdOf(site);if(!id)return;
  if(id===loadedSiteId&&dirty&&!force)return;
  loadedSiteId=id;
  const type=d.getElementById("ivTypeChantier");if(type)type.value=String(site.typeChantier||"");
  const start=d.getElementById("ivDateDebutPrestation");if(start)start.value=String(site.dateDebutPrestation||"");
  const end=d.getElementById("ivDateFinContrat");if(end)end.value=String(site.dateFinContrat||"");
  dirty=false;
  decorateSiteList(d);
}
function resetDraft(d){
  loadedSiteId="";dirty=false;
  ["ivTypeChantier","ivDateDebutPrestation","ivDateFinContrat"].forEach(id=>{const el=d.getElementById(id);if(el)el.value="";});
  decorateSiteList(d);
}
function findSiteForButton(button){
  const name=norm(button.querySelector("strong")?.textContent||"");if(!name)return null;
  const matches=sites().filter(s=>norm(s.nom)===name);if(matches.length<=1)return matches[0]||null;
  const all=norm(button.textContent||"");
  return matches.find(s=>s.adresse&&all.includes(norm(s.adresse)))||matches[0]||null;
}
function decorateSiteList(d){
  d?.querySelectorAll?.("#siteList .site-item").forEach(button=>{
    const site=findSiteForButton(button);
    const end=String(site?.dateFinContrat||"").trim();
    button.classList.toggle("iv-contract-ending",!!end);
    button.querySelector(".iv-contract-date-note")?.remove();
    let mark=button.querySelector(".iv-contract-lost-mark");
    if(end){
      if(!mark){
        mark=d.createElement("span");
        mark.className="iv-contract-lost-mark";
        mark.setAttribute("aria-hidden","true");
        mark.textContent="✕";
        button.appendChild(mark);
      }
      mark.title=`Chantier perdu — fin de contrat : ${fmtDate(end)}`;
    }else mark?.remove();
  });
}
function syncFromSite(d){
  ensureUi(d);decorateSiteList(d);
  const form=d.getElementById("siteForm");if(!form||form.classList.contains("hidden"))return;
  const state=(d.getElementById("recordState")?.textContent||"").trim();
  if(/nouveau/i.test(state)){
    if(loadedSiteId&&!dirty)resetDraft(d);
    return;
  }
  const site=activeSite(d);
  if(site&&siteIdOf(site)!==loadedSiteId)applySite(d,site,true);
  else if(site&&!dirty)applySite(d,site,false);
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function resolveSavedSite(d,wasNew){
  for(let i=0;i<40;i++){
    if(wasNew&&/nouveau/i.test(d.getElementById("recordState")?.textContent||"")){await wait(125);continue}
    const site=activeSite(d);if(site&&siteIdOf(site))return site;
    await wait(125);
  }
  return null;
}
async function saveAfterBase(d,payload,wasNew){
  if(!db)return;
  const site=await resolveSavedSite(d,wasNew),id=siteIdOf(site);if(!id)return;
  try{
    await db.collection("chantiers").doc(id).set({
      typeChantier:payload.typeChantier,
      dateDebutPrestation:payload.dateDebutPrestation,
      dateFinContrat:payload.dateFinContrat,
      contratSuiviUpdatedAtMs:Date.now(),
      contratSuiviUpdatedBy:auth?.currentUser?.uid||""
    },{merge:true});
    loadedSiteId=id;dirty=false;
    setTimeout(()=>decorateSiteList(d),250);
  }catch(error){
    console.error("Enregistrement des informations de contrat impossible",error);
    alert("Le chantier a été enregistré, mais les dates de contrat n’ont pas pu être synchronisées. Réessaie avec Enregistrer.");
  }
}
function install(){
  const d=doc();if(!d?.body)return;
  if(d!==lastDoc){
    lastDoc=d;loadedSiteId="";dirty=false;
    try{observer?.disconnect()}catch{}
    observer=new MutationObserver(()=>{clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncFromSite(d),70)});
    observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
  }
  syncFromSite(d);
}
frame?.addEventListener("load",()=>{setTimeout(install,120);setTimeout(install,600);setTimeout(install,1400)});
try{window.InovtecDataHub?.subscribe?.(()=>{const d=doc();if(d)syncFromSite(d)})}catch{}
setInterval(install,750);
setTimeout(install,450);
})();
