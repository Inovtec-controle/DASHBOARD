import { chromium } from 'playwright';

const base='http://127.0.0.1:8765';
const key='inovtec_plannings_v2';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1365,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));

await page.addInitScript(()=>{
  window.InovtecDataHub={
    readyAgents:true,
    readyChantiers:true,
    agents:[
      {id:'rollback-agent-1',identity:{prenom:'Agent',nom:'Un'}},
      {id:'rollback-agent-2',identity:{prenom:'Agent',nom:'Deux'}}
    ],
    chantiers:[
      {id:'rollback-site-a',nom:'Chantier A',adresse:'1 rue A'},
      {id:'rollback-site-b',nom:'Chantier B',adresse:'2 rue B'}
    ],
    subscribe(){return()=>{}}
  };
  localStorage.setItem('inovtec_plannings_v2',JSON.stringify({
    agents:[
      {id:'rollback-agent-1',refId:'rollback-agent-1',name:'Agent Un',color:'#4f9f57',copies:2,parityMode:'standard',parityTemplates:{even:'',odd:''},parityInheritedWeeks:{}},
      {id:'rollback-agent-2',refId:'rollback-agent-2',name:'Agent Deux',color:'#4f8fd8',copies:2,parityMode:'standard',parityTemplates:{even:'',odd:''},parityInheritedWeeks:{}}
    ],
    weeks:{},
    selected:null
  }));
});

const getState=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}'),key);
const events=s=>Object.values(s.weeks||{}).flat();

try{
  await page.goto(base+'/PLANNINGS-LEGACY.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.agent-row[data-agent-id="rollback-agent-1"]').waitFor({state:'visible',timeout:15000});

  await page.locator('.agent-row[data-agent-id="rollback-agent-1"]').click();
  const firstDay=page.locator('.day-column').first();
  await firstDay.dblclick({position:{x:60,y:300},timeout:10000});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  await page.locator('#edTitle').selectOption('rollback-site-a');
  await page.locator('#edStart').fill('09:00');
  await page.locator('#edEnd').fill('10:00');
  await page.locator('#edSite').fill('Tâche agent 1');
  await page.locator('#edDone').click();
  await page.waitForFunction(()=>!document.getElementById('editorPopover')?.classList.contains('open'),null,{timeout:5000});
  let s=await getState(), rows=events(s);
  if(rows.length!==1||rows[0].agentId!=='rollback-agent-1'||rows[0].chantierId!=='rollback-site-a')throw Error('Création agent 1 incorrecte');
  console.log('OK : création par double-clic sur le premier planning');

  await page.locator('.agent-row[data-agent-id="rollback-agent-2"]').click();
  await page.locator('.day-column').nth(1).dblclick({position:{x:60,y:340},timeout:10000});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  await page.locator('#edTitle').selectOption('rollback-site-b');
  await page.locator('#edStart').fill('11:00');
  await page.locator('#edEnd').fill('12:00');
  await page.locator('#edDone').click();
  await page.waitForFunction(()=>!document.getElementById('editorPopover')?.classList.contains('open'),null,{timeout:5000});
  s=await getState();rows=events(s);
  if(rows.length!==2||!rows.some(e=>e.agentId==='rollback-agent-2'&&e.chantierId==='rollback-site-b'))throw Error('Création agent 2 incorrecte');
  console.log('OK : création sur un deuxième planning');

  await page.locator('.agent-row[data-agent-id="rollback-agent-1"]').click();
  await page.locator('.event-card').first().dblclick({timeout:10000});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  await page.locator('#edStart').fill('08:30');
  await page.locator('#edEnd').fill('10:15');
  await page.locator('#edDone').click();
  await page.waitForFunction(()=>!document.getElementById('editorPopover')?.classList.contains('open'),null,{timeout:5000});
  s=await getState();rows=events(s);
  if(!rows.some(e=>e.agentId==='rollback-agent-1'&&e.start==='08:30'&&e.end==='10:15'))throw Error('Modification non enregistrée');
  console.log('OK : modification et fermeture avec Terminé');

  await page.locator('.agent-row[data-agent-id="rollback-agent-2"]').click();
  await page.locator('.event-card').first().dblclick({timeout:10000});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  page.once('dialog',d=>d.accept());
  await page.locator('#edDelete').click();
  await page.waitForFunction(()=>!document.getElementById('editorPopover')?.classList.contains('open'),null,{timeout:5000});
  s=await getState();rows=events(s);
  if(rows.length!==1||rows[0].agentId!=='rollback-agent-1')throw Error('Suppression incorrecte');
  if(errors.length)throw Error('Erreur JavaScript : '+errors.join('; '));
  console.log('OK : suppression ciblée sans toucher à l’autre planning');
  console.log('BILAN ROLLBACK PLANNING : création, multi-agents, édition et suppression réussies');
}catch(error){
  console.error('::error::Rollback Planning : '+error.message);
  process.exitCode=1;
}finally{
  await browser.close();
}
