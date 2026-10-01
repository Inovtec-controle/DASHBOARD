import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1365,height:900}});

await context.addInitScript(()=>{
  const initialTasks=[
    {id:'shell-move',title:'Déplacer depuis le shell',description:'',status:'todo',priority:'normal',dueDate:'',archived:false,archivedAt:'',createdAt:'2026-09-29T08:00:00.000Z',updatedAt:'2026-09-29T08:00:00.000Z'},
    {id:'shell-archive',title:'Archiver depuis le shell',description:'',status:'done',priority:'normal',dueDate:'',archived:false,archivedAt:'',createdAt:'2026-09-29T08:00:00.000Z',updatedAt:'2026-09-29T08:00:00.000Z'}
  ];
  const state={personal:{tasks:initialTasks},shared:{},listeners:{kanban:[],chantiers:[]},writes:0};
  window.__orgaShellTest=state;
  const snap=data=>({exists:!!data,data:()=>data||{},metadata:{fromCache:false,hasPendingWrites:false}});
  const notify=(name)=>queueMicrotask(()=>state.listeners[name].forEach(cb=>{
    cb(snap(name==='kanban'?state.personal:state.shared));
  }));
  const collection=name=>({
    doc:id=>({
      onSnapshot(cb){state.listeners[name]?.push(cb);queueMicrotask(()=>cb(snap(name==='kanban'?state.personal:state.shared)));return()=>{};},
      get(){return Promise.resolve(snap(name==='kanban'?state.personal:state.shared));},
      set(data){
        state.writes++;
        if(name==='kanban')state.personal={...(state.personal||{}),...JSON.parse(JSON.stringify(data))};
        else state.shared={...(state.shared||{}),...JSON.parse(JSON.stringify(data))};
        notify(name);
        return Promise.resolve();
      }
    }),
    limit(){return {get:()=>Promise.resolve({empty:false,docs:[snap(state.shared)]})};},
    orderBy(){return {onSnapshot(cb){queueMicrotask(()=>cb({docs:[]}));return()=>{};}};}
  });
  const db={collection,batch(){return {set(){},commit(){return Promise.resolve();}}}};
  const auth={
    currentUser:{uid:'test-user'},
    onAuthStateChanged(cb){queueMicrotask(()=>cb(this.currentUser));return()=>{};},
    signOut(){this.currentUser=null;return Promise.resolve();},
    setPersistence(){return Promise.resolve();},
    signInWithEmailAndPassword(){this.currentUser={uid:'test-user'};return Promise.resolve({user:this.currentUser});}
  };
  function firestore(){return db;}
  firestore.FieldValue={serverTimestamp:()=> 'test-server-timestamp'};
  const firebase={apps:[],initializeApp(){this.apps.push({})},auth:()=>auth,firestore};
  firebase.auth.Auth={Persistence:{LOCAL:'local',SESSION:'session',NONE:'none'}};
  window.firebase=firebase;
  window.INOVTEC_FIREBASE_CONFIG={projectId:'test-only'};
});

const page=await context.newPage();
await page.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
page.on('dialog',dialog=>dialog.accept());
const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));

try{
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:30000});
  const organisation=page.locator('a[data-iv-menu-key="organisation"]').first();
  await organisation.waitFor({timeout:10000});
  const href=await organisation.getAttribute('href');
  if(!href?.includes('ORGA-LEGACY.html%3Fv%3D20261001-organisation6'))throw Error('Le menu global pointe encore vers une ancienne version Organisation : '+href);
  if(!href?.includes('build=20261001-organisation6'))throw Error('Le shell Organisation utilise encore un ancien build : '+href);

  await organisation.click();
  await page.waitForURL(/inovtec-page-shell\.html.*mode=organisation/i,{timeout:10000});
  const frame=page.frameLocator('#legacyFrame');
  await frame.locator('#app:not(.hidden)').waitFor({timeout:10000});
  await frame.locator('.task[data-id="shell-move"]').waitFor({timeout:10000});

  await page.waitForFunction(()=>window.InovtecHeaderSyncState?.state==='connected',null,{timeout:12000}).catch(async error=>{
    const diagnostic=await page.evaluate(()=>({
      header:window.InovtecHeaderSyncState||null,
      mark:document.querySelector('.iv-head-mark')?.dataset?.state||'absent',
      markTitle:document.querySelector('.iv-head-mark')?.title||'',
      health:window.InovtecFirebaseOperational||null,
      mirror:document.getElementById('syncMirror')?.textContent||'',
      frameStatus:document.getElementById('legacyFrame')?.contentDocument?.getElementById('syncStatus')?.textContent||''
    }));
    throw Error('Symbole Firebase du bandeau non validé : '+JSON.stringify(diagnostic)+' · '+error.message);
  });

  await frame.locator('.task[data-id="shell-move"]').dragTo(frame.locator('.task-list[data-status="blocked"]'));
  await frame.locator('.task-list[data-status="blocked"] .task[data-id="shell-move"]').waitFor({timeout:5000});

  await frame.locator('.task[data-id="shell-archive"]').getByRole('button',{name:'Archiver'}).click();
  await frame.locator('#board .task[data-id="shell-archive"]').waitFor({state:'detached',timeout:5000});
  await frame.locator('#ivArchiveButton').waitFor({timeout:5000});
  await frame.locator('#ivArchiveButton').click();
  await frame.locator('#ivArchiveModal.iv-open').waitFor({timeout:5000});
  await frame.locator('#archiveList').getByText('Archiver depuis le shell').waitFor({state:'visible',timeout:5000});

  const writes=await frame.locator('body').evaluate(()=>window.__orgaShellTest?.writes||0);
  if(writes<2)throw Error('Les actions Organisation du shell ne sont pas envoyées à Firebase');
  if(errors.length)throw Error('JavaScript : '+errors.join('; '));
  console.log('OK : vraie navigation Organisation, indicateur Firebase, déplacement et archivage via le shell');
}finally{
  await context.close();
  await browser.close();
}
