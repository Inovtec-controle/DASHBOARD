import { chromium } from 'playwright';

// Firebase simulé : les deux anciens documents refusent l'écriture,
// mais le document de secours autorisé reste accessible.
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
await context.addInitScript(()=>{
  const initial=[{id:'backup-test',title:'Conserver la modification',description:'',status:'todo',priority:'normal',dueDate:'',archived:false,archivedAt:'',createdAt:'2026-10-15T07:00:00.000Z',updatedAt:'2026-10-15T07:00:00.000Z'}];
  const state=JSON.parse(sessionStorage.getItem('ivFallbackTestState')||'null')||{
    personal:{tasks:initial},shared:{tasks:initial},fallback:null
  };
  const watchers={personal:[],shared:[],fallback:[]};
  const store=()=>sessionStorage.setItem('ivFallbackTestState',JSON.stringify(state));
  const key=(name,id)=>name==='kanban'?'personal':id==='__inovtec_organisation_tasks_v1__'?'fallback':'shared';
  const snap=k=>({exists:!!state[k],data:()=>state[k]||{},metadata:{fromCache:false,hasPendingWrites:false}});
  const db={collection:name=>({doc:id=>{
    const k=key(name,id);
    return {
      onSnapshot(cb){watchers[k].push(cb);queueMicrotask(()=>cb(snap(k)));return()=>{watchers[k]=watchers[k].filter(x=>x!==cb)};},
      get(){return Promise.resolve(snap(k));},
      set(data){
        if(k!=='fallback')return Promise.reject(Object.assign(Error('Document saturé'),{code:'resource-exhausted'}));
        if(sessionStorage.getItem('ivFallbackTestDeny')==='yes')return Promise.reject(Object.assign(Error('Document saturé'),{code:'resource-exhausted'}));
        state[k]={...(state[k]||{}),...JSON.parse(JSON.stringify(data))};store();
        queueMicrotask(()=>watchers[k].forEach(cb=>cb(snap(k))));
        return Promise.resolve();
      }
    };
  }})};
  const auth={currentUser:{uid:'mock-user'},onAuthStateChanged(cb){queueMicrotask(()=>cb(this.currentUser));return()=>{};},signOut(){return Promise.resolve()}};
  const firestore=()=>db;
  firestore.FieldValue={serverTimestamp:()=> 'mock-server-timestamp'};
  window.firebase={apps:[],initializeApp(){this.apps.push({})},auth:()=>auth,firestore};
  window.INOVTEC_FIREBASE_CONFIG={projectId:'test-only'};
  window.__ivFallbackTest={state};
});
const page=await context.newPage();
await page.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await page.route('**/firebase-config.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.INOVTEC_FIREBASE_CONFIG={projectId:"test-only"};'}));
page.on('dialog',dialog=>dialog.accept());
const errors=[];
page.on('pageerror',err=>errors.push(err.message));

try{
  await page.goto('http://127.0.0.1:8765/ORGANISATION-V17.html',{waitUntil:'domcontentloaded'});
  await page.locator('#app:not(.hidden)').waitFor();
  await page.locator('.task[data-id="backup-test"] .task-targets button[data-target-status="blocked"]').click();
  await page.waitForFunction(()=>document.getElementById('syncStatus')?.textContent.includes('Synchronisé (sauvegarde Firebase de secours)'));
  const persisted=await page.evaluate(()=>window.__ivFallbackTest.state.fallback?.tasks?.find(t=>t.id==='backup-test')?.status);
  if(persisted!=='blocked')throw Error('La modification n’a pas atteint le document de secours');

  // Le navigateur est rechargé : ne pas écraser le changement par l'ancienne copie kanban.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.task[data-id="backup-test"] .task-targets button[data-target-status="done"]').waitFor();
  const restored=await page.evaluate(()=>({status:document.getElementById('syncStatus')?.textContent||'',fallback:window.__ivFallbackTest.state.fallback?.tasks?.[0]?.status}));
  if(restored.fallback!=='blocked')throw Error('Données Firebase de secours perdues après actualisation');

  // Quand le document de secours échoue aussi, ne jamais afficher de fausse confirmation.
  await page.evaluate(()=>sessionStorage.setItem('ivFallbackTestDeny','yes'));
  await page.locator('.task[data-id="backup-test"] .task-targets button[data-target-status="done"]').click();
  await page.waitForFunction(()=>document.getElementById('syncStatus')?.textContent.includes('Enregistrement Firebase impossible'));
  const errorText=await page.locator('#syncStatus').textContent();
  if(!errorText.includes('document trop volumineux'))throw Error('Cause Firebase non expliquée : '+errorText);
  const remote=await page.evaluate(()=>window.__ivFallbackTest.state.fallback?.tasks?.[0]?.status);
  if(remote!=='blocked')throw Error('Échec Firebase a modifié les données serveur : '+remote);
  if(errors.length)throw Error('Erreur JavaScript : '+errors.join('; '));
  console.log('OK : bascule Firebase indépendante, relecture serveur, recharge et erreur explicite');
}finally{
  await context.close();
  await browser.close();
}
