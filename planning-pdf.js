(()=>{
"use strict";
const KEY="inovtec_plannings_v2";
const DAYS=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const MONTHS=["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function addDays(d,n){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x}
function mondayIndex(d){return(d.getDay()+6)%7}
function dateFromWeek(key,day=0){const m=String(key||"").match(/^(\d{4})-W(\d{2})$/);if(!m)return null;const year=+m[1],week=+m[2],jan4=new Date(year,0,4),mon=addDays(jan4,-mondayIndex(jan4));return addDays(mon,(week-1)*7+day)}
function rangeLabel(a,b){if(!a||!b)return"Semaine affichee";if(a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth())return`${a.getDate()}-${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;if(a.getFullYear()===b.getFullYear())return`${a.getDate()} ${MONTHS[a.getMonth()]} - ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;return`${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()} - ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`}
function safeName(v){return String(v||"planning").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"planning"}
function timeToMin(t){const m=String(t||"").match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):0}
function displayTime(t){const m=String(t||"").match(/(\d{1,2}):(\d{2})/);if(!m)return String(t||"");return`${Number(m[1])}h${m[2]}`}
function durationMin(item){return Math.max(0,timeToMin(item.end)-timeToMin(item.start))}
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
  const dayTotals=groups.map(g=>g.reduce((n,item)=>n+durationMin(item),0));
  const weekTotal=dayTotals.reduce((a,b)=>a+b,0);
  return{agent:agent.name||"Agent",start,end,groups,dayTotals,weekTotal};
}
function jsPDFClass(){return window.jspdf?.jsPDF||window.jsPDF||null}
function fitLine(doc,value,maxWidth){let s=String(value||"").replace(/\s+/g," ").trim();if(!s)return"";if(doc.getTextWidth(s)<=maxWidth)return s;const ell="...";while(s.length>1&&doc.getTextWidth(s+ell)>maxWidth)s=s.slice(0,-1);return(s.trim()||"")+ell}
function fitLines(doc,value,maxWidth,maxLines){const text=String(value||"").replace(/\s+/g," ").trim();if(!text)return[];let lines=doc.splitTextToSize(text,maxWidth);if(lines.length<=maxLines)return lines;lines=lines.slice(0,maxLines);lines[maxLines-1]=fitLine(doc,lines[maxLines-1]+"...",maxWidth);return lines}
function timeRange(data){
  const items=data.groups.flat();
  if(!items.length)return{start:7*60,end:19*60};
  let first=Math.min(...items.map(x=>timeToMin(x.start)).filter(Number.isFinite));
  let last=Math.max(...items.map(x=>timeToMin(x.end)).filter(Number.isFinite));
  first=Math.max(0,Math.floor((first-30)/60)*60);
  last=Math.min(24*60,Math.ceil((last+30)/60)*60);
  const minSpan=8*60;
  if(last-first<minSpan){
    const need=minSpan-(last-first),before=Math.floor(need/2),after=need-before;
    first=Math.max(0,first-before);last=Math.min(24*60,last+after);
    if(last-first<minSpan){if(first===0)last=Math.min(24*60,minSpan);else first=Math.max(0,last-minSpan)}
  }
  return{start:first,end:last};
}
function drawHeader(doc,data){
  doc.setFillColor(6,78,59);doc.roundedRect(8,7,281,23,4,4,"F");
  doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(7);doc.text("PLANNING HEBDOMADAIRE",15,13);
  doc.setFontSize(18);doc.text(String(data.agent||"Agent"),15,21,{maxWidth:178});
  doc.setFontSize(9);doc.setFont("helvetica","normal");doc.text(rangeLabel(data.start,data.end),15,27);
  doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text("TOTAL SEMAINE",281,14,{align:"right"});doc.setFontSize(15);doc.text(totalLabel(data.weekTotal),281,23,{align:"right"});
  doc.setFont("helvetica","normal");doc.setTextColor(0,0,0);
}
function layoutDay(list,range,bodyY,bodyH){
  if(!list.length)return[];
  const gap=1.1,bodyBottom=bodyY+bodyH,n=list.length;
  const minH=Math.max(10.8,Math.min(15,(bodyH-gap*(n-1))/Math.max(1,n)));
  const span=Math.max(60,range.end-range.start);
  const pos=list.map(item=>{
    const start=timeToMin(item.start),end=Math.max(start+15,timeToMin(item.end));
    const desiredTop=bodyY+Math.max(0,Math.min(1,(start-range.start)/span))*bodyH;
    const naturalH=Math.max(minH,Math.min(30,((end-start)/span)*bodyH));
    return{item,top:desiredTop,h:naturalH};
  });
  for(let i=0;i<pos.length;i++){if(i>0)pos[i].top=Math.max(pos[i].top,pos[i-1].top+pos[i-1].h+gap)}
  if(pos.length){
    let overflow=pos[pos.length-1].top+pos[pos.length-1].h-bodyBottom;
    if(overflow>0){for(let i=pos.length-1;i>=0;i--){pos[i].top-=overflow;if(i>0){const allowed=pos[i].top-gap-pos[i-1].h;if(pos[i-1].top>allowed)overflow=pos[i-1].top-allowed;else overflow=0}else overflow=Math.max(0,bodyY-pos[i].top)}}
    if(pos[0].top<bodyY){const shift=bodyY-pos[0].top;pos.forEach(p=>p.top+=shift)}
    for(let i=1;i<pos.length;i++)pos[i].top=Math.max(pos[i].top,pos[i-1].top+pos[i-1].h+gap);
    overflow=pos[pos.length-1].top+pos[pos.length-1].h-bodyBottom;
    if(overflow>0){for(let i=pos.length-1;i>=0;i--){pos[i].top-=overflow;overflow=0;if(i>0&&pos[i-1].top+pos[i-1].h+gap>pos[i].top)overflow=pos[i-1].top+pos[i-1].h+gap-pos[i].top}}
  }
  return pos;
}
function drawEvent(doc,item,x,y,w,h){
  const padX=2,textW=w-4;
  doc.setFillColor(255,255,255);doc.setDrawColor(174,195,184);doc.setLineWidth(.22);doc.roundedRect(x,y,w,h,1.2,1.2,"FD");
  doc.setFillColor(6,120,84);doc.rect(x,y,.9,h,"F");
  const mins=durationMin(item);
  doc.setFont("helvetica","bold");doc.setFontSize(6.9);doc.setTextColor(205,45,45);
  const timeText=`${displayTime(item.start)} - ${displayTime(item.end)}   ${durationLabel(mins)}`;
  doc.text(fitLine(doc,timeText,textW),x+padX,y+2.9);
  doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(25,45,38);
  doc.text(fitLine(doc,item.task||"Intervention",textW),x+padX,y+6.1);
  if(item.brief){
    doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(66,78,72);
    const maxLines=h>=16?2:1,lines=fitLines(doc,item.brief,textW,maxLines);
    if(lines.length)doc.text(lines,x+padX,y+9.2,{lineHeightFactor:1.08});
  }
}
function drawGrid(doc,data){
  const x=8,y=36,w=281,headH=11,bodyH=146,totalH=11,dayW=w/7,bodyY=y+headH,totalY=bodyY+bodyH;
  const range=timeRange(data),span=Math.max(60,range.end-range.start);
  doc.setFillColor(246,249,247);doc.rect(x,y,w,headH,"F");
  doc.setDrawColor(155,166,160);doc.setLineWidth(.25);doc.rect(x,y,w,headH+bodyH+totalH);
  for(let i=1;i<7;i++){const vx=x+i*dayW;doc.line(vx,y,vx,y+headH+bodyH+totalH)}
  DAYS.forEach((name,i)=>{
    const d=addDays(data.start,i),cx=x+i*dayW+dayW/2;
    doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(20,57,45);doc.text(name.toUpperCase(),cx,y+4.3,{align:"center"});
    doc.setFont("helvetica","normal");doc.setFontSize(6.2);doc.setTextColor(105,116,110);doc.text(`${d.getDate()} ${MONTHS[d.getMonth()].slice(0,4)}.`,cx,y+8.2,{align:"center"});
  });
  const firstHour=Math.ceil(range.start/60),lastHour=Math.floor(range.end/60);
  for(let h=firstHour;h<=lastHour;h++){
    const yy=bodyY+((h*60-range.start)/span)*bodyH;
    if(yy<bodyY||yy>bodyY+bodyH)continue;
    doc.setDrawColor(220,224,222);doc.setLineWidth(.13);doc.line(x,yy,x+w,yy);
  }
  for(let h=firstHour;h<lastHour;h++){
    const yy=bodyY+(((h*60+30)-range.start)/span)*bodyH;
    if(yy<bodyY||yy>bodyY+bodyH)continue;
    doc.setDrawColor(237,239,238);doc.setLineWidth(.1);doc.line(x,yy,x+w,yy);
  }
  data.groups.forEach((list,day)=>{
    const positions=layoutDay(list,range,bodyY+1,bodyH-2),left=x+day*dayW+1.1,cardW=dayW-2.2;
    positions.forEach(p=>drawEvent(doc,p.item,left,p.top,cardW,p.h));
  });
  doc.setFillColor(248,250,249);doc.rect(x,totalY,w,totalH,"F");doc.setDrawColor(155,166,160);doc.line(x,totalY,x+w,totalY);
  data.dayTotals.forEach((mins,i)=>{
    const cx=x+i*dayW+dayW/2;
    doc.setFont("helvetica","bold");doc.setFontSize(8.2);doc.setTextColor(25,45,38);doc.text(totalLabel(mins),cx,totalY+6.8,{align:"center"});
  });
  doc.setFont("helvetica","normal");doc.setFontSize(5.8);doc.setTextColor(105,116,110);doc.text(`Amplitude affichee : ${displayTime(`${Math.floor(range.start/60)}:${pad(range.start%60)}`)} - ${displayTime(`${Math.floor(range.end/60)}:${pad(range.end%60)}`)}`,8,207);
  doc.text("Document genere depuis Inovtec Dashboard",289,207,{align:"right"});
}
function drawPage(doc,data){drawHeader(doc,data);drawGrid(doc,data)}
function makeDoc(){const C=jsPDFClass();if(!C){alert("Le generateur PDF n'est pas encore charge. Reessaie dans quelques secondes.");return null}return new C({orientation:"landscape",unit:"mm",format:"a4",compress:true})}
function single(){const state=loadState(),week=currentWeek(),agent=state.agents.find(a=>String(a.id)===String(state.selected));if(!week){alert("La semaine affichee n'a pas pu etre determinee.");return}if(!agent){alert("Selectionne d'abord un agent dans la liste de gauche.");return}const doc=makeDoc();if(!doc)return;const data=agentData(state,week,agent);drawPage(doc,data);doc.save(`Planning_${safeName(data.agent)}_${data.start.getFullYear()}-${pad(data.start.getMonth()+1)}-${pad(data.start.getDate())}.pdf`)}
function all(){const state=loadState(),week=currentWeek(),agents=Array.isArray(state.agents)?state.agents.slice():[];if(!week){alert("La semaine affichee n'a pas pu etre determinee.");return}if(!agents.length){alert("Aucun agent n'est disponible dans le Planning.");return}const queue=[];const maxCopies=Math.max(...agents.map(copiesFor),2);for(let round=1;round<=maxCopies;round++)agents.forEach(a=>{if(copiesFor(a)>=round)queue.push(a)});if(!queue.length)return;const doc=makeDoc();if(!doc)return;queue.forEach((agent,i)=>{if(i>0)doc.addPage("a4","landscape");drawPage(doc,agentData(state,week,agent))});const start=dateFromWeek(week,0);doc.save(`Plannings_tous_agents_${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}.pdf`)}
window.InovtecPlanningPDF={generate:single,generateSingle:single,generateAll:all,copiesFor};
})();
