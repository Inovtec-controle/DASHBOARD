/* Masquage transversal des commandes d'export CSV. Ne modifie ni les données,
   ni les sauvegardes Firebase, ni les exports PDF/JSON. */
(()=>{
  'use strict';
  if(window.__INOVTEC_HIDE_CSV_EXPORTS_V1__)return;
  window.__INOVTEC_HIDE_CSV_EXPORTS_V1__=true;
  const initialized=new WeakSet();
  const registeredFrames=new WeakSet();
  const knownIds=new Set(['exportHistory','exportMaterial','exportCsv','estimateCsv']);
  const selector='button,a,[role="button"],input[type="button"],input[type="submit"]';
  const isExport=(el)=>{
    if(knownIds.has(el.id))return true;
    const label=[el.textContent,el.value,el.getAttribute('aria-label'),el.getAttribute('title')]
      .filter(Boolean).join(' ').trim();
    if(!/\bcsv\b/i.test(label))return false;
    // « Importer CSV » n'est pas un export et doit rester utilisable.
    return !/\bimport(?:er|ation)?\b/i.test(label) || /\bexport(?:er|ation)?\b/i.test(label);
  };
  function hide(el){
    if(!isExport(el)||el.dataset.ivCsvExportHidden==='1')return;
    el.dataset.ivCsvExportHidden='1';
    el.hidden=true;
    el.style.setProperty('display','none','important');
    el.setAttribute('aria-hidden','true');
    el.tabIndex=-1;
  }
  function frameReady(frame){
    if(!registeredFrames.has(frame)){
      registeredFrames.add(frame);
      frame.addEventListener('load',()=>{
        try{attach(frame.contentDocument)}catch{/* Cadre externe : aucune action. */}
      });
    }
    try{attach(frame.contentDocument)}catch{/* Cadre externe : aucune action. */}
  }
  function scan(node){
    if(!node)return;
    if(node.nodeType===1){
      if(node.matches(selector))hide(node);
      if(node.matches('iframe'))frameReady(node);
    }
    if(!node.querySelectorAll)return;
    node.querySelectorAll(selector).forEach(hide);
    node.querySelectorAll('iframe').forEach(frameReady);
  }
  function attach(doc){
    if(!doc||initialized.has(doc))return;
    if(!doc.documentElement){doc.addEventListener('DOMContentLoaded',()=>attach(doc),{once:true});return;}
    initialized.add(doc);
    const style=doc.createElement('style');
    style.dataset.ivCsvExportStyle='1';
    style.textContent='#exportHistory,#exportMaterial,#exportCsv,#estimateCsv{display:none!important}';
    (doc.head||doc.documentElement).appendChild(style);
    scan(doc);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        // Un libellé peut être ajouté après la création de son bouton.
        if(record.target?.nodeType===1&&record.target.matches(selector))hide(record.target);
        for(const node of record.addedNodes)scan(node);
      }
    });
    observer.observe(doc.documentElement,{childList:true,subtree:true});
  }
  attach(document);
  // Matériel possède un cadre parent séparé qui ne charge pas firebase-config.js.
  try{
    if(window.parent!==window&&window.parent.document.getElementById('materialFrame')?.contentWindow===window){
      attach(window.parent.document);
    }
  }catch{/* Le parent n'est pas accessible : ne pas interrompre le module. */}
})();
