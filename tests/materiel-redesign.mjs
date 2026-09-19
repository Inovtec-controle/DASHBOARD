import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const check=(value,message)=>{if(!value)throw Error(message)};
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1450,height:900}});
 await context.addInitScript(()=>{
  const items=[
   {id:'m_frange',name:'Frange microfibre 40 cm',category:'Franges',reference:'FM-040',quantity:48,minStock:20,status:'En stock',supplier:'Hygiene Pro',site:'Chantier Centre',price:6.5},
   {id:'m_chiffon',name:'Chiffon blanc',category:'Chiffons',reference:'CB-01',quantity:12,minStock:20,status:'En stock',supplier:'Clean Supply',site:'Chantier Gare',price:2},
   {id:'m_machine',name:'Autolaveuse T300',category:'Autolaveuses',reference:'AT-300',quantity:2,minStock:0,status:'En service',supplier:'Tennant',site:'Chantier Centre',nextMaintenance:new Date().toISOString().slice(0,10)}
  ];
  const doc={moduleSyncV1:{materiel:{payload:JSON.stringify({items})}}};
  const state={doc,writes:0,listeners:[]};window.__ivMaterialVisualTest=state;
  const snapshot=()=>({exists:true,data:()=>structuredClone(state.doc),metadata:{fromCache:false,hasPendingWrites:false}});
  const ref={onSnapshot(options,callback){const fn=typeof options==='function'?options:callback;state.listeners.push(fn);queueMicrotask(()=>fn(snapshot()));return()=>{}},set:async()=>{state.writes++}};
  const auth={currentUser:{uid:'test-user'},onAuthStateChanged(cb){queueMicrotask(()=>cb(this.currentUser));return()=>{}},signInWithEmailAndPassword:async()=>{}};
  const db={collection(name){if(name!=='kanban')throw Error('Collection incorrecte');return{doc:()=>ref}},runTransaction:async()=>{throw Error('Unexpected write in visual test')}};
  window.firebase={apps:[],initializeApp(){this.apps.push({})},auth:()=>auth,firestore:()=>db};
  window.INOVTEC_FIREBASE_CONFIG={projectId:'fake'};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/firebase-config.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.INOVTEC_FIREBASE_CONFIG={projectId:"fake"};'}));
 await page.goto('http://127.0.0.1:8765/MATERIEL-LEGACY.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.classList.contains('iv-material-v2')&&document.querySelectorAll('#rows tr').length===3);
 check(await page.locator('#kpiRefs').innerText()==='3','KPI references incorrect');
 check(await page.locator('#kpiLow').innerText()==='1','KPI stock faible incorrect');
 check(await page.locator('#ivLowList .iv-alert-row').count()===1,'Alerte stock absente');
 check(await page.locator('#ivMaintList .iv-alert-row').count()===1,'Maintenance absente');
 check(await page.locator('#ivDetailBody').innerText().then(t=>t.includes('Frange microfibre')),'Premier détail non chargé');
 await page.locator('#ivSiteFilter').selectOption('Chantier Gare');
 check(await page.locator('#rows tr:visible').count()===1,'Filtre chantier non appliqué');
 await page.locator('#rows tr:visible').click();
 check(await page.locator('#ivDetailBody').innerText().then(t=>t.includes('Chiffon blanc')),'Détail au clic incorrect');
 await page.locator('#ivClearFilters').click();
 check(await page.locator('#rows tr:visible').count()===3,'Réinitialisation des filtres incorrecte');
 await page.locator('#ivAddButton').click();
 check(await page.locator('.iv-editor').evaluate(e=>e.classList.contains('iv-editor-open')),'Formulaire ajout non ouvert');
 await page.locator('.iv-editor-close').click();
 await page.locator('#ivDetailBody [data-iv-action="fault"]').click();
 check(await page.locator('#status').inputValue()==='En panne','Signalement panne non prérempli');
 check(await page.locator('.iv-editor').evaluate(e=>e.classList.contains('iv-editor-open')),'Édition contextuelle non ouverte');
 check(await page.evaluate(()=>window.__ivMaterialVisualTest.writes)===0,'La consultation ne doit pas enregistrer de modification');
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(150);
 check(await page.locator('#ivAddButton').isVisible(),'Action ajout invisible sur mobile');
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Débordement horizontal sur mobile');
 check(errors.length===0,'Erreur navigateur : '+errors.join('; '));
 console.log('OK : Matériel V2, indicateurs réels, alertes, sélection, filtres, formulaire, panne et affichage mobile sans débordement.');
 await context.close();
}catch(e){console.error('ÉCHEC DESIGN MATÉRIEL : '+String(e?.stack||e));process.exitCode=1}finally{await browser.close()}
