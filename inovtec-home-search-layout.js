/* Disposition de l'accueil uniquement : conserve les identifiants et les données en place. */
(()=>{
  'use strict';
  if(window.__INOVTEC_HOME_SEARCH_LAYOUT_V1__)return;
  window.__INOVTEC_HOME_SEARCH_LAYOUT_V1__=true;
  function init(){
    const home=document.querySelector('.c3-app .c3-content');
    const banner=home?.querySelector('.c3-hero-banner');
    const topbar=document.querySelector('.c3-app .c3-topbar');
    const search=topbar?.querySelector('.m1-search');
    if(!home||!banner||!topbar||!search)return;
    // Déplacer le champ EXISTANT et ses résultats, sans recréer de champ ni perdre les écouteurs.
    let row=home.querySelector('.c3-home-search-row');
    if(!row){
      row=document.createElement('section');
      row.className='c3-home-search-row';
      row.setAttribute('aria-label','Recherche globale');
    }
    row.appendChild(search);
    banner.insertAdjacentElement('afterend',row);
    // Garder les nœuds techniques de la barre dans le DOM (horloge, état de session)
    // pour les scripts existants ; supprimer uniquement leur affichage redondant.
    topbar.style.setProperty('display','none','important');
    topbar.setAttribute('aria-hidden','true');
    const style=document.createElement('style');
    style.id='ivHomeSearchLayoutStyle';
    style.textContent=`
      .c3-app .c3-home-search-row{display:flex;align-items:center;min-width:0;margin:0 0 16px;padding:0 2px;position:relative;z-index:26}
      .c3-app .c3-home-search-row .m1-search{flex:1 1 auto;width:100%;max-width:760px;margin:0;min-width:0}
      .c3-app .c3-home-search-row .m1-search input{width:100%}
      @media(max-width:860px){.c3-app .c3-home-search-row{padding:0;margin-bottom:14px}.c3-app .c3-home-search-row .m1-search{order:initial;flex-basis:auto;max-width:100%}}
      @media print{.c3-app .c3-home-search-row{display:none!important}}
    `;
    if(!document.getElementById(style.id))document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
