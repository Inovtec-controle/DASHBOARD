import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const config=readFileSync('firebase-config.js','utf8');
if(!config.includes('inovtec-common-header.js?v=20260917-common-header1'))throw Error('En-tête non chargé via la configuration commune');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 for(const kind of ['shell','material','home','reassort']){
  await page.goto('http://127.0.0.1:8765/tests/common-header-fixture.html?kind='+kind,{waitUntil:'load'});
  const tile=page.locator('.iv-header-tile');
  await tile.waitFor({state:'visible'});
  if(await tile.count()!==1)throw Error(kind+': composant absent ou dupliqué');
  const date=await tile.locator('.iv-head-date').innerText(),time=await tile.locator('.iv-head-time').innerText();
  if(!date.match(/\d{4}/)||!time.match(/\d{2}:\d{2}/))throw Error(kind+': date ou heure absente '+date+' '+time);
  if(await tile.locator('.iv-head-mark').innerText()!=='✓')throw Error(kind+': coche absente');
  if(['shell','material'].includes(kind)){
   if(await tile.locator('#dateLabel').count()!==1||await tile.locator('#timeLabel').count()!==1)throw Error(kind+': identifiants de l’horloge détruits');
  }
  const duplicate=await page.evaluate(async()=>{await import('../inovtec-common-header.js?v=reloaded');return document.querySelectorAll('.iv-header-tile').length});
  if(duplicate!==1)throw Error(kind+': l’injection répétée dédouble le composant');
  await page.setViewportSize({width:390,height:780});
  const fits=await tile.evaluate(el=>{const rect=el.getBoundingClientRect();return rect.left>=-1&&rect.right<=innerWidth+1&&rect.width>=150});
  if(!fits)throw Error(kind+': le cadre déborde de l’écran mobile');
  await page.setViewportSize({width:1280,height:850});
 }
 console.log('OK : cadre date/heure et coche uniques sur Accueil, pages communes, Matériel et Réassort ; identifiants conservés, mobile sans débordement.');
}finally{await browser.close()}
