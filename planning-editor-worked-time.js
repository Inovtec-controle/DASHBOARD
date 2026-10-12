(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_EDITOR_WORKED_TIME_V1__)return;
window.__INOVTEC_PLANNING_EDITOR_WORKED_TIME_V1__=true;
const $=id=>document.getElementById(id);
const pop=$("editorPopover"),start=$("edStart"),end=$("edEnd"),date=$("edDate"),agent=$("edAgent"),title=$("edTitle");
if(!pop||!start||!end||!date||!agent||!title)return;
const pad=n=>String(n).padStart(2,"0");
const fmt=n=>{n=Math.max(0,Math.round(Number(n)||0));return Math.floor(n/60)+"h"+pad(n%60)};
const validTime=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t||""));
function parseDate(value){
 const m=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!m)return null;
 const d=new Date(+m[1],+m[2]-1,+m[3]);
 if(d.getFullYear()!==+m[1]||d.getMonth()!==+m[2]-1||d.getDate()!==+m[3])return null;
 return d;
}
function isoWeek(d){
 const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
 x.setDate(x.getDate()+3-(x.getDay()+6)%7);
 const y=new Date(x.getFullYear(),0,4);
 return x.getFullYear()+"-W"+pad(1+Math.round(((x-y)/86400000-3+(y.getDay()+6)%7)/7));
}
function editorTask(original){
 if(title.value==="__legacy__")return title.dataset.legacyTitle||original?.task||"Intervention";
 return "Intervention";
}
const after=start.closest(".editor-row");
if(!after)return;
const summary=document.createElement("div");
summary.id="ivEditorWorkedTime";
summary.setAttribute("aria-live","polite");
summary.setAttribute("aria-label","Durée de travail calculée comme sur le PDF");
summary.className="iv-editor-worked-time";
after.insertAdjacentElement("afterend",summary);
const style=document.createElement("style");
style.id="ivEditorWorkedTimeStyle";
style.textContent="#editorPopover .iv-editor-worked-time{"+
 "margin:1px 3px 9px 28px;padding:7px 9px;"+
 "border:1px solid #d8e6dd;border-radius:8px;"+
 "background:#f5faf7;color:#204a39;font:500 11px/1.4 Inter,system-ui,sans-serif}"+
 "#editorPopover .iv-editor-worked-time strong{font-weight:800}"+
 "#editorPopover .iv-editor-worked-time small{display:block;color:#526c5e;font-size:10px;margin-top:2px}";
document.head.appendChild(style);
let queued=false;
function calculate(){
 if(!pop.classList.contains("open"))return;
 const api=window.InovtecPlanningPDF,source=window.InovtecPlanningAPI?.getState?.();
 if(typeof api?.workedDayMinutes!=="function"||!source?.weeks){
  summary.textContent="Calcul de la durée en cours…";return;
 }
 const d=parseDate(date.value),from=start.value,to=end.value,agentId=String(agent.value||"");
 if(!d||!validTime(from)||!validTime(to)||to<=from||!agentId){
  summary.textContent="Vérifie les horaires pour afficher la durée de travail.";return;
 }
 const targetWeek=isoWeek(d),targetDay=(d.getDay()+6)%7;
 const oldWeek=String(pop.dataset.week||""),editId=String(pop.dataset.id||"");
 const groups=Array.from({length:7},()=>[]);
 for(const [week,events] of Object.entries(source.weeks)){
  if(week!==targetWeek)continue;
  for(const item of Array.isArray(events)?events:[]){
   if(week===oldWeek&&String(item.id)===editId)continue;
   if(String(item.agentId)!==agentId)continue;
   const day=Number(item.day);
   if(Number.isInteger(day)&&day>=0&&day<=6)groups[day].push(item);
  }
 }
 groups[targetDay].push({
  id:editId,agentId,day:targetDay,start:from,end:to,
  task:editorTask((source.weeks?.[oldWeek]||[]).find(e=>String(e.id)===editId))
 });
 const dayTotals=groups.map(items=>api.workedDayMinutes(items));
 const weekly=dayTotals.reduce((n,v)=>n+v,0);
 summary.innerHTML="<strong>Travail compté : "+fmt(dayTotals[targetDay])+" ce jour · "+fmt(weekly)+" cette semaine</strong>"+
  "<small>Comme sur le PDF : déplacements comptés, pauses retirées. Calcul actualisé avant enregistrement.</small>";
}
function requestCalculate(){
 if(queued)return;
 queued=true;
 requestAnimationFrame(()=>{queued=false;calculate()});
}
[start,end,date,agent,title].forEach(el=>{
 el.addEventListener("input",requestCalculate);
 el.addEventListener("change",requestCalculate);
});
new MutationObserver(changes=>{
 if(changes.some(x=>x.attributeName==="class")&&pop.classList.contains("open"))requestCalculate();
}).observe(pop,{attributes:true,attributeFilter:["class"]});
if(pop.classList.contains("open"))requestCalculate();
})();