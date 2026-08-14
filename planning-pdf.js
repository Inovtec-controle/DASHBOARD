(()=>{
"use strict";
const DAYS=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const MONTHS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
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
function readPlanning(){
  const week=$("week")?.value||"";
  const start=dateFromWeek(week,0),end=dateFromWeek(week,6);
  const title=($("title")?.textContent||"Planning").replace(/^Planning\s*[—-]?\s*/i,"").trim();
  const groups=DAYS.map(()=>[]);
  [...($("rows")?.querySelectorAll("tr")||[])].forEach(tr=>{
    const c=[...tr.cells].map(td=>(td.textContent||"").trim());
    const idx=DAYS.findIndex(d=>d.toLowerCase()===String(c[0]||"").toLowerCase());
    if(idx>=0)groups[idx].push({time:c[1]||"",task:c[2]||"Intervention",site:c[3]||"",note:c[4]||""});
  });
  return{week,start,end,agent:title||"Aucun agent",groups};
}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node}
function buildDocument(data){
  const root=el("div","pdf-planning");
  root.innerHTML=`<style>
    .pdf-planning{width:194mm;background:#fff;color:#173b30;font-family:Inter,Arial,sans-serif;font-size:10px;line-height:1.25}
    .pdf-head{background:#064e3b;color:#fff;border-radius:5mm;padding:8mm 9mm 7mm;display:flex;align-items:flex-end;justify-content:space-between;gap:8mm;margin-bottom:5mm}
    .pdf-kicker{font-size:8px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.8;margin-bottom:2.5mm}.pdf-agent{font-size:22px;font-weight:800;line-height:1.05}.pdf-range{font-size:13px;font-weight:700;margin-top:2mm;opacity:.94}.pdf-brand{font-size:10px;font-weight:800;letter-spacing:.1em;text-align:right;white-space:nowrap;opacity:.9}
    .pdf-days{border:1px solid #dce9e3;border-radius:4mm;overflow:hidden;background:#fff}.pdf-day{display:grid;grid-template-columns:29mm 1fr;min-height:28mm;border-bottom:1px solid #dce9e3;break-inside:avoid;page-break-inside:avoid}.pdf-day:last-child{border-bottom:0}.pdf-day-label{padding:4mm;background:#f1f8f4;border-right:1px solid #dce9e3}.pdf-day-name{font-size:12px;font-weight:800;color:#075d43}.pdf-day-date{font-size:9px;color:#6d8177;margin-top:1.5mm}.pdf-events{padding:2.5mm 3mm;display:flex;flex-direction:column;justify-content:center;gap:1.5mm}.pdf-empty{color:#94a3b8;font-style:italic;padding:2mm 0}.pdf-event{display:grid;grid-template-columns:26mm minmax(0,1fr);gap:3mm;padding:1.8mm 0;border-bottom:1px solid #edf3f0}.pdf-event:last-child{border-bottom:0}.pdf-time{font-weight:800;color:#0b6b4b}.pdf-task{font-weight:800;color:#173b30}.pdf-site{font-size:9px;color:#64748b;margin-top:.6mm}.pdf-note{font-size:8.5px;color:#7c5f22;margin-top:.6mm;font-style:italic}.pdf-foot{display:flex;justify-content:space-between;gap:8mm;margin-top:4mm;color:#7b8f85;font-size:7.5px}.pdf-foot strong{color:#315f4e}
  </style>`;
  const head=el("div","pdf-head");
  const left=el("div");left.append(el("div","pdf-kicker","Planning hebdomadaire"),el("div","pdf-agent",data.agent),el("div","pdf-range",rangeLabel(data.start,data.end)));
  head.append(left,el("div","pdf-brand","INOVTEC\nDASHBOARD"));root.appendChild(head);
  const days=el("div","pdf-days");
  DAYS.forEach((name,i)=>{
    const day=el("section","pdf-day"),label=el("div","pdf-day-label"),events=el("div","pdf-events");
    const date=addDays(data.start,i);
    label.append(el("div","pdf-day-name",name),el("div","pdf-day-date",`${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`));
    const list=data.groups[i]||[];
    if(!list.length)events.appendChild(el("div","pdf-empty","Aucune intervention"));
    list.forEach(item=>{
      const row=el("div","pdf-event"),time=el("div","pdf-time",item.time),desc=el("div");
      desc.appendChild(el("div","pdf-task",item.task||"Intervention"));
      if(item.site)desc.appendChild(el("div","pdf-site",item.site));
      if(item.note)desc.appendChild(el("div","pdf-note",item.note));
      row.append(time,desc);events.appendChild(row);
    });
    day.append(label,events);days.appendChild(day);
  });
  root.appendChild(days);
  const foot=el("div","pdf-foot");foot.innerHTML=`<span><strong>${data.groups.reduce((n,g)=>n+g.length,0)}</strong> intervention(s) planifiée(s)</span><span>Document généré depuis Inovtec Dashboard</span>`;root.appendChild(foot);
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
    await window.html2pdf().set({margin:[8,8,8,8],filename,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",scrollX:0,scrollY:0},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"]}}).from(root).save();
  }catch(err){console.error(err);alert("Impossible de générer le PDF pour le moment.");}
  finally{root.remove()}
}
window.InovtecPlanningPDF={generate,readPlanning};
})();