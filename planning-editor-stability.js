(()=>{
"use strict";
const title=document.getElementById("edTitle");
const brief=document.getElementById("edSite");
const pop=document.getElementById("editorPopover");
const done=document.getElementById("edDone");
if(!title||!brief||!pop||!done)return;

let heldValue="";
let opening=false;

function siteList(){
  try{return Array.from(parent?.InovtecDataHub?.chantiers||[])}catch{return[]}
}
function siteById(id){return siteList().find(c=>String(c?.id)===String(id))||null}
function isAddressLike(value,site){
  const v=String(value||"").trim().toLowerCase();
  if(!v||!site)return false;
  return [site.adresse,site.gps].filter(Boolean).some(x=>String(x).trim().toLowerCase()===v);
}
function prepareBriefField(){
  brief.setAttribute("placeholder","Décrire brièvement la tâche du jour…");
  brief.setAttribute("maxlength","140");
  brief.setAttribute("aria-label","Tâche du jour");
  brief.title="Description courte de la tâche à réaliser sur ce chantier";
}
prepareBriefField();

/* Le référentiel se rafraîchit régulièrement. On mémorise le choix utilisateur
   pour qu'un rafraîchissement de la liste ne remette jamais le select à zéro. */
title.addEventListener("change",()=>{
  heldValue=title.value;
  if(opening)return;
  if(heldValue&&heldValue!=="__legacy__"){
    const site=siteById(heldValue);
    if(isAddressLike(brief.value,site))brief.value="";
    else brief.value="";
    brief.focus({preventScroll:true});
  }
});

const selectObserver=new MutationObserver(()=>{
  if(!pop.classList.contains("open")||!heldValue)return;
  const exists=[...title.options].some(o=>o.value===heldValue);
  if(exists&&title.value!==heldValue)title.value=heldValue;
});
selectObserver.observe(title,{childList:true,subtree:true});

const popObserver=new MutationObserver(()=>{
  if(pop.classList.contains("open")){
    opening=true;
    requestAnimationFrame(()=>{
      heldValue=title.value||"";
      const site=siteById(heldValue);
      if(isAddressLike(brief.value,site))brief.value="";
      prepareBriefField();
      opening=false;
    });
  }else{
    heldValue="";
    opening=false;
  }
});
popObserver.observe(pop,{attributes:true,attributeFilter:["class"]});

/* planning-calendar.js utilisait jusqu'ici l'adresse du chantier dans e.site.
   Au clic sur Terminé, on masque l'adresse le temps de l'enregistrement afin que
   la valeur de la zone "tâche du jour" soit enregistrée et affichée sous le nom. */
done.addEventListener("click",()=>{
  const id=title.value;
  if(!id||id==="__legacy__")return;
  const site=siteById(id);
  if(!site)return;
  const hadAddress=Object.prototype.hasOwnProperty.call(site,"adresse");
  const hadGps=Object.prototype.hasOwnProperty.call(site,"gps");
  const address=site.adresse;
  const gps=site.gps;
  site.adresse="";
  site.gps="";
  setTimeout(()=>{
    if(hadAddress)site.adresse=address;else delete site.adresse;
    if(hadGps)site.gps=gps;else delete site.gps;
  },0);
},true);

/* Si le hub modifie la liste pendant que l'utilisateur écrit, la valeur choisie
   reste prioritaire et la saisie n'est pas touchée. */
window.addEventListener("focus",()=>{
  if(pop.classList.contains("open")&&title.value)heldValue=title.value;
});
})();
