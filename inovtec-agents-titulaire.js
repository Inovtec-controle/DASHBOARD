/* Qualification des agents titulaires et rattachement des remplacements.
   Les informations sont conservées dans la fiche canonique job de l'agent. */
(()=>{
'use strict';
if(window.__IV_AGENTS_TITULAIRE_V1__)return;
window.__IV_AGENTS_TITULAIRE_V1__=true;

const byId=id=>document.getElementById(id);
const nameOf=a=>[a?.identity?.prenom,a?.identity?.nom].filter(Boolean).join(' ').trim()||'Agent sans nom';
const visibleAgents=()=>typeof activeAgents==='function'?activeAgents().filter(a=>!a.archivedAt):[];
const selected=()=>typeof getSelectedAgent==='function'?getSelectedAgent():null;
const isTitulaire=a=>a?.job?.estTitulaire===true;

function install(){
  if(byId('ivAgentTitulaire'))return;
  const contract=byId('f_contrat');
  const field=contract?.closest('.field');
  if(!field)return;
  const style=document.createElement('style');
  style.id='ivAgentTitulaireStyle';
  style.textContent=`
    #ivAgentTitulaire{grid-column:1/-1;display:grid;gap:10px;padding:13px 14px;border:1px solid #cce6d6;border-radius:13px;background:#f6fbf8}
    #ivAgentTitulaire .iv-title{font-size:12px;font-weight:800;color:#165b37}
    #ivAgentTitulaire .iv-check{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;cursor:pointer;color:#183a2b}
    #ivAgentTitulaire input[type=checkbox]{width:18px;height:18px;accent-color:#15803d;flex-shrink:0}
    #ivAgentTitulaire .iv-hint{font-size:11px;line-height:1.45;color:#52675b}
    #ivAgentTitulaire .iv-replace{display:grid;gap:6px}
    #ivAgentTitulaire .iv-replace label{font-size:12px;font-weight:750;color:#234537}
    #ivAgentTitulaire .iv-replace select{width:100%;min-width:0}
    #ivAgentTitulaire .iv-replace[hidden]{display:none!important}
    .iv-agent-role{display:inline-block;margin-top:5px;padding:3px 7px;border-radius:999px;background:#e5f5eb;color:#17643b;font-size:10px;font-weight:800;line-height:1.25}
    .iv-agent-role.iv-replacement{background:#edf2ff;color:#355199}
  `;
  document.head.appendChild(style);
  const box=document.createElement('div');
  box.id='ivAgentTitulaire';
  box.innerHTML=`
    <div class="iv-title">Statut dans l’équipe</div>
    <label class="iv-check" for="f_estTitulaire"><input id="f_estTitulaire" type="checkbox"> Agent titulaire</label>
    <div class="iv-hint">Coche cette case pour identifier le titulaire du poste. Pour un agent embauché en remplacement, sélectionne ci-dessous la personne remplacée.</div>
    <div class="iv-replace" id="ivAgentRemplacement">
      <label for="f_titulaireRemplace">Titulaire remplacé (si remplacement)</label>
      <select class="input" id="f_titulaireRemplace"><option value="">Aucun titulaire sélectionné</option></select>
    </div>`;
  field.insertAdjacentElement('afterend',box);
  byId('f_estTitulaire').addEventListener('change',()=>{
    if(byId('f_estTitulaire').checked)byId('f_titulaireRemplace').value='';
    updateVisibility();
  });
}
function updateVisibility(){
  const isChecked=byId('f_estTitulaire')?.checked;
  const row=byId('ivAgentRemplacement');
  if(row)row.hidden=!!isChecked;
  const select=byId('f_titulaireRemplace');
  if(select)select.disabled=!!isChecked;
}
function syncForm(){
  install();
  const a=selected();
  const check=byId('f_estTitulaire');
  const picker=byId('f_titulaireRemplace');
  if(!check||!picker)return;
  check.checked=isTitulaire(a);
  const previous=a?.job?.titulaireRemplaceId||'';
  picker.replaceChildren();
  const empty=document.createElement('option');
  empty.value='';
  empty.textContent='Aucun titulaire sélectionné';
  picker.appendChild(empty);
  const titulaires=visibleAgents().filter(other=>other.id!==a?.id&&isTitulaire(other))
    .sort((x,y)=>nameOf(x).localeCompare(nameOf(y),'fr',{sensitivity:'base'}));
  titulaires.forEach(other=>{
    const opt=document.createElement('option');
    opt.value=other.id;
    opt.textContent=nameOf(other);
    picker.appendChild(opt);
  });
  if(previous&&!titulaires.some(other=>other.id===previous)){
    const stale=document.createElement('option');
    stale.value=previous;
    stale.textContent='Titulaire indisponible — modifier le rattachement';
    stale.disabled=true;
    picker.appendChild(stale);
  }
  picker.value=previous;
  updateVisibility();
}
function decorateList(){
  const lookup=new Map(visibleAgents().map(a=>[String(a.id),a]));
  byId('agentList')?.querySelectorAll('.listItem[data-agent-id]').forEach(row=>{
    const agent=lookup.get(String(row.dataset.agentId));
    const sub=row.querySelector('.liText .sub');
    if(!agent||!sub)return;
    let badge=sub.parentElement.querySelector('.iv-agent-role');
    const titular=isTitulaire(agent);
    const replacement=String(agent.job?.titulaireRemplaceId||'');
    if(!titular&&!replacement){badge?.remove();return;}
    if(!badge){badge=document.createElement('span');badge.className='iv-agent-role';sub.insertAdjacentElement('afterend',badge);}
    badge.classList.toggle('iv-replacement',!titular);
    const covered=lookup.get(replacement);
    badge.textContent=titular?'Titulaire':('Remplace '+(covered?nameOf(covered):'un titulaire indisponible'));
  });
}

install();
if(typeof window.renderDetails==='function'){
  const original=window.renderDetails;
  window.renderDetails=function(...args){const result=original.apply(this,args);syncForm();return result;};
}
if(typeof window.renderList==='function'){
  const original=window.renderList;
  window.renderList=function(...args){const result=original.apply(this,args);decorateList();return result;};
}
if(typeof window.saveAgentForm==='function'){
  const original=window.saveAgentForm;
  window.saveAgentForm=function(...args){
    const a=selected();
    if(a&&byId('f_estTitulaire')&&byId('f_titulaireRemplace')){
      const titulaire=byId('f_estTitulaire').checked;
      const replacement=titulaire?'':byId('f_titulaireRemplace').value;
      if(replacement){
        const linked=visibleAgents().find(other=>other.id===replacement&&other.id!==a.id&&isTitulaire(other));
        if(!linked){alert('Le titulaire remplacé n’est plus disponible. Sélectionne un titulaire valide ou efface le rattachement.');return;}
      }
      // La validation et la sauvegarde existantes restent la source de vérité.
      const firstName=String(byId('f_prenom')?.value||'').trim();
      const lastName=String(byId('f_nom')?.value||'').trim();
      if(firstName||lastName){
        a.job=a.job||{};
        a.job.estTitulaire=titulaire;
        a.job.titulaireRemplaceId=replacement;
      }
    }
    return original.apply(this,args);
  };
}
if(typeof window.duplicateAgent==='function'){
  const original=window.duplicateAgent;
  window.duplicateAgent=function(...args){
    const source=selected();
    const result=original.apply(this,args);
    const copy=selected();
    if(copy&&copy!==source){
      copy.job=copy.job||{};
      // Une fiche dupliquée ne crée pas automatiquement un deuxième titulaire.
      copy.job.estTitulaire=false;
      copy.job.titulaireRemplaceId='';
      if(typeof touchAgent==='function')touchAgent(copy);
      if(typeof save==='function')save();
      if(typeof renderAll==='function')renderAll();
    }
    return result;
  };
}
})();
