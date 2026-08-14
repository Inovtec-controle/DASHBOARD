(()=>{
"use strict";
const DAYS=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const MONTHS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const START_HOUR=6,END_HOUR=22,HOUR_MM=12;
const $=id=>document.getElementById(id);
function addDays(d,n){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x}
function mondayIndex(d){return(d.getDay()+6)%7}
function dateFromWeek(key,day=0){const m=String(key||"").match(/^(\d{4})-W(\d{2})$/);if(!m)return null;const year=+m[1],week=+m[2],jan4=new Date(year,0,4),mon=addDays(jan4,-mondayIndex(jan4));return addDays(mon,(week-1)*7+day)}
function rangeLabel(a,b){
  if(!a||!b)return"Semaine affichée";
  if(a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth())return`${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  if(a.getFullYear()===b.getFullYear())return`${a.getDate()} ${MONTHS[a.getMonth()]}–${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  return`${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}–${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}
function safeName(v){return String(v||"planning").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"planning"}
function timeToMin(t){const m=String(t||"").match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):START_HOUR*60}
function readPlanning(){
  const week=$("week")?.value||"";
  const start=dateFromWeek(week,0),end=dateFromWeek(week,6);
  const title=($("title")?.textContent||"Planning").replace(/^Planning\s*[—-]?\s*/i,"").trim();
  const groups=DAYS.map(()=>[]);
  [...($("rows")?.querySelectorAll("tr")||[])].forEach(tr=>{
    const c=[...tr.cells].map(td=>(td.textContent||"").trim());
    const idx=DAYS.findIndex(d=>d.toLowerCase()===String(c[0]||"").toLowerCase());
    if(idx<0)return;
    const tm=String(c[1]||"").match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
    groups[idx].push({start:tm?.[1]||"06:00",end:tm?.[2]||"07:00",time:c[1]||"",task:c[2]||"Intervention",site:c[3]||"",note:c[4]||""});
  });
  return{week,start,end,agent:title||"Aucun agent",groups};
}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node}
function buildDocument(data){
  const root=el("div","pdf-planning");
  root.innerHTML=`<style>
    .pdf-planning{width:194mm;background:#fff;color:#173b30;font-family:Inter,Arial,sans-serif;font-size:9px;line-height:1.2}
    .pdf-head{background:#064e3b;color:#fff;border-radius:4mm;padding:6mm 7mm 5.5mm;display:flex;align-items:flex-end;justify-content:space-between;gap:6mm;margin-bottom:4mm}
    .pdf-kicker{font-size:7px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.8;margin-bottom:2mm}.pdf-agent{font-size:19px;font-weight:800;line-height:1.05}.pdf-range{font-size:12px;font-weight:700;margin-top:1.6mm;opacity:.96}.pdf-brand{font-size:9px;font-weight:800;letter-spacing:.1em;text-align:right;white-space:pre-line;opacity:.9}
    .pdf-calendar{border:1px solid rgba(0,0,0,.30);background:#fff;overflow:hidden}
    .pdf-cal-head{display:grid;grid-template-columns:14mm repeat(7,minmax(0,1fr));height:13mm;background:#f2f7f4;border-bottom:1px solid rgba(0,0,0,.30)}
    .pdf-head-time{border-right:1px solid rgba(0,0,0,.30)}.pdf-day-head{display:flex;flex-direction:column;justify-content:center;align-items:center;border-right:1px solid rgba(0,0,0,.30);text-align:center}.pdf-day-head:last-child{border-right:0}.pdf-day-head strong{font-size:8px;color:#075d43}.pdf-day-head span{font-size:6.5px;color:#6d8177;margin-top:.8mm}
    .pdf-cal-body{display:grid;grid-template-columns:14mm minmax(0,1fr);height:${(END_HOUR-START_HOUR)*HOUR_MM}mm}
    .pdf-time-rail{position:relative;border-right:1px solid rgba(0,0,0,.30);background:#fbfcfb}.pdf-time{position:absolute;right:1.4mm;transform:translateY(-45%);font-size:6.3px;color:#5e6863;font-weight:700}
    .pdf-days-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));height:100%}.pdf-day-col{position:relative;border-right:1px solid rgba(0,0,0,.30);background-image:repeating-linear-gradient(to bottom,rgba(0,0,0,.30) 0,rgba(0,0,0,.30) .22mm,transparent .22mm,transparent ${HOUR_MM/2}mm,rgba(0,0,0,.14) ${HOUR_MM/2}mm,rgba(0,0,0,.14) ${HOUR_MM/2+.18}mm,transparent ${HOUR_MM/2+.18}mm,transparent ${HOUR_MM}mm)}.pdf-day-col:last-child{border-right:0}.pdf-day-col.weekend{background-color:#fbfcfb}
    .pdf-event{position:absolute;left:1mm;right:1mm;border:.25mm solid #4c9c72;border-left:1mm solid #087654;border-radius:1.4mm;background:#e8f5ee;color:#173b30;padding:1mm 1.1mm;overflow:hidden;z-index:3}.pdf-event-time{font-size:6.2px;font-weight:900;color:#075d43;white-space:nowrap}.pdf-event-title{font-size:6.4px;font-weight:800;margin-top:.5mm;line-height:1.1;overflow:hidden}.pdf-event-site{font-size:5.6px;color:#52665d;margin-top:.4mm;line-height:1.08;overflow:hidden}.pdf-event-note{font-size:5.2px;color:#7c5f22;margin-top:.35mm;font-style:italic;line-height:1.05;overflow:hidden}
    .pdf-foot{display:flex;justify-content:space-between;gap:8mm;margin-top:3mm;color:#7b8f85;font-size:7px}.pdf-foot strong{color:#315f4e}
  </style>`;
  const head=el("div","pdf-head"),left=el("div");
  left.append(el("div","pdf-kicker","Planning hebdomadaire"),el("div","pdf-agent",data.agent),el("div","pdf-range",rangeLabel(data.start,data.end)));
  head.append(left,el("div","pdf-brand","INOVTEC\nDASHBOARD"));root.appendChild(head);

  const calendar=el("div","pdf-calendar"),calHead=el("div","pdf-cal-head");
  calHead.appendChild(el("div","pdf-head-time"));
  DAYS.forEach((name,i)=>{const d=addDays(data.start,i),h=el("div","pdf-day-head");h.append(el("strong",null,name),el("span",null,`${d.getDate()} ${MONTHS[d.getMonth()].slice(0,4)}.`));calHead.appendChild(h)});
  calendar.appendChild(calHead);

  const body=el("div","pdf-cal-body"),rail=el("div","pdf-time-rail"),grid=el("div","pdf-days-grid");
  for(let h=START_HOUR;h<=END_HOUR;h++){const lab=el("div","pdf-time",`${String(h).padStart(2,"0")}:00`);lab.style.top=((h-START_HOUR)*HOUR_MM)+"mm";rail.appendChild(lab)}
  DAYS.forEach((name,i)=>{
    const col=el("div","pdf-day-col"+(i>=5?" weekend":""));
    (data.groups[i]||[]).forEach(item=>{
      const start=Math.max(START_HOUR*60,timeToMin(item.start)),end=Math.min(END_HOUR*60,Math.max(start+15,timeToMin(item.end)));
      if(end<=START_HOUR*60||start>=END_HOUR*60)return;
      const top=((start-START_HOUR*60)/60)*HOUR_MM,height=Math.max(5.5,((end-start)/60)*HOUR_MM);
      const ev=el("div","pdf-event");ev.style.top=top+"mm";ev.style.height=height+"mm";
      ev.append(el("div","pdf-event-time",item.time||`${item.start} – ${item.end}`),el("div","pdf-event-title",item.task||"Intervention"));
      if(item.site)ev.appendChild(el("div","pdf-event-site",item.site));
      if(item.note&&height>=13)ev.appendChild(el("div","pdf-event-note",item.note));
      col.appendChild(ev);
    });
    grid.appendChild(col);
  });
  body.append(rail,grid);calendar.appendChild(body);root.appendChild(calendar);
  const total=data.groups.reduce((n,g)=>n+g.length,0),foot=el("div","pdf-foot");
  foot.innerHTML=`<span><strong>${total}</strong> intervention(s) planifiée(s)</span><span>${total?"Planning de la semaine affichée":"Planning vide — aucune intervention planifiée"}</span>`;
  root.appendChild(foot);
  return root;
}
async function generate(){
  if(typeof window.html2pdf!=="function"){alert("Le générateur PDF n’est pas encore chargé. Réessaie dans quelques secondes.");return}
  const data=readPlanning();
  if(!data.start){alert("La semaine affichée n’a pas pu être déterminée.");return}
  if(!data.agent||/aucun agent/i.test(data.agent)){alert("Sélectionne d’abord un agent dans la liste de gauche.");return}
  const root=buildDocument(data);root.style.position="fixed";root.style.left="-10000px";root.style.top="0";root.style.zIndex="-1";document.body.appendChild(root);
  const filename=`Planning_${safeName(data.agent)}_${data.start.getFullYear()}-${String(data.start.getMonth()+1).padStart(2,"0")}-${String(data.start.getDate()).padStart(2,"0")}.pdf`;
  try{
    await window.html2pdf().set({margin:[8,8,8,8],filename,image:{type:"jpeg",quality:.99},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",scrollX:0,scrollY:0},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"]}}).from(root).save();
  }catch(err){console.error(err);alert("Impossible de générer le PDF pour le moment.");}
  finally{root.remove()}
}
window.InovtecPlanningPDF={generate,readPlanning};
})();