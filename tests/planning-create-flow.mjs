import { chromium } from 'playwright';

const base='http://127.0.0.1:8765';
const key='inovtec_plannings_v2';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});

const seed=async page=>{
  await page.addInitScript(()=>{
    const agents=[
      {id:'create-agent-1',identity:{prenom:'Agent',nom:'Un'},displayName:'Agent Un'},
      {id:'create-agent-2',identity:{prenom:'Agent',nom:'Deux'},displayName:'Agent Deux'}
    ];
    const chantiers=[
      {id:'site-a',nom:'Chantier A',adresse:'1 rue A'},
      {id:'site-b',nom:'Chantier B',adresse:'2 rue B'}
    ];
    window.InovtecDataHub={
      readyAgents:true,
      readyChantiers:true,
      agents,
      chantiers,
      subscribe(){return()=>{}}
    };
    localStorage.setItem('inovtec_plannings_v2',JSON.stringify({
      agents:[
        {id:'create-agent-1',refId:'create-agent-1',name:'Agent Un',color:'#4f9f57',copies:2,parityMode:'standard',parityTemplates:{even:'',odd:''},parityInheritedWeeks:{}},
        {id:'create-agent-2',refId:'create-agent-2',name:'Agent Deux',color:'#4f8fd8',copies:2,parityMode:'standard',parityTemplates:{even:'',odd:''},parityInheritedWeeks:{}}
      ],
      weeks:{},
      selected:null
    }));
  });
};

const state=page=>page.evaluate(storage=>JSON.parse(localStorage.getItem(storage)||'{}'),key);
const allEvents=s=>Object.values(s.weeks||{}).flat();

try{
  const page=await browser.newPage({viewport:{width:1365,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await seed(page);
  await page.goto(base+'/PLANNINGS-LEGACY.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.agent-row[data-agent-id="create-agent-1"]').waitFor({state:'visible',timeout:15000});

  await page.locator('.agent-row[data-agent-id="create-agent-1"]').click();
  await page.locator('#addTaskBtn').click();
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  let s=await state(page);
  if(allEvents(s).length!==0)throw Error('Une tâche brouillon a été enregistrée avant Terminé');
  if((await page.locator('#edDelete').innerText()).trim()!=='Annuler')throw Error('Le brouillon ne propose pas Annuler');
  await page.locator('#edTitle').selectOption('site-a');
  await page.locator('#edStart').fill('09:00');
  await page.locator('#edEnd').fill('10:15');
  await page.locator('#edSite').fill('Nettoyage hall');
  await page.locator('#edNote').fill('Création agent 1');
  await page.locator('#edDone').click();
  await page.waitForFunction(()=>!document.getElementById('editorPopover')?.classList.contains('open'),null,{timeout:5000});
  s=await state(page);
  let events=allEvents(s);
  if(events.length!==1||events[0].agentId!=='create-agent-1'||events[0].chantierId!=='site-a'||events[0].start!=='09:00'||events[0].end!=='10:15')throw Error('Création agent 1 incorrecte');
  console.log('OK : création par bouton sur le premier planning');

  await page.locator('.agent-row[data-agent-id="create-agent-2"]').click();
  await page.locator('#addTaskBtn').click();
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  await page.locator('#edTitle').selectOption('site-b');
  await page.locator('#edStart').fill('11:00');
  await page.locator('#edEnd').fill('12:00');
  await page.locator('#edDone').click();
  await page.waitForFunction(()=>!document.getElementById('editorPopover')?.classList.contains('open'),null,{timeout:5000});
  s=await state(page);
  events=allEvents(s);
  if(events.length!==2||!events.some(e=>e.agentId==='create-agent-2'&&e.chantierId==='site-b'))throw Error('Création sur le deuxième planning incorrecte');
  console.log('OK : création indépendante sur un deuxième planning');

  await page.locator('#addTaskBtn').click();
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  await page.locator('#edDelete').click();
  await page.waitForFunction(()=>!document.getElementById('editorPopover')?.classList.contains('open'),null,{timeout:5000});
  s=await state(page);
  if(allEvents(s).length!==2)throw Error('Annuler un brouillon a modifié les données');
  console.log('OK : annulation du brouillon sans écriture');

  await page.locator('.agent-row[data-agent-id="create-agent-1"]').click();
  const firstCard=page.locator('.event-card').first();
  await firstCard.dblclick({timeout:10000});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  await page.locator('#edStart').fill('08:30');
  await page.locator('#edEnd').fill('10:00');
  await page.locator('#edDone').click();
  await page.waitForFunction(()=>!document.getElementById('editorPopover')?.classList.contains('open'),null,{timeout:5000});
  s=await state(page);
  if(!allEvents(s).some(e=>e.agentId==='create-agent-1'&&e.start==='08:30'&&e.end==='10:00'))throw Error('Modification de tâche non enregistrée');
  console.log('OK : modification puis fermeture de la bulle');

  await page.locator('.agent-row[data-agent-id="create-agent-2"]').click();
  await page.locator('.event-card').first().dblclick({timeout:10000});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#edDelete').click();
  await page.waitForFunction(()=>!document.getElementById('editorPopover')?.classList.contains('open'),null,{timeout:5000});
  s=await state(page);
  events=allEvents(s);
  if(events.length!==1||events[0].agentId!=='create-agent-1')throw Error('Suppression sur un planning a touché le mauvais agent');
  if(errors.length)throw Error('Erreur JavaScript : '+errors.join('; '));
  console.log('OK : suppression ciblée sans toucher aux autres plannings');

  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  await seed(mobile);
  await mobile.goto(base+'/PLANNINGS-LEGACY.html',{waitUntil:'domcontentloaded',timeout:45000});
  await mobile.locator('.agent-row[data-agent-id="create-agent-1"]').waitFor({state:'visible',timeout:15000});
  await mobile.locator('.agent-row[data-agent-id="create-agent-1"]').click();
  if(!await mobile.locator('#addTaskBtn').isVisible())throw Error('Bouton Ajouter une tâche absent sur mobile');
  await mobile.locator('#addTaskBtn').click();
  await mobile.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  const box=await mobile.locator('#editorPopover').boundingBox();
  if(!box||box.x<0||box.y<0||box.x+box.width>391||box.y+box.height>845)throw Error('Bulle de création hors écran sur mobile');
  await mobile.locator('#edTitle').selectOption('site-a');
  await mobile.locator('#edDone').click();
  await mobile.waitForFunction(()=>!document.getElementById('editorPopover')?.classList.contains('open'),null,{timeout:5000});
  const ms=await state(mobile);
  if(allEvents(ms).length!==1)throw Error('Création mobile non enregistrée');
  console.log('OK : création mobile, sauvegarde et fermeture');

  console.log('BILAN CREATION PLANNING : bouton, multi-agents, annulation, édition, suppression et mobile réussis');
}catch(error){
  console.error('::error::Test création planning : '+error.message);
  process.exitCode=1;
}finally{
  await browser.close();
}
