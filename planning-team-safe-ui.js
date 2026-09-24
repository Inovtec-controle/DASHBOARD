/* Gestion d'équipes ciblée : conserve la protection des plannings personnalisés.
   Seuls Enregistrer l'équipe et la validation explicite d'une intervention peuvent
   copier un horaire vers un membre dont le créneau est vide ou encore identique
   à la dernière version commune. Aucun recalcul au chargement/navigation. */
(()=>{
'use strict';
if(window.InovtecSafeTeamPlanning)return;
const KEY='inovtec_plannings_v2';
const str=x=>x==null?'':String(x);
const uid=prefix=>prefix+'_'+Date.now()+'_'+Math.random().toString(16).slice(2);
const read=()=>{
 try{
  const s=JSON.parse(localStorage.getItem(KEY)||'null');
  if(!s||typeof s!=='object'||Array.isArray(s))return null;
  if(!Array.isArray(s.agents))s.agents=[];
  if(!s.weeks||typeof s.weeks!=='object'||Array.isArray(s.weeks))s.weeks={};
  if(!s.teamPlanning||typeof s.teamPlanning!=='object'||Array.isArray(s.teamPlanning))s.teamPlanning={teams:[]};
  if(!Array.isArray(s.teamPlanning.teams))s.teamPlanning.teams=[];
  return s;
 }catch{return null}
};
const label=(s,id)=>str(s.agents.find(a=>str(a?.id)===str(id))?.name)||'Agent';
const agent=(s,id)=>s.agents.find(a=>str(a?.id)===str(id)||str(a?.refId)===str(id));
const teamFor=(s,id)=>s.teamPlanning.teams.find(t=>Array.isArray(t.members)&&t.members.includes(id));
const entries=(s,week,id)=>(Array.isArray(s.weeks[week])?s.weeks[week]:[]).filter(e=>str(e?.agentId)===id);
const shape=e=>({day:Number(e.day)||0,start:str(e.start),end:str(e.end),task:str(e.task),site:str(e.site),chantierId:str(e.chantierId),note:str(e.note)});
const signature=list=>JSON.stringify(list.map(shape).sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.task.localeCompare(b.task)||a.site.localeCompare(b.site)));
const persist=s=>{
  const payload=JSON.stringify(s);
  try{localStorage.setItem(KEY,payload)}catch(e){console.warn('Planning équipe : copie locale indisponible',e)}
  window.dispatchEvent(new CustomEvent('inovtec:planning-local-saved',{detail:{at:Date.now(),payload,stored:true,source:'team'}}));
  window.dispatchEvent(new Event('inovtec:planning-cloud-updated'));
};
function protectAndShare(s,team,week,sourceId,initial=false){
 if(!Array.isArray(team.members)||team.members.length<2||!team.members.includes(sourceId))return false;
 const source=entries(s,week,sourceId),meta=team.weeks?.[week]||null;
 if(!source.length&&!meta)return false;
 const sig=signature(source),old=meta?.signature;
 if(!initial&&old===sig)return false;
 let changed=false;
 team.exceptions=team.exceptions&&typeof team.exceptions==='object'?team.exceptions:{};
 const exceptions=new Set(Array.isArray(team.exceptions[week])?team.exceptions[week]:[]);
 for(const targetId of team.members){
  if(targetId===sourceId||exceptions.has(targetId))continue;
  const existing=entries(s,week,targetId),current=signature(existing);
  if(current===sig)continue;
  // Même un créneau auparavant partagé devient individuel s'il a été modifié.
  // Seul un planning vide ou strictement identique à la précédente version
  // commune peut être mis à jour sans risque d'effacer une intervention.
  const safeToReplace=!existing.length||(old!=null&&current===old);
  if(!safeToReplace){exceptions.add(targetId);changed=true;continue}
  const keep=(Array.isArray(s.weeks[week])?s.weeks[week]:[]).filter(e=>str(e?.agentId)!==targetId);
  const clones=source.map(e=>({...e,id:uid('e'),agentId:targetId,_teamInheritedFrom:sourceId}));
  s.weeks[week]=keep.concat(clones);
  changed=true;
 }
 if(exceptions.size)team.exceptions[week]=[...exceptions];else delete team.exceptions[week];
 team.weeks=team.weeks&&typeof team.weeks==='object'?team.weeks:{};
 if(old!==sig||changed){team.weeks[week]={signature:sig,sourceAgentId:sourceId,updatedAt:new Date().toISOString()};changed=true}
 return changed;
}
function decorate(){
 const s=read();if(!s)return;
 document.querySelectorAll('.agent-row[data-agent-id]').forEach(row=>{
  const id=str(row.dataset.agentId),name=row.querySelector('.agent-name');
  if(!name)return;
  const t=teamFor(s,id);name.querySelector('.iv-safe-team-mark')?.remove();
  if(!t)return;
  const badge=document.createElement('span');badge.className='iv-safe-team-mark';badge.textContent=' 👥';badge.title='Équipe : '+t.name;name.appendChild(badge);
 });
}
let popup=null,focused='';
function modal(){
 if(popup?.isConnected)return popup;
 const style=document.createElement('style');
 style.textContent='.iv-safe-team-mark{font-size:11px;opacity:.75}.iv-team-modal{position:fixed;inset:0;z-index:10080;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55)}.iv-team-modal.open{display:flex}.iv-team-panel{width:min(540px,100%);max-height:min(86vh,760px);overflow:auto;background:#fff;color:#173b2b;border-radius:17px;padding:17px;box-shadow:0 26px 72px rgba(0,0,0,.23);font:13px Inter,system-ui,sans-serif}.iv-team-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}.iv-team-top h3{margin:0;font-size:17px}.iv-team-top button,.iv-team-actions button{border:1px solid #dfe5e2;border-radius:10px;padding:9px 12px;background:#fff;font-weight:800;cursor:pointer}.iv-team-field{margin-top:12px}.iv-team-field>label{display:block;font-size:12px;font-weight:800;margin-bottom:6px}.iv-team-field>input,.iv-team-field>select{width:100%;min-height:38px;border:1px solid #dfe5e2;border-radius:9px;padding:8px;background:#fff;color:#173b2b}.iv-team-members{display:grid;grid-template-columns:1fr 1fr;gap:7px}.iv-team-member{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #e4ece7;border-radius:9px;font-weight:650}.iv-team-note{margin-top:11px;color:#64748b;font-size:11px;line-height:1.55}.iv-team-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.iv-team-actions .primary{background:#0b6b43;color:#fff;border-color:#0b6b43}.iv-team-actions .danger{color:#b91c1c;margin-right:auto}@media(max-width:560px){.iv-team-members{grid-template-columns:1fr}.iv-team-panel{padding:12px}}';
 document.head.appendChild(style);
 popup=document.createElement('div');popup.id='ivTeamModal';popup.className='iv-team-modal';
 popup.innerHTML='<div class="iv-team-panel" role="dialog" aria-modal="true" aria-label="Planning d’équipe"><div class="iv-team-top"><h3>Planning d’équipe</h3><button type="button" id="ivTeamClose">Fermer</button></div><div class="iv-team-field"><label for="ivTeamChoice">Équipe</label><select id="ivTeamChoice"></select></div><div class="iv-team-field"><label for="ivTeamName">Nom de l’équipe</label><input id="ivTeamName" maxlength="60" placeholder="Ex. Équipe Améthyste"></div><div class="iv-team-field"><label>Membres partageant ce planning</label><div id="ivTeamMembers" class="iv-team-members"></div></div><div class="iv-team-field"><label for="ivTeamReference">Planning de référence</label><select id="ivTeamReference"></select></div><p class="iv-team-note">Le planning de référence est partagé avec les membres dont les créneaux sont libres. Les horaires individuels déjà différents sont conservés : ils ne sont jamais écrasés automatiquement.</p><div class="iv-team-actions"><button type="button" class="danger" id="ivTeamDelete" hidden>Supprimer l’équipe</button><button type="button" class="primary" id="ivTeamSave">Enregistrer</button></div></div>';
 document.body.appendChild(popup);
 popup.querySelector('#ivTeamClose').onclick=()=>popup.classList.remove('open');
 popup.addEventListener('click',e=>{if(e.target===popup)popup.classList.remove('open')});
 return popup;
}
function editor(s,teamId,focus){
 const m=modal(),choice=m.querySelector('#ivTeamChoice'),name=m.querySelector('#ivTeamName'),members=m.querySelector('#ivTeamMembers'),ref=m.querySelector('#ivTeamReference'),del=m.querySelector('#ivTeamDelete');
 const teams=s.teamPlanning.teams;
 choice.replaceChildren(new Option('Nouvelle équipe',''),...teams.map(t=>new Option(t.name||'Équipe',t.id)));
 choice.value=teamId||'';
 const t=teams.find(x=>x.id===teamId)||null;
 name.value=t?.name||'';
 const selected=new Set(t?.members||[focus]);selected.add(focus);
 members.replaceChildren();
 for(const a of s.agents){
  const lab=document.createElement('label');lab.className='iv-team-member';
  const cb=document.createElement('input');cb.type='checkbox';cb.value=str(a.id);cb.checked=selected.has(str(a.id));
  const span=document.createElement('span');span.textContent=a.name||'Agent';lab.append(cb,span);members.appendChild(lab);
 }
 const refresh=()=>{
  const ids=[...members.querySelectorAll('input:checked')].map(x=>x.value),prior=ref.value||t?.referenceAgentId||focus;
  ref.replaceChildren(...ids.map(id=>new Option(label(s,id),id)));
  ref.value=ids.includes(prior)?prior:(ids[0]||'');
 };
 members.onchange=refresh;refresh();
 choice.onchange=()=>editor(s,choice.value,focus);
 del.hidden=!t;
}
function open(id){
 const s=read(),a=s&&agent(s,id);if(!a)return false;
 focused=str(a.id);
 const t=teamFor(s,focused);
 editor(s,t?.id||'',focused);
 const m=modal();m.classList.add('open');
 m.querySelector('#ivTeamSave').onclick=save;
 m.querySelector('#ivTeamDelete').onclick=removeTeam;
 return true;
}
function save(){
 const m=modal(),s=read();if(!s)return;
 const chosen=m.querySelector('#ivTeamChoice').value;
 const name=m.querySelector('#ivTeamName').value.trim();
 const ids=[...m.querySelectorAll('#ivTeamMembers input:checked')].map(n=>n.value);
 const ref=m.querySelector('#ivTeamReference').value;
 if(!name){alert('Donne un nom à l’équipe.');return}
 if(ids.length<2){alert('Sélectionne au moins deux agents pour créer une équipe.');return}
 if(!ids.includes(focused)){alert('L’agent sélectionné doit appartenir à son équipe.');return}
 let t=s.teamPlanning.teams.find(x=>x.id===chosen);
 if(!t){t={id:uid('team'),name,members:[],referenceAgentId:ref,exceptions:{},weeks:{}};s.teamPlanning.teams.push(t)}
 const oldMembers=new Set(t.members||[]);
 for(const other of s.teamPlanning.teams){if(other.id!==t.id)other.members=(other.members||[]).filter(id=>!ids.includes(id))}
 s.teamPlanning.teams=s.teamPlanning.teams.filter(other=>other.id===t.id||other.members.length>=2);
 t.name=name;t.members=[...new Set(ids)];t.referenceAgentId=t.members.includes(ref)?ref:t.members[0];
 t.exceptions=t.exceptions&&typeof t.exceptions==='object'?t.exceptions:{};
 t.weeks=t.weeks&&typeof t.weeks==='object'?t.weeks:{};
 // Un nouveau membre conserve ses plannings individuels déjà renseignés.
 for(const week of Object.keys(s.weeks)){
  if(!entries(s,week,t.referenceAgentId).length)continue;
  if(oldMembers.size===0)delete t.weeks[week];
  protectAndShare(s,t,week,t.referenceAgentId,true);
 }
 persist(s);m.classList.remove('open');decorate();
}
function removeTeam(){
 const m=modal(),s=read();if(!s)return;
 const id=m.querySelector('#ivTeamChoice').value,t=s.teamPlanning.teams.find(x=>x.id===id);
 if(!t||!confirm('Supprimer l’équipe « '+t.name+' » ? Les plannings existants seront conservés.'))return;
 s.teamPlanning.teams=s.teamPlanning.teams.filter(x=>x.id!==id);
 persist(s);m.classList.remove('open');decorate();
}
let syncTimer=0;
function onExplicitEdit(agentId,week){
 clearTimeout(syncTimer);
 syncTimer=setTimeout(()=>{
  const s=read(),a=s&&agent(s,agentId);if(!a)return;
  const t=teamFor(s,str(a.id));if(!t)return;
  const w=/^\d{4}-W\d{2}$/.test(week||'')?week:document.getElementById('week')?.value;
  if(!w)return;
  if((t.exceptions?.[w]||[]).includes(str(a.id)))return;
  if(protectAndShare(s,t,w,str(a.id),false))persist(s);
 },550);
}
function bind(){
 const list=document.getElementById('agentList'),menu=document.getElementById('contextMenu');
 if(list)new MutationObserver(()=>decorate()).observe(list,{childList:true});
 if(menu)new MutationObserver(()=>{
  if(!menu.classList.contains('open')||menu.querySelector('[data-iv-safe-team]'))return;
  const s=read(),contextId=str(menu.dataset.agentId||s?.selected),a=s&&agent(s,contextId);if(!a)return;
  const action=document.createElement('button');action.type='button';action.className='context-item';action.dataset.ivSafeTeam='1';
  action.textContent=teamFor(s,str(a.id))?'👥 Gérer le planning d’équipe':'👥 Lier des agents au même planning';
  action.onclick=()=>{menu.classList.remove('open');open(a.id)};
  menu.appendChild(action);
 }).observe(menu,{attributes:true,attributeFilter:['class'],childList:true});
 for(const id of ['edDone','edDelete'])document.getElementById(id)?.addEventListener('click',()=>{
  const s=read(),pop=document.getElementById('editorPopover'),id=str(document.getElementById('edAgent')?.value||s?.selected);
  onExplicitEdit(id,pop?.dataset.week||document.getElementById('week')?.value);
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')modal()?.classList.remove('open')});
 decorate();
}
window.InovtecSafeTeamPlanning={open};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
