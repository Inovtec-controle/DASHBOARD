(()=>{
"use strict";
const collator=new Intl.Collator("fr",{sensitivity:"base",numeric:true,ignorePunctuation:true});
const ORDERED_RE=/(^|[-_])(jour|day|weekday|mois|month|annee|year|semaine|week|heure|hour|minute|statut|status|priorite|priority|categorie|category|type|contrat|mode|view|vue|tri|sort|ordre|order|copies?)([-_]|$)/i;
const PLACEHOLDER_RE=/^(choisir|sélectionner|selectionner|--|—|aucun|aucune|tous|toutes|autre|autres|nouveau|nouvelle|ajouter)/i;
const text=n=>String(n?.textContent||n?.label||n?.value||"").replace(/\s+/g," ").trim();
const cmp=(a,b)=>collator.compare(text(a),text(b));
const states=new WeakMap();
let lastActivity=0;
function mark(){lastActivity=Date.now()}
function interactive(doc){
  const a=doc?.activeElement;
  if(a&&(/^(SELECT|TEXTAREA)$/i.test(a.tagName)||a.isContentEditable))return true;
  if(a?.tagName==="INPUT"&&(a.getAttribute("list")||/^(text|search|email|tel|number|date|time)$/i.test(a.type||"text")))return true;
  if(doc?.querySelector?.('.editor-popover.open,.modal.open,.modal.show,[role="dialog"][open],dialog[open]'))return true;
  return Date.now()-lastActivity<700;
}
function shouldSortSelect(sel){
  if(!sel||sel.multiple||sel.dataset.ivNoAlpha==="1")return false;
  const key=[sel.id,sel.name,sel.getAttribute("aria-label"),sel.getAttribute("data-role")].filter(Boolean).join("-");
  if(ORDERED_RE.test(key))return false;
  const opts=[...sel.options];
  if(opts.length<3)return false;
  return opts.filter(o=>o.value&&!o.disabled&&!PLACEHOLDER_RE.test(text(o))).length>=2;
}
function sortSelect(sel){
  const doc=sel.ownerDocument;if(interactive(doc)||!shouldSortSelect(sel))return;
  const selected=sel.value,scroll=sel.scrollTop;
  if(sel.querySelector("optgroup")){
    [...sel.querySelectorAll("optgroup")].forEach(g=>{
      const arr=[...g.children].filter(n=>n.tagName==="OPTION"),sorted=[...arr].sort(cmp);
      if(arr.some((n,i)=>n!==sorted[i]))sorted.forEach(n=>g.appendChild(n));
    });
  }else{
    const opts=[...sel.options],fixed=[],sortable=[];
    opts.forEach((o,i)=>{if((i===0&&(!o.value||o.disabled||PLACEHOLDER_RE.test(text(o))))||o.disabled||!o.value||PLACEHOLDER_RE.test(text(o)))fixed.push(o);else sortable.push(o)});
    const sorted=[...sortable].sort(cmp),target=[...fixed,...sorted];
    if(opts.length===target.length&&opts.some((n,i)=>n!==target[i]))target.forEach(n=>sel.appendChild(n));
  }
  if([...sel.options].some(o=>o.value===selected))sel.value=selected;
  sel.scrollTop=scroll;
}
function sortDatalist(dl){
  const doc=dl.ownerDocument;if(interactive(doc))return;
  const active=doc?.activeElement;if(active?.getAttribute?.("list")===dl.id)return;
  const arr=[...dl.querySelectorAll(":scope > option")],sorted=[...arr].sort((a,b)=>collator.compare(String(a.value||text(a)),String(b.value||text(b))));
  if(arr.some((n,i)=>n!==sorted[i]))sorted.forEach(n=>dl.appendChild(n));
}
function sortChildren(container,selector,labelSelector){
  if(!container||interactive(container.ownerDocument))return;
  const arr=[...container.children].filter(n=>n.matches(selector));if(arr.length<2)return;
  const key=n=>text(labelSelector?n.querySelector(labelSelector):n),sorted=[...arr].sort((a,b)=>collator.compare(key(a),key(b)));
  if(arr.some((n,i)=>n!==sorted[i]))sorted.forEach(n=>container.appendChild(n));
}
function apply(doc){
  if(!doc?.body||interactive(doc))return;
  doc.querySelectorAll("select").forEach(sortSelect);
  doc.querySelectorAll("datalist").forEach(sortDatalist);
  sortChildren(doc.getElementById("agentList"),".agent-row, .agent-item, li, button",".agent-name, strong, .name");
  sortChildren(doc.getElementById("siteList"),".site-item, li, button","strong, .site-name, .name");
  sortChildren(doc.getElementById("chantierList"),".site-item, .chantier-item, li, button","strong, .name");
  sortChildren(doc.getElementById("employeeList"),"li, button, .item",".name, strong");
}
function watch(doc){
  if(!doc?.body||states.has(doc))return;
  let timer=null;
  const schedule=(delay=550)=>{clearTimeout(timer);timer=setTimeout(()=>{if(interactive(doc)){schedule(700);return}apply(doc)},delay)};
  ["pointerdown","mousedown","touchstart","keydown","input","change","focusin"].forEach(type=>doc.addEventListener(type,mark,true));
  doc.addEventListener("focusout",()=>schedule(900),true);
  const mo=new MutationObserver(()=>schedule(700));mo.observe(doc.body,{childList:true,subtree:true});
  states.set(doc,{mo});schedule(250);
  const nested=doc.getElementById("kontrolFrame");if(nested){nested.addEventListener("load",()=>{try{watch(nested.contentDocument)}catch{}});try{watch(nested.contentDocument)}catch{}}
}
function frameDoc(){try{return document.getElementById("legacyFrame")?.contentDocument||null}catch{return null}}
const frame=document.getElementById("legacyFrame");
frame?.addEventListener("load",()=>setTimeout(()=>watch(frameDoc()),120));
setTimeout(()=>watch(frameDoc()),220);
window.InovtecAlphabeticalLists={apply:()=>apply(frameDoc()),watch};
})();
