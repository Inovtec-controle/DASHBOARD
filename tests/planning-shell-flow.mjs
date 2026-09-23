import { chromium } from 'playwright';

const base='http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1365,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));

try{
  await page.goto(base+'/PLANNINGS.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#legacyFrame').waitFor({state:'attached',timeout:15000});
  const frame=page.frameLocator('#legacyFrame');
  await frame.locator('#addTaskBtn').waitFor({state:'visible',timeout:20000});
  await frame.locator('#calendarViewport').waitFor({state:'visible',timeout:20000});
  await frame.locator('#periodLabel').waitFor({state:'visible',timeout:20000});

  const ready=await frame.locator('body').evaluate(()=>{
    const period=document.getElementById('periodLabel')?.textContent?.trim();
    const viewport=document.getElementById('calendarViewport');
    return !!(period&&period!=='—'&&viewport?.children.length);
  });
  if(!ready)throw Error('Le calendrier intégré ne termine pas son rendu');

  await page.waitForTimeout(21000);

  const fallback=await page.getByText('Le planning ne parvient pas à s’ouvrir dans le tableau de bord.').count();
  if(fallback)throw Error('Le faux écran de secours recouvre encore le Planning');

  const hidden=await page.locator('#loading').evaluate(el=>el.classList.contains('hidden')||el.getAttribute('aria-hidden')==='true');
  if(!hidden)throw Error('Le masque de chargement reste affiché sur le Planning');

  if(errors.length)throw Error('Erreur JavaScript : '+errors.join('; '));
  console.log('OK : Planning intégré chargé et aucun fallback ne revient après 20 secondes');
}catch(error){
  console.error('::error::Planning shell : '+error.message);
  process.exitCode=1;
}finally{
  await browser.close();
}
