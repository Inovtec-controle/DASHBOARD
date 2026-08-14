(()=>{
"use strict";
const SOURCE="planning-calendar.js?v=20260814-5";
function mustReplace(src,find,repl,label){
  if(!src.includes(find))throw new Error("Patch planning introuvable : "+label);
  return src.replace(find,repl);
}
function patch(src){
  src=mustReplace(src,
    'const START_HOUR=6,END_HOUR=22,HOUR_PX=56;',
    'let START_HOUR=6,END_HOUR=22;const HOUR_PX=56;',
    'bornes horaires');

  const marker='function masterName(a){return[a?.identity?.prenom,a?.identity?.nom].filter(Boolean).join(" ").trim()||a?.displayName||a?.name||"Agent sans nom"}';
  const helpers=`
function masterAgentFor(agentId){const local=agentById(agentId),masters=hubAgents();if(!local)return null;return masters.find(m=>String(m.id)===String(local.refId||local.id)||norm(masterName(m))===norm(local.name))||null}
function weeklyHoursFor(agentId){const j=masterAgentFor(agentId)?.job||{},raw=j.contractHoursWeekly??j.heuresContractuellesHebdo??j.heuresContractuelles??"";if(raw===null||raw===undefined||raw==="")return null;const n=Number(String(raw).replace(",","."));return Number.isFinite(n)&&n>0?n:null}
function contractTypeFor(agentId){return String(masterAgentFor(agentId)?.job?.typeContrat||"").trim()}
function amplitudeLimitFor(agentId){const h=weeklyHoursFor(agentId);if(h!==null&&h<16)return 12*60;return 13*60}
function fmtDuration(min){min=Math.max(0,Math.round(min));const h=Math.floor(min/60),m=min%60;return h+" h"+(m?" "+pad(m):"")}
function dailyLegalWindow(d){const agentId=state.selected,items=entriesForDate(d).filter(e=>String(e.agentId)===String(agentId));if(!items.length)return null;const starts=items.map(e=>timeToMin(e.start)).filter(Number.isFinite),ends=items.map(e=>timeToMin(e.end)).filter(Number.isFinite);if(!starts.length||!ends.length)return null;const first=Math.min(...starts),last=Math.max(...ends),limit=first+amplitudeLimitFor(agentId);return{first,last,limit}}
function allDatedRows(agentId,omitWeek,omitId,candidateWeek,candidate){const rows=[];Object.keys(state.weeks||{}).forEach(w=>entriesForWeek(w).forEach(e=>{if(String(e.agentId)!==String(agentId))return;if(w===omitWeek&&String(e.id)===String(omitId))return;const d=dateFromWeek(w,Number(e.day)||0),s=timeToMin(e.start),en=timeToMin(e.end);if(en>s)rows.push({week:w,id:e.id,date:d,key:dateInput(d),start:s,end:en})}));if(candidate){const d=dateFromWeek(candidateWeek,Number(candidate.day)||0),s=timeToMin(candidate.start),en=timeToMin(candidate.end);if(en>s)rows.push({week:candidateWeek,id:candidate.id||"candidate",date:d,key:dateInput(d),start:s,end:en})}return rows}
function legalWarningsForChange(oldWeek,id,newWeek,candidate){const agentId=candidate?.agentId;if(!agentId)return[];const rows=allDatedRows(agentId,oldWeek,id,newWeek,candidate),warnings=[],targetDate=dateFromWeek(newWeek,Number(candidate.day)||0),targetKey=dateInput(targetDate),same=rows.filter(r=>r.key===targetKey);if(!same.length)return warnings;const first=Math.min(...same.map(r=>r.start)),last=Math.max(...same.map(r=>r.end)),amp=last-first,h=weeklyHoursFor(agentId),type=contractTypeFor(agentId),name=agentById(agentId)?.name||masterName(masterAgentFor(agentId))||"cet agent",contractLabel=(type?type+" · ":"")+(h!==null?String(h).replace(".",",")+" h/semaine":"heures non renseignées");
if(h!==null&&h<35){const limit=h<16?12*60:13*60;if(amp>limit)warnings.push("Amplitude journalière de "+fmtDuration(amp)+" pour "+name+" ("+contractLabel+") : maximum conventionnel de "+fmtDuration(limit)+".")}else if(h!==null&&amp>13*60){warnings.push("Amplitude journalière de "+fmtDuration(amp)+" pour "+name+" ("+contractLabel+") : elle dépasse 13 h et n’est pas compatible avec le repos quotidien standard de 11 h sans régime dérogatoire à vérifier.")}else if(h===null&&amp>12*60){warnings.push("Amplitude de "+fmtDuration(amp)+" pour "+name+" ("+contractLabel+"). Les heures contractuelles ne sont pas renseignées dans le Classeur Agents : impossible de confirmer si la limite applicable est 12 h ou 13 h.")}
const groups=new Map();rows.forEach(r=>{let g=groups.get(r.key);if(!g){g={key:r.key,date:r.date,first:r.start,last:r.end};groups.set(r.key,g)}else{g.first=Math.min(g.first,r.start);g.last=Math.max(g.last,r.end)}});const ordered=[...groups.values()].sort((a,b)=>a.date-b.date),idx=ordered.findIndex(g=>g.key===targetKey);const abs=(g,min)=>new Date(g.date.getFullYear(),g.date.getMonth(),g.date.getDate(),0,0,0,0).getTime()+min*60000;const checkRest=(a,b)=>{if(!a||!b)return;const rest=(abs(b,b.first)-abs(a,a.last))/60000;if(rest>=11*60)return;const label="Repos de "+fmtDuration(rest)+" entre le "+new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit"}).format(a.date)+" et le "+new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit"}).format(b.date)+" pour "+name+" ("+contractLabel+"). ";if(h!==null&&h>=35){if(rest<9*60)warnings.push(label+"C’est inférieur au minimum dérogatoire de 9 h prévu pour les salariés pouvant relever de la dérogation conventionnelle.");else warnings.push(label+"Le repos standard est de 11 h. Une dérogation jusqu’à 9 h n’est possible que sous conditions pour les salariés effectuant au moins 151,67 h/mois, avec repos compensateur.")}else if(h===null){warnings.push(label+"Le repos quotidien standard est de 11 h. Renseigne les heures contractuelles dans le Classeur Agents pour déterminer si une dérogation peut éventuellement s’appliquer.")}else warnings.push(label+"Le repos quotidien requis est de 11 h pour ce salarié à temps partiel.")};checkRest(ordered[idx-1],ordered[idx]);checkRest(ordered[idx],ordered[idx+1]);return warnings}
function confirmLegalChange(oldWeek,id,newWeek,candidate){const warnings=legalWarningsForChange(oldWeek,id,newWeek,candidate);if(!warnings.length)return true;return confirm("⚠️ ALERTE TEMPS DE TRAVAIL\n\n"+warnings.map((w,i)=>(i+1)+". "+w).join("\n\n")+"\n\nLe contrôle est une aide au planning et ne remplace pas la vérification RH.\n\nEnregistrer quand même ?")}
function legalVisualRange(dates){const agentId=state.selected,h=weeklyHoursFor(agentId),type=contractTypeFor(agentId),amp=amplitudeLimitFor(agentId),windows=dates.map(dailyLegalWindow).filter(Boolean);let first,end;if(windows.length){first=Math.min(...windows.map(w=>w.first));end=Math.max(...windows.map(w=>Math.max(w.limit,w.last)))}else{const starts=[];Object.keys(state.weeks||{}).forEach(w=>entriesForWeek(w).forEach(e=>{if(String(e.agentId)===String(agentId))starts.push(timeToMin(e.start))}));first=starts.filter(Number.isFinite).sort((a,b)=>a-b)[0];if(!Number.isFinite(first))first=6*60;end=first+amp}const start=Math.max(0,Math.floor(first/60)*60);end=Math.max(start+60,Math.min(24*60,end));const tip=document.querySelector(".agent-tip");if(tip){const contract=(type?type+" · ":"")+(h===null?"heures contractuelles à renseigner":String(h).replace(".",",")+" h/semaine");const info=contract+" · amplitude de référence "+fmtDuration(amp);tip.dataset.legalInfo=info;tip.title=info}return{start,end}}
`;
  src=mustReplace(src,marker,marker+helpers,'helpers légaux');

  src=mustReplace(src,
    'function renderTimeGrid(dates){$("calendarViewport").innerHTML=',
    'function renderTimeGrid(dates){const legalRange=legalVisualRange(dates);START_HOUR=legalRange.start/60;END_HOUR=legalRange.end/60;$("calendarViewport").innerHTML=',
    'plage dynamique');

  src=mustReplace(src,
    'const layer=$("daysLayer");layer.style.gridTemplateColumns=',
    'if(Math.round(END_HOUR*60)%60){const endLabel=document.createElement("div");endLabel.className="time-label";endLabel.style.top=((END_HOUR-START_HOUR)*HOUR_PX)+"px";endLabel.textContent=minToTime(END_HOUR*60);rail.appendChild(endLabel)}rail.style.height=((END_HOUR-START_HOUR)*HOUR_PX)+"px";const layer=$("daysLayer");layer.style.height=((END_HOUR-START_HOUR)*HOUR_PX)+"px";layer.style.gridTemplateColumns=',
    'hauteur dynamique');

  src=mustReplace(src,
    'entriesForDate(d).filter(e=>visibleAgents.has(e.agentId)).forEach(e=>col.appendChild(createEventCard(isoWeekKey(d),e)));if(sameDate(d,now)){',
    'const dayEntries=entriesForDate(d).filter(e=>visibleAgents.has(e.agentId));dayEntries.forEach(e=>col.appendChild(createEventCard(isoWeekKey(d),e)));const legalWindow=dailyLegalWindow(d);if(legalWindow){const cutoff=Math.min(24*60,legalWindow.limit),top=((cutoff/60)-START_HOUR)*HOUR_PX,total=(END_HOUR-START_HOUR)*HOUR_PX;if(top>0&&top<total){const shade=document.createElement("div");shade.style.cssText="position:absolute;left:0;right:0;bottom:0;pointer-events:none;z-index:1;background:rgba(220,38,38,.045);border-top:1px dashed rgba(185,28,28,.65)";shade.style.top=top+"px";const tag=document.createElement("span");tag.textContent="limite "+minToTime(cutoff);tag.style.cssText="position:absolute;right:4px;top:2px;font-size:9px;font-weight:800;color:#b91c1c;background:rgba(255,255,255,.86);padding:1px 4px;border-radius:5px";shade.appendChild(tag);col.appendChild(shade)}}if(sameDate(d,now)){',
    'repère limite journalière');

  src=mustReplace(src,
    'const newWeek=isoWeekKey(d);e.agentId=$("edAgent").value;e.day=mondayIndex(d);e.start=start;e.end=end;',
    'const newWeek=isoWeekKey(d),nextAgent=$("edAgent").value,nextDay=mondayIndex(d),candidate={...e,agentId:nextAgent,day:nextDay,start,end};if(!confirmLegalChange(oldWeek,id,newWeek,candidate))return;e.agentId=nextAgent;e.day=nextDay;e.start=start;e.end=end;',
    'alerte éditeur');

  src=mustReplace(src,
    'if(moved&&target){const oldWeek=week,oldAgent=e.agentId,oldArr=entriesForWeek(oldWeek),idx=oldArr.findIndex(x=>x.id===e.id);if(idx>=0)oldArr.splice(idx,1);const newWeek=target.dataset.week;e.day=Number(target.dataset.day);e.start=minToTime(start);e.end=minToTime(start+duration);entriesForWeek(newWeek).push(e);if(oldWeek!==newWeek)markParityEdited(oldWeek,oldAgent);markParityEdited(newWeek,e.agentId);save();suppressClickUntil=Date.now()+250;render()}',
    'if(moved&&target){const oldWeek=week,oldAgent=e.agentId,newWeek=target.dataset.week,candidate={...e,day:Number(target.dataset.day),start:minToTime(start),end:minToTime(start+duration)};if(!confirmLegalChange(oldWeek,e.id,newWeek,candidate)){render();return}const oldArr=entriesForWeek(oldWeek),idx=oldArr.findIndex(x=>x.id===e.id);if(idx>=0)oldArr.splice(idx,1);e.day=candidate.day;e.start=candidate.start;e.end=candidate.end;entriesForWeek(newWeek).push(e);if(oldWeek!==newWeek)markParityEdited(oldWeek,oldAgent);markParityEdited(newWeek,e.agentId);save();suppressClickUntil=Date.now()+250;render()}',
    'alerte déplacement');

  src=mustReplace(src,
    'if(moved){e.end=minToTime(Math.min(END_HOUR*60,end));markParityEdited(week,e.agentId);save();suppressClickUntil=Date.now()+250;render()}',
    'if(moved){const candidate={...e,end:minToTime(Math.min(END_HOUR*60,end))};if(!confirmLegalChange(week,e.id,week,candidate)){render();return}e.end=candidate.end;markParityEdited(week,e.agentId);save();suppressClickUntil=Date.now()+250;render()}',
    'alerte redimensionnement');

  return src+'\n//# sourceURL=planning-calendar-legal-runtime.js';
}
fetch(SOURCE,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.text()}).then(original=>{
  let code;
  try{code=patch(original)}catch(e){console.error(e);code=original;setTimeout(()=>alert("Le contrôle légal du planning n’a pas pu être chargé. Le planning reste utilisable, mais vérifie les horaires manuellement."),50)}
  (0,eval)(code);
}).catch(e=>{console.error("Chargement planning",e);alert("Impossible de charger le planning. Actualise la page.")});
})();
