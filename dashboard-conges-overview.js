(()=>{
"use strict";
if(window.__INOVTEC_DASHBOARD_CONGES_OVERVIEW_V1__)return;
window.__INOVTEC_DASHBOARD_CONGES_OVERVIEW_V1__=true;

const $=id=>document.getElementById(id);
const list=$("c3LeavesRows");
if(!list)return;

const filters=[...document.querySelectorAll("[data-leave-filter]")];
const counts={all:$("c3LeavesAllCount"),pending:$("c3LeavesPendingCount"),approved:$("c3LeavesApprovedCount")};
const stateLabel=$("c3LeavesSync");
let leaves=null,filter="all",cloudUnsub=null,generation=0;

function setStatus(message,kind="info"){
  stateLabel.textContent=message;
  stateLabel.dataset.state=kind;
}
function setCounts(all,pending,approved){
  counts.all.textContent=all;
  counts.pending.textContent=pending;
  counts.approved.textContent=approved;
}
function emptyMessage(message){
  const div=document.createElement("div");
  div.className="c3-leaves-empty";
  div.textContent=message;
  list.replaceChildren(div);
}
function dateValid(value){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
}
function formatDate(value){
  if(!dateValid(value))return "Date non renseignée";
  const [year,month,day]=value.split("-").map(Number);
  const d=new Date(year,month-1,day);
  if(d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day)return String(value);
  return new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"short",year:"numeric"}).format(d);
}
function validLeaves(raw){
  const byId=new Map();
  (Array.isArray(raw)?raw:[]).forEach((l,index)=>{
    if(!l||typeof l!=="object")return;
    const id=String(l.id||"row-"+index);
    const previous=byId.get(id);
    if(!previous||String(l.updatedAt||"")>=String(previous.updatedAt||""))byId.set(id,l);
  });
  return [...byId.values()].filter(l=>l.deleted!==true&&(l.status==="pending"||l.status==="approved"));
}
function sortedLeaves(rows){
  const today=new Date(),now=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
  return [...rows].sort((a,b)=>{
    if(a.status!==b.status)return a.status==="pending"?-1:1;
    if(a.status==="pending")return String(a.startDate||"9999").localeCompare(String(b.startDate||"9999"))||
      String(a.agentName||"").localeCompare(String(b.agentName||""),"fr");
    const oldA=String(a.endDate||"")<now,oldB=String(b.endDate||"")<now;
    if(oldA!==oldB)return oldA?1:-1;
    const da=String(a.startDate||"9999"),db=String(b.startDate||"9999");
    return oldA?db.localeCompare(da):da.localeCompare(db);
  });
}
function makeRow(l){
  const row=document.createElement("div");
  row.className="c3-leaves-row";
  row.dataset.leaveStatus=l.status;
  const identity=document.createElement("div");
  identity.className="c3-leaves-agent";
  const person=document.createElement("strong");
  person.textContent=String(l.agentName||"Agent non renseigné");
  const type=document.createElement("small");
  type.textContent=String(l.type||"Congé / absence");
  identity.append(person,type);
  const period=document.createElement("div");
  period.className="c3-leaves-dates";
  const dates=document.createElement("strong");
  dates.textContent=formatDate(l.startDate)+" → "+formatDate(l.endDate);
  const details=document.createElement("small");
  const parts={morning:"matin",afternoon:"après-midi",full:"journée entière"};
  const startPart=parts[l.startPart],endPart=parts[l.endPart];
  details.textContent=startPart&&endPart&&startPart===endPart?startPart:
    startPart&&endPart?("Du "+startPart+" au "+endPart):"Période de congé";
  period.append(dates,details);
  const badge=document.createElement("span");
  badge.className="c3-leaves-status "+l.status;
  badge.textContent=l.status==="pending"?"À valider":"Validée";
  row.append(identity,period,badge);
  return row;
}
function render(){
  filters.forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.leaveFilter===filter)));
  if(leaves===null)return;
  const pending=leaves.filter(l=>l.status==="pending").length;
  const approved=leaves.length-pending;
  setCounts(leaves.length,pending,approved);
  const visible=sortedLeaves(leaves.filter(l=>filter==="all"||l.status===filter));
  if(!visible.length){
    emptyMessage(filter==="pending"?"Aucune demande en attente de validation.":
      filter==="approved"?"Aucun congé validé enregistré.":"Aucune demande de congé à valider ou validée.");
    return;
  }
  const fragment=document.createDocumentFragment();
  visible.forEach(row=>fragment.appendChild(makeRow(row)));
  list.replaceChildren(fragment);
}
function reset(message){
  leaves=null;
  setCounts("—","—","—");
  emptyMessage(message);
}
function disconnect(){
  generation++;
  if(cloudUnsub){try{cloudUnsub()}catch(e){console.warn("Arrêt du suivi des congés",e)}cloudUnsub=null}
}
function bindUser(user){
  disconnect();
  if(!user?.uid){
    reset("Connectez-vous pour afficher les demandes de congés.");
    setStatus("Connexion requise","error");
    return;
  }
  const current= generation;
  reset("Chargement des demandes depuis Firebase…");
  setStatus("Lecture Firebase en cours…");
  try{
    const ref=firebase.firestore().collection("kanban").doc(user.uid);
    cloudUnsub=ref.onSnapshot({includeMetadataChanges:true},snapshot=>{
      if(current!==generation)return;
      if(snapshot.metadata?.fromCache||snapshot.metadata?.hasPendingWrites){
        setStatus("Confirmation Firebase en cours…");
        return; // Ne pas présenter de données locales comme définitivement validées.
      }
      let raw=[];
      const entry=snapshot.exists?snapshot.data()?.moduleSyncV1?.conges:null;
      if(entry){
        try{raw=JSON.parse(entry.payload||"[]")}
        catch(e){
          setStatus("Données congés illisibles dans Firebase","error");
          reset("Impossible d'afficher les demandes enregistrées.");
          return;
        }
        if(!Array.isArray(raw)){
          setStatus("Format des congés Firebase incorrect","error");
          reset("Impossible d'afficher les demandes enregistrées.");
          return;
        }
      }
      leaves=validLeaves(raw);
      setStatus("Synchronisé avec Firebase · toutes les périodes");
      render();
    },error=>{
      if(current!==generation)return;
      console.warn("Lecture des demandes de congés",error);
      setStatus("Lecture Firebase indisponible","error");
      if(leaves===null)emptyMessage("Impossible de récupérer les congés. Vérifiez la connexion Firebase.");
    });
  }catch(error){
    console.warn("Initialisation de l'aperçu congés",error);
    setStatus("Lecture Firebase indisponible","error");
    emptyMessage("Impossible de récupérer les congés. Vérifiez la connexion Firebase.");
  }
}

filters.forEach(button=>button.addEventListener("click",()=>{
  filter=button.dataset.leaveFilter;
  render();
}));

if(window.firebase?.auth&&window.firebase?.firestore){
  try{
    if(!firebase.apps?.length&&window.INOVTEC_FIREBASE_CONFIG)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    firebase.auth().onAuthStateChanged(bindUser);
  }catch(error){
    console.warn("Connexion du suivi global des congés",error);
    reset("Connexion Firebase indisponible.");
    setStatus("Connexion Firebase indisponible","error");
  }
}else{
  reset("Connexion Firebase indisponible.");
  setStatus("Connexion Firebase indisponible","error");
}
})();
