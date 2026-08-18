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
function ensureStyle(d){
  if(!d?.head||d.getElementById("ivContactTypeStyle"))return;
  const s=d.createElement("style");
  s.id="ivContactTypeStyle";
  s.textContent=`
    #siteForm .field:has(#gps),#gpsBtn{display:none!important}
    #ivContactTypeBlock{margin:2px 0 16px}.iv-contact-type-title{font-size:12px;font-weight:850;color:#163f31;margin-bottom:9px}.iv-contact-type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.iv-contact-choice{appearance:none;width:100%;border:1px solid #d8e5df;border-radius:14px;background:#fff;padding:13px 14px;display:flex;align-items:center;gap:11px;text-align:left;cursor:pointer;transition:border-color .15s,box-shadow .15s,background .15s}.iv-contact-choice:hover{border-color:#93c9ad}.iv-contact-choice.active{border-color:#15905d;background:#f5fcf8;box-shadow:0 0 0 3px rgba(21,144,93,.09)}.iv-contact-radio{width:20px;height:20px;border:2px solid #aebdb6;border-radius:50%;display:grid;place-items:center;flex:0 0 20px}.iv-contact-choice.active .iv-contact-radio{border-color:#15905d}.iv-contact-choice.active .iv-contact-radio:after{content:"";width:10px;height:10px;border-radius:50%;background:#15905d}.iv-contact-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#eaf8f0;color:#087247;font-size:17px;flex:0 0 38px}.iv-contact-copy{min-width:0}.iv-contact-copy strong{display:block;color:#153e30;font-size:13px}.iv-contact-copy span{display:block;color:#75857d;font-size:10px;line-height:1.35;margin-top:2px}.iv-client-title{font-size:12px;font-weight:850;color:#163f31;margin:2px 0 9px}.iv-client-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.iv-client-grid .field{min-width:0}.iv-contact-help{margin-top:10px;padding:9px 11px;border:1px solid #dcebe3;border-radius:11px;background:#f7fcf9;color:#60766b;font-size:10px;line-height:1.4}.iv-contact-help strong{color:#176044}#ivSyndicContactFields[hidden],#ivClientContactFields[hidden]{display:none!important}
    @media(max-width:760px){.iv-contact-type-grid,.iv-client-grid{grid-template-columns:1fr}.iv-contact-choice{padding:11px}.iv-contact-copy strong{font-size:12px}}
  `;
  d.head.appendChild(s);
}
function contactCard(d){
  return [...(d?.querySelectorAll("#siteForm section.card")||[])].find(card=>/^contacts?$/i.test((card.querySelector("h2")?.textContent||"").trim()))||null;
}
function cleanType(type){
  if(type==="client")return "client";
  if(type==="syndic_cs")return "syndic_cs";
  return "";
}
function setType(d,type,markDirty=false){
  const block=d.getElementById("ivContactTypeBlock");
  if(!block)return;
  const next=cleanType(type);
  block.dataset.contactType=next;
  block.querySelectorAll(".iv-contact-choice").forEach(btn=>{
    const active=!!next&&btn.dataset.type===next;
    btn.classList.toggle("active",active);
    btn.setAttribute("aria-pressed",active?"true":"false");
  });
  const syndic=d.getElementById("ivSyndicContactFields"),client=d.getElementById("ivClientContactFields");
  if(syndic)syndic.hidden=next!=="syndic_cs";
  if(client)client.hidden=next!=="client";
  if(markDirty)dirty=true;
}
function ensureUi(d){
  if(!d?.body)return;
  ensureStyle(d);
  const card=contactCard(d);if(!card)return;
  let block=d.getElementById("ivContactTypeBlock");
  if(!block){
    const currentGrid=card.querySelector(".grid.grid-2")||card.querySelector(".grid");
    if(!currentGrid)return;
    currentGrid.id="ivSyndicContactFields";
    block=d.createElement("div");
    block.id="ivContactTypeBlock";
    block.dataset.contactType="";
    block.innerHTML=`<div class="iv-contact-type-title">Type de contact à utiliser</div><div class="iv-contact-type-grid"><button type="button" class="iv-contact-choice" data-type="syndic_cs" aria-pressed="false"><span class="iv-contact-radio"></span><span class="iv-contact-icon">♙</span><span class="iv-contact-copy"><strong>Syndic / conseil syndical</strong><span>Affiche les contacts syndic et conseil syndical.</span></span></button><button type="button" class="iv-contact-choice" data-type="client" aria-pressed="false"><span class="iv-contact-radio"></span><span class="iv-contact-icon">●</span><span class="iv-contact-copy"><strong>Client</strong><span>Affiche le contact client simple et dédié.</span></span></button></div>`;
    currentGrid.insertAdjacentElement("beforebegin",block);
    const client=d.createElement("div");
    client.id="ivClientContactFields";
    client.hidden=true;
    client.innerHTML=`<div class="iv-client-title">Contact client</div><div class="iv-client-grid"><div class="field"><label for="ivClientNom">Nom client</label><input id="ivClientNom" autocomplete="organization" placeholder="Ex. : Société Dupont"></div><div class="field"><label for="ivClientTelephone">Téléphone client</label><input id="ivClientTelephone" type="tel" autocomplete="tel" placeholder="Ex. : 06 12 34 56 78"></div><div class="field"><label for="ivClientEmail">Email client</label><input id="ivClientEmail" type="email" autocomplete="email" placeholder="Ex. : contact@dupont.fr"></div></div><div class="iv-contact-help"><strong>Client sélectionné :</strong> les anciennes informations Syndic / Conseil syndical restent conservées mais ne sont pas affichées.</div>`;
    currentGrid.insertAdjacentElement("afterend",client);
    block.querySelectorAll(".iv-contact-choice").forEach(btn=>btn.addEventListener("click",()=>setType(d,btn.dataset.type,true)));
    ["ivClientNom","ivClientTelephone","ivClientEmail"].forEach(id=>d.getElementById(id)?.addEventListener("input",()=>{dirty=true}));
    setType(d,"",false);
  }
  const form=d.getElementById("siteForm");
  if(form&&form.dataset.ivContactModeBound!=="1"){
    form.dataset.ivContactModeBound="1";
    form.addEventListener("submit",()=>{
      const wasNew=/nouveau/i.test(d.getElementById("recordState")?.textContent||"");
      const payload=collect(d);
      saveAfterBase(d,payload,wasNew);
    });
  }
  const newBtn=d.getElementById("newBtn");
  if(newBtn&&newBtn.dataset.ivContactModeBound!=="1"){
    newBtn.dataset.ivContactModeBound="1";
    newBtn.addEventListener("click",()=>setTimeout(()=>resetDraft(d),0));
  }
}
function collect(d){
  return {
    contactType:cleanType(d.getElementById("ivContactTypeBlock")?.dataset.contactType||""),
    clientNom:d.getElementById("ivClientNom")?.value.trim()||"",
    clientTelephone:d.getElementById("ivClientTelephone")?.value.trim()||"",
    clientEmail:d.getElementById("ivClientEmail")?.value.trim()||""
  };
}
function applySite(d,site,force=false){
  if(!site)return;
  const id=siteIdOf(site);if(!id)return;
  if(id===loadedSiteId&&dirty&&!force)return;
  loadedSiteId=id;
  d.getElementById("ivClientNom").value=String(site.clientNom||"");
  d.getElementById("ivClientTelephone").value=String(site.clientTelephone||"");
  d.getElementById("ivClientEmail").value=String(site.clientEmail||"");
  setType(d,cleanType(site.contactType),false);
  dirty=false;
}
function resetDraft(d){
  loadedSiteId="";dirty=false;
  if(d.getElementById("ivClientNom"))d.getElementById("ivClientNom").value="";
  if(d.getElementById("ivClientTelephone"))d.getElementById("ivClientTelephone").value="";
  if(d.getElementById("ivClientEmail"))d.getElementById("ivClientEmail").value="";
  setType(d,"",false);
}
function syncFromSite(d){
  ensureUi(d);
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
  const site=await resolveSavedSite(d,wasNew);
  const id=siteIdOf(site);if(!id)return;
  try{
    await db.collection("chantiers").doc(id).set({
      contactType:payload.contactType,
      clientNom:payload.clientNom,
      clientTelephone:payload.clientTelephone,
      clientEmail:payload.clientEmail,
      contactModeUpdatedAtMs:Date.now(),
      contactModeUpdatedBy:auth?.currentUser?.uid||""
    },{merge:true});
    loadedSiteId=id;dirty=false;
  }catch(error){
    console.error("Enregistrement du type de contact impossible",error);
    alert("Le chantier a été enregistré, mais le type de contact n’a pas pu être synchronisé. Réessaie avec Enregistrer.");
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
try{window.InovtecDataHub?.subscribe?.(()=>{const d=doc();if(d&&!dirty)syncFromSite(d)})}catch{}
setTimeout(install,450);
})();
