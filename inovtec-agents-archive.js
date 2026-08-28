(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="agents")return;
const frame=document.getElementById("legacyFrame");
let installedFor=null;

function install(){
  try{
    const w=frame?.contentWindow,d=frame?.contentDocument;
    if(!w||!d||!d.body||!w.state||!Array.isArray(w.state.agents)||typeof w.save!=="function"||typeof w.renderAll!=="function"||typeof w.filteredAgents!=="function"){
      setTimeout(install,180);return;
    }
    if(installedFor===d)return;
    installedFor=d;

    const css=d.createElement("style");
    css.textContent=`
      .ivAgentHeaderActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .ivArchiveBtn{border-color:rgba(245,158,11,.3)!important;background:rgba(245,158,11,.12)!important;color:#b45309!important}
      .ivArchivesBtn{border:1px solid rgba(100,116,139,.22);background:rgba(100,116,139,.10);color:#475569;padding:8px 10px;border-radius:12px;font-weight:900;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
      .ivArchivesCount{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#fff;border:1px solid rgba(100,116,139,.18);font-size:11px}
      .ivArchiveModal{position:fixed;inset:0;z-index:500;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.62);backdrop-filter:blur(3px)}
      .ivArchiveModal.open{display:flex}
      .ivArchivePanel{width:min(760px,100%);max-height:min(82vh,760px);display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:#fff;border:1px solid rgba(148,163,184,.35);box-shadow:0 24px 80px rgba(15,23,42,.28)}
      .ivArchiveTop{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(148,163,184,.28)}
      .ivArchiveTop h3{font-size:15px;font-weight:900}
      .ivArchiveBody{padding:14px;overflow:auto}
      .ivArchiveEmpty{padding:18px;border:1px dashed rgba(148,163,184,.55);border-radius:14px;color:#64748b;font-weight:700;text-align:center}
      .ivArchiveRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid rgba(148,163,184,.32);border-radius:15px;margin-bottom:9px;background:#fff}
      .ivArchiveInfo{min-width:0}.ivArchiveInfo strong{display:block;font-size:13px}.ivArchiveInfo span{display:block;margin-top:3px;font-size:11px;color:#64748b;font-weight:700}
      .ivArchiveActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      .ivRestoreBtn{border:1px solid rgba(22,163,74,.25);background:rgba(22,163,74,.10);color:#15803d;padding:8px 10px;border-radius:11px;font-weight:900;font-size:12px;cursor:pointer}
      .ivDeleteArchivedBtn{border:1px solid rgba(239,68,68,.22);background:rgba(239,68,68,.08);color:#b91c1c;padding:8px 10px;border-radius:11px;font-weight:900;font-size:12px;cursor:pointer}
      @media(max-width:640px){.ivArchiveRow{align-items:flex-start;flex-direction:column}.ivArchiveActions{width:100%}.ivArchiveActions button{flex:1}.ivAgentHeaderActions{width:100%}.ivAgentHeaderActions button{flex:1}}
    `;
    d.head.appendChild(css);

    const originalFiltered=w.filteredAgents.bind(w);
    w.filteredAgents=function(){
      return originalFiltered().filter(a=>!a?.archivedAt);
    };

    const archiveModal=d.createElement("div");
    archiveModal.className="ivArchiveModal";
    archiveModal.id="ivAgentArchiveModal";
    archiveModal.innerHTML=`<div class="ivArchivePanel" role="dialog" aria-modal="true" aria-labelledby="ivArchiveTitle">
      <div class="ivArchiveTop"><h3 id="ivArchiveTitle">Agents archivés</h3><button type="button" class="tiny" id="ivArchiveClose">Fermer</button></div>
      <div class="ivArchiveBody" id="ivArchiveBody"></div>
    </div>`;
    d.body.appendChild(archiveModal);

    const validAgent=a=>a&&a._deleted!==true&&(typeof w.agentHasName==="function"?w.agentHasName(a):!!`${String(a?.identity?.prenom||"").trim()} ${String(a?.identity?.nom||"").trim()}`.trim());
    const archiveCount=()=>w.state.agents.filter(a=>validAgent(a)&&a?.archivedAt).length;
    const activeAgents=()=>w.state.agents.filter(a=>validAgent(a)&&!a?.archivedAt);
    const label=a=>{
      const i=a?.identity||{};
      return `${String(i.prenom||"").trim()} ${String(i.nom||"").trim()}`.trim()||"Agent sans nom";
    };
    const updateArchiveButton=()=>{
      const c=d.getElementById("ivArchivesCount");
      if(c)c.textContent=String(archiveCount());
    };
    const selectFirstActive=()=>{
      const current=w.state.agents.find(a=>a?.id===w.state.selectedId&&validAgent(a)&&!a?.archivedAt);
      if(current)return;
      w.state.selectedId=activeAgents()[0]?.id||null;
    };

    function renderArchives(){
      const body=d.getElementById("ivArchiveBody");
      if(!body)return;
      const archived=w.state.agents.filter(a=>validAgent(a)&&a?.archivedAt).sort((a,b)=>{
        const ad=String(a.archivedAt||""),bd=String(b.archivedAt||"");
        return bd.localeCompare(ad);
      });
      updateArchiveButton();
      if(!archived.length){body.innerHTML='<div class="ivArchiveEmpty">Aucun agent archivé.</div>';return}
      body.innerHTML="";
      archived.forEach(agent=>{
        const row=d.createElement("div");row.className="ivArchiveRow";
        const info=d.createElement("div");info.className="ivArchiveInfo";
        const strong=d.createElement("strong");strong.textContent=label(agent);
        const meta=d.createElement("span");
        const site=String(agent?.job?.sitePrincipal||"").trim();
        const date=agent.archivedAt?new Date(agent.archivedAt).toLocaleString("fr-FR"):"";
        meta.textContent=(site?site+" • ":"")+"Archivé le "+date;
        info.append(strong,meta);
        const actions=d.createElement("div");actions.className="ivArchiveActions";
        const restore=d.createElement("button");restore.type="button";restore.className="ivRestoreBtn";restore.textContent="Restaurer";
        restore.onclick=()=>{
          if(!validAgent(agent))return;
          agent.archivedAt="";
          agent.updatedAt=new Date().toISOString();
          w.state.selectedId=agent.id;
          w.save();
          w.renderAll();
          renderArchives();
        };
        const del=d.createElement("button");del.type="button";del.className="ivDeleteArchivedBtn";del.textContent="Supprimer définitivement";
        del.onclick=()=>{
          if(!w.confirm(`Supprimer définitivement la fiche de ${label(agent)} ? La suppression sera synchronisée et ne pourra plus être restaurée.`))return;
          const tombstone=typeof w.makeAgentTombstone==="function"
            ?w.makeAgentTombstone(agent,"suppression-archives")
            :{id:agent.id,_deleted:true,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdAt:agent.createdAt||new Date().toISOString(),deletedDisplayName:label(agent),identity:{prenom:String(agent?.identity?.prenom||""),nom:String(agent?.identity?.nom||"")},job:{},docs:[],incidents:[]};
          w.state.agents=w.state.agents.map(a=>a?.id===agent.id?tombstone:a);
          selectFirstActive();
          w.save();
          try{w.dispatchEvent(new CustomEvent("inovtec:agent-deleted",{detail:{id:agent.id,name:label(agent),deletedAt:new Date().toISOString(),source:"archives"}}))}catch{}
          w.renderAll();
          renderArchives();
        };
        actions.append(restore,del);row.append(info,actions);body.appendChild(row);
      });
    }

    const countChip=d.getElementById("agentCount");
    const header=countChip?.closest(".cardHeader");
    if(header&&!d.getElementById("ivArchivesBtn")){
      const group=d.createElement("div");group.className="ivAgentHeaderActions";
      const archives=d.createElement("button");archives.type="button";archives.id="ivArchivesBtn";archives.className="ivArchivesBtn";
      archives.innerHTML='Archives <span class="ivArchivesCount" id="ivArchivesCount">0</span>';
      archives.onclick=()=>{renderArchives();archiveModal.classList.add("open")};
      countChip.insertAdjacentElement("beforebegin",group);group.append(archives,countChip);
    }

    const deleteBtn=d.getElementById("btnDeleteAgent");
    if(deleteBtn&&!d.getElementById("btnArchiveAgent")){
      const archiveBtn=d.createElement("button");archiveBtn.type="button";archiveBtn.id="btnArchiveAgent";archiveBtn.className="miniBtn ivArchiveBtn";archiveBtn.textContent="Archiver l’agent";
      archiveBtn.onclick=()=>{
        const agent=w.getSelectedAgent?.();
        if(!validAgent(agent))return;
        if(!w.confirm(`Archiver ${label(agent)} ? La fiche restera conservée et pourra être restaurée depuis « Agents archivés ».`))return;
        agent.archivedAt=new Date().toISOString();
        agent.updatedAt=agent.archivedAt;
        selectFirstActive();
        w.save();
        w.renderAll();
        updateArchiveButton();
      };
      deleteBtn.insertAdjacentElement("beforebegin",archiveBtn);
      deleteBtn.textContent="Supprimer définitivement";
      deleteBtn.title="Suppression irréversible";
    }

    d.getElementById("ivArchiveClose")?.addEventListener("click",()=>archiveModal.classList.remove("open"));
    archiveModal.addEventListener("click",e=>{if(e.target===archiveModal)archiveModal.classList.remove("open")});
    d.addEventListener("keydown",e=>{if(e.key==="Escape")archiveModal.classList.remove("open")});

    const originalRenderList=w.renderList.bind(w);
    w.renderList=function(){const r=originalRenderList();updateArchiveButton();return r};
    selectFirstActive();
    w.renderAll();
    updateArchiveButton();
  }catch(e){
    console.warn("Agents archive runtime",e);
    installedFor=null;
    setTimeout(install,250);
  }
}

frame?.addEventListener("load",()=>{installedFor=null;setTimeout(install,80)});
setTimeout(install,120);
setTimeout(install,600);
})();
