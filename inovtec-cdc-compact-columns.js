(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame");
let lastDoc=null,observer=null,timer=null;
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function ensureStyle(d){
  if(!d?.head||d.getElementById("ivCdcCompactColumnsStyle"))return;
  const style=d.createElement("style");
  style.id="ivCdcCompactColumnsStyle";
  style.textContent=`
    #ivCdcCard .iv-cdc-column-hidden{display:none!important}
    #ivCdcCard .iv-cdc-table{min-width:560px!important}
    #ivCdcCard .iv-cdc-table th:nth-child(1){width:20%}
    #ivCdcCard .iv-cdc-table th:nth-child(2){width:32%}
    #ivCdcCard .iv-cdc-table th[data-iv-cdc-days-head="1"]{width:20%;white-space:nowrap}
    #ivCdcCard .iv-cdc-table th[data-iv-cdc-observations-head="1"]{width:24%}
    #ivCdcCard .iv-cdc-observations-cell{min-width:150px}
    #ivCdcCard .iv-cdc-observations-edit{display:block;width:100%;min-height:40px;box-sizing:border-box;border:1px solid #d7e5de;border-radius:8px;background:#fbfdfc;padding:8px;color:#263f36;font:inherit;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;cursor:pointer}
    #ivCdcCard .iv-cdc-observations-edit:empty::before{content:"Ajouter une observation";color:#64766d}
    #ivCdcCard .iv-cdc-observations-edit:hover{background:#f0f7f3}
    #ivCdcCard .iv-cdc-observations-edit:focus-visible{outline:2px solid #0b6b43;outline-offset:2px}
    #ivCdcCard .iv-cdc-days-cell{min-width:145px;white-space:nowrap!important}
    #ivCdcCard .iv-cdc-row-actions{justify-content:flex-end;white-space:nowrap}
    @media(max-width:700px){#ivCdcCard .iv-cdc-table{min-width:520px!important}}
  `;
  d.head.appendChild(style);
}
function shouldHide(label){
  const n=norm(label);
  return n==="frequence"||n.includes("methode consigne")||n==="controle";
}
function compact(d){
  ensureStyle(d);
  const table=d?.querySelector?.("#ivCdcCard .iv-cdc-table");if(!table)return;
  const heads=[...table.querySelectorAll("thead th")];
  const hidden=[];
  heads.forEach((th,index)=>{
    const hide=shouldHide(th.textContent||"");
    th.classList.toggle("iv-cdc-column-hidden",hide);
    if(hide)hidden.push(index);
  });
  [...table.querySelectorAll("tbody tr")].forEach(tr=>{
    [...tr.children].forEach((td,index)=>td.classList.toggle("iv-cdc-column-hidden",hidden.includes(index)));
  });
  table.dataset.ivCompactColumns="1";
}
function install(){
  const d=doc();if(!d?.body)return;
  if(d!==lastDoc){
    lastDoc=d;
    try{observer?.disconnect()}catch{}
    observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>compact(d),40)});
    observer.observe(d.body,{childList:true,subtree:true});
  }
  compact(d);
}
frame?.addEventListener("load",()=>{setTimeout(install,180);setTimeout(install,700);setTimeout(install,1300)});
setTimeout(install,450);
})();
