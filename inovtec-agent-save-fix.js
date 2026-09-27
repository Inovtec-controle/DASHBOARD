(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="agents")return;
const frame=document.getElementById("legacyFrame");
let bound=null;
const val=(d,id)=>String(d.getElementById(id)?.value||"").trim();
function install(){
  let w,d;try{w=frame?.contentWindow;d=frame?.contentDocument}catch{return}
  if(!w||!d?.body||!w.state||typeof w.getSelectedAgent!=="function"||typeof w.save!=="function"){setTimeout(install,150);return}
  if(bound===d)return;
  const btn=d.getElementById("btnSaveAgent");
  if(!btn){setTimeout(install,150);return}
  bound=d;
  btn.disabled=false;
  btn.removeAttribute("disabled");
  btn.style.pointerEvents="auto";
  btn.style.cursor="pointer";
  btn.addEventListener("click",function(e){
    e.preventDefault();e.stopImmediatePropagation();
    const agent=w.getSelectedAgent();
    if(!agent){w.alert("Aucun agent sélectionné.");return}
    const prenom=val(d,"f_prenom"),nom=val(d,"f_nom");
    if(!(prenom+" "+nom).trim()){w.alert("Renseigne au moins le prénom ou le nom de l’agent avant d’enregistrer.");d.getElementById("f_prenom")?.focus();return}
    agent.identity=agent.identity||{}; agent.job=agent.job||{};
    Object.assign(agent.identity,{
      prenom,nom,telephone:val(d,"f_tel"),email:val(d,"f_email"),adresse:val(d,"f_adresse"),
      dateNaissance:val(d,"f_dn"),secu:val(d,"f_secu"),permis:val(d,"f_permis"),vehicule:val(d,"f_vehicule")
    });
    Object.assign(agent.job,{
      poste:val(d,"f_poste"),typeContrat:val(d,"f_contrat"),dateEntree:val(d,"f_entree"),
      sitePrincipal:val(d,"f_site"),disponibilites:val(d,"f_dispo"),notes:val(d,"f_notes")
    });
    const hours=val(d,"f_heuresContrat");
    if(hours){
      const n=Number(hours.replace(",","."));
      if(!Number.isFinite(n)||n<=0||n>60){w.alert("Indique un nombre d’heures contractuelles hebdomadaires compris entre 1 et 60 h.");d.getElementById("f_heuresContrat")?.focus();return}
      agent.job.contractHoursWeekly=Math.round(n*100)/100;
    }else agent.job.contractHoursWeekly="";
    const titulaire=d.getElementById("f_estTitulaire");
    const replacement=d.getElementById("f_titulaireRemplace");
    if(titulaire){
      agent.job.estTitulaire=!!titulaire.checked;
      agent.job.titulaireRemplaceId=titulaire.checked?"":String(replacement?.value||"");
    }
    delete agent._draft;
    if(typeof w.touchAgent==="function")w.touchAgent(agent); else agent.updatedAt=new Date().toISOString();
    if(typeof w.rememberSelectedAgent==="function")w.rememberSelectedAgent(agent.id);
    w.save();
    try{window.dispatchEvent(new CustomEvent("inovtec:agent-local-saved",{detail:{id:agent.id,updatedAt:agent.updatedAt}}))}catch{}
    if(typeof w.renderAll==="function")w.renderAll();
  },true);
}
frame?.addEventListener("load",()=>{bound=null;setTimeout(install,60);setTimeout(install,350)});
setTimeout(install,100);setTimeout(install,600);
})();