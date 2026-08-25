(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="conges")return;
const frame=document.getElementById("legacyFrame");
let hubUnsub=null,installedDoc=null,pending=null,mutating=false;
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const displayName=a=>a?.name||a?.displayName||[a?.identity?.prenom,a?.identity?.nom].filter(Boolean).join(" ").trim()||"Agent";
const initials=name=>String(name||"?").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"?";
function schedule(){clearTimeout(pending);pending=setTimeout(fillCompleteList,40)}
function allAgents(){try{return Array.from(window.InovtecDataHub?.agents||[])}catch{return[]}}
function addCompleteListStyle(d){if(d.getElementById("ivCongesFullListStyle"))return;const st=d.createElement("style");st.id="ivCongesFullListStyle";st.textContent=`
.list-card{overflow:visible!important}
.leave-list{max-height:none!important;height:auto!important;overflow:visible!important}
.leave-row{overflow:visible!important}
.leave-person strong,.leave-meta b,.coverage b{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;word-break:break-word}
.timeline-wrap{max-height:none!important}
.iv-full-agent-row .timeline-agent{background:#fff}
`;(d.head||d.documentElement).appendChild(st)}
function fillCompleteList(){
  let d;try{d=frame?.contentDocument}catch{return}if(!d?.body||mutating)return;
  addCompleteListStyle(d);
  const root=d.querySelector(".timeline"),head=root?.querySelector(".timeline-head");if(!root||!head)return;
  const agents=allAgents();if(!agents.length)return;
  const dayCount=head.querySelectorAll(".day-h").length;if(!dayCount)return;
  const existing=new Set([...root.querySelectorAll(".timeline-row .timeline-agent .agent-copy strong")].map(x=>norm(x.textContent)));
  const missing=agents.filter(a=>!existing.has(norm(displayName(a))));if(!missing.length)return;
  mutating=true;
  try{
    missing.forEach(a=>{
      const name=displayName(a),row=d.createElement("div");row.className="timeline-row iv-full-agent-row";
      const ac=d.createElement("div");ac.className="timeline-agent";
      const avatar=d.createElement("div");avatar.className="agent-avatar";avatar.textContent=initials(name);
      const copy=d.createElement("div");copy.className="agent-copy";
      const strong=d.createElement("strong");strong.textContent=name;
      const small=d.createElement("small");small.textContent="Disponible";
      copy.append(strong,small);ac.append(avatar,copy);row.appendChild(ac);
      for(let i=0;i<dayCount;i++){const cell=d.createElement("div");cell.className="day-cell";row.appendChild(cell)}
      root.appendChild(row);
    });
  }finally{mutating=false}
}
function install(){
  let d;try{d=frame?.contentDocument}catch{return}if(!d?.body)return;
  if(installedDoc===d){schedule();return}installedDoc=d;
  addCompleteListStyle(d);schedule();
  const wrap=d.getElementById("timelineWrap");
  if(wrap&&window.MutationObserver){const obs=new MutationObserver(()=>{if(!mutating)schedule()});obs.observe(wrap,{childList:true,subtree:true})}
  try{hubUnsub?.()}catch{}hubUnsub=null;
  try{if(window.InovtecDataHub?.subscribe)hubUnsub=window.InovtecDataHub.subscribe(()=>schedule())}catch{}
  d.addEventListener("click",()=>setTimeout(schedule,80),true);
  d.addEventListener("change",()=>setTimeout(schedule,80),true);
}
frame?.addEventListener("load",()=>{installedDoc=null;setTimeout(install,80);setTimeout(install,400)});
setTimeout(install,120);setTimeout(install,600);setTimeout(install,1500);
})();
