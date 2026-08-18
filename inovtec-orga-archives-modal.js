(()=>{
"use strict";
const frame=document.getElementById("legacyFrame");
if(!frame)return;
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="organisation")return;

function install(){
  try{
    const d=frame.contentDocument;
    if(!d?.head||!d.body)return;

    const archiveCard=d.getElementById("archiveCard");
    const archiveList=d.getElementById("archiveList");
    const archiveCount=d.getElementById("archiveCount");
    const board=d.getElementById("board");
    const boardCard=board?.closest("section.card");
    const boardTitle=boardCard?.querySelector(".section-title");
    if(!archiveCard||!archiveList||!archiveCount||!boardTitle)return;

    let style=d.getElementById("ivOrgaArchiveModalStyle");
    if(!style){
      style=d.createElement("style");
      style.id="ivOrgaArchiveModalStyle";
      style.textContent=`
#archiveCard{display:none!important}
#ivArchiveButton{white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
#ivArchiveButton .iv-archive-badge{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:10px;font-weight:800}
#ivArchiveModal{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.48);backdrop-filter:blur(3px)}
#ivArchiveModal.iv-open{display:flex}
#ivArchiveModal .iv-archive-dialog{width:min(760px,100%);max-height:calc(100% - 12px);display:flex;flex-direction:column;background:#fff;border:1px solid #dbe5df;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.28);overflow:hidden}
#ivArchiveModal .iv-archive-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #e2e8f0;background:#f8fafc}
#ivArchiveModal .iv-archive-head h2{margin:0;font-size:17px}
#ivArchiveModal .iv-archive-head p{margin:3px 0 0;color:#64748b;font-size:11px}
#ivArchiveModal .iv-archive-close{width:38px;height:38px;border:1px solid #dbe5df;border-radius:10px;background:#fff;color:#334155;font-size:20px;line-height:1;cursor:pointer}
#ivArchiveModal .iv-archive-body{min-height:120px;overflow:auto;padding:4px 14px 14px}
#ivArchiveModal #archiveList{overflow:visible!important;max-height:none!important}
#ivArchiveModal .archive-item{padding:12px 4px}
#ivArchiveEmpty{padding:28px 8px;text-align:center;color:#64748b;font-size:12px}
body.iv-archive-modal-open{overflow:hidden!important}
@media(max-width:619px){
  #ivArchiveModal{padding:8px}
  #ivArchiveModal .iv-archive-dialog{max-height:calc(100% - 4px);border-radius:14px}
  #ivArchiveModal .iv-archive-head{padding:13px}
  #ivArchiveModal .iv-archive-body{padding:2px 10px 10px}
  #ivArchiveModal .archive-item{flex-direction:column;align-items:flex-start}
}
`;
      d.head.appendChild(style);
    }

    let button=d.getElementById("ivArchiveButton");
    if(!button){
      button=d.createElement("button");
      button.id="ivArchiveButton";
      button.type="button";
      button.className="btn btn-secondary";
      button.innerHTML='Archives <span class="iv-archive-badge">0</span>';
      boardTitle.appendChild(button);
    }

    let modal=d.getElementById("ivArchiveModal");
    if(!modal){
      modal=d.createElement("div");
      modal.id="ivArchiveModal";
      modal.setAttribute("role","dialog");
      modal.setAttribute("aria-modal","true");
      modal.setAttribute("aria-labelledby","ivArchiveModalTitle");
      modal.innerHTML=`
        <div class="iv-archive-dialog">
          <div class="iv-archive-head">
            <div><h2 id="ivArchiveModalTitle">Actions archivées</h2><p id="ivArchiveModalSubtitle">Consulter, restaurer ou supprimer une action archivée.</p></div>
            <button class="iv-archive-close" type="button" aria-label="Fermer">×</button>
          </div>
          <div class="iv-archive-body"><div id="ivArchiveListHost"></div><div id="ivArchiveEmpty">Aucune action archivée.</div></div>
        </div>`;
      d.body.appendChild(modal);
    }

    const host=d.getElementById("ivArchiveListHost");
    const empty=d.getElementById("ivArchiveEmpty");
    const badge=button.querySelector(".iv-archive-badge");
    const subtitle=d.getElementById("ivArchiveModalSubtitle");
    if(host&&archiveList.parentElement!==host)host.appendChild(archiveList);

    function update(){
      const count=archiveList.children.length;
      if(badge)badge.textContent=String(count);
      if(empty)empty.style.display=count?"none":"block";
      if(subtitle)subtitle.textContent=count?`${count} action${count>1?"s":""} archivée${count>1?"s":""}`:"Aucune action archivée";
    }
    function open(){
      update();
      modal.classList.add("iv-open");
      d.body.classList.add("iv-archive-modal-open");
      modal.querySelector(".iv-archive-close")?.focus();
    }
    function close(){
      modal.classList.remove("iv-open");
      d.body.classList.remove("iv-archive-modal-open");
      button.focus();
    }

    if(!button.dataset.ivArchiveBound){
      button.dataset.ivArchiveBound="1";
      button.addEventListener("click",open);
    }
    if(!modal.dataset.ivArchiveBound){
      modal.dataset.ivArchiveBound="1";
      modal.querySelector(".iv-archive-close")?.addEventListener("click",close);
      modal.addEventListener("click",e=>{if(e.target===modal)close();});
      d.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("iv-open"))close();});
    }
    if(!archiveList.dataset.ivArchiveObserved){
      archiveList.dataset.ivArchiveObserved="1";
      new MutationObserver(update).observe(archiveList,{childList:true});
      new MutationObserver(update).observe(archiveCount,{childList:true,characterData:true,subtree:true});
    }
    update();
  }catch(e){console.warn("Organisation archives modal",e);}
}

frame.addEventListener("load",()=>{setTimeout(install,80);setTimeout(install,350);setTimeout(install,900);});
setTimeout(install,700);
})();
