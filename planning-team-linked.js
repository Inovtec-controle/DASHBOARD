/* Planning equipes liees : un planning commun visible chez chaque membre,
   avec exceptions individuelles possibles par semaine. */
(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_TEAMS_V1__)return;
window.__INOVTEC_PLANNING_TEAMS_V1__=true;

const KEY="inovtec_plannings_v2";
const safe=v=>v==null?"":String(v);
const uid=p=>p+"_"+Date.now()+"_"+Math.random().toString(16).slice(2);
let syncing=false,menuObserver=null,renderObserver=null,syncTimer=0;

function parseState(){
  try{
    const raw=localStorage.getItem(KEY);
    const s=raw?JSON.parse(raw):null;
    if(!s||typeof s!=="object"||Array.isArray(s))return null;
    if(!Array.isArray(s.agents))s.agents=[];
    if(!s.weeks||typeof s.weeks!=="object"||Array.isArray(s.weeks))s.weeks={};
    if(!s.teamPlanning||typeof s.teamPlanning!=="object"||Array.isArray(s.teamPlanning))s.teamPlanning={teams:[]};
    if(!Array.isArray(s.teamPlanning.teams))s.teamPlanning.teams=[];
    return s;
  }catch{return null}
}
function normalizeTeam(t){
  if(!t||typeof t!=="object")return null;
  t.id=safe(t.id)||uid("team");
  t.name=safe(t.name)||"Équipe";
  t.members=Array.from(new Set((Array.isArray(t.members)?t.members:[]).map(safe).filter(Boolean)));
  t.referenceAgentId=safe(t.referenceAgentId);
  if(!t.exceptions||typeof t.exceptions!=="object"||Array.isArray(t.exceptions))t.exceptions={};
  if(!t.weeks||typeof t.weeks!=="object"||Array.isArray(t.weeks))t.weeks={};
  return t;
}
function cleanTeams(state){
  const ids=new Set(state.agents.map(a=>safe(a?.id)).filter(Boolean));
  const seen=new Set();
  state.teamPlanning.teams=(state.teamPlanning.teams||[]).map(normalizeTeam).filter(Boolean).map(t=>{
    t.members=t.members.filter(id=>ids.has(id)&&!seen.has(id));
    t.members.forEach(id=>seen.add(id));
    if(!t.members.includes(t.referenceAgentId))t.referenceAgentId=t.members[0]||"";
    Object.keys(t.exceptions).forEach(w=>{
      t.exceptions[w]=(Array.isArray(t.exceptions[w])?t.exceptions[w]:[]).map(safe).filter(id=>t.members.includes(id));
      if(!t.exceptions[w].length)delete t.exceptions[w];
    });
    return t;
  }).filter(t=>t.members.length>=2);
}
function currentWeek(){
  const v=document.getElementById("week")?.value||"";
  return /^\d{4}-W\d{2}$/.test(v)?v:"";
}
function rows(state,week,agentId){
  return (Array.isArray(state.weeks?.[week])?state.weeks[week]:[]).filter(e=>safe(e?.agentId)===safe(agentId));
}
function rowShape(e){
  return {day:Number(e?.day)||0,start:safe(e?.start),end:safe(e?.end),task:safe(e?.task),site:safe(e?.site),chantierId:safe(e?.chantierId),note:safe(e?.note)};
}
function signature(list){
  return JSON.stringify((Array.isArray(list)?list:[]).map(rowShape).sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.task.localeCompare(b.task)||a.site.localeCompare(b.site)));
}
function teamForAgent(state,agentId){
  return state.teamPlanning.teams.find(t=>t.members.includes(safe(agentId)))||null;
}
function agentLabel(state,id){return safe(state.agents.find(a=>safe(a?.id)===safe(id))?.name)||"Agent"}
function exceptionSet(team,week){return new Set((Array.isArray(team.exceptions?.[week])?team.exceptions[week]:[]).map(safe))}
function isAlternating(agent){return agent?.parityMode==="alternating"}
function parityKind(week){const m=String(week).match(/W(\d{2})$/);return m&&Number(m[1])%2?"odd":"even"}

function markCopiedAsTemplate(state,week,agentId){
  const a=state.agents.find(x=>safe(x?.id)===safe(agentId));
  if(!a)return;
  if(isAlternating(a)){
    if(!a.parityTemplates||typeof a.parityTemplates!=="object")a.parityTemplates={even:"",odd:""};
    if(!a.parityInheritedWeeks||typeof a.parityInheritedWeeks!=="object")a.parityInheritedWeeks={};
    delete a.parityInheritedWeeks[week];
    a.parityTemplates[parityKind(week)]=week;
  }else{
    if(!state.standardRecurrence||typeof state.standardRecurrence!=="object")state.standardRecurrence={};
    let meta=state.standardRecurrence[agentId];
    if(!meta||typeof meta!=="object")meta=state.standardRecurrence[agentId]={template:"",inheritedWeeks:{}};
    if(!meta.inheritedWeeks||typeof meta.inheritedWeeks!=="object")meta.inheritedWeeks={};
    delete meta.inheritedWeeks[week];
    meta.template=week;
  }
}
function replaceMemberWeek(state,week,targetId,sourceRows,sourceId){
  const all=Array.isArray(state.weeks[week])?state.weeks[week]:[];
  const keep=all.filter(e=>safe(e?.agentId)!==safe(targetId));
  const clones=sourceRows.map(src=>{
    const e={...src,id:uid("e"),agentId:targetId,_teamInheritedFrom:sourceId};
    delete e._parityInheritedFrom;
    delete e._standardInheritedFrom;
    return e;
  });
  state.weeks[week]=keep.concat(clones);
  markCopiedAsTemplate(state,week,targetId);
}
function chooseSource(state,team,week,eligible,meta){
  const selected=safe(state.selected);
  if(!meta){
    if(eligible.includes(selected)&&rows(state,week,selected).length)return selected;
    if(eligible.includes(team.referenceAgentId)&&rows(state,week,team.referenceAgentId).length)return team.referenceAgentId;
    return eligible.find(id=>rows(state,week,id).length)||"";
  }
  const lastSig=safe(meta.signature);
  const changed=eligible.filter(id=>signature(rows(state,week,id))!==lastSig);
  if(changed.length){
    if(changed.includes(selected))return selected;
    if(changed.includes(team.referenceAgentId))return team.referenceAgentId;
    const groups=new Map();
    changed.forEach(id=>{const sig=signature(rows(state,week,id));const g=groups.get(sig)||[];g.push(id);groups.set(sig,g)});
    const largest=Array.from(groups.values()).sort((a,b)=>b.length-a.length)[0]||[];
    return largest.includes(team.referenceAgentId)?team.referenceAgentId:(largest[0]||changed[0]);
  }
  if(eligible.includes(selected)&&rows(state,week,selected).length)return selected;
  if(eligible.includes(team.referenceAgentId)&&rows(state,week,team.referenceAgentId).length)return team.referenceAgentId;
  return eligible.find(id=>rows(state,week,id).length)||"";
}
function syncTeamWeek(state,team,week,forceSource){
  const except=exceptionSet(team,week);
  const eligible=team.members.filter(id=>!except.has(id));
  if(eligible.length<2)return false;
  const meta=team.weeks[week]&&typeof team.weeks[week]==="object"?team.weeks[week]:null;
  let source=forceSource&&eligible.includes(forceSource)&&(rows(state,week,forceSource).length||meta)?forceSource:chooseSource(state,team,week,eligible,meta);
  if(!source)return false;
  const sourceRows=rows(state,week,source);
  if(!sourceRows.length&&!meta)return false;
  const sig=signature(sourceRows);
  let changed=false;
  eligible.forEach(id=>{
    if(id===source)return;
    if(signature(rows(state,week,id))!==sig){replaceMemberWeek(state,week,id,sourceRows,source);changed=true}
  });
  if(!meta||changed||safe(meta.signature)!==sig){
    team.weeks[week]={signature:sig,sourceAgentId:source,updatedAt:new Date().toISOString()};
    changed=true;
  }
  return changed;
}
function saveState(state,rerender=true){
  localStorage.setItem(KEY,JSON.stringify(state));
  if(rerender)window.dispatchEvent(new Event("inovtec:planning-cloud-updated"));
}
function syncCurrentWeek(forceSource){
  if(syncing)return false;
  const state=parseState(),week=currentWeek();
  if(!state||!week)return false;
  syncing=true;
  try{
    cleanTeams(state);
    let changed=false;
    state.teamPlanning.teams.forEach(team=>{if(syncTeamWeek(state,team,week,forceSource))changed=true});
    if(changed)saveState(state,true);
    decorateAgents(state);
    return changed;
  }finally{syncing=false}
}
function scheduleSync(delay=300,forceSource){
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>syncCurrentWeek(forceSource),delay);
}

function decorateAgents(state){
  const s=state||parseState();if(!s)return;
  document.querySelectorAll(".agent-row[data-agent-id]").forEach(row=>{
    const id=safe(row.dataset.agentId),name=row.querySelector(".agent-name"),team=teamForAgent(s,id);
    if(!name)return;
    name.querySelector(".iv-team-mark")?.remove();
    if(team){
      const mark=document.createElement("span");
      mark.className="iv-team-mark";
      mark.textContent=" 👥";
      mark.title=`Équipe : ${team.name}`;
      name.appendChild(mark);
    }
  });
}

function closeMenu(){document.getElementById("contextMenu")?.classList.remove("open")}
function injectMenu(){
  const menu=document.getElementById("contextMenu");
  if(!menu?.classList.contains("open")||menu.querySelector("[data-iv-team-menu='1']"))return;
  const state=parseState();if(!state)return;
  cleanTeams(state);
  const agentId=safe(state.selected);if(!agentId)return;
  const team=teamForAgent(state,agentId),week=currentWeek();
  const sep=document.createElement("div");sep.className="context-sep";sep.dataset.ivTeamMenu="1";
  menu.appendChild(sep);
  const info=document.createElement("button");info.type="button";info.className="context-item";info.dataset.ivTeamMenu="1";
  info.textContent=team?`👥 Équipe : ${team.name}`:"👥 Planning d’équipe";
  info.style.fontWeight="800";info.style.cursor="default";info.onclick=e=>e.preventDefault();
  menu.appendChild(info);
  const manage=document.createElement("button");manage.type="button";manage.className="context-item";manage.dataset.ivTeamMenu="1";
  manage.textContent=team?"Gérer l’équipe":"Créer / rejoindre une équipe";
  manage.onclick=()=>{closeMenu();openTeamModal(agentId,team?.id||"")};
  menu.appendChild(manage);
  if(team&&week){
    const ex=exceptionSet(team,week).has(agentId);
    const exception=document.createElement("button");exception.type="button";exception.className="context-item";exception.dataset.ivTeamMenu="1";
    exception.textContent=ex?"Revenir au planning d’équipe":"Exception individuelle cette semaine";
    exception.onclick=()=>{closeMenu();toggleException(agentId,team.id,week,!ex)};
    menu.appendChild(exception);
    const leave=document.createElement("button");leave.type="button";leave.className="context-item danger";leave.dataset.ivTeamMenu="1";
    leave.textContent="Retirer cet agent de l’équipe";
    leave.onclick=()=>{closeMenu();leaveTeam(agentId,team.id)};
    menu.appendChild(leave);
  }
  requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
}

function ensureModal(){
  let modal=document.getElementById("ivTeamModal");if(modal)return modal;
  const style=document.createElement("style");
  style.textContent=`.iv-team-mark{font-size:11px;opacity:.78}.iv-team-modal{position:fixed;inset:0;z-index:10080;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55);backdrop-filter:blur(3px)}.iv-team-modal.open{display:flex}.iv-team-panel{width:min(540px,100%);max-height:min(86vh,760px);overflow:auto;background:#fff;border:1px solid #dfe5e2;border-radius:18px;box-shadow:0 28px 80px rgba(15,23,42,.25);padding:16px}.iv-team-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.iv-team-top h3{margin:0;font-size:16px}.iv-team-close{border:0;background:#f1f5f3;border-radius:10px;padding:8px 10px;font-weight:800}.iv-team-field{margin-top:11px}.iv-team-field label{display:block;font-size:11px;font-weight:800;color:#64748b;margin-bottom:5px}.iv-team-field input,.iv-team-field select{width:100%;border:1px solid #dfe5e2;border-radius:11px;padding:9px 10px;background:#fff}.iv-team-members{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}.iv-team-member{display:flex;align-items:center;gap:8px;border:1px solid #e6ebe8;border-radius:11px;padding:8px;font-size:12px;font-weight:700}.iv-team-note{font-size:11px;color:#64748b;line-height:1.45;margin-top:10px}.iv-team-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:15px;padding-top:12px;border-top:1px solid #edf0ee}.iv-team-actions button{border:1px solid #dfe5e2;border-radius:11px;padding:9px 12px;background:#fff;font-weight:800}.iv-team-actions .primary{background:#0b6b43;color:#fff;border-color:#0b6b43}.iv-team-actions .danger{color:#c62828}@media(max-width:560px){.iv-team-members{grid-template-columns:1fr}.iv-team-panel{padding:13px}}`;
  document.head.appendChild(style);
  modal=document.createElement("div");modal.className="iv-team-modal";modal.id="ivTeamModal";
  modal.innerHTML=`<div class="iv-team-panel" role="dialog" aria-modal="true"><div class="iv-team-top"><h3>Planning d’équipe</h3><button type="button" class="iv-team-close">Fermer</button></div><div class="iv-team-field"><label>Équipe</label><select id="ivTeamChoice"></select></div><div class="iv-team-field"><label>Nom de l’équipe</label><input id="ivTeamName" maxlength="60" placeholder="Ex. Équipe Améthyste"></div><div class="iv-team-field"><label>Membres</label><div class="iv-team-members" id="ivTeamMembers"></div></div><div class="iv-team-field"><label>Planning de référence</label><select id="ivTeamReference"></select></div><div class="iv-team-note">Tous les membres affichent le même planning. Une modification faite sur un membre est répercutée sur l’équipe, sauf si une exception individuelle est activée pour la semaine.</div><div class="iv-team-actions"><button type="button" class="danger" id="ivTeamDelete" hidden>Supprimer l’équipe</button><button type="button" class="primary" id="ivTeamSave">Enregistrer</button></div></div>`;
  document.body.appendChild(modal);
  modal.querySelector(".iv-team-close").onclick=()=>modal.classList.remove("open");
  modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});
  return modal;
}
function fillEditor(state,modal,teamId,focusAgentId){
  const choice=modal.querySelector("#ivTeamChoice"),name=modal.querySelector("#ivTeamName"),members=modal.querySelector("#ivTeamMembers"),ref=modal.querySelector("#ivTeamReference"),del=modal.querySelector("#ivTeamDelete");
  choice.innerHTML='<option value="">Nouvelle équipe</option>'+state.teamPlanning.teams.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
  choice.value=teamId||"";
  const team=state.teamPlanning.teams.find(t=>t.id===teamId)||null;
  name.value=team?.name||"";
  const selected=new Set(team?.members||[focusAgentId]);selected.add(focusAgentId);
  members.innerHTML="";
  state.agents.forEach(a=>{
    const lab=document.createElement("label");lab.className="iv-team-member";
    const cb=document.createElement("input");cb.type="checkbox";cb.value=a.id;cb.checked=selected.has(a.id);
    const span=document.createElement("span");span.textContent=a.name||"Agent";
    lab.append(cb,span);members.appendChild(lab);
  });
  const refreshRef=()=>{
    const ids=Array.from(members.querySelectorAll("input:checked")).map(x=>x.value);
    const current=ref.value||team?.referenceAgentId||focusAgentId;
    ref.innerHTML=ids.map(id=>`<option value="${id}">${agentLabel(state,id)}</option>`).join("");
    ref.value=ids.includes(current)?current:(ids[0]||"");
  };
  members.onchange=refreshRef;refreshRef();del.hidden=!team;
  choice.onchange=()=>fillEditor(state,modal,choice.value,focusAgentId);
}
function openTeamModal(agentId,teamId){
  const state=parseState();if(!state)return;cleanTeams(state);
  const modal=ensureModal();fillEditor(state,modal,teamId,agentId);modal.classList.add("open");
  modal.querySelector("#ivTeamSave").onclick=()=>saveTeamFromModal(agentId);
  modal.querySelector("#ivTeamDelete").onclick=()=>deleteTeamFromModal(agentId);
}
function saveTeamFromModal(focusAgentId){
  const modal=ensureModal(),state=parseState();if(!state)return;
  cleanTeams(state);
  const chosen=modal.querySelector("#ivTeamChoice").value;
  const name=safe(modal.querySelector("#ivTeamName").value).trim();
  const members=Array.from(modal.querySelectorAll("#ivTeamMembers input:checked")).map(x=>safe(x.value));
  const ref=safe(modal.querySelector("#ivTeamReference").value);
  if(!name){alert("Donne un nom à l’équipe.");return}
  if(members.length<2){alert("Sélectionne au moins deux agents pour créer une équipe.");return}
  let team=state.teamPlanning.teams.find(t=>t.id===chosen);
  if(!team){team=normalizeTeam({id:uid("team"),name,members:[],referenceAgentId:ref,exceptions:{},weeks:{}});state.teamPlanning.teams.push(team)}
  state.teamPlanning.teams.forEach(t=>{if(t.id!==team.id)t.members=t.members.filter(id=>!members.includes(id))});
  state.teamPlanning.teams=state.teamPlanning.teams.filter(t=>t.id===team.id||t.members.length>=2);
  team.name=name;team.members=members;team.referenceAgentId=members.includes(ref)?ref:members[0];
  team.weeks={};team.exceptions=team.exceptions||{};
  cleanTeams(state);
  const week=currentWeek();
  if(week)syncTeamWeek(state,team,week,team.referenceAgentId);
  saveState(state,true);modal.classList.remove("open");setTimeout(()=>{decorateAgents();scheduleSync(120,team.referenceAgentId)},80);
}
function deleteTeamFromModal(){
  const modal=ensureModal(),state=parseState();if(!state)return;
  const id=modal.querySelector("#ivTeamChoice").value,team=state.teamPlanning.teams.find(t=>t.id===id);if(!team)return;
  if(!confirm(`Supprimer l’équipe « ${team.name} » ? Les plannings déjà affichés resteront en place mais ne seront plus liés.`))return;
  state.teamPlanning.teams=state.teamPlanning.teams.filter(t=>t.id!==id);saveState(state,true);modal.classList.remove("open");setTimeout(()=>decorateAgents(),80);
}
function toggleException(agentId,teamId,week,enable){
  const state=parseState();if(!state)return;cleanTeams(state);
  const team=state.teamPlanning.teams.find(t=>t.id===teamId);if(!team)return;
  const set=exceptionSet(team,week);if(enable)set.add(agentId);else set.delete(agentId);
  if(set.size)team.exceptions[week]=Array.from(set);else delete team.exceptions[week];
  if(!enable){const source=team.referenceAgentId===agentId?team.members.find(id=>id!==agentId):team.referenceAgentId;if(source&&rows(state,week,source).length)replaceMemberWeek(state,week,agentId,rows(state,week,source),source);team.weeks[week]=undefined;delete team.weeks[week];}
  saveState(state,true);setTimeout(()=>scheduleSync(100),70);
}
function leaveTeam(agentId,teamId){
  const state=parseState();if(!state)return;cleanTeams(state);
  const team=state.teamPlanning.teams.find(t=>t.id===teamId);if(!team)return;
  if(!confirm(`Retirer ${agentLabel(state,agentId)} de l’équipe « ${team.name} » ? Son planning actuel restera affiché mais ne sera plus synchronisé avec l’équipe.`))return;
  team.members=team.members.filter(id=>id!==agentId);if(team.referenceAgentId===agentId)team.referenceAgentId=team.members[0]||"";
  if(team.members.length<2)state.teamPlanning.teams=state.teamPlanning.teams.filter(t=>t.id!==team.id);
  saveState(state,true);setTimeout(()=>decorateAgents(),80);
}

function bind(){
  const menu=document.getElementById("contextMenu");
  if(menu&&!menuObserver){menuObserver=new MutationObserver(()=>{injectMenu();setTimeout(()=>decorateAgents(),0)});menuObserver.observe(menu,{attributes:true,attributeFilter:["class"],childList:true,subtree:false})}
  const list=document.getElementById("agentList");
  if(list&&!renderObserver){renderObserver=new MutationObserver(()=>decorateAgents());renderObserver.observe(list,{childList:true,subtree:true})}
  ["prevBtn","nextBtn","todayBtn"].forEach(id=>document.getElementById(id)?.addEventListener("click",()=>scheduleSync(280)));
  document.querySelectorAll(".view-tab").forEach(b=>b.addEventListener("click",()=>scheduleSync(280)));
  document.getElementById("agentList")?.addEventListener("click",()=>scheduleSync(180),true);
  document.getElementById("edDone")?.addEventListener("click",()=>scheduleSync(300),true);
  document.getElementById("edDelete")?.addEventListener("click",()=>scheduleSync(300),true);
  document.addEventListener("mouseup",()=>scheduleSync(360),true);
  document.addEventListener("dblclick",()=>scheduleSync(320),true);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")document.getElementById("ivTeamModal")?.classList.remove("open")});
  setTimeout(()=>{decorateAgents();syncCurrentWeek()},220);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
