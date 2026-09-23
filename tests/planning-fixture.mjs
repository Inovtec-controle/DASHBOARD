import { chromium } from 'playwright';

const base='http://127.0.0.1:8765';
const key='inovtec_plannings_v2';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1365,height:900}});
const problems=[];
page.on('pageerror',e=>problems.push(String(e?.message||e)));
const assert=(value,message)=>{if(!value)throw new Error(message)};
try{
  await page.goto(base+'/PLANNINGS-LEGACY.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Boolean(document.querySelector('#week')?.value&&document.querySelector('#periodLabel')?.textContent?.trim()!=='—'),null,{timeout:30000});
  const week=await page.locator('#week').inputValue();
  const parity=Number(week.slice(-2))%2?'odd':'even';
  // Jeu d'essai isolé dans le navigateur du test : aucune donnée Firebase ni réelle.
  const fake={
    agents:[{id:'audit-agent',refId:'audit-agent',name:'Agent fictif',color:'#4f9f57',copies:2,parityMode:'alternating',parityTemplates:{even:parity==='even'?week:'',odd:parity==='odd'?week:''},parityInheritedWeeks:{}}],
    weeks:{[week]:[{id:'audit-intervention',agentId:'audit-agent',day:2,start:'09:00',end:'10:00',task:'Chantier fictif',site:'',chantierId:'',note:''}]},
    selected:'audit-agent'
  };
  await page.evaluate(([storage,value])=>localStorage.setItem(storage,JSON.stringify(value)),[key,fake]);
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.agent-row[data-agent-id="audit-agent"]').waitFor({state:'visible',timeout:15000});
  await page.locator('.agent-row[data-agent-id="audit-agent"]').click();
  await page.locator('.event-card[data-id="audit-intervention"]').waitFor({state:'visible',timeout:10000});
  console.log('OK : agent fictif sélectionné et intervention affichée');

  await page.locator('.event-card[data-id="audit-intervention"]').dblclick({timeout:10000});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:10000});
  await page.locator('#edStart').fill('09:30');
  await page.locator('#edEnd').fill('10:30');
  await page.locator('#edDone').click({timeout:10000});
  const edited=await page.evaluate(([storage,w])=>JSON.parse(localStorage.getItem(storage)).weeks[w].find(e=>e.id==='audit-intervention'),[key,week]);
  assert(edited?.start==='09:30'&&edited?.end==='10:30','La modification des heures n’a pas été sauvegardée');
  console.log('OK : modification et sauvegarde des horaires dans le planning');

  await page.locator('#nextBtn').click({timeout:10000});
  await page.locator('#nextBtn').click({timeout:10000});
  await page.waitForFunction(([storage,source])=>{
    const state=JSON.parse(localStorage.getItem(storage)||'{}');
    const current=document.getElementById('week')?.value;
    return current&&current!==source&&state.weeks?.[current]?.some(e=>e.agentId==='audit-agent'&&e._parityInheritedFrom===source);
  },[key,week],{timeout:10000});
  const inherited=await page.evaluate(storage=>{
    const state=JSON.parse(localStorage.getItem(storage));
    const week=document.getElementById('week').value;
    return state.weeks[week].find(e=>e.agentId==='audit-agent');
  },key);
  assert(inherited?.start==='09:30'&&inherited?.end==='10:30','Le report pair/impair ne reprend pas les heures modifiées');
  await page.locator('.event-card').first().waitFor({state:'visible',timeout:10000});
  console.log('OK : report vers la semaine de même parité, sans écraser le modèle');
  assert(!problems.length,'Erreur JavaScript du planning : '+problems.join('; '));
  console.log('BILAN PLANNING FICTIF : sélection, édition et report pair/impair réussis');
}catch(error){
  console.error('::error::Test planning fictif : '+error.message);
  process.exitCode=1;
}finally{await browser.close()}
