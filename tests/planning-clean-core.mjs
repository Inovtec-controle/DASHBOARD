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
await page.route('**/inovtec-data-hub.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
await page.route('**/planning-firebase-direct.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.__INOVTEC_PLANNING_FIREBASE_DIRECT_V1__=true;'}));
await page.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
page.on('dialog',async d=>{if(d.type()==='confirm')await d.accept();else await d.dismiss()});
const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};

try{
  await page.goto(base+'/PLANNINGS-APP.html?mode=planning&v=test-direct',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('.agent-row[data-agent-id="agent-a"]').waitFor({state:'visible',timeout:15000});

  // Recherche et sélection agent
  await page.locator('#agentSearch').fill('Bruno');
  assert(await page.locator('.agent-row').count()===1,'Recherche agent incorrecte');
  await page.locator('#agentSearch').fill('');
  await page.locator('.agent-row[data-agent-id="agent-a"]').click();
  assert((await page.locator('.agent-row.active').getAttribute('data-agent-id'))==='agent-a','Sélection agent incorrecte');
  await page.locator('.agent-row[data-agent-id="agent-b"]').click();
  assert((await page.locator('.agent-row.active').getAttribute('data-agent-id'))==='agent-b','Le changement d’agent exige encore un clic sur Aujourd’hui');
  await page.locator('.agent-row[data-agent-id="agent-a"]').click();

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

  assert(await page.locator('#addTaskBtn').count()===0,'Le bouton + Tâche ne doit plus exister');

  // Création uniquement par vraie souris / double-clic
  const col=page.locator('.day-column').nth(1);
  const box=await col.boundingBox();assert(!!box,'Colonne Planning non mesurable');
  const beforeDraft=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
  const beforeDraftCount=Object.values(beforeDraft.weeks||{}).flat().length;
  await page.mouse.click(box.x+Math.min(60,box.width/2),box.y+220,{clickCount:2,delay:90});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:5000});
  await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(120);
  assert(await page.locator('#editorPopover.open').count()===1,'La bulle se ferme après redimensionnement du Dashboard');
  assert(await page.locator('.event-card.draft-preview').count()===1,'L’aperçu provisoire n’apparaît pas dès le double-clic');
  const whileDraft=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
  assert(Object.values(whileDraft.weeks||{}).flat().length===beforeDraftCount,'Le double-clic enregistre avant Terminé');
  await page.locator('#edTitle').selectOption('site-b');
  await page.locator('#edSite').fill('Contrôle sanitaires');
  await page.locator('#edStart').fill('11:00');
  await page.locator('#edEnd').fill('12:00');
  const previewText=(await page.locator('.event-card.draft-preview').innerText()).replace(/\s+/g,' ');
  assert(previewText.includes('11:00')&&previewText.includes('12:00')&&previewText.includes('Chantier Beta'),'L’aperçu provisoire ne suit pas les modifications de la bulle');
  await page.locator('#edDone').click();
  await page.locator('#editorPopover').waitFor({state:'hidden',timeout:1500});
  assert(await page.locator('.event-card').count()===1,'La tâche créée au double-clic n’apparaît pas immédiatement après Terminé');
  const visibleCard=page.locator('.event-card').first();
  const visual=await visibleCard.evaluate(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    const cx=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2));
    const cy=Math.max(0,Math.min(innerHeight-1,r.top+Math.min(r.height/2,20)));
    const top=document.elementFromPoint(cx,cy);
    return{
      width:r.width,height:r.height,top:r.top,left:r.left,
      display:s.display,visibility:s.visibility,opacity:s.opacity,zIndex:s.zIndex,
      hit:top===el||el.contains(top)
    };
  });
  assert(visual.width>10&&visual.height>10,'La carte existe mais n’a aucune taille visible');
  assert(visual.display!=='none'&&visual.visibility!=='hidden'&&Number(visual.opacity)>0,'La carte existe mais est cachée');
  assert(visual.hit,'La carte est rendue derrière un autre calque du Planning');

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
  let state=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
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
  state=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
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
  state=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
  rows=Object.values(state.weeks||{}).flat();
  const resized=rows.find(e=>e.id===modifiedId);
  assert(resized&&resized.end!==beforeEnd,'Redimensionnement non enregistré');

  // Menu agent : couleur et rythme uniquement
  await page.locator('.agent-row[data-agent-id="agent-a"]').click({button:'right'});
  await page.locator('#contextMenu.open').waitFor({state:'visible',timeout:5000});
  assert(await page.locator('#contextMenu .color-choice').count()>=1,'Palette couleur absente');
  assert(await page.locator('#contextMenu .planning-rhythm-choice').count()===2,'Rythme planning absent');
  assert(await page.locator('#contextMenu').getByText('Modifier le nom',{exact:true}).count()===0,'Fonction annexe Modifier le nom encore présente');
  assert(await page.locator('#contextMenu').getByText('Supprimer',{exact:true}).count()===0,'Fonction annexe Supprimer agent encore présente');
  await page.locator('#contextMenu .planning-rhythm-choice').nth(1).click();
  state=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
  assert(state.agents.find(a=>a.id==='agent-a')?.parityMode==='alternating','Rythme paire/impaire non enregistré');

  // Suppression d'une intervention
  card=page.locator('.event-card').first();cb=await card.boundingBox();assert(!!cb,'Tâche absente avant suppression');
  await page.mouse.click(cb.x+20,cb.y+12,{clickCount:2,delay:90});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:5000});
  const beforeCount=Object.values(await page.evaluate(()=>window.InovtecPlanningAPI.getState()).weeks||{}).flat().length;
  await page.locator('#edDelete').click();
  await page.locator('#editorPopover').waitFor({state:'hidden',timeout:5000});
  const afterCount=Object.values(await page.evaluate(()=>window.InovtecPlanningAPI.getState()).weeks||{}).flat().length;
  assert(afterCount===beforeCount-1,'Suppression intervention non enregistrée');

  // Aujourd'hui
  await page.locator('#todayBtn').click();
  assert((await page.locator('#periodLabel').innerText()).trim().length>0,'Bouton Aujourd’hui inactif');

  if(errors.length)throw Error('Erreur JavaScript : '+errors.join(' | '));
  console.log('OK : Planning direct — sans +Tâche, double-clic réel, brouillon, bulle, Terminé, édition, déplacement, redimensionnement, rythme et suppression.');
}catch(e){
  console.error('::error::Planning propre : '+e.message);
  process.exitCode=1;
}finally{
  await browser.close();
}
