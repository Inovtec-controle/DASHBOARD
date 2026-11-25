/*
 * Infos chantier — mise en page unifiée de la fiche.
 *
 * Fusion non-destructive des anciens modules top-layout et save-placement.
 * Un seul MutationObserver surveille le formulaire et applique dans l'ordre :
 * informations générales / contacts, puis position du bouton Enregistrer.
 * Aucun accès à Firebase et aucune modification des données métier.
 */
(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame");
if(!frame)return;
let lastDoc=null,observer=null,refreshTimer=null;
function doc(){try{return frame.contentDocument||null}catch{return null}}

function cards(d){return Array.from(d?.querySelectorAll?.("#siteForm>section.card")||[])}
function findCard(d,re){return cards(d).find(card=>re.test((card.querySelector("h2")?.textContent||"").trim()))||null}
function ensureTopStyle(d){
  if(!d?.head||d.getElementById("ivInfoTopLayoutStyle"))return;
  const style=d.createElement("style");
  style.id="ivInfoTopLayoutStyle";
  style.textContent=`
    body.iv-mode-infos #siteForm>#ivGeneralInfoCard,
    body.iv-mode-infos #siteForm>#ivContactsCard{
      grid-column:1/-1!important;
      width:100%!important;
      max-width:none!important;
      justify-self:stretch!important;
      box-sizing:border-box!important;
    }
    #ivGeneralInfoCard>#ivContractFields{
      margin:0 0 14px!important;
      width:100%!important;
      box-sizing:border-box!important;
    }
    @media(max-width:760px){
      #ivGeneralInfoCard>#ivContractFields{margin-bottom:12px!important}
    }
  `;
  d.head.appendChild(style);
}
function ensureTypeOptions(d){
  const select=d?.getElementById("ivTypeChantier");if(!select)return;
  const wanted=["","Copropriétés","Tertiaire","Industriels","Autre"];
  const actual=[...select.options].map(o=>o.value||o.textContent||"");
  if(actual.length===wanted.length&&actual.every((v,i)=>v===wanted[i]))return;
  const previous=select.value;
  const mapped=previous==="Copropriété"?"Copropriétés":previous==="Industriel"?"Industriels":wanted.includes(previous)?previous:"";
  select.innerHTML='<option value="">— Sélectionner —</option><option value="Copropriétés">Copropriétés</option><option value="Tertiaire">Tertiaire</option><option value="Industriels">Industriels</option><option value="Autre">Autre</option>';
  select.value=mapped;
}
function arrange(d){
  const containerLabel=d?.querySelector?.('label[for="locauxConteneurs"]');
  if(containerLabel)containerLabel.textContent="Local conteneurs";
  const form=d?.getElementById("siteForm");if(!form)return;
  ensureTypeOptions(d);
  const general=findCard(d,/informations?\s+g[eé]n[eé]rales?/i);
  const contacts=findCard(d,/^contacts?$/i);
  if(!general||!contacts)return;
  ensureTopStyle(d);
  general.id="ivGeneralInfoCard";
  contacts.id="ivContactsCard";
  if(form.firstElementChild!==general)form.insertBefore(general,form.firstElementChild);
  if(general.nextElementSibling!==contacts)general.insertAdjacentElement("afterend",contacts);
  const contract=d.getElementById("ivContractFields");
  const title=general.querySelector(".section-title");
  if(contract&&title&&title.nextElementSibling!==contract)title.insertAdjacentElement("afterend",contract);
}

function ensureSaveStyle(d){
  if(!d?.head||d.getElementById("ivInfoSavePlacementStyle"))return;
  const s=d.createElement("style");
  s.id="ivInfoSavePlacementStyle";
  s.textContent=`
    #siteForm>.sticky-save.iv-after-cdc{
      position:static!important;
      bottom:auto!important;
      left:auto!important;
      right:auto!important;
      width:100%!important;
      margin:12px 0 0!important;
      padding:12px 0 4px!important;
      background:transparent!important;
      border-top:1px solid #dfeae4;
      display:flex!important;
      justify-content:flex-end!important;
      gap:8px!important;
      z-index:auto!important;
    }
    #siteForm>.sticky-save.iv-after-cdc .btn{min-width:150px}
    @media(max-width:700px){
      #siteForm>.sticky-save.iv-after-cdc{flex-direction:column}
      #siteForm>.sticky-save.iv-after-cdc .btn{width:100%;min-width:0}
    }
  `;
  d.head.appendChild(s);
}
function place(d){
  if(!d?.body)return;
  ensureSaveStyle(d);
  const form=d.getElementById("siteForm"),cdc=d.getElementById("ivCdcCard"),history=d.getElementById("ivControlHistoryCard");
  const bar=form?.querySelector(":scope > .sticky-save")||form?.querySelector(".sticky-save");
  if(!form||!bar)return;
  const anchor=history||cdc;
  if(anchor&&anchor.nextElementSibling!==bar)anchor.insertAdjacentElement("afterend",bar);
  bar.classList.add("iv-after-cdc");
}

function apply(d){
  if(!d?.body)return;
  arrange(d);
  place(d);
}
function schedule(d){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>{if(d===doc())apply(d)},60);
}
function install(){
  const d=doc();if(!d?.body)return;
  if(d!==lastDoc){
    lastDoc=d;
    clearTimeout(refreshTimer);
    try{observer?.disconnect()}catch{}
    observer=new MutationObserver(()=>schedule(d));
    observer.observe(d.body,{childList:true,subtree:true});
  }
  apply(d);
}
frame.addEventListener("load",()=>{
  for(const delay of [100,150,450,700,1100,1500])setTimeout(install,delay);
});
setTimeout(install,350);
setTimeout(install,500);
})();
