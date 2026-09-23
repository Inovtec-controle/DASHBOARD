(()=>{
  'use strict';
  const params=new URLSearchParams(location.search);
  if((params.get('mode')||'planning').toLowerCase()!=='planning')return;
  const frame=document.getElementById('legacyFrame');
  const loading=document.getElementById('loading');
  const summary=document.getElementById('pageSummary');
  if(!frame||!loading)return;
  const directUrl='PLANNINGS-LEGACY.html?v=20260917-planning-summary-recovery2';
  const cardSpecs=[
    ['♙','Agent actif','Aucun agent','Référentiel partagé'],
    ['▦','Semaine','—','Période affichée'],
    ['✓','Interventions','0 intervention','Planning sélectionné'],
    ['◷','Volume prévu','0 h','Calcul des horaires']
  ];
  let fallbackShown=false;
  let ownCards=[];
  function frameDocument(){
    try{return frame.contentDocument||null}catch{return null}
  }
  function initializeCards(){
    if(!summary||summary.querySelector('.iv-summary-card'))return;
    ownCards=cardSpecs.map(([icon,label,value,note])=>{
      const card=document.createElement('article');
      card.className='iv-summary-card';
      card.dataset.planningRecovery='1';
      const symbol=document.createElement('span');symbol.className='iv-summary-icon';symbol.textContent=icon;
      const copy=document.createElement('span');copy.className='iv-summary-copy';
      const small=document.createElement('small');small.className='iv-summary-label';small.textContent=label;
      const strong=document.createElement('strong');strong.className='iv-summary-value';strong.textContent=value;
      const hint=document.createElement('span');hint.className='iv-summary-note';hint.textContent=note;
      copy.append(small,strong,hint);card.append(symbol,copy);
      summary.appendChild(card);
      return strong;
    });
  }
  function updateCards(){
    if(!summary)return;
    initializeCards();
    // Le rendu standard prend le relais dès qu'il est chargé.
    if(ownCards.length!==4||ownCards.some(el=>!el.isConnected))return;
    const doc=frameDocument();
    if(!doc)return;
    const name=(doc.getElementById('title')?.textContent||'').replace(/^Planning\s*[—-]?\s*/i,'').trim();
    const week=(doc.getElementById('weekInfo')?.textContent||'').trim();
    const count=(doc.getElementById('count')?.textContent||'').trim();
    let minutes=0;
    doc.querySelectorAll('#rows tr').forEach(tr=>{
      const raw=tr.cells?.[1]?.textContent||'';
      const parts=raw.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
      if(parts)minutes+=Math.max(0,(Number(parts[3])*60+Number(parts[4]))-(Number(parts[1])*60+Number(parts[2])));
    });
    ownCards[0].textContent=name||'Aucun agent';
    ownCards[1].textContent=week||'—';
    ownCards[2].textContent=count||'0 intervention';
    ownCards[3].textContent=minutes?`${Math.floor(minutes/60)} h ${String(minutes%60).padStart(2,'0')}`:'0 h';
  }
  function calendarReady(){
    const doc=frameDocument();
    const period=doc?.getElementById('periodLabel')?.textContent?.trim();
    const viewport=doc?.getElementById('calendarViewport');
    return !!(period&&period!=='—'&&viewport?.children.length&&!viewport.querySelector('.planning-render-error'));
  }
  function reveal(){
    if(!calendarReady())return false;
    loading.classList.add('hidden');
    loading.setAttribute('aria-hidden','true');
    return true;
  }
  function showFallback(){
    if(reveal()||fallbackShown)return;
    fallbackShown=true;
    loading.classList.remove('hidden');
    loading.setAttribute('role','alert');
    loading.replaceChildren();
    const panel=document.createElement('div');
    panel.style.cssText='max-width:370px;padding:22px;text-align:center;line-height:1.6';
    const message=document.createElement('p');
    message.textContent='Le planning ne parvient pas à s’ouvrir dans le tableau de bord.';
    message.style.cssText='margin:0 0 12px';
    const link=document.createElement('a');
    link.href=directUrl;link.target='_blank';link.rel='noopener';
    link.textContent='Ouvrir le planning directement ↗';
    link.style.cssText='display:inline-block;background:#064e3b;color:#fff;padding:10px 14px;border-radius:9px;text-decoration:none';
    const hint=document.createElement('p');
    hint.textContent='Aucune donnée n’a été effacée. Le planning direct reste accessible indépendamment du tableau de bord.';
    hint.style.cssText='font-size:11px;font-weight:400;margin:12px 0 0';
    panel.append(message,link,hint);loading.appendChild(panel);
  }
  // Le tableau de synthèse apparaît sans attendre Firebase, jsPDF ou l'événement load de l'iframe.
  initializeCards();
  updateCards();
  const heartbeat=setInterval(()=>{
    updateCards();
    if(reveal()){
      // Maintenir les bulles de secours à jour si le script visuel principal est bloqué.
      // L'intervalle reste léger : quatre valeurs et au plus les lignes de l'agent affiché.
    }
  },600);
  window.addEventListener('pagehide',()=>clearInterval(heartbeat),{once:true});
  setTimeout(showFallback,12000);
})();
