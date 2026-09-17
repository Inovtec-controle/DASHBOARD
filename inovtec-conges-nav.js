(()=>{
"use strict";
if(!document.querySelector('script[data-iv-nav-order="1"]')){
  const s=document.createElement("script");
  s.src="inovtec-navigation-order.js?v=20260829-planningstable3";
  s.dataset.ivNavOrder="1";
  s.async=false;
  document.head.appendChild(s);
}
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode==="conges"&&!document.querySelector('script[data-iv-conges-full-list="1"]')){
  const s=document.createElement("script");
  s.src="inovtec-conges-full-list.js?v=20260825-1";
  s.dataset.ivCongesFullList="1";
  s.async=false;
  document.head.appendChild(s);
}
// Les menus sont parfois reconstruits : rétablir les liens sans modifier les autres entrées.
function ensureInventoryLinks(nav){
  if(!nav)return;
  const shell=nav.id==="desktopNav"||nav.classList.contains("iv-nav");
  const ico=shell?'iv-ico':'ico';
  let materiel=nav.querySelector('a[href^="MATERIEL.html"]');
  if(!materiel){
    materiel=document.createElement('a');
    materiel.href='MATERIEL.html';
    materiel.dataset.ivMenuKey='materiel';
    materiel.innerHTML=`<span class="${ico}">▣</span><span>Matériel</span>`;
    const anchor=[...nav.querySelectorAll('a')].find(el=>/AGENTS\.html/i.test(el.getAttribute('href')||''));
    if(anchor)anchor.insertAdjacentElement('afterend',materiel);else nav.appendChild(materiel);
  }
  if(!nav.querySelector('a[href^="REASSORT.html"]')){
    const reassort=document.createElement('a');
    reassort.href='REASSORT.html';
    reassort.dataset.ivMenuKey='reassort';
    reassort.innerHTML=`<span class="${ico}">↻</span><span>Réassort</span>`;
    materiel.insertAdjacentElement('afterend',reassort);
  }
}
function ensureNav(){document.querySelectorAll('.c3-nav,#desktopNav,.iv-nav,.m1-sidebar .m1-nav,.sidebar .nav').forEach(ensureInventoryLinks)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureNav);else ensureNav();
const observer=new MutationObserver(ensureNav);
observer.observe(document.documentElement,{childList:true,subtree:true});
})();
