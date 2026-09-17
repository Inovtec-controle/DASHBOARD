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
// Matériel : le menu Accueil et le menu des pages sont recréés par plusieurs scripts.
// Ajouter le lien après chaque reconstruction sans toucher à la présentation existante.
function addMaterielLink(nav){
  if(!nav||nav.querySelector('a[href^="MATERIEL.html"]'))return;
  const shell=nav.id==="desktopNav"||nav.classList.contains("iv-nav");
  const a=document.createElement("a");
  a.href="MATERIEL.html";
  a.dataset.ivMenuKey="materiel";
  a.innerHTML=shell?'<span class="iv-ico">▣</span><span>Matériel</span>':'<span class="ico">▣</span><span>Matériel</span>';
  const anchor=[...nav.querySelectorAll('a')].find(el=>/AGENTS\.html/i.test(el.getAttribute('href')||''));
  if(anchor)anchor.insertAdjacentElement("afterend",a);else nav.appendChild(a);
}
function ensureMaterielNav(){
  document.querySelectorAll('.c3-nav,#desktopNav,.m1-sidebar .m1-nav,.sidebar .nav').forEach(addMaterielLink);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensureMaterielNav);else ensureMaterielNav();
const observer=new MutationObserver(ensureMaterielNav);
observer.observe(document.documentElement,{childList:true,subtree:true});
})();
