import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1365,height:950},serviceWorkers:'block'});
await context.addInitScript(()=>{
  const agents=[{id:'agent-one',identity:{prenom:'Agent',nom:'Test'},displayName:'Agent Test'}];
  const sites=[{id:'site-one',nom:'Résidence Test',adresse:'1 rue Test'}];
  window.InovtecDataHub={readyAgents:true,readyChantiers:true,agents,chantiers:sites,
    subscribe(fn){fn({agents,chantiers:sites,readyAgents:true,readyChantiers:true});return()=>{}}};
  localStorage.setItem('inovtec_plannings_v2',JSON.stringify({
    agents:[{id:'agent-one',refId:'agent-one',name:'Agent Test',color:'#4f9f57',copies:2,parityMode:'standard',parityTemplates:{even:'',odd:''},parityInheritedWeeks:{}}],
    selected:'agent-one',weeks:{}
  }));
});
const page=await context.newPage();
const errors=[],alerts=[];
page.on('pageerror',e=>errors.push(String(e.message||e)));
page.on('dialog',async d=>{alerts.push(d.message());await d.dismiss()});
await page.route('**/inovtec-data-hub.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
await page.route('**/planning-firebase-direct-v2.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.__INOVTEC_PLANNING_FIREBASE_DIRECT_V1__=true;'}));
await page.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
try{
  await page.goto('http://127.0.0.1:8765/PLANNINGS-APP.html?mode=planning&v=special-regression',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('.agent-row[data-agent-id="agent-one"]').waitFor({timeout:12000});
  await page.locator('.agent-row[data-agent-id="agent-one"]').click();
  await page.locator('.view-tab[data-view="week"]').click();
  const created=[];
  for(const [kind,label] of [['break','Pause'],['travel','Déplacement']]){
    const col=page.locator('.day-column').nth(kind==='break'?1:2);
    const rect=await col.boundingBox();
    if(!rect)throw Error('Impossible de créer une intervention test');
    await page.mouse.click(rect.x+Math.min(48,rect.width/2),rect.y+210,{clickCount:2,delay:90});
    await page.locator('#editorPopover.open').waitFor({timeout:4000});
    await page.locator('[data-iv-special="'+kind+'"]').click();
    if(await page.locator('#editorPopover').getAttribute('data-iv-special-kind')!==label)
      throw Error('La sélection '+label+' n’est pas conservée');
    await page.locator('#edTitle').evaluate(select=>{
      // Reproduction d’une synchronisation Infos chantier qui vide le sélecteur.
      select.replaceChildren(new Option('Choisir un chantier…',''));
      select.value='';
    });
    await page.locator('#edDone').click();
    await page.locator('#editorPopover').waitFor({state:'hidden',timeout:4000});
    const events=await page.evaluate(()=>Object.values(window.InovtecPlanningAPI.getState().weeks||{}).flat());
    if(events.filter(e=>e.task===label&&e.chantierId==='').length!==1)
      throw Error('La tâche '+label+' sans chantier n’est pas enregistrée correctement : '+JSON.stringify(events));
    created.push(label);
  }
  if(alerts.some(x=>/chantier/i.test(x)))throw Error('Demande de chantier injustifiée : '+alerts.join('; '));
  const all=await page.evaluate(()=>Object.values(window.InovtecPlanningAPI.getState().weeks||{}).flat());
  if(all.length!==2||created.length!==2)throw Error('Les deux tâches ne sont pas conservées');
  if(errors.length)throw Error('Erreur JS : '+errors.join('; '));
  console.log('OK : création Pause + Déplacement sans chantier, même après rafraîchissement du sélecteur Infos chantier');
}finally{await browser.close()}
