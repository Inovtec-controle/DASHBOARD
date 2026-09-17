(()=>{
"use strict";
const KEY="inovtec_absences_v1", PLANNING_KEY="inovtec_plannings_v2";
const $=id=>document.getElementById(id), pad=n=>String(n).padStart(2,"0");
const uid=()=>"leave_"+Date.now().toString(16)+"_"+Math.random().toString(16).slice(2);
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const parentWin=(()=>{try{return parent&&parent!==window?parent:window}catch{return window}})();
const fb=()=>{try{return parentWin.firebase||window.firebase}catch{return null}};
const hub=()=>{try{return parentWin.InovtecDataHub||null}catch{return null}};
const parse=(s,fallback)=>{try{const v=JSON.parse(s);return v??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const stamp=x=>JSON.stringify(x||null);
let leaves=[],serverRecords=[],agents=[],monthCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let user=null,docRef=null,unsub=null,hubUnsub=null,ready=false,busy=false,migrating=false,authBound=false;
let editingRevision=null;
function cache(){try{const v=parse(localStorage.getItem(KEY)||"[]",[]);return Array.isArray(v)?v:[]}catch{return[]}}
function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify(serverRecords))}catch(e){console.warn("Cache congés",e)}}
function dateISO(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseISO(s){const m=String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3]):null}
function covers(l,date){const s=parseISO(l.startDate),e=parseISO(l.endDate),d=parseISO(date);return !!(s&&e&&d&&d>=s&&d<=e&&l.status!=="rejected"&&l.status!=="cancelled"&&!l.deleted)}
function approved(l){return l.status==="approved"&&!l.deleted}
function displayAgentName(a){return a?.name||a?.displayName||[a?.identity?.prenom,a?.identity?.nom].filter(Boolean).join(" ")||"Agent"}
function initials(name){return String(name||"?").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"?"}
function leaveTone(l){if(l.status==="rejected"||l.status==="cancelled")return l.status;if(l.status==="pending")return"pending";return /maladie|absence/i.test(l.type||"")||l.sourceType==="absence"?"sick":"approved"}
function statusLabel(s){return s==="pending"?"À valider":s==="approved"?"Validée":s==="rejected"?"Refusée":"Annulée"}
function partLabel(v,edge){if(v==="morning")return edge==="start"?"matin":"jusqu’au matin";if(v==="afternoon")return edge==="start"?"après-midi":"jusqu’à l’après-midi";return"journée complète"}
function fmtDate(s){const d=parseISO(s);return d?new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"short",year:"numeric"}).format(d):"—"}
function fmtRange(l){return l.startDate===l.endDate?fmtDate(l.startDate):`${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}`}
function planning(){const p=parse(localStorage.getItem(PLANNING_KEY)||"{}",{});return p&&p.weeks?p:{agents:[],weeks:{}}}
function dateFromWeek(key,day){const m=String(key).match(/^(\d{4})-W(\d{2})$/);if(!m)return null;const year=+m[1],week=+m[2],jan4=new Date(year,0,4),offset=(jan4.getDay()+6)%7,mon=new Date(year,0,4-offset);mon.setDate(mon.getDate()+(week-1)*7+(Number(day)||0));return mon}
function planningAgentId(l,p){const byRef=(p.agents||[]).find(a=>String(a.refId||a.id)===String(l.agentRefId));if(byRef)return byRef.id;const n=norm(l.agentName);return(p.agents||[]).find(a=>norm(a.name)===n)?.id||""}
function coverage(l){if(!approved(l))return{total:0,replaced:0,pending:0};const p=planning(),orig=planningAgentId(l,p);if(!orig)return{total:0,replaced:0,pending:0};let pending=0,replaced=0;Object.entries(p.weeks||{}).forEach(([w,rows])=>(rows||[]).forEach(e=>{if(e?._replacementFor?.leaveId===l.id)replaced++;else if(String(e.agentId)===String(orig)){const d=dateFromWeek(w,e.day);if(d&&covers(l,dateISO(d)))pending++}}));return{total:pending+replaced,replaced,pending}}
function syncMessage(message,warning=false){const el=$("congesSyncStatus");if(!el)return;el.textContent=message;el.style.color=warning?"#ad382d":"#0b6b43"}
function setReady(value,message){ready=value;syncMessage(message,!value);render()}
function updateKPIs(){const today=dateISO(new Date()),day=parseISO(today);$("kpiToday").textContent=leaves.filter(l=>approved(l)&&covers(l,today)).length;$("kpiPending").textContent=leaves.filter(l=>l.status==="pending").length;$("kpiUpcoming").textContent=leaves.filter(l=>approved(l)&&parseISO(l.startDate)>day).length;$("kpiCoverage").textContent=leaves.reduce((n,l)=>n+coverage(l).pending,0)}
function buildAgentSelect(){const sel=$("agentSelect"),value=sel.value;sel.innerHTML='<option value="">Choisir un agent…</option>';agents.forEach(a=>{const o=document.createElement("option");o.value=a.id;o.textContent=displayAgentName(a);sel.appendChild(o)});if([...sel.options].some(o=>o.value===value))sel.value=value}
function renderTimeline(){
 const days=new Date(monthCursor.getFullYear(),monthCursor.getMonth()+1,0).getDate(),start=dateISO(monthCursor),end=dateISO(new Date(monthCursor.getFullYear(),monthCursor.getMonth(),days));
 $("monthLabel").textContent=new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric"}).format(monthCursor).replace(/^./,c=>c.toUpperCase());
 const visibleAgents=agents.filter(a=>leaves.some(l=>String(l.agentRefId)===String(a.id)&&l.startDate<=end&&l.endDate>=start));
 const allAgents=visibleAgents.length?visibleAgents:agents;const wrap=$("timelineWrap");
 if(!allAgents.length){wrap.innerHTML='<div class="empty">Chargement des agents du Classeur Agents…</div>';return}
 const root=document.createElement("div");root.className="timeline";root.style.setProperty("--days",days);
 const head=document.createElement("div");head.className="timeline-head";head.innerHTML='<div class="timeline-agent-head">Agents</div>';
 for(let day=1;day<=days;day++){const d=new Date(monthCursor.getFullYear(),monthCursor.getMonth(),day),c=document.createElement("div");c.className="day-h";c.innerHTML=`<span>${new Intl.DateTimeFormat("fr-FR",{weekday:"short"}).format(d).replace(".","")}</span><strong>${day}</strong>`;head.appendChild(c)}root.appendChild(head);
 allAgents.forEach(a=>{const row=document.createElement("div");row.className="timeline-row";const ac=document.createElement("div");ac.className="timeline-agent";const name=displayAgentName(a),own=leaves.filter(l=>String(l.agentRefId)===String(a.id)&&l.startDate<=end&&l.endDate>=start);
 ac.innerHTML=`<div class="agent-avatar">${initials(name)}</div><div class="agent-copy"><strong></strong><small>${own.length?own.length+" période"+(own.length>1?"s":""):"Disponible"}</small></div>`;ac.querySelector("strong").textContent=name;row.appendChild(ac);
 for(let day=1;day<=days;day++){const d=new Date(monthCursor.getFullYear(),monthCursor.getMonth(),day),cell=document.createElement("div");cell.className="day-cell"+([0,6].includes(d.getDay())?" weekend":"")+(dateISO(d)===dateISO(new Date())?" today":"");row.appendChild(cell)}
 own.forEach(l=>{const a=parseISO(l.startDate),b=parseISO(l.endDate);if(!a||!b)return;const s=Math.max(1,a.getMonth()===monthCursor.getMonth()&&a.getFullYear()===monthCursor.getFullYear()?a.getDate():1),e=Math.min(days,b.getMonth()===monthCursor.getMonth()&&b.getFullYear()===monthCursor.getFullYear()?b.getDate():days),band=document.createElement("button");band.type="button";band.className="leave-band "+leaveTone(l);band.style.gridColumn=`${s+1} / ${e+2}`;band.style.gridRow="1";band.style.margin="9px 3px";band.style.position="relative";band.textContent=`${l.type} · ${statusLabel(l.status)}`;band.title=`${name} — ${fmtRange(l)}`;band.onclick=()=>openEdit(l.id);row.appendChild(band)});root.appendChild(row)});
 wrap.replaceChildren(root);
}
function renderList(){const q=norm($("searchLeave").value),status=$("statusFilter").value,box=$("leaveList");const list=leaves.filter(l=>(status==="all"||l.status===status)&&(!q||norm(l.agentName).includes(q)||norm(l.type).includes(q))).sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate)));
 box.replaceChildren();if(!list.length){box.innerHTML='<div class="empty">Aucune demande ou absence pour ce filtre.</div>';return}
 list.forEach(l=>{const cov=coverage(l),row=document.createElement("div");row.className="leave-row";const pct=cov.total?Math.round(cov.replaced/cov.total*100):0;
 row.innerHTML=`<div class="leave-person"><div class="agent-avatar">${initials(l.agentName)}</div><div><strong></strong><small>${l.sourceType==="request"?"Demande":"Absence enregistrée"}</small></div></div><div class="leave-meta"><b></b><small>${fmtRange(l)}</small></div><div><span class="status-pill ${l.status}">${statusLabel(l.status)}</span><small style="display:block;color:#7c8982;font-size:9px;margin-top:4px">Début : ${partLabel(l.startPart,"start")}</small></div><div class="coverage"><b>${approved(l)?`${cov.replaced} remplacée${cov.replaced>1?"s":""} · ${cov.pending} à couvrir`:"Remplacement après validation"}</b><div class="progress"><span style="width:${pct}%"></span></div><small>${cov.total?cov.total+" intervention"+(cov.total>1?"s":"")+" concernée"+(cov.total>1?"s":""):"Aucune intervention détectée"}</small></div><div class="row-actions"></div>`;
 row.querySelector(".leave-person strong").textContent=l.agentName;row.querySelector(".leave-meta b").textContent=l.type;
 const actions=row.querySelector(".row-actions");const action=(label,cls,callback)=>{const b=document.createElement("button");b.type="button";b.className="mini-btn "+cls;b.textContent=label;b.disabled=!ready||busy;b.onclick=callback;actions.appendChild(b)};
 if(l.status==="pending"){action("Valider","approve",()=>changeStatus(l,"approved"));action("Refuser","reject",()=>changeStatus(l,"rejected"))}else if(l.status==="approved")action("Annuler","reject",()=>changeStatus(l,"cancelled"));
 action("Modifier","",()=>openEdit(l.id));if(approved(l)&&cov.pending)action("Organiser","approve",()=>{try{parentWin.location.href=`inovtec-page-shell.html?mode=planning&page=PLANNINGS-LEGACY.html%3Fv%3D20260815-menu1&replacementAgent=${encodeURIComponent(l.agentRefId)}`}catch{location.href="PLANNINGS.html"}});
 box.appendChild(row)});
}
function render(){leaves=serverRecords.filter(l=>l&&!l.deleted);updateKPIs();renderTimeline();renderList();buildAgentSelect();$("newLeave").disabled=!ready||busy;const submit=$("leaveForm").querySelector('[type="submit"]');if(submit)submit.disabled=!ready||busy;$("deleteLeave").disabled=!ready||busy}
function openModal(l=null){if(!ready||busy)return;editingRevision=l?stamp(l):null;$("leaveModal").classList.add("open");$("leaveModal").setAttribute("aria-hidden","false");$("modalTitle").textContent=l?"Modifier la demande / absence":"Nouvelle demande / absence";$("leaveId").value=l?.id||"";$("agentSelect").value=l?.agentRefId||"";$("sourceType").value=l?.sourceType||"request";$("leaveType").value=l?.type||"Congés payés";$("startDate").value=l?.startDate||dateISO(new Date());$("endDate").value=l?.endDate||dateISO(new Date());$("startPart").value=l?.startPart||"full";$("endPart").value=l?.endPart||"full";$("leaveComment").value=l?.comment||"";$("deleteLeave").hidden=!l;updateStatusHint();setTimeout(()=>$("agentSelect").focus(),20)}
function closeModal(){if(busy)return;$("leaveModal").classList.remove("open");$("leaveModal").setAttribute("aria-hidden","true");editingRevision=null}
function openEdit(id){const l=leaves.find(x=>x.id===id);if(l)openModal(l)}
function updateStatusHint(){const absence=$("sourceType").value==="absence";$("statusHint").textContent=absence?"Une absence enregistrée est considérée comme validée immédiatement et peut déclencher les remplacements.":"Une demande de congé sera enregistrée « À valider » avant d’impacter le planning."}
function readRecords(doc){const entry=doc?.moduleSyncV1?.conges;if(!entry)return null;const records=parse(entry.payload||"[]",null);if(!Array.isArray(records))throw Error("Format des congés Firebase invalide : aucune écriture effectuée.");return records}
async function saveChange(kind,record,expected){
 if(!ready||busy||!docRef||!user){syncMessage("Firebase non confirmé : aucune modification enregistrée.",true);return false}
 busy=true;render();syncMessage("Synchronisation Firebase…");const currentRef=docRef,currentUid=user.uid;
 try{
  await fb().firestore().runTransaction(async tx=>{
   const snap=await tx.get(currentRef);const current=snap.exists?readRecords(snap.data()):null;
   if(current===null)throw Error("Données de congés indisponibles : réessayez après synchronisation.");
   const records=current.slice(),idx=records.findIndex(x=>String(x?.id)===String(record.id)),existing=idx>=0?records[idx]:null;
   if(kind==="create"&&existing)throw Error("Cette demande existe déjà sur un autre appareil.");
   if(kind!=="create"&&(!existing||existing.deleted||stamp(existing)!==expected))throw Error("Cette demande a été modifiée ou supprimée sur un autre appareil. Les nouvelles données sont affichées : ouvrez de nouveau sa fiche avant d’enregistrer.");
   if(kind==="delete")records[idx]={...existing,deleted:true,status:"cancelled",updatedAt:now()};
   else if(kind==="status")records[idx]={...existing,status:record.status,updatedAt:now()};
   else if(kind==="create")records.push(record);
   else records[idx]={...existing,...record};
   tx.set(currentRef,{moduleSyncV1:{conges:{payload:JSON.stringify(records),updatedAtMs:Date.now(),client:"conges_"+currentUid.slice(0,6),reason:kind,version:2}}},{merge:true});
  });
  syncMessage("Firebase synchronisé");return true;
 }catch(e){console.warn("Congés Firebase",e);syncMessage(e?.message||"Erreur Firebase : aucune modification enregistrée.",true);return false}
 finally{busy=false;render()}
}
async function changeStatus(l,status){const ok=await saveChange("status",{id:l.id,status},stamp(l));if(!ok&&ready)alert($("congesSyncStatus").textContent)}
async function deleteCurrent(){const id=$("leaveId").value,l=leaves.find(x=>x.id===id);if(!l||!confirm("Supprimer cette demande / absence ?"))return;const ok=await saveChange("delete",{id},editingRevision);if(ok)closeModal();else alert($("congesSyncStatus").textContent)}
async function onSubmit(e){e.preventDefault();if(busy||!ready)return;const id=$("leaveId").value||uid(),ref=$("agentSelect").value,a=agents.find(x=>String(x.id)===String(ref));if(!a)return alert("Choisissez un agent.");const start=$("startDate").value,end=$("endDate").value;if(!start||!end||end<start)return alert("Vérifiez les dates de début et de fin.");
 const existing=leaves.find(x=>x.id===id),sourceType=$("sourceType").value,status=existing?.status||(sourceType==="absence"?"approved":"pending"),timestamp=now();
 const record={id,agentRefId:ref,agentName:displayAgentName(a),sourceType,type:$("leaveType").value,startDate:start,endDate:end,startPart:$("startPart").value,endPart:$("endPart").value,comment:$("leaveComment").value.trim(),status:sourceType==="absence"&&status==="pending"?"approved":status,createdAt:existing?.createdAt||timestamp,updatedAt:timestamp};
 const ok=await saveChange(existing?"edit":"create",record,editingRevision);if(ok)closeModal();else alert($("congesSyncStatus").textContent);
}
function bindHub(){const h=hub();if(!h){setTimeout(bindHub,350);return}agents=Array.from(h.agents||[]);render();try{hubUnsub?.()}catch{}if(h.subscribe)hubUnsub=h.subscribe(detail=>{agents=Array.from(detail.agents||[]);render()})}
function markSeen(){try{localStorage.setItem("inovtec_conges_cloud_seen_"+user.uid,"1");localStorage.setItem("inovtec_conges_cache_uid",user.uid)}catch{}}
async function migrateInitial(local,ref,uidAtStart){
 if(migrating||!local.length||!user||user.uid!==uidAtStart)return;
 migrating=true;syncMessage("Reprise de vos congés dans Firebase…");
 try{await fb().firestore().runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists&&snap.data()?.moduleSyncV1?.conges)return;tx.set(ref,{moduleSyncV1:{conges:{payload:JSON.stringify(local),updatedAtMs:Date.now(),client:"migration_"+uidAtStart.slice(0,6),reason:"migration-initiale",version:2}}},{merge:true})})}
 catch(e){console.warn("Migration congés",e);syncMessage("Reprise Firebase impossible : données locales conservées, écriture bloquée.",true)}
 finally{migrating=false}
}
function bindFirebase(){const f=fb();if(!f){setReady(false,"Firebase indisponible : aucune écriture possible.");setTimeout(bindFirebase,500);return}if(authBound)return;authBound=true;
 f.auth().onAuthStateChanged(u=>{
  if(unsub){try{unsub()}catch{}unsub=null}user=u||null;docRef=null;ready=false;busy=false;serverRecords=[];
  if(!user){$("loginModal").classList.add("open");setReady(false,"Connexion requise : données non partagées.");return}
  $("loginModal").classList.remove("open");docRef=f.firestore().collection("kanban").doc(user.uid);const currentUid=user.uid,currentRef=docRef;
  setReady(false,"Connexion Firebase en cours…");
  unsub=docRef.onSnapshot({includeMetadataChanges:true},snap=>{
   if(!user||user.uid!==currentUid)return;
   const confirmed=!(snap.metadata?.fromCache||snap.metadata?.hasPendingWrites);
   let remote;try{remote=snap.exists?readRecords(snap.data()):null}catch(e){setReady(false,e.message);return}
   if(remote===null){
    if(!confirmed){setReady(false,"Attente de confirmation Firebase…");return}
    const seen=localStorage.getItem("inovtec_conges_cloud_seen_"+currentUid)==="1",previousUid=localStorage.getItem("inovtec_conges_cache_uid");const local=cache();
    if(!seen&&(!previousUid||previousUid===currentUid)&&local.length){migrateInitial(local,currentRef,currentUid);return}
    serverRecords=[];saveLocal();markSeen();setReady(true,"Firebase synchronisé");return;
   }
   serverRecords=remote;saveLocal();if(confirmed){markSeen();setReady(true,busy?"Synchronisation Firebase…":"Firebase synchronisé")}else{ready=false;setReady(false,"Attente de confirmation Firebase…")}
  },e=>{console.warn("Lecture congés Firebase",e);setReady(false,"Firebase inaccessible : aucune écriture possible.")});
 });
}
function bind(){
 const status=document.createElement("div");status.id="congesSyncStatus";status.setAttribute("role","status");status.setAttribute("aria-live","polite");status.style.cssText="font:600 12px Inter,sans-serif;padding:8px 16px;color:#ad382d";$("timelineWrap").parentElement.prepend(status);
 serverRecords=cache();render();bindHub();bindFirebase();
 $("prevMonth").onclick=()=>{monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()-1,1);renderTimeline()};$("nextMonth").onclick=()=>{monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()+1,1);renderTimeline()};$("monthLabel").onclick=()=>{monthCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderTimeline()};
 $("newLeave").onclick=()=>openModal();$("closeModal").onclick=closeModal;$("cancelModal").onclick=closeModal;$("deleteLeave").onclick=deleteCurrent;$("leaveForm").onsubmit=onSubmit;$("sourceType").onchange=updateStatusHint;$("searchLeave").oninput=renderList;$("statusFilter").onchange=renderList;
 $("leaveModal").addEventListener("click",e=>{if(e.target===$("leaveModal"))closeModal()});
 $("loginForm").onsubmit=async e=>{e.preventDefault();const f=fb(),err=$("loginError");err.textContent="";if(!f){err.textContent="Firebase indisponible.";return}try{try{await f.auth().setPersistence(f.auth.Auth.Persistence.LOCAL)}catch(_e1){try{await f.auth().setPersistence(f.auth.Auth.Persistence.SESSION)}catch(_e2){try{await f.auth().setPersistence(f.auth.Auth.Persistence.NONE)}catch(_e3){}}}await f.auth().signInWithEmailAndPassword($("loginEmail").value.trim(),$("loginPassword").value)}catch(ex){err.textContent="Connexion impossible : "+(ex?.message||"vérifiez vos identifiants.")}};
 window.__INOVTEC_CONGES_SYNC_V2__=true;
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})();