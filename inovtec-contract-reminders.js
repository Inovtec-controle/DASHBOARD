(()=>{
"use strict";
const fb=window.firebase;
if(!fb||!window.INOVTEC_FIREBASE_CONFIG)return;
try{if(!fb.apps.length)fb.initializeApp(window.INOVTEC_FIREBASE_CONFIG)}catch{}
const db=fb.firestore?.(),auth=fb.auth?.();if(!db||!auth)return;
let unsubscribe=null;
const fmt=value=>{
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||""));
  return m?`${m[3]}/${m[2]}/${m[1]}`:String(value||"");
};
function ensureStyle(){
  if(document.getElementById("ivContractReminderStyle"))return;
  const s=document.createElement("style");s.id="ivContractReminderStyle";s.textContent=`
    .iv-contract-reminders{margin:14px 0 6px;border:1px solid #fecaca;border-radius:16px;background:#fffafa;overflow:hidden;box-shadow:0 5px 18px rgba(127,29,29,.04)}
    .iv-contract-reminders[hidden]{display:none!important}.iv-contract-reminder-toggle{width:100%;border:0;background:transparent;padding:13px 15px;display:flex;align-items:center;gap:11px;cursor:pointer;text-align:left;color:#4c1d1d}
    .iv-contract-reminder-icon{width:34px;height:34px;border-radius:11px;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:16px;flex:0 0 34px}.iv-contract-reminder-copy{min-width:0;flex:1}.iv-contract-reminder-copy strong{display:block;font-size:12px}.iv-contract-reminder-copy span{display:block;color:#8b5b5b;font-size:9px;margin-top:2px}.iv-contract-reminder-count{display:inline-grid;place-items:center;min-width:24px;height:24px;padding:0 7px;border-radius:999px;background:#dc2626;color:#fff;font-size:10px;font-weight:850}.iv-contract-reminder-chevron{font-size:17px;color:#991b1b;transition:transform .18s}.iv-contract-reminders.open .iv-contract-reminder-chevron{transform:rotate(180deg)}
    .iv-contract-reminder-list{border-top:1px solid #fee2e2;padding:5px 12px 10px;background:#fff}.iv-contract-reminder-list[hidden]{display:none!important}.iv-contract-reminder-row{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid #f8e2e2}.iv-contract-reminder-row:last-child{border-bottom:0}.iv-contract-reminder-main{min-width:0;flex:1}.iv-contract-reminder-main strong{display:block;color:#3f2a2a;font-size:11px}.iv-contract-reminder-main span{display:block;color:#8b7373;font-size:9px;margin-top:2px}.iv-contract-reminder-date{white-space:nowrap;border-radius:999px;background:#fff1f2;color:#c81e1e;border:1px solid #fecdd3;padding:5px 8px;font-size:9px;font-weight:800}.iv-contract-reminder-footer{display:flex;justify-content:flex-end;padding:5px 4px 0}.iv-contract-reminder-footer a{color:#087247;font-size:10px;font-weight:800;text-decoration:none}
    @media(max-width:620px){.iv-contract-reminder-toggle{padding:11px}.iv-contract-reminder-row{align-items:flex-start;flex-direction:column;gap:6px}.iv-contract-reminder-date{align-self:flex-start}}
    @media print{.iv-contract-reminders{display:none!important}}
  `;document.head.appendChild(s);
}
function ensureBox(){
  ensureStyle();let box=document.getElementById("ivContractReminders");if(box)return box;
  const kpis=document.querySelector(".kpis");if(!kpis)return null;
  box=document.createElement("section");box.id="ivContractReminders";box.className="iv-contract-reminders";box.hidden=true;
  box.innerHTML=`<button id="ivContractReminderToggle" class="iv-contract-reminder-toggle" type="button" aria-expanded="false" aria-controls="ivContractReminderList"><span class="iv-contract-reminder-icon">⚑</span><span class="iv-contract-reminder-copy"><strong>Rappels fins de contrat</strong><span>Cliquez pour afficher les chantiers concernés</span></span><span id="ivContractReminderCount" class="iv-contract-reminder-count">0</span><span class="iv-contract-reminder-chevron">⌄</span></button><div id="ivContractReminderList" class="iv-contract-reminder-list" hidden></div>`;
  kpis.insertAdjacentElement("afterend",box);
  box.querySelector("#ivContractReminderToggle").addEventListener("click",()=>{
    const list=box.querySelector("#ivContractReminderList"),open=list.hidden;
    list.hidden=!open;box.classList.toggle("open",open);
    box.querySelector("#ivContractReminderToggle").setAttribute("aria-expanded",open?"true":"false");
  });
  return box;
}
function statusLabel(date){
  const today=new Date();today.setHours(0,0,0,0);
  const d=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Date(`${date}T00:00:00`):null;
  return d&&d<today?"Terminé le":"Fin prévue le";
}
function render(sites){
  const box=ensureBox();if(!box)return;
  const rows=(sites||[]).filter(x=>x&&x._type!=="disciplinePhotoChunk"&&x._hidden!==true&&String(x.dateFinContrat||"").trim()).sort((a,b)=>String(a.dateFinContrat||"9999").localeCompare(String(b.dateFinContrat||"9999"))||String(a.nom||"").localeCompare(String(b.nom||""),"fr",{sensitivity:"base"}));
  if(!rows.length){box.hidden=true;box.classList.remove("open");const list=box.querySelector("#ivContractReminderList");list.hidden=true;box.querySelector("#ivContractReminderToggle").setAttribute("aria-expanded","false");return;}
  box.hidden=false;box.querySelector("#ivContractReminderCount").textContent=String(rows.length);
  const list=box.querySelector("#ivContractReminderList");
  const wasOpen=!list.hidden;
  list.innerHTML="";
  rows.forEach(site=>{
    const row=document.createElement("div");row.className="iv-contract-reminder-row";
    const main=document.createElement("div");main.className="iv-contract-reminder-main";
    const name=document.createElement("strong");name.textContent=site.nom||"Chantier sans nom";
    const sub=document.createElement("span");sub.textContent=[site.typeChantier,site.adresse].filter(Boolean).join(" • ")||"Chantier concerné";
    main.append(name,sub);
    const date=document.createElement("span");date.className="iv-contract-reminder-date";date.textContent=`${statusLabel(String(site.dateFinContrat))} ${fmt(site.dateFinContrat)}`;
    row.append(main,date);list.appendChild(row);
  });
  const footer=document.createElement("div");footer.className="iv-contract-reminder-footer";footer.innerHTML='<a href="INFOCHANTIERS-V2.html">Ouvrir Infos chantier →</a>';list.appendChild(footer);
  list.hidden=!wasOpen;
}
auth.onAuthStateChanged(user=>{
  if(unsubscribe){try{unsubscribe()}catch{}unsubscribe=null;}
  const box=ensureBox();
  if(!user){if(box)box.hidden=true;return;}
  unsubscribe=db.collection("chantiers").onSnapshot(snap=>render(snap.docs.map(d=>({id:d.id,...(d.data()||{})}))),err=>{console.warn("Rappels fins de contrat",err);if(box)box.hidden=true;});
});
})();
