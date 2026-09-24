import { chromium } from 'playwright';

const base='http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1365,height:900},serviceWorkers:'block'});
await context.addInitScript(()=>{
  const agents=[{id:'rec-agent',identity:{prenom:'Agent',nom:'Récurrence'},displayName:'Agent Récurrence'}];
  const chantiers=[{id:'rec-site',nom:'Chantier Récurrence',adresse:'1 rue Test'}];
  window.InovtecDataHub={
    readyAgents:true,readyChantiers:true,agents,chantiers,
    subscribe(fn){fn?.({agents,chantiers,readyAgents:true,readyChantiers:true});return()=>{}}
  };
});
const page=await context.newPage();
await page.route('**/inovtec-data-hub.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
await page.route('**/planning-firebase-direct-v2.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.__INOVTEC_PLANNING_FIREBASE_DIRECT_V1__=true;'}));
await page.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
page.on('dialog',async d=>{if(d.type()==='confirm')await d.accept();else await d.dismiss()});
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const mondayIndex=d=>(d.getDay()+6)%7;
const isoWeekKey=d=>{
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  x.setDate(x.getDate()+3-mondayIndex(x));
  const y=new Date(x.getFullYear(),0,4);
  const w=1+Math.round(((x-y)/86400000-3+mondayIndex(y))/7);
  return x.getFullYear()+'-W'+String(w).padStart(2,'0');
};
const current=new Date();
const week0=isoWeekKey(current),week1=isoWeekKey(addDays(current,7)),week2=isoWeekKey(addDays(current,14)),week3=isoWeekKey(addDays(current,21));
const row=(id,start='09:00',end='10:00',task='Chantier Récurrence')=>({id,agentId:'rec-agent',day:1,start,end,task,site:'',chantierId:'rec-site',note:''});

try{
  await page.goto(base+'/PLANNINGS-APP.html?mode=planning&v=recurrence-test',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('.agent-row[data-agent-id="rec-agent"]').waitFor({state:'visible',timeout:15000});

  // STANDARD : la semaine suivante hérite, puis une modification devient le nouveau modèle.
  await page.evaluate(({week0,row0})=>{
    window.InovtecPlanningAPI.replaceState({
      agents:[{id:'rec-agent',refId:'rec-agent',name:'Agent Récurrence',color:'#4f9f57',copies:2,parityMode:'standard',parityTemplates:{even:'',odd:''},parityInheritedWeeks:{}}],
      weeks:{[week0]:[row0]},
      selected:'rec-agent'
    },{persist:false});
  },{week0,row0:row('std-0')});
  await page.locator('#todayBtn').click();
  await page.locator('#nextBtn').click();
  let state=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
  let inherited=(state.weeks?.[week1]||[]).find(e=>e.agentId==='rec-agent');
  assert(inherited&&inherited._standardInheritedFrom===week0,'Standard : la semaine suivante n’hérite pas du modèle');

  const card=page.locator('.event-card').first();
  await card.dblclick({timeout:8000});
  await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:5000});
  await page.locator('#edStart').fill('10:30');
  await page.locator('#edEnd').fill('11:30');
  await page.locator('#edDone').click();
  await page.locator('#editorPopover').waitFor({state:'hidden',timeout:5000});
  state=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
  assert(state.standardRecurrence?.['rec-agent']?.template===week1,'Standard : la dernière semaine modifiée ne devient pas le modèle');

  await page.locator('#nextBtn').click();
  state=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
  inherited=(state.weeks?.[week2]||[]).find(e=>e.agentId==='rec-agent');
  assert(inherited&&inherited.start==='10:30'&&inherited.end==='11:30'&&inherited._standardInheritedFrom===week1,'Standard : le nouveau modèle n’est pas reporté sur la semaine suivante');
  console.log('OK : récurrence standard et nouveau modèle');

  // PAIRE / IMPAIRE : chaque parité conserve son propre modèle.
  const kind=w=>Number(w.slice(-2))%2?'odd':'even';
  const templates={even:'',odd:''};
  templates[kind(week0)]=week0;
  templates[kind(week1)]=week1;
  await page.evaluate(({week0,week1,templates,row0,row1})=>{
    window.InovtecPlanningAPI.replaceState({
      agents:[{id:'rec-agent',refId:'rec-agent',name:'Agent Récurrence',color:'#4f9f57',copies:2,parityMode:'alternating',parityTemplates:templates,parityInheritedWeeks:{}}],
      weeks:{[week0]:[row0],[week1]:[row1]},
      selected:'rec-agent'
    },{persist:false});
  },{week0,week1,templates,row0:row('par-0','08:00','09:00'),row1:row('par-1','13:00','14:00')});
  await page.locator('#todayBtn').click();
  await page.locator('#nextBtn').click();
  await page.locator('#nextBtn').click();
  state=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
  let same=(state.weeks?.[week2]||[]).find(e=>e.agentId==='rec-agent');
  assert(same&&same.start==='08:00'&&same._parityInheritedFrom===week0,'Paire/impaire : la semaine de même parité n’utilise pas le bon modèle');
  await page.locator('#nextBtn').click();
  state=await page.evaluate(()=>window.InovtecPlanningAPI.getState());
  same=(state.weeks?.[week3]||[]).find(e=>e.agentId==='rec-agent');
  assert(same&&same.start==='13:00'&&same._parityInheritedFrom===week1,'Paire/impaire : le modèle de l’autre parité n’est pas respecté');
  console.log('OK : récurrence paire/impaire sur les bonnes semaines');

  console.log('BILAN RECURRENCE PLANNING : standard + paire/impaire validés');
}catch(error){
  console.error('::error::Récurrence Planning : '+String(error?.message||error));
  process.exitCode=1;
}finally{
  await context.close();
  await browser.close();
}
