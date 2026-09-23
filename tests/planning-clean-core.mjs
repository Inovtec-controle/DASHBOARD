import { chromium } from 'playwright';

const base='http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1365,height:900},serviceWorkers:'block'});
await context.addInitScript(()=>{
  const agents=[
    {id:'agent-a',identity:{prenom:'Alice',nom:'Test'},displayName:'Alice Test'},
    {id:'agent-b',identity:{prenom:'Bruno',nom:'Test'},displayName:'Bruno Test'}
  ];
  const sites=[
    {id:'site-a',nom:'Chantier Alpha',adresse:'1 rue Alpha'},
    {id:'site-b',nom:'Chantier Beta',adresse:'2 rue Beta'}
  ];
  window.InovtecDataHub={
    readyAgents:true,readyChantiers:true,agents,chantiers:sites,
    subscribe(fn){fn?.({agents, chantiers:sites, readyAgents:true, readyChantiers:true});return()=>{}}
  };
  localStorage.setItem('inovtec_plannings_v2',JSON.stringify({
    agents:[
      {id:'agent-a',refId:'agent-a',name:'Alice Test',color:'#4f9f57',copies:2,parityMode:'standard',parityTemplates:{even:'',odd:''},parityInheritedWeeks:{}},
      {id:'agent-b',refId:'agent-b',name:'Bruno Test',color:'#4f9f57',copies:2,parityMode:'standard',parityTemplates:{even:'',odd:''},parityInheritedWeeks:{}}
    ],
    weeks:{},selected:null
  }));
});
const page=await context.newPage();
page.on('dialog',async d=>{if(d.type()==='confirm')await d.accept();else await d.dismiss()});
const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};

try{
  await page.goto(base+'/PLANNINGS-LEGACY.html?v=test-clean',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('.agent-row[data-agent-id="agent-a"]').waitFor({state:'visible',timeout:15000});

  // Recherche et sélection agent
  await page.locator('#agentSearch').fill('Bruno');
  assert(await page.locator('.agent-row').count()===1,'Recherche agent incorrecte');
  await page.locator('#agentSearch').fill('');
  await page.locator('.agent-row[data-agent-id="agent-a"]').click();
  assert((await page.locator('.agent-row.active').getAttribute('data-agent-id'))==='agent-a','Sélection agent incorrecte');

  // Vues
  for(const [view,selector] of [['day','.day-column'],['month','.month-view'],['list','.list-view'],['week','.day-column']]){
    await page.locator('.view-tab[data-view="'+view+'"]').click();
    await page.locator(selector).first().waitFor({state:'visible',timeout:5000});
  }

  // Navigation période
  const period0=(await page.locator('#periodLabel').innerText()).trim();
  await page.locator('#nextBtn').click();
  const period1=(await page.locator('#periodLabel').innerText()).trim();
  assert(period1!==period0,'Période suivante inactive');
  await page.locator('#prevBtn').click();

  // Création via bouton
  await page.locator('#addTaskBtn').click();
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:5000});
  await page.locator('#edTitle').selectOption('site-a');
  await page.locator('#edSite').fill('Nettoyage bureaux');
  await page.locator('#edStart').fill('09:00');
  await page.locator('#edEnd').fill('10:00');
  await page.locator('#edNote').fill('Note test');
  await page.locator('#edDone').click();
  await page.locator('#editorPopover').waitFor({state:'hidden',timeout:5000});
  assert(await page.locator('.event-card').count()>=1,'Création via + Tâche absente');

  // Création par vraie souris / double-clic
  const col=page.locator('.day-column').nth(1);
  const box=await col.boundingBox();assert(!!box,'Colonne Planning non mesurable');
  await page.mouse.click(box.x+Math.min(60,box.width/2),box.y+220,{clickCount:2,delay:90});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:5000});
  await page.locator('#edTitle').selectOption('site-b');
  await page.locator('#edSite').fill('Contrôle sanitaires');
  await page.locator('#edStart').fill('11:00');
  await page.locator('#edEnd').fill('12:00');
  await page.locator('#edDone').click();
  await page.locator('#editorPopover').waitFor({state:'hidden',timeout:5000});
  assert(await page.locator('.event-card').count()>=2,'Création par double-clic absente');

  // Edition d'une tâche existante + Terminé
  const first=page.locator('.event-card').first();
  const firstBox=await first.boundingBox();assert(!!firstBox,'Tâche existante non mesurable');
  await page.mouse.click(firstBox.x+20,firstBox.y+12,{clickCount:2,delay:90});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:5000});
  await page.locator('#edStart').fill('10:00');
  await page.locator('#edEnd').fill('11:30');
  await page.locator('#edNote').fill('Modification OK');
  await page.locator('#edDone').click();
  await page.locator('#editorPopover').waitFor({state:'hidden',timeout:5000});
  let state=JSON.parse(await page.evaluate(()=>localStorage.getItem('inovtec_plannings_v2')));
  let rows=Object.values(state.weeks||{}).flat();
  const modified=rows.find(e=>e.note==='Modification OK'&&e.start==='10:00'&&e.end==='11:30');
  assert(!!modified,'Terminé n’enregistre pas les modifications');
  const modifiedId=modified.id;

  // Déplacement souris de la même tâche
  let card=page.locator('.event-card[data-id="'+modifiedId+'"]');
  let cb=await card.boundingBox();assert(!!cb,'Tâche modifiée introuvable avant déplacement');
  const target=page.locator('.day-column').nth(2);const tb=await target.boundingBox();assert(!!tb,'Cible déplacement introuvable');
  await page.mouse.move(cb.x+20,cb.y+14);
  await page.mouse.down();
  await page.mouse.move(tb.x+Math.min(50,tb.width/2),tb.y+280,{steps:8});
  await page.mouse.up();
  await page.waitForTimeout(250);
  state=JSON.parse(await page.evaluate(()=>localStorage.getItem('inovtec_plannings_v2')));
  rows=Object.values(state.weeks||{}).flat();
  const moved=rows.find(e=>e.id===modifiedId);
  assert(moved&&Number(moved.day)===2,'Déplacement de tâche non enregistré');

  // Redimensionnement de la même tâche
  card=page.locator('.event-card[data-id="'+modifiedId+'"]');
  const handle=card.locator('.event-resize');
  const hb=await handle.boundingBox();assert(!!hb,'Poignée de redimensionnement absente');
  const beforeEnd=moved.end||'';
  await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);
  await page.mouse.down();
  await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2+56,{steps:6});
  await page.mouse.up();
  await page.waitForTimeout(200);
  state=JSON.parse(await page.evaluate(()=>localStorage.getItem('inovtec_plannings_v2')));
  rows=Object.values(state.weeks||{}).flat();
  const resized=rows.find(e=>e.id===modifiedId);
  assert(resized&&resized.end!==beforeEnd,'Redimensionnement non enregistré');

  // Menu agent : couleur et rythme uniquement
  await page.locator('.agent-row[data-agent-id="agent-a"]').click({button:'right'});
  await page.locator('#contextMenu.open').waitFor({state:'visible',timeout:5000});
  assert(await page.locator('#contextMenu .color-choice').count()>=1,'Palette couleur absente');
  assert(await page.locator('#contextMenu .planning-rhythm-choice').count()===2,'Rythme planning absent');
  assert(await page.getByText('Modifier le nom').count()===0,'Fonction annexe Modifier le nom encore présente');
  assert(await page.getByText('Supprimer').count()===0,'Fonction annexe Supprimer agent encore présente');
  await page.locator('#contextMenu .planning-rhythm-choice').nth(1).click();
  state=JSON.parse(await page.evaluate(()=>localStorage.getItem('inovtec_plannings_v2')));
  assert(state.agents.find(a=>a.id==='agent-a')?.parityMode==='alternating','Rythme paire/impaire non enregistré');

  // Suppression d'une intervention
  card=page.locator('.event-card').first();cb=await card.boundingBox();assert(!!cb,'Tâche absente avant suppression');
  await page.mouse.click(cb.x+20,cb.y+12,{clickCount:2,delay:90});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:5000});
  const beforeCount=Object.values(JSON.parse(await page.evaluate(()=>localStorage.getItem('inovtec_plannings_v2'))).weeks||{}).flat().length;
  await page.locator('#edDelete').click();
  await page.locator('#editorPopover').waitFor({state:'hidden',timeout:5000});
  const afterCount=Object.values(JSON.parse(await page.evaluate(()=>localStorage.getItem('inovtec_plannings_v2'))).weeks||{}).flat().length;
  assert(afterCount===beforeCount-1,'Suppression intervention non enregistrée');

  // Aujourd'hui
  await page.locator('#todayBtn').click();
  assert((await page.locator('#periodLabel').innerText()).trim().length>0,'Bouton Aujourd’hui inactif');

  if(errors.length)throw Error('Erreur JavaScript : '+errors.join(' | '));
  console.log('OK : Planning propre — recherche, vues, navigation, +Tâche, double-clic réel, édition, Terminé, déplacement, redimensionnement, rythme et suppression.');
}catch(e){
  console.error('::error::Planning propre : '+e.message);
  process.exitCode=1;
}finally{
  await browser.close();
}
