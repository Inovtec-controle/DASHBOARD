(()=>{
"use strict";
if(window.__INOVTEC_GLOBAL_SEARCH_V1__)return;
window.__INOVTEC_GLOBAL_SEARCH_V1__=true;

const input=document.getElementById("globalSearch");
const panel=document.getElementById("globalSearchResults");
if(!input||!panel)return;

const parse=(s,f=null)=>{try{const v=JSON.parse(String(s||""));return v??f}catch{return f}};
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const localJson=(key,f)=>{try{return parse(localStorage.getItem(key)||"",f)}catch{return f}};
let rows=[],activeIndex=-1,ready=false,loading=false;

function agentName(a){
  return a?.name||a?.displayName||[a?.identity?.prenom,a?.identity?.nom].filter(Boolean).join(" ")||"Agent";
}
function agentsFrom(data){
  const p=parse(data?.moduleSyncV1?.agents?.payload||"",null);
  if(Array.isArray(p))return p;
  return Array.isArray(data?.referentialAgents)?data.referentialAgents:[];
}
function unique(items,keyFn){
  const out=[],seen=new Set();
  for(const item of items){
    const key=norm(keyFn(item));
    if(!key||seen.has(key))continue;
    seen.add(key);out.push(item);
  }
  return out;
}
function buildRows(sites,agents,tasks){
  const out=[];
  unique(sites,s=>String(s.id||s.nom||"")).forEach(s=>out.push({
    type:"chantier",
    label:String(s.nom||"Chantier"),
    sub:[s.adresse,s.agentNom].filter(Boolean).join(" • ")||"Infos chantier",
    search:norm([s.nom,s.adresse,s.syndic,s.agentNom].filter(Boolean).join(" ")),
    href:"INFOCHANTIERS-V2.html",
    handoff:{mode:"infos",id:String(s.id||""),label:String(s.nom||"")}
  }));
  unique(agents,a=>String(a.id||agentName(a))).forEach(a=>out.push({
    type:"agent",
    label:agentName(a),
    sub:[a?.job?.poste,a?.job?.sitePrincipal,a?.identity?.telephone].filter(Boolean).join(" • ")||"Classeur agents",
    search:norm([agentName(a),a?.identity?.telephone,a?.identity?.email,a?.job?.poste,a?.job?.sitePrincipal].filter(Boolean).join(" ")),
    href:"AGENTS.html",
    handoff:{mode:"agents",id:String(a.id||""),label:agentName(a)}
  }));
  unique(tasks,t=>String(t.id||t.title||"")).filter(t=>!t?.archived).forEach(t=>out.push({
    type:"tache",
    label:String(t.title||"Tâche"),
    sub:[t.status==="done"?"Terminée":t.status==="inprogress"?"En cours":t.status==="blocked"?"Bloquée":"À faire",t.dueDate].filter(Boolean).join(" • "),
    search:norm([t.title,t.description,t.status,t.dueDate].filter(Boolean).join(" ")),
    href:"ORGA.html",
    handoff:{mode:"organisation",id:String(t.id||""),label:String(t.title||"")}
  }));
  rows=out;
}
function sourceData(result){
  return result&&result.status==="fulfilled"&&result.value?.exists?(result.value.data()||{}):{};
}
function moduleTasks(shared,personal){
  const all=[
    ...(Array.isArray(shared?.tasks)?shared.tasks:[]),
    ...(Array.isArray(personal?.tasks)?personal.tasks:[]),
    ...(Array.isArray(localJson("orga_task_board_v2",[]))?localJson("orga_task_board_v2",[]):[])
  ];
  return unique(all,t=>String(t.id||t.title||""));
}
async function load(user){
  if(loading)return;loading=true;
  try{
    const db=firebase.firestore();
    const sharedId="__inovtec_shared_workspace_v1__";
    const result=await Promise.allSettled([
      db.collection("chantiers").orderBy("nom").get(),
      db.collection("chantiers").doc(sharedId).get(),
      db.collection("kanban").doc(user.uid).get()
    ]);
    const sites=result[0].status==="fulfilled"
      ?result[0].value.docs.map(d=>({id:d.id,...(d.data()||{})})).filter(s=>s._hidden!==true)
      :[];
    const shared=sourceData(result[1]),personal=sourceData(result[2]);
    const localAgents=localJson("kontrol_agents_classeur_v2",[]);
    const agents=unique([
      ...agentsFrom(shared),
      ...agentsFrom(personal),
      ...(Array.isArray(localAgents)?localAgents:[])
    ],a=>String(a.id||agentName(a)));
    buildRows(sites,agents,moduleTasks(shared,personal));
    ready=true;
    if(input.value.trim())render();
  }catch(e){
    console.warn("Recherche globale Inovtec",e);
    ready=false;
  }finally{
    loading=false;
  }
}
function score(row,q){
  const label=norm(row.label),sub=norm(row.sub),hay=row.search+" "+sub;
  if(label===q)return 100;
  if(label.startsWith(q))return 80;
  if(label.includes(q))return 65;
  const tokens=q.split(" ").filter(Boolean);
  const matched=tokens.filter(t=>hay.includes(t)).length;
  return matched===tokens.length?40+matched:matched*8;
}
function matches(){
  const q=norm(input.value);
  if(!q)return[];
  return rows.map(r=>({r,s:score(r,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.r.label.localeCompare(b.r.label,"fr")).slice(0,12).map(x=>x.r);
}
function typeLabel(type){return type==="agent"?"Agent":type==="chantier"?"Chantier":"Tâche"}
function close(){panel.hidden=true;panel.innerHTML="";activeIndex=-1}
function openResult(row){
  try{
    sessionStorage.setItem("inovtec_global_search_handoff_v1",JSON.stringify({...row.handoff,createdAt:Date.now()}));
  }catch{}
  location.href=row.href;
}
function render(){
  const q=input.value.trim();
  if(!q){close();return}
  panel.hidden=false;panel.innerHTML="";activeIndex=-1;
  if(!ready){
    const d=document.createElement("div");d.className="m1-search-state";
    d.textContent=loading?"Chargement des données…":"Recherche disponible après connexion Firebase.";
    panel.appendChild(d);return;
  }
  const list=matches();
  if(!list.length){
    const d=document.createElement("div");d.className="m1-search-state";d.textContent="Aucun agent, chantier ou tâche trouvé.";panel.appendChild(d);return;
  }
  list.forEach((row,index)=>{
    const b=document.createElement("button");b.type="button";b.className="m1-search-result";b.dataset.index=String(index);
    const badge=document.createElement("span");badge.className="m1-search-kind "+row.type;badge.textContent=typeLabel(row.type);
    const copy=document.createElement("span");copy.className="m1-search-copy";
    const strong=document.createElement("strong");strong.textContent=row.label;
    const small=document.createElement("small");small.textContent=row.sub||"Ouvrir";
    copy.append(strong,small);
    const arrow=document.createElement("span");arrow.className="m1-search-arrow";arrow.textContent="›";
    b.append(badge,copy,arrow);
    b.addEventListener("click",()=>openResult(row));
    panel.appendChild(b);
  });
}
function buttons(){return[...panel.querySelectorAll(".m1-search-result")]}
function setActive(index){
  const bs=buttons();if(!bs.length)return;
  activeIndex=(index+bs.length)%bs.length;
  bs.forEach((b,i)=>b.classList.toggle("active",i===activeIndex));
  bs[activeIndex].scrollIntoView({block:"nearest"});
}
input.addEventListener("input",render);
input.addEventListener("focus",()=>{if(input.value.trim())render()});
input.addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"){e.preventDefault();setActive(activeIndex+1)}
  else if(e.key==="ArrowUp"){e.preventDefault();setActive(activeIndex-1)}
  else if(e.key==="Enter"){
    const bs=buttons();
    if(bs.length){e.preventDefault();(bs[activeIndex>=0?activeIndex:0]).click()}
  }else if(e.key==="Escape"){close();input.blur()}
});
document.addEventListener("mousedown",e=>{if(!e.target.closest(".m1-search"))close()});
window.addEventListener("focus",()=>{try{const u=firebase.auth().currentUser;if(u)load(u)}catch{}});
if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    firebase.auth().onAuthStateChanged(u=>{
      if(u){input.disabled=false;input.title="Recherche globale";load(u)}
      else{input.disabled=true;input.title="Connectez-vous pour utiliser la recherche";ready=false;close()}
    });
  }catch(e){console.warn("Initialisation recherche globale",e)}
}
})();