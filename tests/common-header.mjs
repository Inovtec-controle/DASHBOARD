import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const config=readFileSync('firebase-config.js','utf8');
if(!config.includes('inovtec-common-header.js?v=20260917-planning-background1'))throw Error('Nouvelle version de l’en-tête non chargée via la configuration commune');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 let referenceBackground='';
 for(const kind of ['shell','material','home','reassort']){
  await page.goto('http://127.0.0.1:8765/tests/common-header-fixture.html?kind='+kind,{waitUntil:'load'});
  const hero=page.locator(kind==='home'?'.c3-hero-banner':kind==='reassort'?'.shell .hero':'.iv-shell .iv-hero');
  const tile=page.locator('.iv-header-tile');
  await tile.waitFor({state:'visible'});
  if(await tile.count()!==1)throw Error(kind+': composant absent ou dupliqué');
  const date=await tile.locator('.iv-head-date').innerText(),time=await tile.locator('.iv-head-time').innerText();
  if(!date.match(/\d{4}/)||!time.match(/\d{2}:\d{2}/))throw Error(kind+': date ou heure absente '+date+' '+time);
  if(await tile.locator('.iv-head-mark').innerText()!=='✓')throw Error(kind+': coche absente');
  if(['shell','material'].includes(kind)){
   if(await tile.locator('#dateLabel').count()!==1||await tile.locator('#timeLabel').count()!==1)throw Error(kind+': identifiants de l’horloge détruits');
  }
  const background=await hero.evaluate(el=>getComputedStyle(el).backgroundImage);
  if(!background.includes('linear-gradient')||!background.includes('6, 78, 59')||!background.includes('5, 102, 71')||!background.includes('12, 122, 87'))throw Error(kind+': fond Planning non appliqué '+background);
  if(!referenceBackground)referenceBackground=background;
  else if(background!==referenceBackground)throw Error(kind+': le fond diffère du Planning');
  const backdrop=page.locator('.iv-shared-backdrop');
  if(await backdrop.count()!==(['home','reassort'].includes(kind)?1:0))throw Error(kind+': motifs géométriques absents ou en double');
  if(kind==='home'){
   const titleColor=await hero.locator('h1').evaluate(el=>getComputedStyle(el).color);
   if(titleColor!=='rgb(255, 255, 255)')throw Error('Accueil : titre illisible sur le fond vert '+titleColor);
  }
  const duplicate=await page.evaluate(async()=>{await import('../inovtec-common-header.js?v=reloaded');return document.querySelectorAll('.iv-header-tile').length});
  if(duplicate!==1)throw Error(kind+': l’injection répétée dédouble le composant');
  await page.setViewportSize({width:390,height:780});
  const fits=await tile.evaluate(el=>{const rect=el.getBoundingClientRect();return rect.left>=-1&&rect.right<=innerWidth+1&&rect.width>=150});
  if(!fits)throw Error(kind+': le cadre déborde de l’écran mobile');
  await page.setViewportSize({width:1280,height:850});
 }
 console.log('OK : fond et motifs du Planning identiques sur Accueil, pages communes, Matériel et Réassort ; horloge unique, textes lisibles, mobile sans débordement.');
}finally{await browser.close()}
