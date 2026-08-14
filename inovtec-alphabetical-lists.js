(()=>{
"use strict";
const collator=new Intl.Collator("fr",{sensitivity:"base",numeric:true,ignorePunctuation:true});
const ORDERED_RE=/(^|[-_])(jour|day|weekday|mois|month|annee|year|semaine|week|heure|hour|minute|statut|status|priorite|priority|categorie|category|type|contrat|mode|view|vue|tri|sort|ordre|order|copies?)([-_]|$)/i;
const PLACEHOLDER_RE=/^(choisir|sélectionner|selectionner|--|—|aucun|aucune|tous|toutes|autre|autres|nouveau|nouvelle|ajouter)/i;
const text=n=>String(n?.textContent||n?.label||n?.value||"").replace(/\s+/g," ").trim();
const cmp=(a,b)=>collator.compare(text(a),text(b));
function busy(doc,el){const a=doc?.activeElement;return !!(a&&(a===el||el?.contains?.(a)))}
function shouldSortSelect(sel){
  if(!sel||sel.multiple||sel.dataset.ivNoAlpha==="1")return false;
  const key=[sel.id,sel.name,sel.getAttribute("aria-label"),sel.getAttribute("data-role")].filter(Boolean).join("-");
  if(ORDERED_RE.test(key))return false;
  const opts=[...sel.options];
  if(opts.length<3)return false;
  const meaningful=opts.filter(o=>o.value&&!o.disabled&&!PLACEHOLDER_RE.test(text(o)));
  return meaningful.length>=2;
}
function sortSelect(sel){
  const doc=sel.ownerDocument;if(busy(doc,sel)||!shouldSortSelect(sel))return;
  const selected=sel.value,scroll=sel.scrollTop;
  if(sel.querySelector("optgroup")){
    [...sel.querySelectorAll("optgroup")].forEach(g=>{
      const arr=[...g.children].filter(n=>n.tagName==="OPTION");
      const sorted=[...arr].sort(cmp);
      if(arr.some((n,i)=>n!==sorted[i]))sorted.forEach(n=>g.appendChild(n));
    });
  }else{
    const opts=[...sel.options],fixed=[],sortable=[];
    opts.forEach((o,i)=>{if(i===0&&(!o.value||o.disabled||PLACEHOLDER_RE.test(text(o))))fixed.push(o);else if(o.disabled||!o.value||PLACEHOLDER_RE.test(text(o)))fixed.push(o);else sortable.push(o)});
    const sorted=[...sortable].sort(cmp);
    const target=[...fixed,...sorted];
    if(opts.length===target.length&&opts.some((n,i)=>n!==target[i]))target.forEach(n=>sel.appendChild(n));
  }
  if([...sel.options].some(o=>o.value===selected))sel.value=selected;
  sel.scrollTop=scroll;
}
function sortDatalist(dl){
  const doc=dl.ownerDocument,active=doc?.activeElement;if(active?.getAttribute?.("list")===dl.id)return;
  const arr=[...dl.querySelectorAll(":scope > option")],sorted=[...arr].sort((a,b)=>collator.compare(String(a.value||text(a)),String(b.value||text(b))));
  if(arr.some((n,i)=>n!==sorted[i]))sorted.forEach(n=>dl.appendChild(n));
}
function sortChildren(container,selector,labelSelector){
  if(!container||busy(container.ownerDocument,container))return;
  const arr=[...container.querySelectorAll(`:scope > ${selector}`)];if(arr.length<2)return;
  const key=n=>text(labelSelector?n.querySelector(labelSelector):n);
  const sorted=[...arr].sort((a,b)=>collator.compare(key(a),key(b)));
  if(arr.some((n,i)=>n!==sorted[i]))sorted.forEach(n=>container.appendChild(n));
}
function sortKnownLists(doc){
  sortChildren(doc.getElementById("agentList"),".agent-row, .agent-item, li, button",".agent-name, strong, .name");
  sortChildren(doc.getElementById("siteList"),".site-item, li, button","strong, .site-name, .name");
  sortChildren(doc.getElementById("chantierList"),".site-item, .chantier-item, li, button","strong, .name");
  sortChildren(doc.getElementById("employeeList"),"li, button, .item",".name, strong");
}
function apply(doc){
  if(!doc?.body)return;
  doc.querySelectorAll("select").forEach(sortSelect);
  doc.querySelectorAll("datalist").forEach(sortDatalist);
  sortKnownLists(doc);
}
const states=new WeakMap();
function watch(doc){
  if(!doc?.body||states.has(doc))return;
  let timer=null;
  const run=()=>{clearTimeout(timer);timer=setTimeout(()=>apply(doc),90)};
  const mo=new MutationObserver(run);mo.observe(doc.body,{childList:true,subtree:true});
  doc.addEventListener("change",e=>{if(e.target?.matches?.("select,input"))setTimeout(()=>apply(doc),0)},true);
  doc.addEventListener("focusout",()=>setTimeout(()=>apply(doc),50),true);
  states.set(doc,{mo});apply(doc);
  const nested=doc.getElementById("kontrolFrame");if(nested){nested.addEventListener("load",()=>{try{watch(nested.contentDocument)}catch{}});try{watch(nested.contentDocument)}catch{}}
}
function frameDoc(){try{return document.getElementById("legacyFrame")?.contentDocument||null}catch{return null}}
const frame=document.getElementById("legacyFrame");
frame?.addEventListener("load",()=>setTimeout(()=>watch(frameDoc()),80));
setTimeout(()=>watch(frameDoc()),180);
window.InovtecAlphabeticalLists={apply:()=>apply(frameDoc()),watch};
})();
