(()=>{
  'use strict';
  const params=new URLSearchParams(location.search);
  if((params.get('mode')||'planning').toLowerCase()!=='planning')return;
  const frame=document.getElementById('legacyFrame');
  const loading=document.getElementById('loading');
  if(!frame||!loading)return;
  // Ce secours n'efface et ne modifie aucune donnée locale ou Firebase.
  const directUrl='PLANNINGS-LEGACY.html?v=20260917-planning-start-first1';
  let shown=false;
  function hasCalendar(){
    try{
      const doc=frame.contentDocument;
      const period=doc?.getElementById('periodLabel')?.textContent?.trim();
      const grid=doc?.getElementById('calendarViewport');
      return !!(period&&period!=='—'&&grid&&grid.children.length&&!grid.querySelector('.planning-render-error'));
    }catch{return false}
  }
  function showFallback(){
    if(hasCalendar()){
      loading.classList.add('hidden');
      return;
    }
    if(shown)return;
    shown=true;
    loading.classList.remove('hidden');
    loading.setAttribute('role','alert');
    loading.replaceChildren();
    const panel=document.createElement('div');
    panel.style.cssText='max-width:370px;padding:22px;text-align:center;line-height:1.6';
    const message=document.createElement('p');
    message.textContent='Le planning ne parvient pas à s’ouvrir dans le tableau de bord.';
    message.style.cssText='margin:0 0 12px';
    const link=document.createElement('a');
    link.href=directUrl;
    link.target='_blank';
    link.rel='noopener';
    link.textContent='Ouvrir le planning directement ↗';
    link.style.cssText='display:inline-block;background:#064e3b;color:#fff;padding:10px 14px;border-radius:9px;text-decoration:none';
    const hint=document.createElement('p');
    hint.textContent='Aucune donnée n’a été effacée. Si le planning direct reste bloqué, signale-le.';
    hint.style.cssText='font-size:11px;font-weight:400;margin:12px 0 0';
    panel.append(message,link,hint);
    loading.appendChild(panel);
  }
  // Les services externes peuvent rester en attente sans déclencher l’évènement load.
  setTimeout(showFallback,12000);
})();
