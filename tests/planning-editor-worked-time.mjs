import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1400,height:950},serviceWorkers:'block'});
await context.addInitScript(()=>{
 const agents=[{id:'test-agent',identity:{prenom:'Agent',nom:'Fictif'},displayName:'Agent Fictif'}];
 const sites=[{id:'test-site',nom:'Résidence fictive',adresse:'Adresse fictive'}];
 window.InovtecDataHub={
  readyAgents:true,readyChantiers:true,agents,chantiers:sites,
  subscribe(fn){fn?.({agents,chantiers:sites,readyAgents:true,readyChantiers:true});return()=>{}}
 };
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e.message||e)));
await page.route('**/inovtec-data-hub.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
await page.route('**/planning-firebase-direct-v2.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.__INOVTEC_PLANNING_FIREBASE_DIRECT_V1__=true;'}));
await page.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
try{
 await page.goto('http://127.0.0.1:8765/PLANNINGS-APP.html?mode=planning',{waitUntil:'domcontentloaded'});
 await page.locator('.agent-row[data-agent-id="test-agent"]').waitFor({timeout:15000});
 await page.evaluate(()=>{
  const day=new Date(),pad=n=>String(n).padStart(2,'0');
  const x=new Date(day.getFullYear(),day.getMonth(),day.getDate());
  x.setDate(x.getDate()+3-(x.getDay()+6)%7);
  const y=new Date(x.getFullYear(),0,4);
  const week=x.getFullYear()+'-W'+pad(1+Math.round(((x-y)/86400000-3+(y.getDay()+6)%7)/7));
  const currentDay=(day.getDay()+6)%7;
  window.__workedTimeFixture={week,currentDay};
  window.InovtecPlanningAPI.replaceState({
   agents:[{id:'test-agent',refId:'test-agent',name:'Agent Fictif',copies:2,parityMode:'standard'}],
   weeks:{[week]:[
    {id:'work-a',agentId:'test-agent',day:currentDay,start:'08:00',end:'17:00',task:'Résidence fictive',chantierId:'test-site'},
    {id:'break-a',agentId:'test-agent',day:currentDay,start:'12:00',end:'13:00',task:'Pause'}
   ]},
   selected:'test-agent'
  },{persist:false});
 });
 const work=page.locator('.event-card[data-id="work-a"]');
 await work.waitFor({state:'visible',timeout:10000});
 await work.dispatchEvent('dblclick',{clientX:400,clientY:400});
 await page.locator('#editorPopover.open').waitFor({state:'visible',timeout:5000});
 const start=await page.locator('#edStart').inputValue(),end=await page.locator('#edEnd').inputValue();
 if(start!=='08:00'||end!=='17:00')throw Error('Les horaires du créneau ont été modifiés : '+start+' '+end);
 const box=page.locator('#ivEditorWorkedTime');
 await box.waitFor({state:'visible',timeout:5000});
 await page.waitForFunction(()=>document.querySelector('#ivEditorWorkedTime')?.textContent?.includes('8h00 ce jour'),null,{timeout:5000});
 const initial=await box.innerText();
 if(!initial.includes('8h00 cette semaine'))throw Error('PDF et bulle ne calculent pas les mêmes heures : '+initial);
 await page.locator('#edEnd').fill('18:00');
 await page.waitForFunction(()=>document.querySelector('#ivEditorWorkedTime')?.textContent?.includes('9h00 ce jour'),null,{timeout:5000});
 await page.locator('#edEnd').fill('17:00');
 await page.waitForFunction(()=>document.querySelector('#ivEditorWorkedTime')?.textContent?.includes('8h00 cette semaine'),null,{timeout:5000});
 const result=await page.evaluate(()=>{
  const s=window.InovtecPlanningAPI.getState(),{week,currentDay}=window.__workedTimeFixture;
  const rows=s.weeks[week].filter(e=>e.day===currentDay);
  return {totalPDF:window.InovtecPlanningPDF.workedDayMinutes(rows),
    savedEnd:rows.find(e=>e.id==='work-a')?.end,
    visible:document.getElementById('ivEditorWorkedTime')?.textContent};
 });
 if(result.totalPDF!==480||result.savedEnd!=='17:00')throw Error('Le PDF ou le planning a été modifié : '+JSON.stringify(result));
 if(errors.length)throw Error('JavaScript : '+errors.join(' ; '));
 console.log('OK : bulle Planning 08h–17h et PDF 8h00 effectives après pause ; recalcul en direct sans modifier les données.');
}finally{await browser.close()}
