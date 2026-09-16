import { chromium } from 'playwright';

// Un service tiers qui ne repond pas ne doit pas bloquer le calendrier.
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:1365,height:900},serviceWorkers:'block'});
const page = await context.newPage();
let intercepted = false;
const errors=[];
page.on('pageerror',error=>errors.push(String(error.message||error)));
await page.route('**/jspdf.umd.min.js', async route=>{
  intercepted=true;
  await new Promise(resolve=>setTimeout(resolve,15000));
  await route.abort().catch(()=>{});
});
try{
  await page.goto('http://127.0.0.1:8765/PLANNINGS.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>{
    const frame=document.getElementById('legacyFrame');
    const inner=frame?.contentDocument;
    const period=inner?.getElementById('periodLabel')?.textContent?.trim();
    const loading=document.getElementById('loading');
    return Boolean(loading?.classList.contains('hidden') && inner?.getElementById('calendarViewport') && period && period!=='—');
  },null,{timeout:12000});
  if(!intercepted)throw new Error('Le blocage de la bibliotheque PDF n\u2019a pas ete simule');
  const state=await page.evaluate(()=>({
    loaderHidden:document.getElementById('loading')?.classList.contains('hidden'),
    period:document.getElementById('legacyFrame')?.contentDocument?.getElementById('periodLabel')?.textContent?.trim(),
    pdfReady:!!document.getElementById('legacyFrame')?.contentWindow?.jspdf
  }));
  if(!state.loaderHidden||!state.period||state.period==='—')throw new Error('Calendrier inaccessible');
  if(state.pdfReady)throw new Error('Le test n\u2019a pas maintenu la bibliotheque PDF en attente');
  if(errors.some(s=>/(?:TypeError|ReferenceError|SyntaxError)/i.test(s)))throw new Error('Erreur JavaScript : '+errors.join(' ; '));
  console.log('OK : calendrier visible malgré un service PDF externe bloqué');
  console.log('OK : la génération PDF ne bloque plus l’ouverture du planning');
}catch(error){
  console.error('ÉCHEC : planning toujours bloqué au chargement : '+String(error?.message||error));
  process.exitCode=1;
}finally{
  await context.close();
  await browser.close();
}
