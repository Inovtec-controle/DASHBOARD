/* Référentiel Infos chantier en lecture seule, sans changer le stockage des formulaires existants. */
(()=>{
'use strict';
if(window.__IV_SITE_DROPDOWN__)return;
window.__IV_SITE_DROPDOWN__=true;
const pickers=new Map();
let sites=[];
const labelOf=e=>String((e.labels?.[0]||e.closest('label')||(e.previousElementSibling?.matches?.('label')?e.previousElementSibling:null)||e.parentElement?.querySelector(':scope > label'))?.textContent||'').replace(/\s+/g,' ').trim();
function eligible(e){
 return !e.dataset.ivSiteDropdown&&!e.closest('#siteForm')&&e.type!=='hidden'&&e.type!=='search'&&!e.disabled&&!e.readOnly&&/^(Chantier(?:\s*\/\s*(?:site|destination))?|Site(?:\s*\/|$)|Lieu\s*\/\s*Site)/i.test(labelOf(e));
}
function restore(e,s){
 s?.remove();
 if(e.isConnected){e.style.display=e.dataset.ivSiteOldDisplay||'';e.required=e.dataset.ivSiteRequired==='1';e.tabIndex=Number(e.dataset.ivSiteTabIndex??'0');delete e.dataset.ivSiteDropdown;delete e.dataset.ivSiteOldDisplay;delete e.dataset.ivSiteRequired;delete e.dataset.ivSiteTabIndex;}
 pickers.delete(e);
}
function refresh(e,s){
 if(!e.isConnected||!s.isConnected){restore(e,s);return}
 const value=e.value;
 const options=[['','Sélectionner un chantier'],...(e.id==='orderSite'?[['Dépôt','Dépôt / hors chantier']]:[]),...sites.map(c=>[c.nom,c.nom])];
 if(value&&!options.some(x=>x[0]===value))options.push([value,value+' (valeur déjà enregistrée)']);
 s.replaceChildren(...options.map(([v,t])=>new Option(t,v)));
 s.value=value;
 s.disabled=e.disabled;
 s.required=e.dataset.ivSiteRequired==='1';
}
function mount(e){
 if(!eligible(e)||!sites.length)return;
 const s=document.createElement('select');s.className=e.className;s.style.width='100%';s.style.maxWidth='100%';s.setAttribute('aria-label',labelOf(e));s.dataset.ivChantierDropdown='1';
 e.dataset.ivSiteDropdown='1';e.dataset.ivSiteOldDisplay=e.style.display;e.dataset.ivSiteRequired=e.required?'1':'0';e.dataset.ivSiteTabIndex=String(e.tabIndex);
 e.required=false;e.style.display='none';e.tabIndex=-1;e.insertAdjacentElement('afterend',s);
 pickers.set(e,s);
 s.addEventListener('change',()=>{e.value=s.value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))});
 e.form?.addEventListener('reset',()=>setTimeout(()=>{if(pickers.get(e)===s)refresh(e,s)},0));
 refresh(e,s);
}
function scan(){
 if(!sites.length)return;
 document.querySelectorAll('input').forEach(e=>{if(!pickers.has(e))mount(e)});
 for(const [e,s] of pickers){if(!e.isConnected||!s.isConnected){restore(e,s);continue}if(e.disabled!==s.disabled)s.disabled=e.disabled;if(e.value!==s.value&&document.activeElement!==s)refresh(e,s)}
}
function setSites(rows){
 if(!Array.isArray(rows)||!rows.length){sites=[];for(const [e,s] of pickers)restore(e,s);return}
 const seen=new Set();
 sites=rows.filter(c=>c&&c.id&&c.nom&&!c._hidden&&!c._deleted&&!c.archived&&!String(c.id).startsWith('__')).map(c=>({nom:String(c.nom).trim()})).filter(c=>c.nom).sort((a,b)=>a.nom.localeCompare(b.nom,'fr',{sensitivity:'base',numeric:true})).filter(c=>{const k=c.nom.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(seen.has(k))return false;seen.add(k);return true});
 if(!sites.length){for(const [e,s] of pickers)restore(e,s);return}
 scan();for(const [e,s] of pickers)refresh(e,s);
}
function start(){
 let hub=window.InovtecDataHub;
 if(!hub&&window.parent!==window){try{hub=window.parent.InovtecDataHub}catch{}}
 if(hub?.subscribe){hub.subscribe(x=>{if(x.readyChantiers)setSites(x.chantiers)});}
 else if(window.firebase?.auth&&window.firebase?.firestore&&window.INOVTEC_FIREBASE_CONFIG){
  try{
   if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
   let unsub=null;
   firebase.auth().onAuthStateChanged(u=>{
    unsub?.();unsub=null;
    if(!u){setSites([]);return}
    unsub=firebase.firestore().collection('chantiers').onSnapshot(s=>{if(firebase.auth().currentUser?.uid===u.uid)setSites(s.docs.map(d=>({id:d.id,...d.data()})))},e=>{console.warn('Liste des chantiers indisponible',e);setSites([])});
   });
  }catch(e){console.warn('Liste des chantiers indisponible',e)}
 }
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
 setInterval(scan,1200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
