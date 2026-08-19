(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame");
const OPTIONS=["E27 4000K","E27 3000K","B22 4000K","B22 3000K"];
let lastDoc=null,observer=null,timer=null,syncing=false;
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function parse(value){const raw=String(value||"");return new Set(OPTIONS.filter(opt=>raw.split(/[,;\n]+/).some(x=>norm(x)===norm(opt))||norm(raw).includes(norm(opt))))}
function ensureStyle(d){if(d.getElementById("ivAmpoulesChecklistStyle"))return;const s=d.createElement("style");s.id="ivAmpoulesChecklistStyle";s.textContent=`
#ampoules{display:none!important}
.iv-ampoules-checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:6px}
.iv-ampoules-choice{display:flex;align-items:center;gap:9px;min-height:40px;padding:8px 10px;border:1px solid #d7e5de;border-radius:11px;background:#fff;color:#294a3e;font-size:10px;font-weight:750;cursor:pointer;transition:.15s ease}
.iv-ampoules-choice:hover{border-color:#93c9ad;background:#f8fcfa}.iv-ampoules-choice:has(input:checked){border-color:#15905d;background:#f1fbf5;box-shadow:0 0 0 2px rgba(21,144,93,.07)}
.iv-ampoules-choice input{width:17px!important;height:17px!important;margin:0!important;accent-color:#0b6b43;flex:0 0 17px}
@media(max-width:700px){.iv-ampoules-checklist{grid-template-columns:1fr}}
`;d.head.appendChild(s)}
function updateSource(d,emit=true){if(syncing)return;const src=d.getElementById("ampoules"),box=d.getElementById("ivAmpoulesChecklist");if(!src||!box)return;const values=[...box.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);const next=values.join(", ");if(src.value!==next){src.value=next;if(emit){src.dispatchEvent(new Event("input",{bubbles:true}));src.dispatchEvent(new Event("change",{bubbles:true}))}}}
function syncFromSource(d){const src=d.getElementById("ampoules"),box=d.getElementById("ivAmpoulesChecklist");if(!src||!box)return;syncing=true;const selected=parse(src.value);box.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=selected.has(cb.value));syncing=false}
function ensureUi(d){const src=d.getElementById("ampoules");if(!src)return;ensureStyle(d);const wrap=src.closest(".field");if(!wrap)return;let box=d.getElementById("ivAmpoulesChecklist");if(!box){const label=wrap.querySelector('label[for="ampoules"]');if(label)label.textContent="Type d’ampoules";box=d.createElement("div");box.id="ivAmpoulesChecklist";box.className="iv-ampoules-checklist";OPTIONS.forEach(opt=>{const lab=d.createElement("label");lab.className="iv-ampoules-choice";const cb=d.createElement("input");cb.type="checkbox";cb.value=opt;cb.setAttribute("aria-label",opt);const span=d.createElement("span");span.textContent=opt;lab.append(cb,span);box.appendChild(lab);cb.addEventListener("change",()=>updateSource(d,true))});src.insertAdjacentElement("afterend",box)}syncFromSource(d)}
function bind(d){if(d.documentElement.dataset.ivAmpoulesBound==="1")return;d.documentElement.dataset.ivAmpoulesBound="1";d.addEventListener("click",e=>{if(e.target?.closest?.(".site-item,#newBtn")){setTimeout(()=>syncFromSource(d),120);setTimeout(()=>syncFromSource(d),500)}},true);const src=d.getElementById("ampoules");src?.addEventListener("input",()=>{if(!syncing)setTimeout(()=>syncFromSource(d),0)})}
function install(){const d=doc();if(!d?.body)return;if(d!==lastDoc){lastDoc=d;try{observer?.disconnect()}catch{}observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{ensureUi(d);bind(d)},60)});observer.observe(d.body,{childList:true,subtree:true})}ensureUi(d);bind(d)}
frame?.addEventListener("load",()=>{setTimeout(install,120);setTimeout(install,600);setTimeout(install,1300)});setTimeout(install,450);try{window.InovtecDataHub?.subscribe?.(()=>{const d=doc();if(d)setTimeout(()=>syncFromSource(d),100)})}catch{}
})();
