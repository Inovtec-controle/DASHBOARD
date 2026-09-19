import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const check=(value,message)=>{if(!value)throw Error(message)};
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1450,height:900}});
 await context.addInitScript(()=>{
  const items=[
   {id:'m_frange',name:'Frange microfibre 40 cm',category:'Franges',reference:'FM-040',quantity:48,minStock:20,status:'En stock',supplier:'Hygiene Pro',site:'Bureau',price:6.5},
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
 await page.waitForFunction(()=>document.body.classList.contains('iv-office-mode')&&document.querySelector('#ivOfficeTotal')?.textContent==='48');
 check(await page.locator('#kpiRefs').textContent()==='3','Références historiques perdues');
 check(await page.locator('#ivOfficeRows tr').count()===1,'Une référence chantier apparaît au stock du bureau');
 check(await page.locator('#ivOfficeLegacyCount').textContent()==='2','Affectations historiques non isolées');
 check(await page.locator('#ivOfficeAvailable').textContent()==='48','Stock disponible au bureau incorrect');
 check(await page.locator('#ivOfficeRows').innerText().then(t=>t.includes('Frange microfibre')),'Référence centrale absente');
 await page.locator('#search').fill('produit absent');
 check(await page.locator('#ivOfficeRows .iv-office-empty').count()===1,'Recherche stock bureau non appliquée');
 await page.locator('#search').fill('');
 check(await page.locator('#ivOfficeRows tr').count()===1,'Réinitialisation recherche bureau incorrecte');
 await page.locator('#ivAddButton').evaluate(element=>element.click());
 check(await page.locator('.iv-editor').evaluate(e=>e.classList.contains('iv-editor-open')),'Formulaire ajout non ouvert');
 check(await page.locator('#site').inputValue()==='Bureau','Localisation bureau non proposée par défaut');
 await page.locator('.iv-editor-close').click();
 check(await page.evaluate(()=>window.__ivMaterialVisualTest.writes)===0,'La consultation ne doit pas enregistrer de modification');
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(180);
 check(await page.locator('#ivOfficeIn').isVisible(),'Action réception invisible sur mobile');
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Débordement horizontal sur mobile');
 check(errors.length===0,'Erreur navigateur : '+errors.join('; '));
 console.log('OK : tableau bureau, affectations conservées, recherche, fiche ajout et affichage mobile sans débordement.');
 await context.close();
}catch(e){console.error('ÉCHEC DESIGN MATÉRIEL : '+String(e?.stack||e));process.exitCode=1}finally{await browser.close()}
