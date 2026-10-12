(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_REPLACEMENT_V2__)return;
window.__INOVTEC_PLANNING_REPLACEMENT_V2__=true;
const ABS_KEY="inovtec_absences_v1",PLAN_KEY="inovtec_plannings_v2";const $=id=>document.getElementById(id);const pad=n=>String(n).padStart(2,"0");
let absences=[],cloudBound=false,cloudReady=false,cloudError=false,activeOptimizerId="",observers=[],panelState=null;
const pwin=(()=>{try{return parent&&parent!==window?parent:window}catch{return window}})();
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const compactName=s=>norm(s).replace(/\s+/g,"");
function sameAgent(l,a){
  if(!l||!a)return false;
  const ref=String(l.agentRefId||"").trim();
  if(ref&&[a.refId,a.id].filter(Boolean).map(String).includes(ref))return true;
  const n=compactName(l.agentName);
  return !!(n&&[a.name,a.displayName,[a.identity?.prenom,a.identity?.nom].filter(Boolean).join(" ")].some(x=>compactName(x)===n));
}
function leaveCandidates(a,status){
  return absences.filter(l=>l&&!l.deleted&&l.status===status&&
    /^\d{4}-\d{2}-\d{2}$/.test(String(l.startDate||""))&&
    /^\d{4}-\d{2}-\d{2}$/.test(String(l.endDate||""))&&sameAgent(l,a));
}
function chooseLeave(list,agent,p){
  if(!list.length)return null;
  const covered=list.map(l=>({l,n:affectedRows(l,agent,p).length})).filter(x=>x.n>0);
  if(covered.length)return covered.sort((a,b)=>a.l.startDate.localeCompare(b.l.startDate))[0].l;
  const today=parseISO(dateISO(new Date())).getTime();
  return [...list].sort((a,b)=>Math.abs(parseISO(a.startDate).getTime()-today)-Math.abs(parseISO(b.startDate).getTime()-today))[0];
}
function parse(s,f){try{return JSON.parse(s)||f}catch{return f}}
function plan(){const p=window.InovtecPlanningAPI?.getState?.()||{};return p&&p.weeks?p:{agents:[],weeks:{}}}
function savePlan(p){
  if(window.InovtecPlanningAPI?.replaceState){
    window.InovtecPlanningAPI.replaceState(p,{persist:true,source:"replacement"});
  }else{
    window.dispatchEvent(new CustomEvent("inovtec:planning-save-request",{detail:{at:Date.now(),payload:JSON.stringify(p),source:"replacement"}}));
  }
}
function loadAbs(){const a=parse(localStorage.getItem(ABS_KEY)||"[]",[]);absences=Array.isArray(a)?a:[]}
function dateISO(d){return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseISO(s){const m=String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3]):null}
function dateFromWeek(key,day){const m=String(key).match(/^(\d{4})-W(\d{2})$/);if(!m)return null;const year=+m[1],week=+m[2],jan4=new Date(year,0,4),offset=(jan4.getDay()+6)%7,mon=new Date(year,0,4-offset);mon.setDate(mon.getDate()+(week-1)*7+(Number(day)||0));return mon}
function covers(l,date){return l?.status==="approved"&&date>=l.startDate&&date<=l.endDate}
function agentForPlanning(a,p){if(!a)return null;return(p.agents||[]).find(x=>String(x.refId||x.id)===String(a.agentRefId))||(p.agents||[]).find(x=>norm(x.name)===norm(a.agentName))||null}
function selectedAgent(p=plan()){return(p.agents||[]).find(a=>String(a.id)===String(p.selected))||null}
function leaveForAgent(a,p=plan()){return a?chooseLeave(leaveCandidates(a,"approved"),a,p):null}
function pendingLeaveForAgent(a,p=plan()){return a?chooseLeave(leaveCandidates(a,"pending"),a,p):null}
function affectedRows(l,agent,p=plan()){const out=[];Object.entries(p.weeks||{}).forEach(([week,rows])=>(rows||[]).forEach(e=>{if(String(e.agentId)!==String(agent.id))return;const d=dateFromWeek(week,e.day),iso=d&&dateISO(d);if(iso&&covers(l,iso))out.push({week,event:e,date:d,iso})}));return out.sort((a,b)=>a.iso.localeCompare(b.iso)||String(a.event.start).localeCompare(String(b.event.start)))}
function timeMin(t){const m=String(t||"").match(/^(\d{1,2}):(\d{2})$/);return m?+m[1]*60+ +m[2]:0}
function minutes(e){return Math.max(0,timeMin(e.end)-timeMin(e.start))}
function overlap(a,b){return timeMin(a.start)<timeMin(b.end)&&timeMin(b.start)<timeMin(a.end)}
function entriesOn(p,agentId,week,day){return(p.weeks?.[week]||[]).filter(e=>String(e.agentId)===String(agentId)&&Number(e.day)===Number(day))}
function absentCandidate(candidate,date,p){return absences.some(l=>l&&!l.deleted&&l.status==="approved"&&covers(l,date)&&sameAgent(l,candidate))}
function familiarity(p,candidate,e){let n=0;Object.values(p.weeks||{}).forEach(rows=>(rows||[]).forEach(x=>{if(String(x.agentId)!==String(candidate.id))return;if(e.chantierId&&x.chantierId===e.chantierId)n+=2;else if(e.site&&norm(x.site)===norm(e.site))n++}));return Math.min(n,8)}
function weekLoad(p,candidate,week){return(p.weeks?.[week]||[]).filter(e=>String(e.agentId)===String(candidate.id)).reduce((n,e)=>n+minutes(e),0)}
function candidatesFor(row,p,original){return(p.agents||[]).filter(a=>String(a.id)!==String(original.id)).map(a=>{const dayRows=entriesOn(p,a.id,row.week,row.event.day),conflict=dayRows.some(e=>overlap(e,row.event)),away=absentCandidate(a,row.iso,p),load=weekLoad(p,a,row.week),fam=familiarity(p,a,row.event),score=Math.round(100+fam*7-load/90-(conflict?180:0)-(away?250:0));return{agent:a,conflict,away,load,fam,score,available:!conflict&&!away}}).sort((a,b)=>(b.available-a.available)||b.score-a.score).slice(0,3)}
function initials(name){return String(name||"?").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")}
function refreshOptimizerFromCloud(){
  if(!activeOptimizerId||!$("ivReplacementBackdrop")?.classList.contains("open"))return;
  const p=plan(),a=(p.agents||[]).find(x=>String(x.id)===activeOptimizerId);
  if(a)openOptimizer(a,leaveForAgent(a,p));
}
function bindCloud(){
  if(cloudBound)return;
  let f=null;
  try{f=pwin.firebase?.auth&&pwin.firebase?.firestore?pwin.firebase:window.firebase}catch{}
  if(!f?.auth||!f?.firestore){setTimeout(bindCloud,500);return}
  cloudBound=true;
  f.auth().onAuthStateChanged(u=>{
    if(!u){cloudReady=false;cloudError=true;refreshOptimizerFromCloud();return}
    f.firestore().collection("kanban").doc(u.uid).onSnapshot(snap=>{
      const entry=snap.exists?snap.data()?.moduleSyncV1?.conges:null;
      if(entry){
        const remote=parse(entry.payload||"[]",null);
        if(!Array.isArray(remote)){cloudError=true;console.warn("Format des congés Firebase invalide");refreshOptimizerFromCloud();return}
        absences=remote;
      }
      cloudReady=true;cloudError=false;
      decorate();refreshOptimizerFromCloud();
    },e=>{
      cloudError=true;console.warn("Lecture des congés Firebase impossible",e);
      refreshOptimizerFromCloud();
    })
  })
}
function ensureBanner(){let b=$("ivLeaveBanner");if(!b){b=document.createElement("div");b.id="ivLeaveBanner";b.className="iv-leave-banner";const toolbar=document.querySelector(".calendar-toolbar");toolbar?.insertAdjacentElement("afterend",b)}return b}
function decorate(){const p=plan(),a=selectedAgent(p),l=leaveForAgent(a,p),banner=ensureBanner();if(!a||!l){document.querySelectorAll(".day-column.iv-on-leave").forEach(c=>c.classList.remove("iv-on-leave"));if(banner)banner.style.display="none";return}const affected=affectedRows(l,a,p),replaced=Object.values(p.weeks||{}).flat().filter(e=>e?._replacementFor?.leaveId===l.id).length;banner.style.display="flex";banner.innerHTML=`<strong>Congé validé · ${a.name}</strong><span>${formatDate(l.startDate)} → ${formatDate(l.endDate)} · ${affected.length} intervention${affected.length>1?"s":""} à couvrir${replaced?` · ${replaced} déjà remplacée${replaced>1?"s":""}`:""}</span><button type="button">✨ Suggestion optimale</button>`;banner.querySelector("button").onclick=()=>openOptimizer(a,l);document.querySelectorAll(".day-column[data-date]").forEach(c=>c.classList.toggle("iv-on-leave",covers(l,c.dataset.date)))}
function formatDate(s){const d=parseISO(s);return d?new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"short"}).format(d):s}
function injectMenu(){const menu=$("contextMenu");if(!menu?.classList.contains("open")||!menu.classList.contains("agent-context"))return;if(menu.querySelector(".iv-optimal-replacement"))return;const p=plan(),contextId=String(menu.dataset.agentId||p.selected||""),a=(p.agents||[]).find(x=>String(x.id)===contextId)||selectedAgent(p);if(!a)return;const sep=document.createElement("div");sep.className="context-sep";const b=document.createElement("button");b.type="button";b.className="context-item iv-optimal-replacement";b.textContent="✨ Suggestion de remplacement optimal";b.onclick=e=>{e.stopPropagation();menu.classList.remove("open");const l=leaveForAgent(a,p);openOptimizer(a,l)};const danger=menu.querySelector(".context-item.danger");if(danger){menu.insertBefore(sep,danger);menu.insertBefore(b,danger)}else{menu.append(sep,b)};requestAnimationFrame(()=>{const r=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(parseFloat(menu.style.left)||8,innerWidth-r.width-8))+"px";menu.style.top=Math.max(8,Math.min(parseFloat(menu.style.top)||8,innerHeight-r.height-8))+"px"})}
function ensurePanel(){let back=$("ivReplacementBackdrop");if(back)return back;back=document.createElement("div");back.id="ivReplacementBackdrop";back.className="iv-replacement-backdrop";back.innerHTML='<aside class="iv-replacement-panel"><div class="iv-repl-head"><div class="iv-repl-spark">✦</div><div class="iv-repl-head-copy"><span class="eyebrow">OPTIMISATION</span><h2>Suggestion de remplacement optimal</h2><p id="ivReplSubtitle"></p></div><button class="iv-repl-close" type="button">×</button></div><div class="iv-repl-summary" id="ivReplSummary"></div><div class="iv-repl-body" id="ivReplBody"></div><div class="iv-repl-foot"><small>Une attribution par chantier et par période, avec ajustement possible sur certains jours.</small><button class="iv-repl-btn" id="ivLeavesPage" type="button">Congés & absences</button><button class="iv-repl-btn primary" id="ivApplyReplacements" type="button">Appliquer</button></div></aside>';document.body.appendChild(back);back.querySelector(".iv-repl-close").onclick=closeOptimizer;back.addEventListener("mousedown",e=>{if(e.target===back)closeOptimizer()});$("ivLeavesPage").onclick=()=>{try{pwin.location.href="CONGES.html"}catch{location.href="CONGES.html"}};$("ivApplyReplacements").onclick=applyChoices;return back}
function openOptimizer(agent,leave){
 const back=ensurePanel(),p=plan();
 activeOptimizerId=String(agent.id);
 back.classList.add("open");
 if(!leave){
   panelState=null;
   const pending=pendingLeaveForAgent(agent,p);
   const loading=!cloudReady&&!cloudError;
   let label,detail,period;
   if(pending){
     label="Congé enregistré pour "+agent.name+" — en attente de validation.";
     detail="Les dates existent déjà dans Congés & absences. Cette demande est « À valider » : validez-la avant de lancer les remplacements.";
     period=formatDate(pending.startDate)+" → "+formatDate(pending.endDate);
   }else if(loading){
     label="Vérification des congés de "+agent.name+" dans Firebase…";
     detail="Lecture des dates déjà enregistrées en cours. Ne saisissez rien à nouveau.";
     period="Vérification en cours";
   }else if(cloudError){
     label="Les congés Firebase sont momentanément inaccessibles.";
     detail="Impossible de vérifier les congés existants. Réessayez après la synchronisation.";
     period="Non vérifiable";
   }else{
     label="Aucun congé validé ou en attente trouvé pour "+agent.name+".";
     detail="Aucune période correspondante n'a été retrouvée. Vérifiez l'agent et le statut dans Congés & absences.";
     period="Non renseigné";
   }
   $("ivReplSubtitle").textContent=label;
   $("ivReplSummary").innerHTML='<div><small>Agent</small><b>'+escapeHtml(agent.name)+'</b></div><div><small>Congé</small><b>'+escapeHtml(period)+'</b></div><div><small>À couvrir</small><b>0</b></div>';
   const heading=pending?"Congé déjà enregistré — à valider":loading?"Lecture Firebase en cours":cloudError?"Synchronisation indisponible":"Aucune période correspondante";
   $("ivReplBody").innerHTML='<div class="iv-repl-empty"><strong>'+escapeHtml(heading)+'</strong><span>'+escapeHtml(detail)+'</span><br><button type="button" id="ivGoLeaves">Ouvrir Congés & Absences</button></div>';
   $("ivApplyReplacements").disabled=true;
   $("ivGoLeaves").onclick=()=>{try{pwin.location.href="CONGES.html"}catch{location.href="CONGES.html"}};
   return;
 }
 const rows=affectedRows(leave,agent,p);
 const groups=groupByChantier(rows);
 const choices={};
 rows.forEach((row,i)=>{row.index=i;row.candidates=candidatesFor(row,p,agent);});
 groups.forEach(group=>{
   const top=periodCandidates(group,rows).find(c=>c.available);
   group.rows.forEach(r=>{choices[r.index]=top?.agent.id||"";});
 });
 panelState={agent,leave,rows,groups,choices,p};
 $("ivReplSubtitle").textContent=`Remplacement de ${agent.name} par chantier, pour toute la période du congé. Ajustement ponctuel possible.`;
 $("ivReplSummary").innerHTML=`<div><small>Période</small><b>${formatDate(leave.startDate)} → ${formatDate(leave.endDate)}</b></div><div><small>Chantiers</small><b>${groups.length}</b></div><div><small>Interventions</small><b>${rows.length}</b></div>`;
 renderRows();
}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderRows(){const body=$("ivReplBody"),st=panelState;if(!st||!st.rows.length){body.innerHTML='<div class="iv-repl-empty"><strong>Tout est couvert</strong>Aucune intervention de cet agent ne reste à remplacer sur cette période.</div>';return}body.innerHTML="";st.rows.forEach((r,i)=>{const box=document.createElement("div");box.className="iv-repl-item";const wd=new Intl.DateTimeFormat("fr-FR",{weekday:"short"}).format(r.date).replace(".","");box.innerHTML=`<div class="iv-repl-event"><div class="iv-repl-date"><b>${r.date.getDate()}</b><small>${wd}</small></div><div><strong>${escapeHtml(r.event.task||"Intervention")}</strong><span>${escapeHtml(r.event.site||"Chantier non précisé")}</span></div><span class="iv-repl-time">${escapeHtml(r.event.start||"")} – ${escapeHtml(r.event.end||"")}</span></div><div class="iv-candidate-list"></div>`;const list=box.querySelector(".iv-candidate-list");if(!r.candidates.length){list.innerHTML='<div style="font-size:9px;color:#a13b31;padding:6px">Aucun autre agent disponible.</div>'}r.candidates.forEach(c=>{const b=document.createElement("button");b.type="button";b.className="iv-candidate"+(String(st.choices[i])===String(c.agent.id)?" selected":"")+(c.available?"":" unavailable");const tag=c.away?"En congé":c.conflict?"Conflit horaire":c.fam?`Connaît le chantier · charge ${Math.round(c.load/60)}h`:`Disponible · charge ${Math.round(c.load/60)}h`;const scoreClass=!c.available?"red":c.score<65?"orange":"";b.innerHTML=`<span class="iv-candidate-avatar">${initials(c.agent.name)}</span><span><strong>${escapeHtml(c.agent.name)}</strong><small>${escapeHtml(tag)}</small></span><span class="iv-score ${scoreClass}">${c.available?"Recommandé":"Indispo"}</span>`;if(c.available)b.onclick=()=>{st.choices[i]=c.agent.id;renderRows()};list.appendChild(b)});body.appendChild(box)})}
function applyChoices(){const st=panelState;if(!st)return;const missing=st.rows.some((r,i)=>!st.choices[i]);if(missing)return alert("Au moins une intervention n’a pas encore de remplaçant disponible.");st.rows.forEach((r,i)=>{const event=st.p.weeks[r.week].find(e=>e.id===r.event.id);if(!event)return;event._replacementFor={leaveId:st.leave.id,originalAgentId:st.agent.id,originalAgentName:st.agent.name,replacedAt:new Date().toISOString()};event.agentId=st.choices[i]});savePlan(st.p);closeOptimizer();setTimeout(()=>location.reload(),80)}
function closeOptimizer(){activeOptimizerId="";const b=$("ivReplacementBackdrop");b?.classList.remove("open")}
function init(){loadAbs();bindCloud();const menu=$("contextMenu"),viewport=$("calendarViewport"),agentList=$("agentList");if(menu){const o=new MutationObserver(()=>injectMenu());o.observe(menu,{childList:true,attributes:true,attributeFilter:["class"]});observers.push(o)}if(viewport){const o=new MutationObserver(()=>setTimeout(decorate,0));o.observe(viewport,{childList:true,subtree:true});observers.push(o)}if(agentList){const o=new MutationObserver(()=>setTimeout(decorate,0));o.observe(agentList,{subtree:true,attributes:true,attributeFilter:["class"]});observers.push(o)}setTimeout(decorate,150);setTimeout(decorate,650);setTimeout(()=>{injectMenu();decorate()},1400);const requested=new URLSearchParams(pwin.location.search||"").get("replacementAgent");if(requested){setTimeout(()=>{const p=plan(),a=(p.agents||[]).find(x=>String(x.refId||x.id)===String(requested));if(a){p.selected=a.id;savePlan(p);const l=leaveForAgent(a,p);openOptimizer(a,l)}},700)}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
