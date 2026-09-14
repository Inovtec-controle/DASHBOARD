(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_PDF_ROBUST_TEXT_V2__)return;
window.__INOVTEC_PLANNING_PDF_ROBUST_TEXT_V2__=true;

const KEY="inovtec_plannings_v2";
const DAYS=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const MONTHS=["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
const NIGHT_START=21*60;
const NIGHT_END=5*60;
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const clean=v=>String(v??"").replace(/\s+/g," ").trim();
function addDays(d,n){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x}
function mondayIndex(d){return(d.getDay()+6)%7}
function dateFromWeek(key,day=0){const m=String(key||"").match(/^(\d{4})-W(\d{2})$/);if(!m)return null;const year=+m[1],week=+m[2],jan4=new Date(year,0,4),mon=addDays(jan4,-mondayIndex(jan4));return addDays(mon,(week-1)*7+day)}
function rangeLabel(a,b){if(!a||!b)return"Semaine affichee";if(a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth())return`${a.getDate()}-${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;if(a.getFullYear()===b.getFullYear())return`${a.getDate()} ${MONTHS[a.getMonth()]} - ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;return`${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()} - ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`}
function safeName(v){return String(v||"planning").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"planning"}
function timeToMin(t){const m=String(t||"").match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):0}
function displayTime(t){const m=String(t||"").match(/(\d{1,2}):(\d{2})/);if(!m)return String(t||"");return`${Number(m[1])}h${m[2]}`}
function durationMin(item){let s=timeToMin(item.start),e=timeToMin(item.end);if(e<s)e+=1440;return Math.max(0,e-s)}
function isPause(item){return norm(item?.task)==="pause"}
function workedDurationMin(item){return isPause(item)?0:durationMin(item)}
function overlapMin(start,end,windowStart,windowEnd){return Math.max(0,Math.min(end,windowEnd)-Math.max(start,windowStart))}
function nightDurationMin(item){
  if(isPause(item)||!item?.start||!item?.end)return 0;
  const start=timeToMin(item.start);let end=timeToMin(item.end);
  if(end<start)end+=1440;
  return overlapMin(start,end,0,NIGHT_END)+overlapMin(start,end,NIGHT_START,1440+NIGHT_END);
}
function durationLabel(mins){const h=Math.floor(mins/60),m=mins%60;return h?`${h}h${pad(m)}`:`${m} min`}
function totalLabel(mins){const h=Math.floor(mins/60),m=mins%60;return`${h}h${pad(m)}`}
function loadState(){try{const s=JSON.parse(localStorage.getItem(KEY)||"{}");return s&&Array.isArray(s.agents)&&s.weeks?s:{agents:[],weeks:{},selected:null}}catch{return{agents:[],weeks:{},selected:null}}}
function hubAgents(){try{return parent?.InovtecDataHub?.readyAgents?Array.from(parent.InovtecDataHub.agents||[]):[]}catch{return[]}}
function hubName(a){return[a?.identity?.prenom,a?.identity?.nom].filter(Boolean).join(" ").trim()||a?.displayName||a?.name||"Agent sans nom"}
function copiesFor(agent){const masters=hubAgents();const m=masters.find(x=>String(x.id)===String(agent.refId||agent.id)||norm(hubName(x))===norm(agent.name));const raw=m?.job?.planningCopies,cloud=Math.round(Number(raw)),local=Math.round(Number(agent?.copies));if(Number.isFinite(cloud)&&cloud>=2)return Math.min(10,cloud);if(Number.isFinite(local)&&local>=2)return Math.min(10,local);return 2}
function currentWeek(){return $("week")?.value||""}
function agentData(state,week,agent){
  const start=dateFromWeek(week,0),end=dateFromWeek(week,6),groups=DAYS.map(()=>[]);
  const rows=Array.isArray(state.weeks?.[week])?state.weeks[week]:[];
  rows.filter(e=>String(e.agentId)===String(agent.id)).sort((a,b)=>Number(a.day)-Number(b.day)||String(a.start).localeCompare(String(b.start))).forEach(e=>{
    const d=Math.max(0,Math.min(6,Number(e.day)||0));
    groups[d].push({start:e.start||"",end:e.end||"",task:e.task||"Intervention",brief:e.site||"",note:e.note||""});
  });
  const dayTotals=groups.map(g=>g.reduce((n,item)=>n+workedDurationMin(item),0));
  const weekTotal=dayTotals.reduce((a,b)=>a+b,0);
  const nightTotal=groups.reduce((total,g)=>total+g.reduce((n,item)=>n+nightDurationMin(item),0),0);
  const sundayTotal=dayTotals[6]||0;
  return{agent:agent.name||"Agent",start,end,groups,dayTotals,weekTotal,nightTotal,sundayTotal};
}
function jsPDFClass(){return window.jspdf?.jsPDF||window.jsPDF||null}
function makeDoc(){const C=jsPDFClass();if(!C){alert("Le generateur PDF n'est pas encore charge. Reessaie dans quelques secondes.");return null}return new C({orientation:"landscape",unit:"mm",format:"a4",compress:true})}
function drawHeader(doc,data){
  doc.setFillColor(255,255,255);doc.setDrawColor(6,78,59);doc.setLineWidth(1.1);doc.roundedRect(8,7,281,23,4,4,"FD");
  doc.setTextColor(20,57,45);doc.setFont("helvetica","bold");doc.setFontSize(7);doc.text("PLANNING HEBDOMADAIRE",15,13);
  doc.setFontSize(18);doc.text(clean(data.agent)||"Agent",15,21,{maxWidth:178});
  doc.setFontSize(9);doc.setFont("helvetica","normal");doc.text(rangeLabel(data.start,data.end),15,27);
  doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text("TOTAL SEMAINE",281,14,{align:"right"});doc.setFontSize(15);doc.text(totalLabel(data.weekTotal),281,22.5,{align:"right"});
  const extras=[];
  if(data.nightTotal>0)extras.push(`TRAVAIL DE NUIT (21H-5H) : ${totalLabel(data.nightTotal)}`);
  if(data.sundayTotal>0)extras.push(`TRAVAIL LE DIMANCHE : ${totalLabel(data.sundayTotal)}`);
  if(extras.length){doc.setFont("helvetica","bold");doc.setFontSize(extras.length>1?5.8:6.5);extras.forEach((label,i)=>doc.text(label,281,extras.length>1?26.5+i*2.6:28,{align:"right"}))}
  doc.setLineWidth(.25);doc.setFont("helvetica","normal");doc.setTextColor(0,0,0);
}
function wrap(doc,text,width,size,style="normal"){doc.setFont("helvetica",style);doc.setFontSize(size);const value=clean(text);return value?doc.splitTextToSize(value,Math.max(4,width)):[]}
function measureEvent(doc,item,w,size){
  const padX=size<=4?1.05:1.35,textW=Math.max(5,w-padX*2-1),timeSize=Math.max(3.3,size*.82),taskSize=Math.max(3.5,size*1.03),briefSize=Math.max(3.25,size);
  const timeLines=wrap(doc,`${displayTime(item.start)} - ${displayTime(item.end)} ${durationLabel(durationMin(item))}`,textW,timeSize,"bold");
  const taskLines=wrap(doc,item.task||"Intervention",textW,taskSize,"bold"),briefLines=wrap(doc,item.brief||"",textW,briefSize,"normal");
  const timeLH=Math.max(2.15,timeSize*.39),taskLH=Math.max(2.3,taskSize*.4),briefLH=Math.max(2.15,briefSize*.39),topPad=size<=4?1:1.25,bottomPad=size<=4?.85:1.05;
  let h=topPad+Math.max(1,timeLines.length)*timeLH+.45+Math.max(1,taskLines.length)*taskLH;if(briefLines.length)h+=.55+briefLines.length*briefLH;h+=bottomPad;
  return{h:Math.max(6.2,h),padX,textW,timeSize,taskSize,briefSize,timeLines,taskLines,briefLines,timeLH,taskLH,briefLH,topPad,bottomPad};
}
function chooseDayLayout(doc,list,w,bodyH){
  if(!list.length)return{fontSize:7.4,gap:0,metrics:[],total:0,compact:false};
  const compact=list.length>15;
  const gaps=compact?[.5,.4,.32,.25,.2,.16,.12]:[.8,.72,.64,.56,.48,.4,.32];
  const sizes=compact?[5.8,5.4,5,4.6,4.2,3.9,3.6,3.3,3.05,2.8,2.6]:[7.4,7.1,6.8,6.5,6.2,5.9,5.6,5.3,5];
  for(let si=0;si<sizes.length;si++){
    const size=sizes[si],gap=gaps[Math.min(gaps.length-1,Math.floor(si/2))],metrics=list.map(item=>measureEvent(doc,item,w,size)),total=metrics.reduce((n,m)=>n+m.h,0)+gap*Math.max(0,list.length-1);
    if(total<=bodyH-.8)return{fontSize:size,gap,metrics,total,compact};
  }
  const size=compact?2.45:4.75,gap=compact?.1:.24,metrics=list.map(item=>measureEvent(doc,item,w,size));let total=metrics.reduce((n,m)=>n+m.h,0)+gap*Math.max(0,list.length-1);
  if(total>bodyH-.3){const scale=(bodyH-.3)/total;metrics.forEach(m=>{m.h=Math.max(compact?3.7:5.4,m.h*scale);m.timeLH*=scale;m.taskLH*=scale;m.briefLH*=scale;m.topPad*=scale;m.bottomPad*=scale});total=metrics.reduce((n,m)=>n+m.h,0)+gap*Math.max(0,list.length-1)}
  return{fontSize:size,gap,metrics,total,compact};
}
function drawEvent(doc,item,x,y,w,h,m){
  const pause=isPause(item),barW=m.briefSize<=4?.55:.8;if(pause){doc.setFillColor(255,248,225);doc.setDrawColor(224,165,55)}else{doc.setFillColor(255,255,255);doc.setDrawColor(174,195,184)}
  doc.setLineWidth(.18);doc.roundedRect(x,y,w,h,.75,.75,"FD");doc.setFillColor(pause?230:6,pause?145:120,pause?56:84);doc.rect(x,y,barW,h,"F");
  const cx=x+w/2,extraY=Math.max(0,(h-m.h)/2);let ty=y+extraY+m.topPad+m.timeLH*.82;doc.setFont("helvetica","bold");doc.setFontSize(m.timeSize);doc.setTextColor(205,45,45);if(m.timeLines.length)doc.text(m.timeLines,cx,ty,{align:"center",lineHeightFactor:.98});
  ty+=Math.max(1,m.timeLines.length)*m.timeLH+.45;doc.setFont("helvetica","bold");doc.setFontSize(m.taskSize);doc.setTextColor(25,25,25);if(m.taskLines.length)doc.text(m.taskLines,cx,ty,{align:"center",lineHeightFactor:.98});
  ty+=Math.max(1,m.taskLines.length)*m.taskLH;if(m.briefLines.length){ty+=.55;doc.setFont("helvetica","normal");doc.setFontSize(m.briefSize);doc.setTextColor(35,35,35);doc.text(m.briefLines,cx,ty,{align:"center",lineHeightFactor:.98})}
}
function drawGrid(doc,data){
  const x=8,y=36,w=281,headH=11,bodyH=146,totalH=11,dayW=w/7,bodyY=y+headH,totalY=bodyY+bodyH;
  doc.setFillColor(246,249,247);doc.rect(x,y,w,headH,"F");doc.setDrawColor(155,166,160);doc.setLineWidth(.25);doc.rect(x,y,w,headH+bodyH+totalH);for(let i=1;i<7;i++){const vx=x+i*dayW;doc.line(vx,y,vx,y+headH+bodyH+totalH)}
  DAYS.forEach((name,i)=>{const d=addDays(data.start,i),cx=x+i*dayW+dayW/2;doc.setTextColor(27,53,43);doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.text(name.toUpperCase(),cx,y+4.4,{align:"center"});doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(91,106,99);doc.text(`${d.getDate()} ${MONTHS[d.getMonth()]}`,cx,y+8.5,{align:"center"})});
  data.groups.forEach((list,i)=>{
    if(!list.length)return;
    const cellX=x+i*dayW+.8,cellW=dayW-1.6,usableH=bodyH-1.2,layout=chooseDayLayout(doc,list,cellW,usableH),shouldFill=list.length>=8&&list.length<=15;
    let spare=Math.max(0,usableH-layout.total);
    if(shouldFill&&spare>0){const add=spare/list.length;layout.metrics.forEach(m=>m.h+=add);layout.total+=spare;spare=0}
    let cursor=bodyY+.6+(shouldFill?0:Math.min(1.6,spare/(list.length+1)));
    list.forEach((item,j)=>{const m=layout.metrics[j],h=Math.min(m.h,bodyY+bodyH-.6-cursor);drawEvent(doc,item,cellX,cursor,cellW,h,m);cursor+=h+layout.gap});
  });
  doc.setFillColor(248,250,249);doc.rect(x,totalY,w,totalH,"F");doc.setDrawColor(155,166,160);doc.line(x,totalY,x+w,totalY);data.dayTotals.forEach((mins,i)=>{const cx=x+i*dayW+dayW/2;doc.setFont("helvetica","bold");doc.setFontSize(5.8);doc.setTextColor(87,101,94);doc.text("TOTAL JOUR",cx,totalY+4,{align:"center"});doc.setFontSize(8.5);doc.setTextColor(20,57,45);doc.text(totalLabel(mins),cx,totalY+8.6,{align:"center"})});
}
function drawPage(doc,data){drawHeader(doc,data);drawGrid(doc,data)}
function single(){const state=loadState(),week=currentWeek(),agent=state.agents.find(a=>String(a.id)===String(state.selected));if(!week){alert("La semaine affichee est introuvable.");return}if(!agent){alert("Selectionne d'abord un agent dans la liste de gauche.");return}const doc=makeDoc();if(!doc)return;const data=agentData(state,week,agent);drawPage(doc,data);doc.save(`Planning_${safeName(data.agent)}_${data.start.getFullYear()}-${pad(data.start.getMonth()+1)}-${pad(data.start.getDate())}.pdf`)}
function all(){const state=loadState(),week=currentWeek(),agents=Array.isArray(state.agents)?state.agents:[];if(!week){alert("La semaine affichee est introuvable.");return}if(!agents.length){alert("Aucun agent dans le Planning.");return}const queue=[],maxCopies=Math.max(...agents.map(copiesFor),2);for(let round=1;round<=maxCopies;round++)agents.forEach(a=>{if(copiesFor(a)>=round)queue.push(a)});if(!queue.length)return;const doc=makeDoc();if(!doc)return;queue.forEach((agent,i)=>{if(i>0)doc.addPage("a4","landscape");drawPage(doc,agentData(state,week,agent))});const start=dateFromWeek(week,0);doc.save(`Plannings_tous_agents_${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}.pdf`)}
function install(){const api=window.InovtecPlanningPDF||{};api.generate=single;api.generateSingle=single;api.generateAll=all;api.copiesFor=copiesFor;api.robustText=true;api.nightRange="21:00-05:00";window.InovtecPlanningPDF=api}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(install,0),{once:true});else setTimeout(install,0);setTimeout(install,150);setTimeout(install,700);
})();