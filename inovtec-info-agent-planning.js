(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const PLAN_KEY="inovtec_plannings_v2",frame=document.getElementById("legacyFrame");
let planning={agents:[],weeks:{}},unsubPlanning=null;
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const nameKey=v=>norm(v).split(/\s+/).filter(Boolean).sort().join(" ");
const parse=(s,f)=>{try{return JSON.parse(s)||f}catch{return f}};
const uniq=arr=>[...new Set((Array.isArray(arr)?arr:[]).map(v=>String(v||"").trim()).filter(Boolean))];

function currentWeekKey(){const d=new Date(),x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+3-((x.getDay()+6)%7));const y=new Date(x.getFullYear(),0,4),yi=(y.getDay()+6)%7,w=1+Math.round(((x-y)/86400000-3+yi)/7);return`${x.getFullYear()}-W${String(w).padStart(2,"0")}`}
function masterSites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function masterAgents(){try{return Array.from(window.InovtecDataHub?.agents||[])}catch{return[]}}
function agentsReady(){try{return !!window.InovtecDataHub?.readyAgents}catch{return false}}
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
 const pname=String(pa?.name||"").trim();if(pname){const matches=masters.filter(a=>norm(agentName(a))===norm(pname)||nameKey(agentName(a))===nameKey(pname));if(matches.length===1)return String(matches[0].id)}
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
 const agents=masterAgents(),legacy=String(site?.agentNom||"").trim();
 if(legacy){const matches=agents.filter(a=>norm(agentName(a))===norm(legacy)||nameKey(agentName(a))===nameKey(legacy));if(matches.length===1)return[String(matches[0].id)]}
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
 if(!site||!agentsReady())return[];
 const inferred=inferAssignments(doc,site);
 if(form)form.dataset.ivAgentsAffectes=JSON.stringify(inferred);
 return inferred;
}

function ensureStyle(doc){
 if(doc.getElementById("ivSiteAgentsStyle"))return;
 const s=doc.createElement("style");s.id="ivSiteAgentsStyle";
 s.textContent=`
 #ivSiteAgentsCard .iv-agent-planning-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}
 #ivSiteAgentsCard .iv-agent-picker{position:relative;flex:1;min-width:260px}
 #ivAgentPickerButton{width:100%;min-height:44px;border:1px solid #cfe0d7;border-radius:999px;background:#fff;padding:0 42px 0 42px;color:#17392d;font-weight:750;outline:none;box-shadow:0 4px 14px rgba(15,23,42,.04);text-align:left;position:relative;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 #ivAgentPickerButton:before{content:"♙";position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#0b6b43;font-size:16px}
 #ivAgentPickerButton:after{content:"⌄";position:absolute;right:16px;top:50%;transform:translateY(-53%);font-size:16px;color:#567066}
 #ivAgentPickerButton[aria-expanded="true"]{border-color:#16a34a;box-shadow:0 0 0 4px rgba(22,163,74,.10)}
 #ivAgentPickerPanel{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:80;background:#fff;border:1px solid #d7e5de;border-radius:15px;box-shadow:0 16px 35px rgba(15,23,42,.16);padding:7px;max-height:270px;overflow:auto}
 #ivAgentPickerPanel[hidden]{display:none!important}
 .iv-agent-option{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;cursor:pointer;color:#17392d}
 .iv-agent-option:hover{background:#f3faf6}
 .iv-agent-option input{width:16px;height:16px;accent-color:#0b6b43;flex:0 0 auto}
 .iv-agent-option-copy{min-width:0;display:block}
 .iv-agent-option-name{display:block;font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .iv-agent-option-phone{display:block;font-size:10px;color:#7b8b83;margin-top:1px}
 .iv-agent-empty{padding:12px;color:#7b8b83;font-size:11px;text-align:center}
 #ivSiteAgentSelect{display:none!important}
 #ivOpenAgentPlanning{min-height:44px;border:0;border-radius:999px;padding:0 18px;background:#0b6b43;color:#fff;font-weight:800;box-shadow:0 6px 16px rgba(11,107,67,.18)}
 #ivOpenAgentPlanning:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
 .iv-agent-planning-note{font-size:11px;color:#74837b;margin:5px 0 0}
 @media(max-width:620px){#ivSiteAgentsCard .iv-agent-planning-row{display:grid;grid-template-columns:1fr}.iv-agent-picker{min-width:0!important}#ivOpenAgentPlanning{width:100%}}
 `;
 doc.head.appendChild(s);
}
function closePicker(card){
 const panel=card?.querySelector("#ivAgentPickerPanel"),button=card?.querySelector("#ivAgentPickerButton");
 if(panel)panel.hidden=true;
 if(button)button.setAttribute("aria-expanded","false");
}
function summaryText(ids,agents){
 if(!ids.length)return"Choisir un ou plusieurs agents";
 const names=ids.map(id=>agentName(agents.find(a=>String(a.id)===id)||{displayName:"Agent"}));
 if(names.length<=2)return names.join(", ");
 return names[0]+" + "+(names.length-1)+" autre"+(names.length>2?"s":"");
}
function siteAgentSummary(site){
 const agents=masterAgents(),ids=explicitIds(site);
 if(Array.isArray(ids)&&ids.length){
  const names=ids.map(id=>{
   const a=agents.find(x=>String(x.id)===String(id));
   return a?agentName(a):"";
  }).filter(Boolean);
  if(names.length<=2&&names.length)return names.join(", ");
  if(names.length>2)return names[0]+" + "+(names.length-1)+" autres";
 }
 return String(site?.agentNom||"").trim();
}
function siteSidebarDetail(site){
 const address=String(site?.adresse||"").trim(),agents=siteAgentSummary(site),parts=[address,agents].filter(Boolean);
 return parts.join(" • ")||"Aucune information complémentaire";
}
function syncHiddenSelect(card,ids,agents){
 const select=card.querySelector("#ivSiteAgentSelect");if(!select)return;
 select.innerHTML="";
 agents.forEach(a=>{const o=select.ownerDocument.createElement("option");o.value=String(a.id);o.textContent=agentName(a);o.selected=ids.includes(o.value);select.appendChild(o)});
 ids.filter(id=>!agents.some(a=>String(a.id)===id)).forEach(id=>{const o=select.ownerDocument.createElement("option");o.value=id;o.textContent="Agent indisponible — "+id;o.selected=true;select.appendChild(o)});
}
function setAssignments(doc,card,ids,activeId=""){
 ids=uniq(ids);const form=doc.getElementById("siteForm");
 if(form){form.dataset.ivAgentsAffectes=JSON.stringify(ids);form.dataset.ivAgentsDraft="1"}
 card.dataset.activeAgentId=activeId&&ids.includes(activeId)?activeId:(ids[0]||"");
 const agents=masterAgents(),button=card.querySelector("#ivAgentPickerButton"),plan=card.querySelector("#ivOpenAgentPlanning");
 if(button)button.querySelector(".iv-agent-picker-text").textContent=summaryText(ids,agents);
 if(plan)plan.disabled=!ids.length;
 syncHiddenSelect(card,ids,agents);
}
function ensureCard(doc){
 const form=doc.getElementById("siteForm");if(!form)return null;
 const old=[...form.querySelectorAll("section.card")].find(s=>/agent\s+et\s+planning/i.test(s.querySelector("h2")?.textContent||""));
 if(old){old.style.display="none";old.setAttribute("aria-hidden","true")}
 let card=doc.getElementById("ivSiteAgentsCard");
 if(!card){
  card=doc.createElement("section");card.className="card";card.id="ivSiteAgentsCard";
  card.innerHTML='<div class="section-title"><h2>Agents du chantier</h2></div><p class="iv-agent-planning-note">Sélectionnez un ou plusieurs agents du Classeur agents. Cette affectation est enregistrée avec le chantier.</p><div class="iv-agent-planning-row"><div class="iv-agent-picker"><button id="ivAgentPickerButton" type="button" aria-expanded="false"><span class="iv-agent-picker-text">Choisir un ou plusieurs agents</span></button><div id="ivAgentPickerPanel" hidden></div><select id="ivSiteAgentSelect" multiple aria-hidden="true" tabindex="-1"></select></div><button id="ivOpenAgentPlanning" type="button" disabled>Voir le planning →</button></div>';
  if(old)old.insertAdjacentElement("beforebegin",card);else form.appendChild(card);

  const picker=card.querySelector("#ivAgentPickerButton"),panel=card.querySelector("#ivAgentPickerPanel");
  picker.addEventListener("click",e=>{
    e.stopPropagation();
    const opening=panel.hidden;
    if(opening){panel.hidden=false;picker.setAttribute("aria-expanded","true")}
    else closePicker(card);
  });
  panel.addEventListener("click",e=>e.stopPropagation());
  panel.addEventListener("change",e=>{
    const input=e.target.closest?.('input[type="checkbox"][data-agent-id]');if(!input)return;
    const id=String(input.dataset.agentId||""),current=draftIds(doc)||assignmentIds(doc,currentSite(doc));
    const ids=input.checked?uniq([...current,id]):current.filter(x=>x!==id);
    setAssignments(doc,card,ids,input.checked?id:(card.dataset.activeAgentId||""));
  });
  card.querySelector("#ivOpenAgentPlanning").addEventListener("click",()=>openPlanning(doc,card.dataset.activeAgentId||""));
 }
 return card;
}
function cleanSidebar(doc){
 const sites=masterSites();
 doc.querySelectorAll(".site-item").forEach(b=>{
   const exact=String(b.dataset.ivChantierId||""),site=sites.find(c=>String(c.id)===exact)||null,sub=b.querySelector("span");
   if(sub&&site)sub.textContent=siteSidebarDetail(site);
 });
 const subtitle=doc.querySelector(".topbar p");if(subtitle&&/planning/i.test(subtitle.textContent||""))subtitle.textContent="Accès, contacts et consignes";
}
function render(doc){
 if(!doc?.body)return;ensureStyle(doc);const card=ensureCard(doc);cleanSidebar(doc);if(!card)return;
 const site=currentSite(doc),agents=masterAgents().slice().sort((a,b)=>agentName(a).localeCompare(agentName(b),"fr",{sensitivity:"base",numeric:true})),ids=assignmentIds(doc,site),panel=card.querySelector("#ivAgentPickerPanel"),button=card.querySelector("#ivAgentPickerButton"),plan=card.querySelector("#ivOpenAgentPlanning");
 const wasOpen=!panel.hidden;
 panel.innerHTML="";
 if(!agents.length){const empty=doc.createElement("div");empty.className="iv-agent-empty";empty.textContent="Aucun agent dans le Classeur agents";panel.appendChild(empty)}
 else agents.forEach(a=>{
   const id=String(a.id),label=doc.createElement("label");label.className="iv-agent-option";
   const checkbox=doc.createElement("input");checkbox.type="checkbox";checkbox.dataset.agentId=id;checkbox.checked=ids.includes(id);
   const copy=doc.createElement("span");copy.className="iv-agent-option-copy";
   const name=doc.createElement("span");name.className="iv-agent-option-name";name.textContent=agentName(a);
   const phone=agentPhone(a);copy.appendChild(name);
   if(phone){const p=doc.createElement("span");p.className="iv-agent-option-phone";p.textContent=phone;copy.appendChild(p)}
   label.append(checkbox,copy);panel.appendChild(label);
 });
 const known=new Set(agents.map(a=>String(a.id)));
 ids.filter(id=>!known.has(id)).forEach(id=>{
   const label=doc.createElement("label");label.className="iv-agent-option";
   const checkbox=doc.createElement("input");checkbox.type="checkbox";checkbox.dataset.agentId=id;checkbox.checked=true;
   const copy=doc.createElement("span");copy.className="iv-agent-option-copy";
   const name=doc.createElement("span");name.className="iv-agent-option-name";name.textContent="Agent indisponible";
   const detail=doc.createElement("span");detail.className="iv-agent-option-phone";detail.textContent=id;
   copy.append(name,detail);label.append(checkbox,copy);panel.appendChild(label);
 });
 button.querySelector(".iv-agent-picker-text").textContent=summaryText(ids,agents);
 plan.disabled=!ids.length;
 syncHiddenSelect(card,ids,agents);
 if(!card.dataset.activeAgentId||!ids.includes(card.dataset.activeAgentId))card.dataset.activeAgentId=ids[0]||"";
 panel.hidden=!wasOpen;button.setAttribute("aria-expanded",wasOpen?"true":"false");
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
   const card=doc.getElementById("ivSiteAgentsCard");
   if(card&&!e.target.closest?.("#ivSiteAgentsCard"))closePicker(card);
   const siteButton=e.target.closest?.(".site-item");
   if(siteButton){
     const id=String(siteButton.dataset.ivChantierId||""),site=masterSites().find(c=>String(c.id)===id)||null,form=doc.getElementById("siteForm");
     if(form){form.removeAttribute("data-iv-agents-draft");form.removeAttribute("data-iv-agents-affectes")}
     rememberSite(doc,site);setTimeout(()=>render(doc),90);return;
   }
   if(e.target.closest?.("#newBtn")){const form=doc.getElementById("siteForm");if(form){form.removeAttribute("data-iv-agents-draft");form.dataset.ivAgentsAffectes="[]"}rememberSite(doc,null);setTimeout(()=>render(doc),90);return}
   if(e.target.closest?.("#deleteBtn"))setTimeout(()=>render(doc),90);
 },true);
 doc.addEventListener("keydown",e=>{if(e.key==="Escape")closePicker(doc.getElementById("ivSiteAgentsCard"))});
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