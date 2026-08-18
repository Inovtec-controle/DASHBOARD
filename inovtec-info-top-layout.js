(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame");
let lastDoc=null,observer=null,timer=null;
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function cards(d){return Array.from(d?.querySelectorAll?.("#siteForm>section.card")||[])}
function findCard(d,re){return cards(d).find(card=>re.test((card.querySelector("h2")?.textContent||"").trim()))||null}
function ensureStyle(d){
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
function arrange(d){
  const containerLabel=d?.querySelector?.('label[for="locauxConteneurs"]');
  if(containerLabel)containerLabel.textContent="Local conteneurs / aire de présentations";
  const form=d?.getElementById("siteForm");if(!form)return;
  const general=findCard(d,/informations?\s+g[eé]n[eé]rales?/i);
  const contacts=findCard(d,/^contacts?$/i);
  if(!general||!contacts)return;
  ensureStyle(d);
  general.id="ivGeneralInfoCard";
  contacts.id="ivContactsCard";
  if(form.firstElementChild!==general)form.insertBefore(general,form.firstElementChild);
  if(general.nextElementSibling!==contacts)general.insertAdjacentElement("afterend",contacts);
  const contract=d.getElementById("ivContractFields");
  const title=general.querySelector(".section-title");
  if(contract&&title&&title.nextElementSibling!==contract)title.insertAdjacentElement("afterend",contract);
}
function install(){
  const d=doc();if(!d?.body)return;
  if(d!==lastDoc){
    lastDoc=d;
    try{observer?.disconnect()}catch{}
    observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>arrange(d),50)});
    observer.observe(d.body,{childList:true,subtree:true});
  }
  arrange(d);
}
frame?.addEventListener("load",()=>{setTimeout(install,100);setTimeout(install,450);setTimeout(install,1100)});
setInterval(install,800);
setTimeout(install,350);
})();
