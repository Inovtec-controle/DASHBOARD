(()=>{
"use strict";
const KEY="inovtec_plannings_v2";
const DAYS=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const COLORS=["#4f9f57","#4f8fd8","#7755b8","#e47c25","#e7556f","#43a9b4","#e5a72b","#6279be","#2f9c78","#b965a7"];
const START_HOUR=6,END_HOUR=22,HOUR_PX=56;
const $=id=>document.getElementById(id);
const uid=p=>p+"_"+Date.now()+"_"+Math.random().toString(16).slice(2);
const pad=n=>String(n).padStart(2,"0");
let state={agents:[],weeks:{},selected:null};
let currentDate=new Date(),view="week",visibleAgents=new Set(),selectedEvent=null,suppressClickUntil=0;
const fmtDay=new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"numeric",month:"short"});
const fmtLong=new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"long",year:"numeric"});
const fmtMonth=new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric"});

function cloneDate(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function addDays(d,n){const x=cloneDate(d);x.setDate(x.getDate()+n);return x}
function mondayIndex(d){return (d.getDay()+6)%7}
function weekStart(d){return addDays(d,-mondayIndex(d))}
function isoWeekKey(d){
  const x=cloneDate(d);x.setDate(x.getDate()+3-mondayIndex(x));
  const y=new Date(x.getFullYear(),0,4),w=1+Math.round(((x-y)/86400000-3+mondayIndex(y))/7);
  return x.getFullYear()+"-W"+pad(w);
}
function weekNumber(key){const m=String(key).match(/W(\d{2})$/);return m?Number(m[1]):0}
function dateFromWeek(key,day){
  const m=String(key).match(/^(\d{4})-W(\d{2})$/);if(!m)return new Date();
  const year=+m[1],week=+m[2],jan4=new Date(year,0,4),mon=addDays(jan4,-mondayIndex(jan4));return addDays(mon,(week-1)*7+day)
}
function dateInput(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseDateInput(s){const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3]):null}
function timeToMin(t){const m=String(t||"").match(/^(\d{1,2}):(\d{2})$/);return m?+m[1]*60 + +m[2]:0}
function minToTime(m){m=Math.max(0,Math.min(1439,Math.round(m)));return pad(Math.floor(m/60))+":"+pad(m%60)}
function round15(m){return Math.round(m/15)*15}
function sameDate(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function agentById(id){return state.agents.find(a=>a.id===id)}
function entriesForWeek(key){if(!Array.isArray(state.weeks[key]))state.weeks[key]=[];return state.weeks[key]}
function entriesForDate(d){const key=isoWeekKey(d),day=mondayIndex(d);return entriesForWeek(key).filter(e=>Number(e.day)===day)}
function eventRef(week,id){return entriesForWeek(week).find(e=>e.id===id)}
function allEntries(){const out=[];Object.entries(state.weeks||{}).forEach(([week,rows])=>(rows||[]).forEach(e=>out.push({week,event:e,date:dateFromWeek(week,Number(e.day)||0)})));return out}
function enforceSingleAgent(){visibleAgents=new Set(state.selected?[state.selected]:[])}
function selectAgent(id){if(!agentById(id))return;state.selected=id;enforceSingleAgent();save();closeEditor();closeContext();render()}
function load(){
  try{const raw=localStorage.getItem(KEY);if(raw)state=JSON.parse(raw)}catch{}
  if(!state||!Array.isArray(state.agents)||!state.weeks)state={agents:[],weeks:{},selected:null};
  if(!state.agents.length){const id=uid("a");state.agents=[{id,name:"Agent 1",copies:1,color:COLORS[0]}];state.selected=id}
  state.agents.forEach((a,i)=>{if(!a.color)a.color=COLORS[i%COLORS.length]});
  if(!state.agents.some(a=>a.id===state.selected))state.selected=state.agents[0].id;
  enforceSingleAgent();
}
function save(){localStorage.setItem(KEY,JSON.stringify(state));updateMeta()}

function updateMeta(){
  const key=isoWeekKey(currentDate),selected=agentById(state.selected),rows=entriesForWeek(key).filter(e=>e.agentId===state.selected).sort((a,b)=>Number(a.day)-Number(b.day)||String(a.start).localeCompare(String(b.start)));
  $("week").value=key;$("weekInfo").textContent=`Semaine ${weekNumber(key)} · ${weekNumber(key)%2?"impaire":"paire"}`;$("title").textContent="Planning — "+(selected?.name||"Agent");$("count").textContent=rows.length+" intervention"+(rows.length>1?"s":"");
  const tbody=$("rows");tbody.innerHTML="";rows.forEach(e=>{const tr=document.createElement("tr");[DAYS[Number(e.day)||0],`${e.start||""} – ${e.end||""}`,e.task||"",e.site||"",e.note||""].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.appendChild(td)});tbody.appendChild(tr)})
}

function renderAgents(){
  const q=$("agentSearch").value.trim().toLowerCase(),box=$("agentList");box.innerHTML="";
  state.agents.filter(a=>!q||a.name.toLowerCase().includes(q)).forEach(a=>{
    const row=document.createElement("div");row.className="agent-row"+(a.id===state.selected?" active":"");row.dataset.agentId=a.id;
    const dot=document.createElement("button");dot.type="button";dot.className="agent-dot"+(a.id===state.selected?" visible":"");dot.style.color=a.color;dot.title="Afficher uniquement le calendrier de "+a.name;
    dot.onclick=e=>{e.stopPropagation();selectAgent(a.id)};
    const name=document.createElement("div");name.className="agent-name";name.textContent=a.name;
    row.append(dot,name);row.onclick=()=>selectAgent(a.id);
    row.oncontextmenu=e=>{e.preventDefault();state.selected=a.id;enforceSingleAgent();save();renderAgents();openAgentMenu(a,e.clientX,e.clientY)};
    let press=null;row.addEventListener("touchstart",e=>{const t=e.touches[0];press=setTimeout(()=>{state.selected=a.id;enforceSingleAgent();save();renderAgents();openAgentMenu(a,t.clientX,t.clientY)},520)},{passive:true});row.addEventListener("touchend",()=>clearTimeout(press));row.addEventListener("touchmove",()=>clearTimeout(press));
    box.appendChild(row)
  });
}
function renameAgent(a){const n=prompt("Nom de l’agent :",a.name);if(n?.trim()){a.name=n.trim();save();render()}}
function addAgent(){const n=prompt("Nom du nouvel agent :");if(!n?.trim())return;const a={id:uid("a"),name:n.trim(),copies:1,color:COLORS[state.agents.length%COLORS.length]};state.agents.push(a);state.selected=a.id;enforceSingleAgent();save();render()}
function duplicateAgent(a){const copy={...a,id:uid("a"),name:a.name+" — copie"};state.agents.push(copy);Object.keys(state.weeks).forEach(w=>{const additions=entriesForWeek(w).filter(e=>e.agentId===a.id).map(e=>({...e,id:uid("e"),agentId:copy.id}));state.weeks[w].push(...additions)});state.selected=copy.id;enforceSingleAgent();save();render()}
function deleteAgent(a){if(state.agents.length===1){alert("Il faut garder au moins un agent.");return}if(!confirm(`Supprimer ${a.name} et toutes ses interventions ?`))return;state.agents=state.agents.filter(x=>x.id!==a.id);Object.keys(state.weeks).forEach(w=>state.weeks[w]=entriesForWeek(w).filter(e=>e.agentId!==a.id));if(state.selected===a.id)state.selected=state.agents[0].id;enforceSingleAgent();save();render()}
function openAgentMenu(a,x,y){
  const menu=$("contextMenu");menu.innerHTML="";
  const item=(label,fn,danger=false)=>{const b=document.createElement("button");b.className="context-item"+(danger?" danger":"");b.textContent=label;b.onclick=()=>{closeContext();fn()};menu.appendChild(b)};
  item("Modifier le nom",()=>renameAgent(a));
  const colorLabel=document.createElement("div");colorLabel.className="context-item";colorLabel.textContent="Couleur";menu.appendChild(colorLabel);
  const palette=document.createElement("div");palette.className="color-palette";COLORS.slice(0,6).forEach(c=>{const b=document.createElement("button");b.className="color-choice";b.style.background=c;b.title="Changer la couleur";b.onclick=()=>{a.color=c;closeContext();save();render()};palette.appendChild(b)});menu.appendChild(palette);
  const sep=document.createElement("div");sep.className="context-sep";menu.appendChild(sep);item("Dupliquer l’agent",()=>duplicateAgent(a));item("Supprimer",()=>deleteAgent(a),true);showContext(x,y)
}
function openBlankMenu(x,y){const menu=$("contextMenu");menu.innerHTML="";const b=document.createElement("button");b.className="context-item";b.textContent="Nouvel agent";b.onclick=()=>{closeContext();addAgent()};menu.appendChild(b);showContext(x,y)}
function showContext(x,y){const m=$("contextMenu");m.classList.add("open");requestAnimationFrame(()=>{const r=m.getBoundingClientRect();m.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+"px";m.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+"px"})}
function closeContext(){$("contextMenu").classList.remove("open")}

function periodText(){
  if(view==="month")return fmtMonth.format(currentDate).replace(/^./,c=>c.toUpperCase());
  if(view==="day")return fmtLong.format(currentDate).replace(/^./,c=>c.toUpperCase());
  const a=weekStart(currentDate),b=addDays(a,6);if(a.getMonth()===b.getMonth())return `${a.getDate()} – ${b.getDate()} ${new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric"}).format(b)}`;return `${fmtDay.format(a)} – ${fmtDay.format(b)} ${b.getFullYear()}`
}
function renderToolbar(){$("periodLabel").textContent=periodText();document.querySelectorAll(".view-tab").forEach(b=>b.classList.toggle("active",b.dataset.view===view))}
function headerForDates(dates){
  const head=$("weekHead");head.innerHTML='<div class="week-head-spacer"></div>';head.style.gridTemplateColumns=`62px repeat(${dates.length},minmax(${dates.length===1?"260px":"120px"},1fr))`;
  const today=new Date();dates.forEach(d=>{const el=document.createElement("div");el.className="day-head"+(sameDate(d,today)?" today":"");el.innerHTML=`<span>${new Intl.DateTimeFormat("fr-FR",{weekday:"short"}).format(d).replace(".","")}</span><strong>${d.getDate()} ${new Intl.DateTimeFormat("fr-FR",{month:"short"}).format(d).replace(".","")}</strong>`;head.appendChild(el)})
}
function minuteFromPointer(col,y){const r=col.getBoundingClientRect(),raw=START_HOUR*60 + ((y-r.top)/HOUR_PX)*60;return Math.max(START_HOUR*60,Math.min(END_HOUR*60-15,round15(raw)))}
function eventPosition(e){const s=timeToMin(e.start),en=Math.max(s+15,timeToMin(e.end));return {top:((s-START_HOUR*60)/60)*HOUR_PX,height:Math.max(24,((en-s)/60)*HOUR_PX)}}
function createEventCard(week,e){
  const a=agentById(e.agentId),pos=eventPosition(e),card=document.createElement("article");card.className="event-card"+(selectedEvent===e.id?" selected":"");card.dataset.id=e.id;card.dataset.week=week;card.style.setProperty("--event-color",a?.color||"#4f9f57");card.style.top=pos.top+"px";card.style.height=pos.height+"px";
  card.innerHTML=`<div class="event-time">${e.start||""} – ${e.end||""}</div><div class="event-title"></div><div class="event-site"></div><div class="event-resize"></div>`;card.querySelector(".event-title").textContent=e.task||"Intervention";card.querySelector(".event-site").textContent=e.site||a?.name||"";
  card.ondblclick=ev=>{if(Date.now()<suppressClickUntil)return;ev.preventDefault();ev.stopPropagation();selectedEvent=e.id;openEditor(week,e,ev.clientX,ev.clientY)};
  card.oncontextmenu=ev=>{ev.preventDefault();ev.stopPropagation();openEditor(week,e,ev.clientX,ev.clientY)};
  card.addEventListener("mousedown",ev=>{if(ev.button!==0)return;ev.stopPropagation();if(ev.target.classList.contains("event-resize"))startResize(ev,week,e,card);else startMove(ev,week,e,card)});
  return card
}
function renderTimeGrid(dates){
  $("calendarViewport").innerHTML='<div class="week-head" id="weekHead"></div><div class="calendar-body"><div class="time-rail" id="timeRail"></div><div class="days-layer" id="daysLayer"></div></div>';headerForDates(dates);
  const rail=$("timeRail");for(let h=START_HOUR;h<=END_HOUR;h++){const l=document.createElement("div");l.className="time-label";l.style.top=((h-START_HOUR)*HOUR_PX)+"px";l.textContent=pad(h)+":00";rail.appendChild(l)}
  const layer=$("daysLayer");layer.style.gridTemplateColumns=`repeat(${dates.length},1fr)`;const now=new Date();
  dates.forEach(d=>{
    const col=document.createElement("div");col.className="day-column"+([5,6].includes(mondayIndex(d))?" weekend":"");col.dataset.date=dateInput(d);col.dataset.week=isoWeekKey(d);col.dataset.day=mondayIndex(d);col.addEventListener("dblclick",createOnDoubleClick);layer.appendChild(col);
    entriesForDate(d).filter(e=>visibleAgents.has(e.agentId)).forEach(e=>col.appendChild(createEventCard(isoWeekKey(d),e)));
    if(sameDate(d,now)){const mins=now.getHours()*60+now.getMinutes();if(mins>=START_HOUR*60&&mins<=END_HOUR*60){const line=document.createElement("div");line.className="now-line";line.style.top=(((mins-START_HOUR*60)/60)*HOUR_PX)+"px";col.appendChild(line)}}
  })
}
function createOnDoubleClick(ev){
  if(ev.button!==0||ev.target.closest(".event-card"))return;
  ev.preventDefault();closeEditor();closeContext();
  const col=ev.currentTarget,start=minuteFromPointer(col,ev.clientY),end=Math.min(END_HOUR*60,start+60),week=col.dataset.week,day=Number(col.dataset.day);
  const event={id:uid("e"),agentId:state.selected,day,start:minToTime(start),end:minToTime(end),task:"Nouvelle intervention",site:"",note:""};
  entriesForWeek(week).push(event);save();selectedEvent=event.id;render();setTimeout(()=>openEditor(week,event,ev.clientX,ev.clientY),20)
}
function startMove(ev,week,e,card){
  const duration=Math.max(15,timeToMin(e.end)-timeToMin(e.start)),originX=ev.clientX,originY=ev.clientY;card.style.opacity=".65";let moved=false,target=null,start=timeToMin(e.start);
  const move=me=>{if(Math.abs(me.clientX-originX)+Math.abs(me.clientY-originY)>5)moved=true;const col=document.elementFromPoint(me.clientX,me.clientY)?.closest(".day-column");document.querySelectorAll(".day-column.drag-target").forEach(x=>x.classList.remove("drag-target"));if(col){col.classList.add("drag-target");target=col;start=Math.min(END_HOUR*60-duration,minuteFromPointer(col,me.clientY));card.style.transform=`translateY(${(start-timeToMin(e.start))/60*HOUR_PX}px)`}};
  const up=()=>{document.removeEventListener("mousemove",move);document.removeEventListener("mouseup",up);document.querySelectorAll(".day-column.drag-target").forEach(x=>x.classList.remove("drag-target"));card.style.opacity="";card.style.transform="";if(moved&&target){const oldArr=entriesForWeek(week),idx=oldArr.findIndex(x=>x.id===e.id);if(idx>=0)oldArr.splice(idx,1);const newWeek=target.dataset.week;e.day=Number(target.dataset.day);e.start=minToTime(start);e.end=minToTime(start+duration);entriesForWeek(newWeek).push(e);save();suppressClickUntil=Date.now()+250;render()}};
  document.addEventListener("mousemove",move);document.addEventListener("mouseup",up)
}
function startResize(ev,week,e,card){
  const start=timeToMin(e.start);let end=timeToMin(e.end),moved=false;card.style.opacity=".7";
  const move=me=>{const col=card.closest(".day-column");end=Math.max(start+15,minuteFromPointer(col,me.clientY));card.style.height=Math.max(24,((end-start)/60)*HOUR_PX)+"px";moved=true};
  const up=()=>{document.removeEventListener("mousemove",move);document.removeEventListener("mouseup",up);card.style.opacity="";if(moved){e.end=minToTime(Math.min(END_HOUR*60,end));save();suppressClickUntil=Date.now()+250;render()}};document.addEventListener("mousemove",move);document.addEventListener("mouseup",up)
}

function renderMonth(){
  $("calendarViewport").innerHTML='<div class="month-view" id="monthView"></div>';const box=$("monthView"),first=new Date(currentDate.getFullYear(),currentDate.getMonth(),1),start=addDays(first,-mondayIndex(first)),today=new Date();
  for(let i=0;i<42;i++){const d=addDays(start,i),cell=document.createElement("div");cell.className="month-cell"+(d.getMonth()!==currentDate.getMonth()?" out":"")+(sameDate(d,today)?" today":"");cell.dataset.date=dateInput(d);const n=document.createElement("div");n.className="month-number";n.textContent=d.getDate();cell.appendChild(n);entriesForDate(d).filter(e=>visibleAgents.has(e.agentId)).slice(0,4).forEach(e=>{const p=document.createElement("div"),a=agentById(e.agentId);p.className="month-event";p.style.setProperty("--event-color",a?.color||COLORS[0]);p.textContent=`${e.start} ${e.task||"Intervention"}`;p.ondblclick=ev=>{ev.preventDefault();ev.stopPropagation();openEditor(isoWeekKey(d),e,ev.clientX,ev.clientY)};cell.appendChild(p)});cell.ondblclick=ev=>{if(ev.target!==cell&&ev.target!==n)return;createDefaultForDate(d,ev.clientX,ev.clientY)};box.appendChild(cell)}
}
function renderList(){
  const box=document.createElement("div");box.className="list-view";$("calendarViewport").innerHTML="";$("calendarViewport").appendChild(box);const start=weekStart(currentDate);let total=0;
  for(let i=0;i<7;i++){const d=addDays(start,i),items=entriesForDate(d).filter(e=>visibleAgents.has(e.agentId)).sort((a,b)=>String(a.start).localeCompare(String(b.start)));if(!items.length)continue;total+=items.length;const g=document.createElement("section");g.className="list-group";g.innerHTML=`<h3>${fmtDay.format(d)}</h3>`;items.forEach(e=>{const a=agentById(e.agentId),r=document.createElement("div");r.className="list-item";r.innerHTML='<span class="list-color"></span><span class="list-time"></span><span class="list-title"></span><span class="list-agent"></span>';r.querySelector(".list-color").style.background=a?.color||COLORS[0];r.querySelector(".list-time").textContent=`${e.start} – ${e.end}`;r.querySelector(".list-title").textContent=e.task||"Intervention";r.querySelector(".list-agent").textContent=a?.name||"Agent";r.onclick=ev=>openEditor(isoWeekKey(d),e,ev.clientX,ev.clientY);g.appendChild(r)});box.appendChild(g)}if(!total)box.innerHTML='<div class="empty-state">Aucune intervention sur cette semaine.</div>'
}
function createDefaultForDate(d,x,y){const start=9*60,event={id:uid("e"),agentId:state.selected,day:mondayIndex(d),start:minToTime(start),end:minToTime(start+60),task:"Nouvelle intervention",site:"",note:""},week=isoWeekKey(d);entriesForWeek(week).push(event);save();render();setTimeout(()=>openEditor(week,event,x,y),20)}

function fillAgentSelect(){const s=$("edAgent");s.innerHTML=state.agents.map(a=>`<option value="${a.id}"></option>`).join("");[...s.options].forEach((o,i)=>o.textContent=state.agents[i].name)}
function openEditor(week,e,x,y){selectedEvent=e.id;fillAgentSelect();const d=dateFromWeek(week,Number(e.day)||0);$("edTitle").value=e.task||"";$("edSite").value=e.site||"";$("edDate").value=dateInput(d);$("edStart").value=e.start||"09:00";$("edEnd").value=e.end||"10:00";$("edNote").value=e.note||"";$("edAgent").value=e.agentId||state.selected;const pop=$("editorPopover");pop.dataset.week=week;pop.dataset.id=e.id;pop.classList.add("open");requestAnimationFrame(()=>{const r=pop.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(x+12,innerWidth-r.width-8))+"px";pop.style.top=Math.max(8,Math.min(y+12,innerHeight-r.height-8))+"px"});render()}
function closeEditor(){selectedEvent=null;$("editorPopover").classList.remove("open");document.querySelectorAll(".event-card.selected").forEach(x=>x.classList.remove("selected"))}
function saveEditor(){const pop=$("editorPopover"),oldWeek=pop.dataset.week,id=pop.dataset.id,e=eventRef(oldWeek,id);if(!e){closeEditor();return}const d=parseDateInput($("edDate").value);if(!d)return;const start=$("edStart").value,end=$("edEnd").value;if(timeToMin(end)<=timeToMin(start)){alert("L’heure de fin doit être après le début.");return}const newWeek=isoWeekKey(d);e.agentId=$("edAgent").value;e.day=mondayIndex(d);e.start=start;e.end=end;e.task=$("edTitle").value.trim()||"Intervention";e.site=$("edSite").value.trim();e.note=$("edNote").value.trim();if(newWeek!==oldWeek){state.weeks[oldWeek]=entriesForWeek(oldWeek).filter(x=>x.id!==id);entriesForWeek(newWeek).push(e)}state.selected=e.agentId;enforceSingleAgent();save();closeEditor();render()}
function deleteEdited(){const pop=$("editorPopover"),week=pop.dataset.week,id=pop.dataset.id,e=eventRef(week,id);if(!e)return;if(confirm(`Supprimer « ${e.task||"cette intervention"} » ?`)){state.weeks[week]=entriesForWeek(week).filter(x=>x.id!==id);save();closeEditor();render()}}

function render(){enforceSingleAgent();renderToolbar();renderAgents();updateMeta();if(view==="month")renderMonth();else if(view==="list")renderList();else if(view==="day")renderTimeGrid([cloneDate(currentDate)]);else{const s=weekStart(currentDate);renderTimeGrid(Array.from({length:7},(_,i)=>addDays(s,i)))}}
function navigate(dir){if(view==="month")currentDate=new Date(currentDate.getFullYear(),currentDate.getMonth()+dir,1);else currentDate=addDays(currentDate,dir*(view==="day"?1:7));closeEditor();render()}
function exportData(){const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="inovtec_plannings_"+new Date().toISOString().slice(0,10)+".json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u)}
function importData(file){const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!Array.isArray(x.agents)||!x.weeks)throw Error("format incompatible");state=x;state.agents.forEach((a,i)=>{if(!a.color)a.color=COLORS[i%COLORS.length]});if(!state.agents.some(a=>a.id===state.selected))state.selected=state.agents[0]?.id;enforceSingleAgent();save();render();alert("Import réussi.")}catch(err){alert("Import impossible : "+err.message)}};r.readAsText(file)}

load();
$("agentSearch").addEventListener("input",renderAgents);
$("agentList").addEventListener("contextmenu",e=>{if(e.target.closest(".agent-row"))return;e.preventDefault();openBlankMenu(e.clientX,e.clientY)});
$("agentPanel").addEventListener("contextmenu",e=>{if(e.target.closest(".agent-row")||e.target.closest("input"))return;e.preventDefault();openBlankMenu(e.clientX,e.clientY)});
document.querySelectorAll(".view-tab").forEach(b=>b.onclick=()=>{view=b.dataset.view;closeEditor();render()});
$("prevBtn").onclick=()=>navigate(-1);$("nextBtn").onclick=()=>navigate(1);$("todayBtn").onclick=()=>{currentDate=new Date();closeEditor();render()};
$("edDone").onclick=saveEditor;$("edDelete").onclick=deleteEdited;
$("editorPopover").addEventListener("mousedown",e=>e.stopPropagation());
$("exportBtn").onclick=exportData;$("importFile").onchange=e=>{const f=e.target.files?.[0];if(f)importData(f);e.target.value=""};$("printBtn").onclick=()=>window.print();
document.addEventListener("mousedown",e=>{if(!e.target.closest("#contextMenu"))closeContext();if(!e.target.closest("#editorPopover")&&!e.target.closest(".event-card")&&!e.target.closest(".month-event")&&!e.target.closest(".list-item"))closeEditor()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeContext();closeEditor()}});
window.addEventListener("resize",()=>{closeContext();if($("editorPopover").classList.contains("open"))closeEditor()});
render();setInterval(()=>{if(view==="week"||view==="day")render()},60000);
})();