import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.message||e)));
try{
  // Contexte HTTP du dépôt, interface isolée et données entièrement fictives.
  await page.goto('http://127.0.0.1:8765/__replacement_test_empty__.html',{waitUntil:'domcontentloaded'});
  await page.setContent('<div class="calendar-toolbar"></div><div id="calendarViewport"></div><div id="agentList"></div><div id="contextMenu"></div>');
  await page.evaluate(()=>{
    const p={
      agents:[{id:'planning-dasilva',refId:'legacy-agent-id',name:'Dasilva'},
              {id:'planning-other',refId:'another-id',name:'Autre Agent'}],
      selected:'planning-dasilva',
      weeks:{'2026-W42':[{id:'intervention-1',agentId:'planning-dasilva',day:0,start:'09:00',end:'11:00',task:'Nettoyage',site:'Copropriété fictive'}]}
    };
    const row={id:'conge-1',agentRefId:'nouvel-id-classeur',agentName:'Da Silva',
      status:'pending',startDate:'2026-10-12',endDate:'2026-10-16',
      sourceType:'request',type:'Congés payés',deleted:false};
    const state={p,row,callbacks:[],doc:{moduleSyncV1:{conges:{payload:JSON.stringify([row])}}}};
    state.emit=()=>state.callbacks.forEach(cb=>cb({exists:true,data:()=>state.doc}));
    window.__leaveReplacementTest=state;
    // Cache local volontairement obsolète : Firebase doit gagner.
    localStorage.setItem('inovtec_absences_v1',JSON.stringify([]));
    window.InovtecPlanningAPI={getState:()=>state.p,replaceState:next=>{state.p=next}};
    window.firebase={
      auth:()=>({onAuthStateChanged:cb=>{queueMicrotask(()=>cb({uid:'test-planner'}));return()=>{}}}),
      firestore:()=>({collection:()=>({doc:()=>({onSnapshot:cb=>{
        state.callbacks.push(cb);queueMicrotask(()=>cb({exists:true,data:()=>state.doc}));
        return()=>{};
      }})})})
    };
  });
  await page.addScriptTag({url:'http://127.0.0.1:8765/planning-replacement.js?v=leave-regression'});
  await page.evaluate(()=>{
    const menu=document.getElementById('contextMenu');
    menu.className='agent-context open';
    menu.dataset.agentId='planning-dasilva';
    menu.appendChild(document.createElement('i'));
  });
  await page.locator('.iv-optimal-replacement').waitFor({timeout:10000});
  await page.locator('.iv-optimal-replacement').click();
  await page.waitForFunction(()=>document.getElementById('ivReplSummary')?.textContent.includes('12 oct.'));
  const pending=await page.locator('#ivReplacementBackdrop').innerText();
  if(!pending.includes('à valider')&&!pending.includes('À valider'))
    throw Error('La demande existante en attente est présentée comme une absence introuvable');
  if(pending.includes('Renseignez d’abord la période'))
    throw Error('La fenêtre redemande inutilement les dates déjà enregistrées');
  if(await page.locator('#ivApplyReplacements').isEnabled())
    throw Error('Une demande en attente ne doit pas déclencher de remplacement');

  // Approbation enregistrée côté Firebase : la fenêtre ouverte doit se mettre à jour.
  await page.evaluate(()=>{
    const state=window.__leaveReplacementTest;
    state.row.status='approved';
    state.doc.moduleSyncV1.conges.payload=JSON.stringify([state.row]);
    state.emit();
  });
  await page.waitForFunction(()=>document.getElementById('ivReplSummary')?.textContent.includes('Interventions'));
  const approved=await page.locator('#ivReplacementBackdrop').innerText();
  if(!approved.includes('1')||!approved.includes('Nettoyage'))
    throw Error('Le planning édité ne permet pas de proposer le remplacement validé');
  if(!await page.locator('#ivApplyReplacements').isEnabled())
    throw Error('Le remplacement devrait être disponible après approbation');

  // Re-render du planning : le cache local vide ne doit pas écraser la réponse Firebase.
  await page.evaluate(()=>document.getElementById('calendarViewport').appendChild(document.createElement('div')));
  await page.waitForTimeout(150);
  if(!(await page.locator('#ivReplSummary').innerText()).includes('Interventions'))
    throw Error('Les congés Firebase ont été perdus après le rendu planning');
  if(errors.length)throw Error(errors.join('; '));
  console.log('OK : Da Silva / Dasilva, demande visible à valider, validation Firebase et remplacement sans ressaisie');
}finally{
  await browser.close();
}
