/* Protection temporaire des plannings existants : copie locale avant l'initialisation, sans toucher à la clé métier. */
(()=>{
  'use strict';
  const key='inovtec_plannings_v2';
  const backup='iv_planning_preservation_20260917_before_autosync';
  try{
    const raw=localStorage.getItem(key);
    if(raw&&!localStorage.getItem(backup)){
      JSON.parse(raw);
      localStorage.setItem(backup,raw);
      console.info('Planning : copie de sécurité locale conservée avant initialisation.');
    }
  }catch(e){console.warn('Planning : copie de sécurité non disponible',e)}
  // Ne plus propager automatiquement le planning d'un agent vers les autres
  // ni recalculer les semaines à l'ouverture : ces routines peuvent remplacer
  // des interventions déjà personnalisées. Les données et les autres outils restent en place.
  window.__INOVTEC_PLANNING_TEAMS_V1__=true;
  window.__INOVTEC_PLANNING_STANDARD_RECURRENCE_V2__=true;
})();
