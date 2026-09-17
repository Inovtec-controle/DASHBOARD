/* Pont ciblé Classeur agents -> éditeur de planning d'équipe existant.
   Aucun changement de données : le Planning reste seul responsable des liaisons. */
(()=>{
  'use strict';
  if(window.__IV_AGENTS_TEAM_CONTEXT_V1__)return;
  window.__IV_AGENTS_TEAM_CONTEXT_V1__=true;
  const mode=(new URLSearchParams(location.search).get('mode')||'').toLowerCase();
  if(mode!=='agents'&&mode!=='planning')return;
  const frame=document.getElementById('legacyFrame');
  const REQUEST='ivAgentsOpenTeamEditorV1';
  const PLANNING='inovtec_plannings_v2';
  const str=v=>v==null?'':String(v);
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}};
  const request=()=>{try{return JSON.parse(sessionStorage.getItem(REQUEST)||'null')}catch{return null}};
  const clearRequest=()=>{try{sessionStorage.removeItem(REQUEST)}catch{}};
  const doc=()=>{try{return frame?.contentDocument||null}catch{return null}};

  if(mode==='agents'){
    let currentDocument=null;
    function install(){
      const d=doc(),list=d?.getElementById('agentList');
      if(!list||!d.body||currentDocument===d)return;
      currentDocument=d;
      const css=d.createElement('style');
      css.textContent='#ivAgentTeamContext{position:fixed;display:none;z-index:99999;width:min(295px,calc(100vw - 20px));max-height:calc(100vh - 20px);overflow:auto;padding:6px;background:#fff;color:#173b2b;border:1px solid #dce8e1;border-radius:12px;box-shadow:0 16px 42px rgba(15,23,42,.22);font:600 13px Inter,system-ui,sans-serif}#ivAgentTeamContext.open{display:block}#ivAgentTeamContext button{display:block;width:100%;padding:11px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}#ivAgentTeamContext button:hover,#ivAgentTeamContext button:focus-visible{background:#edf8f1;outline:2px solid #b7e3ca}';
      d.head.appendChild(css);
      const menu=d.createElement('div');menu.id='ivAgentTeamContext';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Actions sur le planning de l’agent');
      const button=d.createElement('button');button.type='button';button.setAttribute('role','menuitem');menu.appendChild(button);d.body.appendChild(menu);
      const close=()=>menu.classList.remove('open');
      list.addEventListener('contextmenu',e=>{
        const row=e.target?.closest?.('.listItem[data-agent-id]');
        if(!row||!list.contains(row))return;
        e.preventDefault();e.stopPropagation();
        const agentId=str(row.dataset.agentId);
        const state=read(PLANNING,{}),agents=Array.isArray(state.agents)?state.agents:[];
        const linked=agents.find(a=>str(a.id)===agentId||str(a.refId)===agentId);
        const team=(state.teamPlanning?.teams||[]).find(t=>Array.isArray(t?.members)&&t.members.some(id=>str(id)===str(linked?.id)));
        button.textContent=team?'👥 Gérer le planning d’équipe':'👥 Lier des agents au même planning';
        button.onclick=()=>{
          close();
          try{
            sessionStorage.setItem(REQUEST,JSON.stringify({agentId,createdAt:Date.now()}));
            sessionStorage.setItem('ivPlanningOpenAgent',agentId);
          }catch(err){console.warn('Ouverture du planning d’équipe',err);return}
          location.assign(new URL('PLANNINGS.html',location.href).href);
        };
        menu.classList.add('open');
        const r=menu.getBoundingClientRect();
        menu.style.left=Math.max(8,Math.min(e.clientX,d.defaultView.innerWidth-r.width-8))+'px';
        menu.style.top=Math.max(8,Math.min(e.clientY,d.defaultView.innerHeight-r.height-8))+'px';
      });
      d.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))close()},true);
      d.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
      d.addEventListener('scroll',close,true);
    }
    frame?.addEventListener('load',()=>{currentDocument=null;setTimeout(install,80)});
    install();setTimeout(install,500);
    return;
  }

  // À l'arrivée sur le Planning, ouvrir son éditeur d'équipe déjà opérationnel.
  let busy=false,attempts=0;
  function fail(){
    clearRequest();
    const d=doc();if(!d?.body)return;
    const note=d.createElement('div');note.setAttribute('role','status');
    note.style.cssText='position:fixed;bottom:16px;left:16px;z-index:99998;max-width:min(420px,calc(100% - 32px));padding:12px 15px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px;color:#92400e;font:600 12px Inter,system-ui,sans-serif';
    note.textContent='Agent introuvable dans le Planning. Vérifie la synchronisation du Classeur agents, puis réessaie.';
    d.body.appendChild(note);
  }
  function openRequested(){
    const req=request();if(!req)return;
    if(!req.agentId||Date.now()-Number(req.createdAt)>120000){clearRequest();return}
    if(busy)return;
    const d=doc(),state=read(PLANNING,{});
    const agent=Array.isArray(state.agents)?state.agents.find(a=>str(a.id)===str(req.agentId)||str(a.refId)===str(req.agentId)):null;
    const row=agent&&[...(d?.querySelectorAll('.agent-row[data-agent-id]')||[])].find(r=>str(r.dataset.agentId)===str(agent.id));
    if(!d?.getElementById('contextMenu')||!row){if(++attempts>=50)fail();return}
    busy=true;
    try{
      row.click();
      setTimeout(()=>{
        const fresh=[...d.querySelectorAll('.agent-row[data-agent-id]')].find(r=>str(r.dataset.agentId)===str(agent.id));
        if(!fresh){busy=false;return}
        const menu=d.getElementById('contextMenu');
        const openTeam=()=>{
          const action=[...(menu?.querySelectorAll('button[data-iv-team-menu="1"]')||[])].find(b=>/Gérer l’équipe|Créer \/ rejoindre une équipe/.test(b.textContent||''));
          if(!action)return false;
          action.click();
          if(d.getElementById('ivTeamModal')?.classList.contains('open')){clearRequest();busy=false;return true}
          return false;
        };
        const observer=new d.defaultView.MutationObserver(()=>{
          if(openTeam())observer.disconnect();
        });
        if(menu)observer.observe(menu,{attributes:true,attributeFilter:['class'],childList:true});
        const r=fresh.getBoundingClientRect();
        fresh.dispatchEvent(new d.defaultView.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:Math.max(8,r.left+Math.min(30,r.width/2)),clientY:Math.max(8,r.top+Math.min(18,r.height/2))}));
        d.defaultView.queueMicrotask(()=>{
          if(openTeam())observer.disconnect();
          else d.defaultView.setTimeout(()=>{observer.disconnect();busy=false},450);
        });
      },100);
    }catch(err){busy=false;console.warn('Accès au planning d’équipe',err)}
  }
  frame?.addEventListener('load',()=>{attempts=0;setTimeout(openRequested,280)});
  const check=setInterval(()=>{if(!request()){clearInterval(check);return}openRequested()},350);
  setTimeout(openRequested,400);
})();
