import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1400,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message||String(e)));
try{
  await page.goto('http://127.0.0.1:8765/__availability_test__.html',{waitUntil:'domcontentloaded'});
  await page.setContent('<div class="calendar-toolbar"></div><div id="calendarViewport"></div><div id="agentList"></div><div id="contextMenu"></div>');
  await page.evaluate(()=>{
    const agents=[
      {id:'absent',name:'Agent absente',job:{contractHoursWeekly:30}},
      {id:'alpha',name:'Alpha',job:{contractHoursWeekly:10,replacementHoursAvailableWeekly:0}},
      {id:'beta',name:'Bêta',job:{contractHoursWeekly:10,replacementHoursAvailableWeekly:4}}
    ];
    const p={
      agents:agents.map(a=>({id:a.id,refId:a.id,name:a.name})),selected:'absent',
      weeks:{'2026-W42':[
        {id:'a',agentId:'absent',day:0,start:'09:00',end:'11:00',task:'Résidence A',chantierId:'a'},
        {id:'b',agentId:'absent',day:1,start:'09:00',end:'11:00',task:'Résidence B',chantierId:'b'},
        {id:'alpha-existing',agentId:'alpha',day:4,start:'08:00',end:'18:00',task:'Autre'},
        {id:'beta-existing',agentId:'beta',day:4,start:'08:00',end:'18:00',task:'Autre'}
      ]}
    };
    const leave={id:'leave',agentRefId:'absent',agentName:'Agent absente',
      status:'approved',startDate:'2026-10-12',endDate:'2026-10-16'};
    const t={agents,p,leave,writes:0,subs:[]};
    t.doc={moduleSyncV1:{conges:{payload:JSON.stringify([leave])}}};
    window.__extraHoursTest=t;
    window.InovtecDataHub={readyAgents:true,agents,chantiers:[]};
    window.InovtecPlanningAPI={getState:()=>t.p,replaceState(next){t.p=next;t.writes++}};
    window.firebase={
      auth:()=>({onAuthStateChanged:cb=>{queueMicrotask(()=>cb({uid:'fixture'}));return()=>{}}}),
      firestore:()=>({collection:()=>({doc:()=>({onSnapshot:cb=>{t.subs.push(cb);queueMicrotask(()=>cb({exists:true,data:()=>t.doc}));return()=>{}}})})})
    };
  });
  await page.addScriptTag({url:'http://127.0.0.1:8765/planning-replacement.js?v=extra-hours-test'});
  await page.evaluate(()=>{
    const menu=document.querySelector('#contextMenu');
    menu.dataset.agentId='absent';menu.className='open agent-context';menu.appendChild(document.createElement('span'));
  });
  await page.locator('.iv-optimal-replacement').click();
  const cards=page.locator('.iv-period-card');
  await cards.first().waitFor({timeout:5000});
  if(await cards.count()!==2)throw Error('Les 2 chantiers doivent être visibles');
  const a=cards.filter({hasText:'Résidence A'}),b=cards.filter({hasText:'Résidence B'});
  if(await a.locator('.iv-period-agents [data-agent-id="alpha"]').count())
    throw Error('Alpha sans heures supplémentaires et avec contrat déjà plein est éligible');
  if(await a.locator('.iv-period-agents [data-agent-id="beta"]').count()!==1)
    throw Error('Bêta avec 4 heures supplémentaires doit être disponible');
  if(await b.locator('.iv-period-agents [data-agent-id="beta"]').count()!==1)
    throw Error('Bêta devrait couvrir les 2 chantiers, total 4 h');
  if(await page.evaluate(()=>window.__extraHoursTest.writes)!==0)
    throw Error('Le moteur a changé le planning sans appliquer');

  // Après augmentation des heures supplémentaires d'Alpha, il devient éligible.
  await page.evaluate(()=>{
    const t=window.__extraHoursTest;
    t.agents.find(a=>a.id==='alpha').job.replacementHoursAvailableWeekly=2;
    const callbacks=t.subs.slice();
    callbacks.forEach(cb=>cb({exists:true,data:()=>t.doc}));
  });
  await page.waitForFunction(()=>document.querySelector('.iv-period-card .iv-period-agents [data-agent-id="alpha"]'));
  const a2=page.locator('.iv-period-card').filter({hasText:'Résidence A'});
  await a2.locator('.iv-period-agents [data-agent-id="alpha"]').click();
  const b2=page.locator('.iv-period-card').filter({hasText:'Résidence B'});
  if(await b2.locator('.iv-period-agents [data-agent-id="alpha"]').count())
    throw Error('Alpha a été proposé une 2e fois au-delà de 2 heures supplémentaires cumulées');
  if(!await page.locator('#ivApplyReplacements').isEnabled())
    throw Error('Bêta doit pouvoir assurer le second chantier');
  await page.locator('#ivApplyReplacements').click();
  const result=await page.evaluate(()=>({
    writes:window.__extraHoursTest.writes,week:window.__extraHoursTest.p.weeks['2026-W42']
  }));
  if(result.writes!==1)throw Error('Le remplacement de la période ne s’enregistre pas une seule fois');
  if(result.week.find(e=>e.id==='a').agentId!=='alpha'||result.week.find(e=>e.id==='b').agentId!=='beta')
    throw Error('Répartition Alpha/Bêta incorrecte');
  if(errors.length)throw Error('Erreurs JS : '+errors.join('; '));
  console.log('OK : heures supplémentaires disponibles, capacité hebdomadaire cumulée sur 2 chantiers, écriture unique');
}finally{await browser.close()}
