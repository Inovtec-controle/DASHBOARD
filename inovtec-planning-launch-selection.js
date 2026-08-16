(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="planning")return;
const frame=document.getElementById("legacyFrame"),KEY="inovtec_plannings_v2";
let done=false,hubUnsub=null;
function parse(s){try{return JSON.parse(s)||{}}catch{return{}}}
function requested(){
  let direct="";try{direct=sessionStorage.getItem("ivPlanningOpenAgent")||""}catch{}
  let replacement="";try{replacement=new URLSearchParams(location.search).get("replacementAgent")||""}catch{}
  return{direct,replacement};
}
function planAgentId(req){
  const state=parse(localStorage.getItem(KEY)||"{}"),agents=Array.isArray(state.agents)?state.agents:[];
  if(req.direct){const a=agents.find(x=>String(x.id)===String(req.direct)||String(x.refId||"")===String(req.direct));if(a)return String(a.id)}
  if(req.replacement){const a=agents.find(x=>String(x.refId||x.id)===String(req.replacement)||String(x.id)===String(req.replacement));if(a)return String(a.id)}
  return"";
}
function apply(){
  if(done)return;
  const req=requested();if(!req.direct&&!req.replacement){done=true;return}
  let d;try{d=frame?.contentDocument}catch{return}if(!d?.body)return;
  const id=planAgentId(req);if(!id)return;
  const row=[...d.querySelectorAll(".agent-row[data-agent-id]")].find(x=>String(x.dataset.agentId)===id);if(!row)return;
  done=true;row.click();
  if(req.direct){try{sessionStorage.removeItem("ivPlanningOpenAgent")}catch{}}
}
frame?.addEventListener("load",()=>{setTimeout(apply,120);setTimeout(apply,500);setTimeout(apply,1200)});
setTimeout(apply,450);
try{const h=window.InovtecDataHub;if(h?.subscribe)hubUnsub=h.subscribe(()=>setTimeout(apply,40))}catch{}
})();
