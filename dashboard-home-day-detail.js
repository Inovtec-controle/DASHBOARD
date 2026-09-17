/* Accueil uniquement : identité visuelle identique au menu commun et détail du planning du jour.
   Lecture seule : ne modifie ni la clé planning ni les fonctionnalités des autres pages. */
(()=>{
'use strict';
if(window.__IV_HOME_DAY_DETAIL_V1__||!document.querySelector('.c3-app'))return;
window.__IV_HOME_DAY_DETAIL_V1__=true;
const $=id=>document.getElementById(id);
const css=document.createElement('style');css.id='ivHomeDayDetailStyle';
css.textContent=`
.c3-sidebar{background:linear-gradient(180deg,#064e3b 0%,#043f32 100%)}
.c3-brand .c3-logo{width:38px;height:38px;flex:0 0 38px;border:6px solid #34d399;border-radius:11px;transform:rotate(30deg);box-shadow:inset 0 0 0 3px rgba(255,255,255,.18);opacity:1}
.c3-nav a.active{background:linear-gradient(135deg,#059669,#16a34a);color:#fff}
#ivHomeDayTrigger{border:0;background:transparent;padding:4px 0;color:var(--c3-green);font:800 10.35px Inter,system-ui,sans-serif;cursor:pointer;text-align:right;white-space:nowrap}
#ivHomeDayTrigger:hover{text-decoration:underline}#ivHomeDayTrigger:focus-visible{outline:2px solid #059669;outline-offset:3px;border-radius:3px}
.iv-home-day-overlay[hidden]{display:none!important}.iv-home-day-overlay{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:16px;background:rgba(6,36,27,.62)}
.iv-home-day-dialog{width:min(1050px,100%);max-height:min(88dvh,900px);display:flex;flex-direction:column;overflow:hidden;border-radius:18px;background:#fff;color:#173b2b;box-shadow:0 30px 90px rgba(0,0,0,.27);font:13px Inter,system-ui,sans-serif}
.iv-home-day-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:19px 22px 12px;border-bottom:1px solid #e4eee8}
.iv-home-day-head h2{font-size:20px;line-height:1.3;margin:0}.iv-home-day-head p{margin:5px 0 0;color:#687e72;font-size:12px}
.iv-home-day-close{flex:0 0 auto;min-width:36px;min-height:36px;border:1px solid #dce9e2;border-radius:10px;background:#f5faf7;color:#173b2b;font-size:22px;line-height:1;cursor:pointer}
.iv-home-day-tools{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 22px;border-bottom:1px solid #e4eee8}.iv-home-day-tools input{flex:1 1 220px;min-width:0;min-height:39px;padding:9px 12px;border:1px solid #cfe2d7;border-radius:10px;font:inherit;color:inherit}.iv-home-day-tools strong{font-size:12px;color:#064e3b}
.iv-home-day-body{min-height:70px;overflow:auto;overscroll-behavior:contain;padding:9px 22px 18px}.iv-home-day-message{padding:16px;border-radius:10px;background:#f1f8f4;color:#526b5b;font-size:12px;line-height:1.5}.iv-home-day-message.warning{background:#fff7e9;color:#8b5e14;margin-bottom:10px}
.iv-home-day-table{width:100%;border-collapse:collapse;text-align:left}.iv-home-day-table th{position:sticky;top:0;z-index:1;background:#f0f7f3;color:#456657;font-size:11px;padding:10px 9px}.iv-home-day-table td{padding:11px 9px;border-bottom:1px solid #eaf1ed;vertical-align:top;font-size:12px;line-height:1.45;overflow-wrap:anywhere}.iv-home-day-table tr:last-child td{border-bottom:0}.iv-home-day-table td:first-child{white-space:nowrap;font-weight:800;color:#064e3b}.iv-home-day-table strong{display:block;font-size:12px}.iv-home-day-table small{display:block;margin-top:3px;color:#6b7d74;font-size:11px}
body.iv-home-day-open{overflow:hidden}
@media(max-width:680px){.iv-home-day-overlay{padding:8px}.iv-home-day-dialog{max-height:94dvh;border-radius:13px}.iv-home-day-head{padding:14px}.iv-home-day-head h2{font-size:17px}.iv-home-day-tools{padding:10px 14px}.iv-home-day-body{padding:7px 10px 14px}.iv-home-day-table thead{display:none}.iv-home-day-table,.iv-home-day-table tbody,.iv-home-day-table tr,.iv-home-day-table td{display:block;width:100%}.iv-home-day-table tr{border:1px solid #e3eee7;border-radius:11px;margin:7px 0;padding:7px}.iv-home-day-table td{border:0;padding:3px 7px}.iv-home-day-table td:before{content:attr(data-label);font-size:10px;color:#6a7e72;font-weight:700;display:block}.iv-home-day-table td:first-child{white-space:normal}}
`;
document.head.appendChild(css);
const trigger=$('c3TodayCount')?.closest('a');if(!trigger)return;
trigger.id='ivHomeDayTrigger';trigger.setAttribute('role','button');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','ivHomeDayOverlay');trigger.title='Afficher toutes les interventions programmées aujourd’hui';
const overlay=document.createElement('div');overlay.id='ivHomeDayOverlay';overlay.className='iv-home-day-overlay';overlay.hidden=true;
overlay.innerHTML='<section class="iv-home-day-dialog" role="dialog" aria-modal="true" aria-labelledby="ivHomeDayTitle"><header class="iv-home-day-head"><div><h2 id="ivHomeDayTitle">Toutes les interventions du jour</h2><p id="ivHomeDayDate"></p></div><button type="button" class="iv-home-day-close" aria-label="Fermer la fenêtre">×</button></header><div class="iv-home-day-tools"><input type="search" id="ivHomeDaySearch" placeholder="Rechercher un agent, un chantier ou une opération…" aria-label="Filtrer les interventions"><strong id="ivHomeDayTotal" aria-live="polite"></strong></div><div id="ivHomeDayBody" class="iv-home-day-body" aria-live="polite"></div></section>';
document.body.appendChild(overlay);
const body=$('ivHomeDayBody'),search=$('ivHomeDaySearch'),total=$('ivHomeDayTotal'),title=$('ivHomeDayDate');
let items=[],previousFocus=null,requestId=0,notice='';
const parse=(v,f)=>{try{return JSON.parse(String(v||''))??f}catch{return f}};
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const local=(key,f)=>{try{return parse(localStorage.getItem(key),f)}catch{return f}};
const modulePayload=(doc,key)=>parse(doc?.moduleSyncV1?.[key]?.payload,{});
function mergeRows(...lists){const out=[],seen=new Set();for(const list of lists)for(const x of(Array.isArray(list)?list:[])){if(!x||typeof x!=='object')continue;const key=String(x.id||x.pdfId||x.agentRefId||[x.title,x.date,x.startDate,x.agentName].join('|'));if(seen.has(key))continue;seen.add(key);out.push(x)}return out}
function mergePlanning(...sources){const valid=sources.filter(x=>x&&typeof x==='object'&&!Array.isArray(x));const result={agents:mergeRows(...valid.map(x=>x.agents||[])),weeks:{}};const keys=new Set(valid.flatMap(x=>Object.keys(x.weeks||{})));for(const week of keys)result.weeks[week]=mergeRows(...valid.map(x=>x.weeks?.[week]||[]));return result}
function weekKey(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const day=(x.getDay()+6)%7;x.setDate(x.getDate()+3-day);const y=new Date(x.getFullYear(),0,4),yd=(y.getDay()+6)%7,w=1+Math.round(((x-y)/86400000-3+yd)/7);return x.getFullYear()+'-W'+String(w).padStart(2,'0')}
function node(tag,txt,cls){const e=document.createElement(tag);if(txt!=null)e.textContent=String(txt);if(cls)e.className=cls;return e}
function render(){body.replaceChildren();const term=norm(search.value.trim());const shown=items.filter(x=>!term||norm([x.time,x.agent,x.task,x.operation,x.note].join(' ')).includes(term));total.textContent=shown.length+' intervention'+(shown.length>1?'s':'')+(term?' trouvée'+(shown.length>1?'s':''):'');if(notice)body.appendChild(node('div',notice,'iv-home-day-message warning'));
 if(!shown.length){body.appendChild(node('p',term?'Aucune intervention ne correspond à cette recherche.':'Aucune intervention programmée pour aujourd’hui.','iv-home-day-message'));return}
 const table=node('table',null,'iv-home-day-table');const thead=node('thead'),tr=node('tr');['Horaires','Agent','Chantier','Opération / détails'].forEach(label=>tr.appendChild(node('th',label)));thead.appendChild(tr);table.appendChild(thead);const tbody=node('tbody');for(const x of shown){const row=node('tr');const cells=[x.time,x.agent,x.task,x.operation];cells.forEach((v,i)=>{const td=node('td');td.dataset.label=['Horaires','Agent','Chantier','Opération / détails'][i];if(i===3){td.appendChild(node('strong',v||'Intervention'));if(x.note)td.appendChild(node('small','Observation : '+x.note))}else td.textContent=v||'—';row.appendChild(td)});tbody.appendChild(row)}table.appendChild(tbody);body.appendChild(table);
}
async function loadToday(id){const date=new Date(),week=weekKey(date),day=(date.getDay()+6)%7;
 const localPlanning=local('inovtec_plannings_v2',{});let shared={},personal={};notice='';
 try{
  const firebase=window.firebase,user=firebase?.auth?.().currentUser;
  if(!user||!firebase?.firestore){notice='Données locales affichées : la synchronisation en ligne n’est pas disponible pour cette consultation.'}
  else{
   const db=firebase.firestore();const SHARED_ID='__inovtec_shared_workspace_v1__';
   const result=await Promise.race([Promise.allSettled([db.collection('chantiers').doc(SHARED_ID).get(),db.collection('kanban').doc(user.uid).get()]),new Promise(resolve=>setTimeout(()=>resolve(null),7000))]);
   if(id!==requestId)return;
   if(!result){notice='Connexion aux données en ligne trop longue : affichage des données locales uniquement.'}
   else{
    if(result[0].status==='fulfilled'&&result[0].value.exists)shared=result[0].value.data()||{};
    if(result[1].status==='fulfilled'&&result[1].value.exists)personal=result[1].value.data()||{};
    if(result.some(r=>r.status==='rejected'))notice='Certaines données en ligne sont temporairement indisponibles : la liste peut être incomplète.';
   }
  }
 }catch{notice='Données locales affichées : la synchronisation en ligne est momentanément indisponible.'}
 if(id!==requestId)return;
 const planning=mergePlanning(modulePayload(shared,'planning'),modulePayload(personal,'planning'),localPlanning);
 const allAgents=mergeRows(planning.agents,local('kontrol_agents_classeur_v2',[]));
 const name=agentId=>{const a=allAgents.find(x=>String(x.id)===String(agentId)||String(x.refId)===String(agentId));return a?.name||a?.displayName||[a?.identity?.prenom,a?.identity?.nom].filter(Boolean).join(' ')||'Agent non identifié'};
 items=(planning.weeks?.[week]||[]).filter(x=>Number(x.day)===day).map(x=>({time:[x.start,x.end].filter(Boolean).join(' – ')||'—',agent:name(x.agentId),task:String(x.task||x.chantier||'Intervention'),operation:String(x.site||x.details||x.description||x.task||'Intervention'),note:String(x.note||'')})).sort((a,b)=>a.time.localeCompare(b.time)||a.agent.localeCompare(b.agent,'fr'));
 title.textContent=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);
 render();
}
function close(){if(overlay.hidden)return;overlay.hidden=true;document.body.classList.remove('iv-home-day-open');requestId++;previousFocus?.focus?.()}
function open(event){event?.preventDefault?.();previousFocus=document.activeElement;overlay.hidden=false;document.body.classList.add('iv-home-day-open');items=[];notice='';search.value='';total.textContent='Chargement…';body.replaceChildren(node('div','Récupération des interventions de tous les agents…','iv-home-day-message'));search.focus();loadToday(++requestId)}
trigger.addEventListener('click',open);
trigger.addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();open(e)}});
overlay.querySelector('.iv-home-day-close').addEventListener('click',close);
overlay.addEventListener('mousedown',e=>{if(e.target===overlay)close()});
document.addEventListener('keydown',e=>{if(overlay.hidden)return;if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='Tab'){const controls=[search,overlay.querySelector('.iv-home-day-close')];const first=controls[0],last=controls[1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
search.addEventListener('input',render);
})();
