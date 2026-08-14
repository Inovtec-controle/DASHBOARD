(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="agents")return;
const frame=document.getElementById("legacyFrame");
let installedFor=null;
function parseHours(v){
  const n=Number(String(v??"").trim().replace(",","."));
  return Number.isFinite(n)&&n>0?n:null;
}
function install(){
  try{
    const w=frame?.contentWindow,d=frame?.contentDocument;
    if(!w||!d||!d.body||!d.getElementById("f_contrat")||!w.state){setTimeout(install,180);return}
    if(installedFor===d)return;
    installedFor=d;

    let input=d.getElementById("f_heuresContrat");
    if(!input){
      const contrat=d.getElementById("f_contrat");
      const field=d.createElement("div");
      field.className="field";
      field.innerHTML='<label>Heures contractuelles / semaine</label><input class="input" type="number" min="1" max="60" step="0.25" id="f_heuresContrat" inputmode="decimal" placeholder="Ex. 12, 24, 35"><div class="muted" style="margin-top:4px">Utilisé par le Planning pour contrôler l’amplitude et le repos quotidien.</div>';
      contrat.closest(".field")?.insertAdjacentElement("afterend",field);
      input=d.getElementById("f_heuresContrat");
    }

    const fill=()=>{
      try{
        const a=w.getSelectedAgent?.();
        if(!input)return;
        const raw=a?.job?.contractHoursWeekly;
        input.value=(raw===null||raw===undefined||raw==="")?"":String(raw);
      }catch{}
    };

    const saveBtn=d.getElementById("btnSaveAgent");
    if(saveBtn&&!saveBtn.dataset.ivContractHours){
      saveBtn.dataset.ivContractHours="1";
      const original=saveBtn.onclick||w.saveAgentForm;
      saveBtn.onclick=function(ev){
        const a=w.getSelectedAgent?.();
        if(a){
          a.job=a.job||{};
          const raw=String(input?.value||"").trim();
          if(raw){
            const n=parseHours(raw);
            if(n===null||n>60){
              alert("Indique un nombre d’heures contractuelles hebdomadaires compris entre 1 et 60 h.");
              input?.focus();
              return;
            }
            a.job.contractHoursWeekly=Math.round(n*100)/100;
          }else{
            a.job.contractHoursWeekly="";
          }
        }
        if(typeof original==="function")original.call(w,ev);
        setTimeout(fill,0);
      };
    }

    d.getElementById("agentList")?.addEventListener("click",()=>setTimeout(fill,0),true);
    if(window.MutationObserver){
      const title=d.getElementById("agentName");
      if(title)new MutationObserver(fill).observe(title,{childList:true,subtree:true,characterData:true});
    }
    fill();
  }catch(e){console.warn("Agent contract hours runtime",e);setTimeout(install,250)}
}
frame?.addEventListener("load",()=>{installedFor=null;setTimeout(install,60)});
setTimeout(install,100);
setTimeout(install,500);
})();
