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
    get(){return Promise.resolve({empty:false,docs:[],size:0});},
    onSnapshot(cb){queueMicrotask(()=>cb({docs:[]}));return()=>{};},
    limit(){return {get:()=>Promise.resolve({empty:false,docs:[snap(state.shared)]})};},
    where(){return {get:()=>Promise.resolve({empty:true,docs:[],size:0}),onSnapshot(cb){queueMicrotask(()=>cb({docs:[]}));return()=>{};},limit(){return this;}};},
    orderBy(){return {get:()=>Promise.resolve({empty:true,docs:[],size:0}),onSnapshot(cb){queueMicrotask(()=>cb({docs:[]}));return()=>{};},limit(){return this;}};}
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
  // Parcours réel utilisateur : Accueil -> menu reconstruit -> Organisation autonome.
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:30000});
  const organisation=page.locator('a[data-iv-menu-key="organisation"]').first();
  await organisation.waitFor({timeout:10000});
  const href=await organisation.getAttribute('href');
  if(!href?.includes('ORGANISATION-LIVE-V16.html'))throw Error('Le menu réellement visible ne pointe pas vers Organisation LIVE v16 : '+href);
  if(href?.includes('inovtec-page-shell.html')||href?.includes('ORGA-LEGACY'))throw Error('Le menu visible repasse encore par l’ancien shell : '+href);

  await organisation.click();
  await page.waitForURL(/ORGANISATION-LIVE-V16\.html/i,{timeout:10000});
  await page.locator('#app:not(.hidden)').waitFor({timeout:10000});
  await page.locator('.task[data-id="shell-move"]').waitFor({timeout:10000});

  const buildText=(await page.locator('#orgaBoardBuild').textContent()||'').trim();
  if(buildText!=='LIVE v16')throw Error('La page visible n’est pas Organisation LIVE v16 : '+buildText);

  // Déplacement réel à la souris dans la page réellement ouverte depuis l'accueil.
  const source=await page.locator('.task[data-id="shell-move"]').boundingBox();
  const target=await page.locator('.column[data-status="blocked"]').boundingBox();
  if(!source||!target)throw Error('Zones de déplacement Organisation LIVE introuvables');
  await page.mouse.move(source.x+source.width/2,source.y+Math.min(30,source.height/3));
  await page.mouse.down();
  await page.mouse.move(target.x+target.width/2,target.y+Math.max(55,target.height-18),{steps:10});
  await page.mouse.up();
  await page.locator('.task-list[data-status="blocked"] .task[data-id="shell-move"]').waitFor({timeout:5000});

  // Archivage sur cette même page autonome.
  await page.locator('.task[data-id="shell-archive"]').getByRole('button',{name:'Archiver'}).click();
  await page.locator('#board .task[data-id="shell-archive"]').waitFor({state:'detached',timeout:5000});
  await page.locator('#archiveList').getByText('Archiver depuis le shell').waitFor({state:'visible',timeout:5000});

  const writes=await page.evaluate(()=>window.__orgaShellTest?.writes||0);
  if(writes<2)throw Error('Les actions Organisation LIVE ne sont pas envoyées à Firebase');

  // Même un ancien accès ORGA.html doit quitter définitivement l'ancien shell.
  const legacy=await context.newPage();
  await legacy.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await legacy.goto('http://127.0.0.1:8765/ORGA.html',{waitUntil:'domcontentloaded',timeout:30000});
  await legacy.waitForURL(/ORGANISATION-LIVE-V16\.html/i,{timeout:10000});
  const legacyBuild=(await legacy.locator('#orgaBoardBuild').textContent()||'').trim();
  if(legacyBuild!=='LIVE v16')throw Error('ORGA.html ne mène pas à la nouvelle page autonome');
  await legacy.close();

  if(errors.length)throw Error('JavaScript : '+errors.join('; '));
  console.log('OK : accueil réel -> menu visible -> Organisation LIVE v16 -> déplacement -> Firebase');
}finally{
  await context.close();
  await browser.close();
}
