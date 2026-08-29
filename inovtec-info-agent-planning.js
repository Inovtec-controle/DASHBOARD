(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const PLAN_KEY="inovtec_plannings_v2",frame=document.getElementById("legacyFrame");
let planning={agents:[],weeks:{}},unsubPlanning=null;
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const parse=(s,f)=>{try{return JSON.parse(s)||f}catch{return f}};
const uniq=arr=>[...new Set((Array.isArray(arr)?arr:[]).map(v=>String(v||"").trim()).filter(Boolean))];
function currentWeekKey(){const d=new Date(),x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+3-((x.getDay()+6)%7));const y=new Date(x.getFullYear(),0,4),yi=(y.getDay()+6)%7,w=1+Math.round(((x-y)/86400000-3+yi)/7);return`${x.getFullYear()}-W${String(w).padStart(2,"0")}`}
function masterSites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function masterAgents(){try{return Array.from(window.InovtecDataHub?.agents||[])}catch{return[]}}
function agentName(a){const i=a?.identity||{};return[i.prenom,i.nom].filter(Boolean).join(" ").trim()||a?.displayName||a?.name||"Agent sans nom"}
function agentPhone(a){return String(a?.identity?.telephone||a?.telephone||"").trim()}
function selectedSiteId(doc){return String(doc?.getElementById("siteForm")?.dataset.ivChantierId||"").trim()}
function rememberSite(doc,site){const form=doc?.getElementById("siteForm");if(form)form.dataset.ivChantierId=site?.id?String(site.id):"";return site}
function currentSite(doc){
 const sites=masterSites(),known=selectedSiteId(doc);
 if(known)return sites.find(c=>String(c.id)===known)||null;
 const nom=doc.getElementById("nom")?.value.trim()||"",adresse=doc.getElementById("adresse")?.value.trim()||"";
 if(!nom&&!adresse)return null;
 const exact=sites.filter(c=>norm(c.nom)===norm(nom)&&adresse&&norm(c.adresse)===norm(adresse));
 if(exact.length===1)return rememberSite(doc,exact[0]);
 const byName=sites.filter(c=>norm(c.nom)===norm(nom));
 if(byName.length===1)return rememberSite(doc,byName[0]);
 const byAddress=sites.filter(c=>adresse&&norm(c.adresse)===norm(adresse));
 return byAddress.length===1?rememberSite(doc,byAddress[0]):null;
}
function matchesSite(e,site,doc){
 if(site?.id&&String(e?.chantierId||"")===String(site.id))return true;
 if(e?.chantierId)return false;
 const nom=site?.nom||doc.getElementById("nom")?.value||"",adresse=site?.adresse||doc.getElementById("adresse")?.value||"",task=norm(e?.task),place=norm(e?.site);
 return !!((nom&&task===norm(nom))||(adresse&&place===norm(adresse))||(nom&&place===norm(nom)));
}
function planningMasterId(e){
 const masters=masterAgents(),masterIds=new Set(masters.map(a=>String(a.id)));
 const direct=String(e?.agentRefId||"").trim();if(direct&&masterIds.has(direct))return direct;
 const eventId=String(e?.agentId||"").trim();if(eventId&&masterIds.has(eventId))return eventId;
 const pa=(planning.agents||[]).find(a=>String(a.id)===eventId||String(a.refId||"")===direct);
 const ref=String(pa?.refId||pa?.id||"").trim();if(ref&&masterIds.has(ref))return ref;
 const pname=norm(pa?.name||"");if(pname){const matches=masters.filter(a=>norm(agentName(a))===pname);if(matches.length===1)return String(matches[0].id)}
 return "";
}
function inferFromPlanning(doc,site){
 const rows=[];
 Object.entries(planning.weeks||{}).forEach(([week,entries])=>(entries||[]).forEach(e=>{if(matchesSite(e,site,doc))rows.push({week,event:e})}));
 if(!rows.length)return[];
 const now=currentWeekKey(),future=rows.filter(x=>x.week>=now),pool=future.length?future:(()=>{const latest=rows.map(x=>x.week).sort().at(-1);return rows.filter(x=>x.week===latest)})();
 return uniq(pool.map(x=>planningMasterId(x.event)));
}
function inferAssignments(doc,site){
 const agents=masterAgents(),legacy=norm(site?.agentNom||"");
 if(legacy){const matches=agents.filter(a=>norm(agentName(a))===legacy);if(matches.length===1)return[String(matches[0].id)]}
 return inferFromPlanning(doc,site);
}
function explicitIds(site){return Array.isArray(site?.agentsAffectes)?uniq(site.agentsAffectes):null}
function draftIds(doc){const raw=doc.getElementById("siteForm")?.dataset.ivAgentsAffectes;if(raw===undefined)return null;const parsed=parse(raw,null);return Array.isArray(parsed)?uniq(parsed):[]}
function sameIds(a,b){a=uniq(a).sort();b=uniq(b).sort();return JSON.stringify(a)===JSON.stringify(b)}
function assignmentIds(doc,site){
 const form=doc.getElementById("siteForm"),draft=draftIds(doc),saved=explicitIds(site),hasDraft=form?.dataset.ivAgentsDraft==="1";
 if(hasDraft&&draft){
   if(saved&&sameIds(draft,saved)){form.removeAttribute("data-iv-agents-draft");return saved}
   return draft;
 }
 if(saved){if(form)form.dataset.ivAgentsAffectes=JSON.stringify(saved);return saved}
 const inferred=site?inferAssignments(doc,site):[];
 if(form)form.dataset.ivAgentsAffectes=JSON.stringify(inferred);
 return inferred;
}
function ensureStyle(doc){
 if(doc.getElementById("ivSiteAgentsStyle"))return;
 const s=doc.createElement("style");s.id="ivSiteAgentsStyle";
 s.textContent=`#ivSiteAgentsCard .iv-agent-planning-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}#ivSiteAgentsCard .iv-agent-select-wrap{position:relative;flex:1;min-width:230px}#ivSiteAgentsCard .iv-agent-select-wrap:before{content:"♙";position:absolute;left:14px;top:18px;color:#0b6b43;font-size:16px;pointer-events:none}#ivSiteAgentSelect{width:100%;min-height:96px;border:1px solid #cfe0d7;border-radius:18px;background:#fff;padding:9px 12px 9px 42px;color:#17392d;font-weight:750;outline:none;box-shadow:0 4px 14px rgba(15,23,42,.04)}#ivSiteAgentSelect:focus{border-color:#16a34a;box-shadow:0 0 0 4px rgba(22,163,74,.10)}#ivSiteAgentSelect option{padding:5px 6px}#ivOpenAgentPlanning{min-height:44px;border:0;border-radius:999px;padding:0 18px;background:#0b6b43;color:#fff;font-weight:800;box-shadow:0 6px 16px rgba(11,107,67,.18)}#ivOpenAgentPlanning:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}.iv-agent-planning-note{font-size:11px;color:#74837b;margin:5px 0 0}@media(max-width:620px){#ivSiteAgentsCard .iv-agent-planning-row{display:grid;grid-template-columns:1fr}#ivOpenAgentPlanning{width:100%}}`;
 doc.head.appendChild(s);
}
function ensureCard(doc){
 const form=doc.getElementById("siteForm");if(!form)return null;
 const old=[...form.querySelectorAll("section.card")].find(s=>/agent\s+et\s+planning/i.test(s.querySelector("h2")?.textContent||""));
 if(old){old.style.display="none";old.setAttribute("aria-hidden","true")}
 let card=doc.getElementById("ivSiteAgentsCard");
 if(!card){
  card=doc.createElement("section");card.className="card";card.id="ivSiteAgentsCard";
  card.innerHTML='<div class="section-title"><h2>Agents du chantier</h2></div><p class="iv-agent-planning-note">Sélectionnez un ou plusieurs agents du Classeur agents. Cette affectation est enregistrée avec le chantier.</p><div class="iv-agent-planning-row"><div class="iv-agent-select-wrap"><select id="ivSiteAgentSelect" multiple size="4" aria-label="Agents affectés au chantier"></select></div><button id="ivOpenAgentPlanning" type="button" disabled>Voir le planning →</button></div>';
  if(old)old.insertAdjacentElement("beforebegin",card);else form.appendChild(card);
  const select=card.querySelector("#ivSiteAgentSelect");
  select.addEventListener("change",()=>{
    const ids=uniq([...select.selectedOptions].map(o=>o.value)),f=doc.getElementById("siteForm");
    if(f){f.dataset.ivAgentsAffectes=JSON.stringify(ids);f.dataset.ivAgentsDraft="1"}
    card.dataset.activeAgentId=select.value||ids[0]||"";
    card.querySelector("#ivOpenAgentPlanning").disabled=!ids.length;
  });
  card.querySelector("#ivOpenAgentPlanning").addEventListener("click",()=>openPlanning(doc,card.dataset.activeAgentId||""));
 }
 return card;
}
function cleanSidebar(doc){
 const sites=masterSites();
 doc.querySelectorAll(".site-item").forEach(b=>{
   const exact=String(b.dataset.ivChantierId||""),site=sites.find(c=>String(c.id)===exact)||null,sub=b.querySelector("span");
   if(sub&&site)sub.textContent=site.adresse||"Aucune information complémentaire";
 });
 const subtitle=doc.querySelector(".topbar p");if(subtitle&&/planning/i.test(subtitle.textContent||""))subtitle.textContent="Accès, contacts et consignes";
}
function render(doc){
 if(!doc?.body)return;ensureStyle(doc);const card=ensureCard(doc);cleanSidebar(doc);if(!card)return;
 const site=currentSite(doc),select=card.querySelector("#ivSiteAgentSelect"),button=card.querySelector("#ivOpenAgentPlanning"),agents=masterAgents().slice().sort((a,b)=>agentName(a).localeCompare(agentName(b),"fr",{sensitivity:"base",numeric:true})),ids=assignmentIds(doc,site),known=new Set(agents.map(a=>String(a.id)));
 select.innerHTML="";
 agents.forEach(a=>{const o=doc.createElement("option"),phone=agentPhone(a);o.value=String(a.id);o.textContent=agentName(a)+(phone?" — "+phone:"");o.selected=ids.includes(o.value);select.appendChild(o)});
 ids.filter(id=>!known.has(id)).forEach(id=>{const o=doc.createElement("option");o.value=id;o.textContent="Agent indisponible — "+id;o.selected=true;select.appendChild(o)});
 if(!select.options.length){const o=doc.createElement("option");o.value="";o.textContent="Aucun agent dans le Classeur agents";o.disabled=true;select.appendChild(o)}
 button.disabled=!ids.length;
 if(!card.dataset.activeAgentId||!ids.includes(card.dataset.activeAgentId))card.dataset.activeAgentId=ids[0]||"";
}
function openPlanning(doc,preferredId){
 const ids=draftIds(doc)||assignmentIds(doc,currentSite(doc)),masterId=preferredId&&ids.includes(preferredId)?preferredId:(ids[0]||"");
 if(masterId){
   const pa=(planning.agents||[]).find(a=>String(a.refId||"")===masterId||String(a.id)===masterId);
   if(pa){const state={...planning,selected:pa.id};try{localStorage.setItem(PLAN_KEY,JSON.stringify(state));sessionStorage.setItem("ivPlanningOpenAgent",String(pa.id))}catch{}}
 }
 location.href="PLANNINGS.html";
}
function bindDoc(doc){
 if(doc.body.dataset.ivSiteAgentsBound==="1")return;doc.body.dataset.ivSiteAgentsBound="1";
 doc.addEventListener("click",e=>{
   const siteButton=e.target.closest?.(".site-item");
   if(siteButton){
     const id=String(siteButton.dataset.ivChantierId||""),site=masterSites().find(c=>String(c.id)===id)||null,form=doc.getElementById("siteForm");
     if(form){form.removeAttribute("data-iv-agents-draft");form.removeAttribute("data-iv-agents-affectes")}
     rememberSite(doc,site);setTimeout(()=>render(doc),90);return;
   }
   if(e.target.closest?.("#newBtn")){const form=doc.getElementById("siteForm");if(form){form.removeAttribute("data-iv-agents-draft");form.dataset.ivAgentsAffectes="[]"}rememberSite(doc,null);setTimeout(()=>render(doc),90);return}
   if(e.target.closest?.("#deleteBtn"))setTimeout(()=>render(doc),90);
 },true);
 ["nom","adresse"].forEach(id=>doc.getElementById(id)?.addEventListener("input",()=>render(doc)));
}
function install(){let doc;try{doc=frame?.contentDocument}catch{return}if(!doc?.body)return;bindDoc(doc);render(doc)}
function bindPlanning(){
 const local=parse(localStorage.getItem(PLAN_KEY)||"{}",{});if(local?.weeks)planning=local;
 const f=window.firebase;if(!f?.auth||!f?.firestore)return;
 f.auth().onAuthStateChanged(user=>{
   if(unsubPlanning){try{unsubPlanning()}catch{}unsubPlanning=null}
   if(!user)return;
   unsubPlanning=f.firestore().collection("kanban").doc(user.uid).onSnapshot(s=>{const raw=s.exists?s.data()?.moduleSyncV1?.planning?.payload:"",remote=parse(raw,"{}");if(remote?.weeks){planning=remote;install()}})
 });
}
if(frame){frame.addEventListener("load",()=>{setTimeout(install,100);setTimeout(install,550)});setTimeout(install,450)}
bindPlanning();try{window.InovtecDataHub?.subscribe?.(()=>install())}catch{}
})();