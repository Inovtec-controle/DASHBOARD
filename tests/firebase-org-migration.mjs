import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const scenarios = [
  {name:'Reprise locale lorsque Firebase est vide',personal:null,shared:null,local:[{id:'local-1',title:'Tâche locale',status:'todo'}],expectedWrites:1,expectedId:'local-1'},
  {name:'Ne pas écraser les tâches partagées',personal:null,shared:{tasks:[{id:'shared-1',title:'Tâche partagée',status:'todo'}]},local:[{id:'stale-1',title:'Ancienne tâche',status:'todo'}],expectedWrites:0,expectedId:'stale-1'},
  {name:'Ne pas rétablir les tâches volontairement supprimées',personal:null,shared:{tasks:[]},local:[{id:'deleted-1',title:'Ancienne tâche',status:'todo'}],expectedWrites:0,expectedId:'deleted-1'},
  {name:'Priorité aux tâches déjà présentes dans Firebase',personal:{tasks:[{id:'remote-1',title:'Tâche distante',status:'todo'}]},shared:null,local:[{id:'stale-2',title:'Ancienne tâche',status:'todo'}],expectedWrites:0,expectedId:'remote-1'}
];
let failures=0;
try {
  for(const sc of scenarios){
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.addInitScript(testCase=>{
      localStorage.setItem('orga_task_board_v2',JSON.stringify(testCase.local));
      const personal=testCase.personal?JSON.parse(JSON.stringify(testCase.personal)):null;
      const shared=testCase.shared?JSON.parse(JSON.stringify(testCase.shared)):null;
      const state={personal,shared,writes:[],listeners:[]};
      window.__firebaseOrgTest=state;
      const snap=(name)=>{
        const data=name==='kanban'?state.personal:state.shared;
        return {exists:!!data,data:()=>data||{},metadata:{hasPendingWrites:false}};
      };
      const db={collection:name=>({doc:id=>({
        onSnapshot(cb){if(name==='kanban'){state.listeners.push(cb);queueMicrotask(()=>cb(snap(name)))}return()=>{}},
        get(){return Promise.resolve(snap(name))},
        set(data){state.writes.push({name,id,data});if(name==='kanban')state.personal={...(state.personal||{}),...data};else state.shared={...(state.shared||{}),...data};if(name==='kanban')queueMicrotask(()=>state.listeners.forEach(cb=>cb(snap(name))));return Promise.resolve()}
      })})};
      const firebase={apps:[],initializeApp(){this.apps.push({})},auth(){return {onAuthStateChanged(cb){queueMicrotask(()=>cb({uid:'test-user'}));return()=>{}},signOut(){return Promise.resolve()}}},firestore(){return db}};
      firebase.firestore.FieldValue={serverTimestamp:()=> 'test-server-timestamp'};
      window.firebase=firebase;
      window.INOVTEC_FIREBASE_CONFIG={projectId:'test-only'};
    },sc);
    const page=await context.newPage();
    await page.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.route('**/firebase-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.INOVTEC_FIREBASE_CONFIG={projectId:"test-only"};'}));
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.goto('http://127.0.0.1:8765/ORGA-LEGACY.html',{waitUntil:'domcontentloaded',timeout:30000});
      await page.locator('#app:not(.hidden)').waitFor({timeout:10000});
      await page.waitForFunction(expected=>{
        const test=window.__firebaseOrgTest;
        return test && (expected===0?document.querySelector('#syncStatus')?.textContent?.includes('partagées') || document.querySelector('#syncStatus')?.textContent?.includes('Synchronisé'):test.writes.length>=expected);
      },sc.expectedWrites,{timeout:10000});
      const result=await page.evaluate(()=>({
        writes:window.__firebaseOrgTest.writes.map(w=>({name:w.name,id:w.id,tasks:w.data.tasks})),
        items:JSON.parse(localStorage.getItem('orga_task_board_v2')||'[]'),
        status:document.querySelector('#syncStatus')?.textContent||''
      }));
      if(errors.length)throw Error('JavaScript : '+errors.join('; '));
      if(result.writes.length!==sc.expectedWrites)throw Error('Écritures Firebase : '+result.writes.length+' au lieu de '+sc.expectedWrites);
      if(result.writes.some(w=>w.name!=='kanban'||w.id!=='test-user'))throw Error('Mauvaise collection ou mauvais compte');
      if(result.writes.length && result.writes[0].tasks?.[0]?.id!=='local-1')throw Error('Migration locale incorrecte');
      if(result.items?.[0]?.id!==sc.expectedId)throw Error('Liste locale remplacée à tort : '+JSON.stringify(result.items));
      console.log('OK : '+sc.name);
    }catch(error){failures++;console.error('ÉCHEC : '+sc.name+' : '+String(error?.message||error));}
    finally {await context.close()}
  }
}finally {await browser.close()}
console.log('BILAN FIREBASE ORGANISATION : '+(failures?failures+' anomalie(s)':'4 scénarios validés avec des données fictives'));
if(failures)process.exitCode=1;
