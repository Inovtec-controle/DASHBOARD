(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_LEGAL_GUARD_V2__)return;
window.__INOVTEC_PLANNING_LEGAL_GUARD_V2__=true;

const KEY="inovtec_plannings_v2";
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");
const DAY_MS=86400000;
const MIN_MS=60000;
const RULES={
  DAILY_WORK:10*60,
  DAILY_WORK_AGREEMENT_MAX:12*60,
  DAILY_REST:11*60,
  BREAK_TRIGGER:6*60,
  BREAK_MIN:20,
  WEEKLY_MAX:48*60,
  AVG_12W_MAX:44*60,
  DAYS_MAX:6
};

function norm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function state(){
  try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch{return{}}
}
function timeMin(v){
  const m=String(v||"").match(/^(\d{1,2}):(\d{2})$/);
  if(!m)return null;
  const h=Number(m[1]),min=Number(m[2]);
  return h>=0&&h<24&&min>=0&&min<60?h*60+min:null;
}
function weekDate(week,day=0){
  const m=String(week||"").match(/^(\d{4})-W(\d{2})$/);
  if(!m)return null;
  const y=Number(m[1]),w=Number(m[2]),jan4=new Date(y,0,4),idx=(jan4.getDay()+6)%7;
  const mon=new Date(y,0,4-idx);
  mon.setDate(mon.getDate()+(w-1)*7+Number(day||0));
  return mon;
}
function weekKey(d){
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const idx=(x.getDay()+6)%7;
  x.setDate(x.getDate()+3-idx);
  const y=new Date(x.getFullYear(),0,4),yidx=(y.getDay()+6)%7;
  const w=1+Math.round(((x-y)/DAY_MS-3+yidx)/7);
  return x.getFullYear()+"-W"+pad(w);
}
function dayIndex(d){return(d.getDay()+6)%7}
function dateKey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function addDays(d,n){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x}
function absMin(d,min){return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()/MIN_MS+min}
function fmt(min){
  min=Math.max(0,Math.round(min));
  const h=Math.floor(min/60),m=min%60;
  return m?`${h} h ${pad(m)}`:`${h} h`;
}
function fmtDate(d){return d?.toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"2-digit"})||""}
function isPause(e){
  return norm(e?.task||e?.type||e?.kind)==="pause";
}

function masterFor(local){
  try{
    const h=parent?.InovtecDataHub;
    if(!h?.readyAgents)return null;
    return Array.from(h.agents||[]).find(m=>
      String(m.id)===String(local?.refId||local?.id) ||
      norm(m.name||m.displayName||[m?.identity?.prenom,m?.identity?.nom].filter(Boolean).join(" "))===norm(local?.name)
    )||null;
  }catch{return null}
}
function contract(local){
  const m=masterFor(local),j=m?.job||{};
  const raw=j.contractHoursWeekly??j.heuresContractuellesHebdo??j.heuresContractuelles??"";
  const hours=raw===""||raw==null?null:Number(String(raw).replace(",","."));
  return{
    hours:Number.isFinite(hours)&&hours>0?hours:null,
    type:String(j.typeContrat||"").trim()
  };
}

function mergeIntervals(intervals){
  const sorted=(intervals||[]).filter(x=>x&&x.end>x.start)
    .map(x=>({start:x.start,end:x.end})).sort((a,b)=>a.start-b.start||a.end-b.end);
  const out=[];
  for(const cur of sorted){
    const last=out[out.length-1];
    if(!last||cur.start>last.end)out.push({...cur});
    else last.end=Math.max(last.end,cur.end);
  }
  return out;
}
function overlapMinutes(interval,workUnion){
  let total=0;
  for(const w of workUnion){
    const a=Math.max(interval.start,w.start),b=Math.min(interval.end,w.end);
    if(b>a)total+=b-a;
  }
  return total;
}
function eventRow(week,e){
  const d=weekDate(week,e.day),start=timeMin(e.start),end=timeMin(e.end);
  if(!d||start==null||end==null||end<=start)return null;
  return{
    ...e,
    week,
    date:d,
    key:dateKey(d),
    startMin:start,
    endMin:end,
    pause:isPause(e)
  };
}
function allRowsWithCandidate(s,candidate){
  const rows=[];
  Object.entries(s.weeks||{}).forEach(([w,arr])=>(arr||[]).forEach(e=>{
    if(String(e.agentId)!==String(candidate.agentId))return;
    if(w===candidate.oldWeek&&String(e.id)===String(candidate.id))return;
    const r=eventRow(w,e);
    if(r)rows.push(r);
  }));
  const ce=eventRow(candidate.week,candidate);
  if(ce)rows.push(ce);
  return rows;
}
function daySummary(rows,date){
  const key=dateKey(date);
  const dayRows=rows.filter(r=>r.key===key);
  const workRows=dayRows.filter(r=>!r.pause);
  const workUnion=mergeIntervals(workRows.map(r=>({start:r.startMin,end:r.endMin})));
  const effective=workUnion.reduce((sum,x)=>sum+x.end-x.start,0);
  const first=workUnion.length?workUnion[0].start:null;
  const last=workUnion.length?workUnion[workUnion.length-1].end:null;
  const pauses=dayRows.filter(r=>r.pause).map(r=>{
    const interval={start:r.startMin,end:r.endMin};
    const inside=first!=null&&last!=null&&interval.start>=first&&interval.end<=last;
    const overlap=overlapMinutes(interval,workUnion);
    return{
      start:interval.start,end:interval.end,
      duration:Math.max(0,interval.end-interval.start-overlap),
      rawDuration:interval.end-interval.start,
      inside,overlap
    };
  });
  const validPauses=pauses.filter(p=>p.inside&&p.overlap===0);
  return{
    date,key,dayRows,workRows,workUnion,effective,first,last,
    amplitude:first!=null&&last!=null?last-first:0,
    pauses,validPauses,
    longestPause:validPauses.reduce((m,p)=>Math.max(m,p.duration),0),
    vacations:workUnion.length
  };
}
function summaries(rows){
  const dates=[...new Set(rows.filter(r=>!r.pause).map(r=>r.key))].map(k=>{
    const [y,m,d]=k.split("-").map(Number);
    return new Date(y,m-1,d);
  }).sort((a,b)=>a-b);
  return dates.map(d=>daySummary(rows,d));
}
function weeklyTotal(rows,week){
  const mon=weekDate(week,0);
  if(!mon)return 0;
  let total=0;
  for(let i=0;i<7;i++)total+=daySummary(rows,addDays(mon,i)).effective;
  return total;
}
function workedDaysInWeek(rows,week){
  const mon=weekDate(week,0);
  if(!mon)return 0;
  let count=0;
  for(let i=0;i<7;i++)if(daySummary(rows,addDays(mon,i)).effective>0)count++;
  return count;
}
function rollingAverage12(rows,endWeek){
  const endMon=weekDate(endWeek,0);
  if(!endMon)return null;
  let total=0;
  for(let i=11;i>=0;i--)total+=weeklyTotal(rows,weekKey(addDays(endMon,-7*i)));
  return total/12;
}

function warning(level,code,title,detail,law){
  return{level,code,title,detail,law};
}
function warningsFor(candidate){
  const s=state();
  const local=(s.agents||[]).find(a=>String(a.id)===String(candidate.agentId));
  if(!local)return[];
  const c=contract(local);
  const rows=allRowsWithCandidate(s,candidate);
  const target=weekDate(candidate.week,candidate.day);
  if(!target)return[];
  const targetDay=daySummary(rows,target);
  const out=[];

  if(targetDay.effective>RULES.DAILY_WORK_AGREEMENT_MAX){
    out.push(warning(
      "danger","daily12","Durée quotidienne très élevée",
      `${fmt(targetDay.effective)} de travail effectif planifié. Cela dépasse 12 h.`,
      "Code du travail L3121-18 et L3121-19"
    ));
  }else if(targetDay.effective>RULES.DAILY_WORK){
    out.push(warning(
      "danger","daily10","Durée quotidienne > 10 h",
      `${fmt(targetDay.effective)} de travail effectif planifié. La limite générale est 10 h ; un dépassement nécessite un cadre dérogatoire applicable.`,
      "Code du travail L3121-18 et L3121-19"
    ));
  }

  if(targetDay.effective>=RULES.BREAK_TRIGGER&&targetDay.longestPause<RULES.BREAK_MIN){
    out.push(warning(
      "danger","break20","Pause obligatoire insuffisante",
      `${fmt(targetDay.effective)} de travail effectif et aucune pause « Pause » d’au moins 20 min consécutives entre le début et la fin de la journée.`,
      "Code du travail L3121-16"
    ));
  }
  if(targetDay.pauses.some(p=>p.overlap>0)){
    out.push(warning(
      "warning","pauseOverlap","Pause superposée à du travail",
      "Une plage « Pause » chevauche une intervention ou un déplacement. Elle n’est pas comptée comme pause valide dans le contrôle.",
      "Contrôle de cohérence du planning"
    ));
  }

  const ordered=summaries(rows);
  const idx=ordered.findIndex(x=>x.key===targetDay.key);
  const pairs=[[ordered[idx-1],targetDay],[targetDay,ordered[idx+1]]];
  const seenRest=new Set();
  for(const [a,b] of pairs){
    if(!a||!b||a.last==null||b.first==null)continue;
    const rest=absMin(b.date,b.first)-absMin(a.date,a.last);
    if(rest>=RULES.DAILY_REST)continue;
    const sig=a.key+"_"+b.key;
    if(seenRest.has(sig))continue;
    seenRest.add(sig);
    out.push(warning(
      "danger","rest11-"+sig,"Repos quotidien < 11 h",
      `${fmt(rest)} entre la fin du ${fmtDate(a.date)} et la reprise du ${fmtDate(b.date)}. Minimum général : 11 h consécutives.`,
      "Code du travail L3131-1"
    ));
  }

  const weekTotal=weeklyTotal(rows,candidate.week);
  if(weekTotal>RULES.WEEKLY_MAX){
    out.push(warning(
      "danger","week48","Durée hebdomadaire > 48 h",
      `${fmt(weekTotal)} de travail effectif planifié sur ${candidate.week}.`,
      "Code du travail L3121-20"
    ));
  }

  const avg12=rollingAverage12(rows,candidate.week);
  if(avg12!=null&&avg12>RULES.AVG_12W_MAX){
    out.push(warning(
      "danger","avg44","Moyenne sur 12 semaines > 44 h",
      `${fmt(avg12)} de moyenne hebdomadaire calculée sur les 12 semaines consécutives se terminant par ${candidate.week}. Des dérogations encadrées peuvent exister.`,
      "Code du travail L3121-22 à L3121-25"
    ));
  }

  const days=workedDaysInWeek(rows,candidate.week);
  if(days>RULES.DAYS_MAX){
    out.push(warning(
      "danger","days6","Plus de 6 jours travaillés",
      `${days} jours avec du travail effectif sont planifiés sur ${candidate.week}.`,
      "Code du travail L3132-1"
    ));
  }

  if(c.hours!=null&&c.hours<35&&targetDay.effective>0){
    const amplitudeLimit=c.hours<16?12*60:13*60;
    const vacationsLimit=c.hours<=24?2:3;
    if(targetDay.amplitude>amplitudeLimit){
      out.push(warning(
        "danger","ccnAmplitude","Amplitude temps partiel dépassée",
        `${fmt(targetDay.amplitude)} d’amplitude pour un contrat de ${String(c.hours).replace(".",",")} h/semaine. Référence conventionnelle : ${fmt(amplitudeLimit)} maximum, sauf volonté expresse du salarié dans les cas prévus.`,
        "CCN Entreprises de propreté et services associés, art. 6.2.4.2"
      ));
    }
    if(targetDay.vacations>vacationsLimit){
      out.push(warning(
        "danger","ccnVacations","Trop de vacations dans la journée",
        `${targetDay.vacations} vacations planifiées. Pour ${String(c.hours).replace(".",",")} h/semaine, la référence conventionnelle est ${vacationsLimit} vacation${vacationsLimit>1?"s":""} maximum, sauf volonté expresse du salarié dans les cas prévus.`,
        "CCN Entreprises de propreté et services associés, art. 6.2.4.2"
      ));
    }
  }

  return out;
}

function candidateFromEditor(){
  const pop=$("editorPopover");
  if(!pop?.classList.contains("open"))return null;
  const rawDate=$("edDate")?.value;
  if(!rawDate)return null;
  const d=new Date(rawDate+"T12:00:00");
  if(Number.isNaN(d.getTime()))return null;
  const start=$("edStart")?.value,end=$("edEnd")?.value,agentId=$("edAgent")?.value;
  if(!agentId||timeMin(start)==null||timeMin(end)==null||timeMin(end)<=timeMin(start))return null;

  const title=$("edTitle");
  const legacy=title?.value==="__legacy__";
  const task=legacy?(title?.dataset?.legacyTitle||title?.selectedOptions?.[0]?.textContent||"Intervention"):"Intervention";

  return{
    id:pop.dataset.id,
    oldWeek:pop.dataset.week,
    week:weekKey(d),
    day:dayIndex(d),
    agentId,
    start,end,
    task,
    chantierId:legacy?"":"chantier"
  };
}

function ensureStyle(){
  if(document.getElementById("ivLegalGuardStyle"))return;
  const s=document.createElement("style");
  s.id="ivLegalGuardStyle";
  s.textContent=`
    #ivLegalGuardBox{display:none;margin:8px 0 2px;padding:10px 11px;border-radius:10px;border:1px solid #f0b7b7;background:#fff7f7;color:#7f1d1d;font:600 11px/1.35 Inter,system-ui,sans-serif}
    #ivLegalGuardBox.open{display:block}
    #ivLegalGuardBox .iv-lg-head{font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:6px}
    #ivLegalGuardBox .iv-lg-item{padding:6px 0;border-top:1px solid rgba(127,29,29,.12)}
    #ivLegalGuardBox .iv-lg-item:first-of-type{border-top:0}
    #ivLegalGuardBox .iv-lg-title{font-weight:800}
    #ivLegalGuardBox .iv-lg-detail{font-weight:500;margin-top:2px}
    #ivLegalGuardBox .iv-lg-law{font-weight:500;opacity:.72;margin-top:2px;font-size:10px}
    #ivLegalGuardBox .iv-lg-foot{font-weight:500;opacity:.72;margin-top:6px;font-size:10px}
  `;
  document.head.appendChild(s);
}
function ensureBox(){
  ensureStyle();
  let box=document.getElementById("ivLegalGuardBox");
  if(box)return box;
  box=document.createElement("div");
  box.id="ivLegalGuardBox";
  box.setAttribute("role","alert");
  box.setAttribute("aria-live","polite");
  const actions=$("editorPopover")?.querySelector(".editor-actions");
  if(actions)actions.insertAdjacentElement("beforebegin",box);
  return box;
}
function renderLive(){
  const box=ensureBox();
  const c=candidateFromEditor();
  if(!c){box.classList.remove("open");box.innerHTML="";return}
  const warnings=warningsFor(c);
  if(!warnings.length){box.classList.remove("open");box.innerHTML="";return}
  box.innerHTML=
    `<div class="iv-lg-head">⚠️ Alerte planning — ${warnings.length} point${warnings.length>1?"s":""} à vérifier</div>`+
    warnings.map(w=>
      `<div class="iv-lg-item"><div class="iv-lg-title">${escapeHtml(w.title)}</div>`+
      `<div class="iv-lg-detail">${escapeHtml(w.detail)}</div>`+
      `<div class="iv-lg-law">${escapeHtml(w.law)}</div></div>`
    ).join("")+
    `<div class="iv-lg-foot">Le contrôle signale les dépassements des règles générales et conventionnelles connues. Des dérogations ou accords particuliers peuvent exister.</div>`;
  box.classList.add("open");
}
function escapeHtml(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function confirmText(warnings){
  return "⚠️ ALERTE LÉGALITÉ DU PLANNING\n\n"+
    warnings.map(w=>"• "+w.title+"\n  "+w.detail+"\n  "+w.law).join("\n\n")+
    "\n\nEnregistrer quand même ?";
}
function onDone(e){
  const btn=e.target.closest?.("#edDone");
  if(!btn)return;
  const c=candidateFromEditor();
  if(!c)return;
  const warnings=warningsFor(c);
  if(!warnings.length)return;
  const ok=confirm(confirmText(warnings));
  if(!ok){
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

const editor=$("editorPopover");
ensureBox();
["edDate","edStart","edEnd","edAgent","edTitle"].forEach(id=>{
  const el=$(id);
  if(!el)return;
  el.addEventListener("input",()=>requestAnimationFrame(renderLive));
  el.addEventListener("change",()=>requestAnimationFrame(renderLive));
});
document.addEventListener("click",onDone,true);

if(editor){
  const obs=new MutationObserver(()=>{
    if(editor.classList.contains("open"))requestAnimationFrame(renderLive);
    else{
      const box=ensureBox();
      box.classList.remove("open");
      box.innerHTML="";
    }
  });
  obs.observe(editor,{attributes:true,attributeFilter:["class","data-id","data-week"]});
}
setTimeout(renderLive,250);
})();
