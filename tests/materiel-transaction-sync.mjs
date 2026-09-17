import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const assert=(ok,message)=>{if(!ok)throw Error(message)};
try{
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.addInitScript(()=>{
  const first={id:'m_test',name:'Sacs aspirateur',quantity:9,minStock:3,price:10,updatedAt:'2026-09-17T08:00:00.000Z'};
  const state={doc:{moduleSyncV1:{materiel:{payload:JSON.stringify({items:[first]})},reassort:{payload:'{"orders":[{"id":"commande-conservee"}],"deliveries":[]}'}}},callbacks:[],cache:false,writes:0,oldWrites:0};
  window.__materialTest=state;
  const merge=(a,b)=>{for(const [k,v] of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge({...a[k]},v);else a[k]=v;}return a;};
  const snap=()=>({exists:true,data:()=>structuredClone(state.doc),metadata:{fromCache:state.cache,hasPendingWrites:false}});
  const emit=()=>queueMicrotask(()=>state.callbacks.forEach(cb=>cb(snap())));
  const ref={onSnapshot(options,callback){const fn=typeof options==='function'?options:callback;state.callbacks.push(fn);queueMicrotask(()=>fn(snap()));return()=>{state.callbacks=state.callbacks.filter(cb=>cb!==fn);}},get:async()=>snap(),set:async()=>{state.oldWrites++;throw Error('Ancien enregistrement non transactionnel interdit');}};
  const db={collection(name){assertName(name);return {doc(id){if(id!=='test-user')throw Error('Mauvais compte');return ref;}};},async runTransaction(fn){let update;const tx={get:async target=>{if(target!==ref)throw Error('Mauvaise source');return snap();},set:(target,data,opts)=>{if(target!==ref||!opts?.merge)throw Error('Écriture non atomique');update=data;}};const result=await fn(tx);if(update){merge(state.doc,update);state.writes++;emit();}return result;}};
  function assertName(name){if(name!=='kanban')throw Error('Collection inattendue : '+name);}
  const auth={currentUser:{uid:'test-user'},onAuthStateChanged(fn){queueMicrotask(()=>fn(this.currentUser));return()=>{};},signInWithEmailAndPassword:async()=>{}};
  window.firebase={apps:[],initializeApp(){this.apps.push({});},auth(){return auth;},firestore(){return db;}};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/firebase-config.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.INOVTEC_FIREBASE_CONFIG={projectId:"fake"};const materialSync=document.createElement("script");materialSync.src="inovtec-materiel-transactional-sync.js";document.head.appendChild(materialSync);'}));
 await page.goto('http://127.0.0.1:8765/MATERIEL-LEGACY.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#syncStatus')?.textContent?.includes('serveur confirmé'));
 assert(await page.locator('#rows tr').count()===1,'Inventaire Firebase non chargé');
 await page.locator('#name').fill('Balai neuf');await page.locator('#quantity').fill('2');await page.locator('#materialForm [type="submit"]').click();
 await page.waitForFunction(()=>JSON.parse(window.__materialTest.doc.moduleSyncV1.materiel.payload).items.length===2);
 let result=await page.evaluate(()=>({doc:window.__materialTest.doc,old:window.__materialTest.oldWrites,writes:window.__materialTest.writes}));
 assert(result.old===0&&result.writes===1,'Sauvegarde Matériel passée par l’ancien chemin non transactionnel');
 assert(JSON.parse(result.doc.moduleSyncV1.reassort.payload).orders[0].id==='commande-conservee','La sauvegarde Matériel a écrasé Réassort');
 await page.locator('button.edit[data-id="m_test"]').click();
 await page.evaluate(()=>{const state=window.__materialTest,material=JSON.parse(state.doc.moduleSyncV1.materiel.payload);material.items[0].quantity=11;material.items[0].updatedAt='2026-09-18T10:00:00.000Z';state.doc.moduleSyncV1.materiel.payload=JSON.stringify(material);state.callbacks.forEach(cb=>cb({exists:true,data:()=>structuredClone(state.doc),metadata:{fromCache:false,hasPendingWrites:false}}));});
 await page.locator('#quantity').fill('13');await page.locator('#materialForm [type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('#syncStatus')?.textContent?.includes('Fiche modifiée'));
 assert(await page.evaluate(()=>JSON.parse(window.__materialTest.doc.moduleSyncV1.materiel.payload).items[0].quantity)===11,'Une réception concurrente a été écrasée');
 await page.locator('button.edit[data-id="m_test"]').click();await page.locator('#quantity').fill('15');await page.locator('#materialForm [type="submit"]').click();
 await page.waitForFunction(()=>JSON.parse(window.__materialTest.doc.moduleSyncV1.materiel.payload).items[0].quantity===15);
 await page.evaluate(()=>{const state=window.__materialTest;state.cache=true;state.callbacks.forEach(cb=>cb({exists:true,data:()=>structuredClone(state.doc),metadata:{fromCache:true,hasPendingWrites:false}}));});
 const previous=await page.evaluate(()=>window.__materialTest.writes);
 await page.locator('#name').fill('Ne doit pas être enregistré');await page.locator('#materialForm [type="submit"]').click();
 assert(await page.evaluate(()=>window.__materialTest.writes)===previous,'Une écriture a été autorisée sans confirmation du serveur');
 assert(errors.length===0,'Erreurs JavaScript navigateur : '+errors.join(' ; '));
 console.log('OK : transactions Matériel, préservation Réassort, conflit inter-appareils détecté et sauvegardes hors ligne bloquées.');
 await context.close();
}catch(error){console.error('ÉCHEC MATÉRIEL : '+String(error?.stack||error));process.exitCode=1;}finally{await browser.close();}
