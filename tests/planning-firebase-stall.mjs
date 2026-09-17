import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1365,height:900},serviceWorkers:'block'});
const page=await context.newPage();
const errors=[];
let firebaseHeld=false;
let fontHeld=false;
page.on('pageerror',error=>errors.push(String(error?.message||error)));
const hold=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await page.route('**/firebase-app-compat.js',async route=>{
  firebaseHeld=true;
  await hold(20000);
  await route.abort().catch(()=>{});
});
await page.route('https://fonts.googleapis.com/**',async route=>{
  fontHeld=true;
  await hold(20000);
  await route.abort().catch(()=>{});
});
try{
  // waitUntil:commit permet d'observer le calendrier AVANT la fin du chargement de Firebase.
  await page.goto('http://127.0.0.1:8765/PLANNINGS.html',{waitUntil:'commit',timeout:12000});
  await page.waitForFunction(()=>{
    const frame=document.getElementById('legacyFrame');
    const doc=frame?.contentDocument;
    const period=doc?.getElementById('periodLabel')?.textContent?.trim();
    const viewport=doc?.getElementById('calendarViewport');
    return Boolean(document.getElementById('loading')?.classList.contains('hidden')
      &&period&&period!=='—'&&viewport?.children.length&&!viewport.querySelector('.planning-render-error'));
  },null,{timeout:10000});
  if(!firebaseHeld)throw new Error('Le script Firebase externe n’a pas été intercepté');
  if(!fontHeld)throw new Error('Le chargement de police externe n’a pas été intercepté');
  if(errors.some(s=>/(?:TypeError|ReferenceError|SyntaxError)/i.test(s)))throw new Error('Erreur JavaScript : '+errors.join(' ; '));
  console.log('OK : le planning s’affiche avant la réponse de Firebase et des polices externes');
}catch(error){
  console.error('::error::Le planning attend encore une dépendance externe : '+String(error?.message||error));
  process.exitCode=1;
}finally{
  await context.close();
  await browser.close();
}
