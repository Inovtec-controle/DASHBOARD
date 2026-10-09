import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
let failures=0;

try{
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(()=>{
    const personal={tasks:[
      {id:'move-1',title:'Tâche à déplacer',description:'',status:'todo',priority:'normal',dueDate:'',archived:false,archivedAt:'',createdAt:'2026-09-28T08:00:00.000Z',updatedAt:'2026-09-28T08:00:00.000Z'},
      {id:'archive-1',title:'Tâche à archiver',description:'',status:'done',priority:'normal',dueDate:'',archived:false,archivedAt:'',createdAt:'2026-09-28T08:00:00.000Z',updatedAt:'2026-09-28T08:00:00.000Z'}
    ]};
    localStorage.setItem('orga_task_board_v2',JSON.stringify(personal.tasks));
    const state={personal,shared:{tasks:JSON.parse(JSON.stringify(personal.tasks))},writes:[],listeners:[]};
    window.__orgaActionsTest=state;
    const snap=()=>({exists:true,data:()=>state.personal,metadata:{hasPendingWrites:false}});
    const db={collection:name=>({doc:id=>({
      onSnapshot(cb){if(name==='kanban'){state.listeners.push(cb);queueMicrotask(()=>cb(snap()))}return()=>{}},
      get(){return Promise.resolve(name==='kanban'?snap():{exists:!!state.shared,data:()=>state.shared||{},metadata:{hasPendingWrites:false}})},
      set(data){state.writes.push({name,id,data:JSON.parse(JSON.stringify(data))});if(name==='kanban'){state.personal={...(state.personal||{}),...data};queueMicrotask(()=>state.listeners.forEach(cb=>cb(snap())))}else if(name==='chantiers'){state.shared={...(state.shared||{}),...JSON.parse(JSON.stringify(data))}}return Promise.resolve()}
    })})};
    const firebase={apps:[],initializeApp(){this.apps.push({})},auth(){return {onAuthStateChanged(cb){queueMicrotask(()=>cb({uid:'test-user'}));return()=>{}},signOut(){return Promise.resolve()}}},firestore(){return db}};
    firebase.firestore.FieldValue={serverTimestamp:()=> 'test-server-timestamp'};
    window.firebase=firebase;
    window.INOVTEC_FIREBASE_CONFIG={projectId:'test-only'};
  });

  const page=await context.newPage();
  await page.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/firebase-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.INOVTEC_FIREBASE_CONFIG={projectId:"test-only"};'}));
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());

  await page.goto('http://127.0.0.1:8765/ORGANISATION-LIVE-V16.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#app:not(.hidden)').waitFor({timeout:10000});
  const liveBuild=(await page.locator('#orgaBoardBuild').textContent()||'').trim();
  if(liveBuild!=='LIVE v16')throw Error('La page autonome Organisation v16 n’est pas chargée : '+liveBuild);

  // 1. Le bouton de déplacement reste cliquable dans une carte draggable.
  const moveCard=page.locator('.task[data-id="move-1"]');
  await moveCard.locator('.task-actions button').first().click();
  await page.waitForFunction(()=>window.__orgaActionsTest.personal.tasks.find(t=>t.id==='move-1')?.status==='inprogress');

  // 2. Vrai geste souris (pointer events) : ne dépend plus du drag HTML5 du navigateur.
  const sourceBox=await page.locator('.task[data-id="move-1"] .task-title').boundingBox();
  const targetBox=await page.locator('.column[data-status="blocked"]').boundingBox();
  if(!sourceBox||!targetBox)throw Error('Zones de déplacement Organisation introuvables');
  await page.mouse.move(sourceBox.x+sourceBox.width/2,sourceBox.y+sourceBox.height/2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x+targetBox.width/2,targetBox.y+Math.max(55,targetBox.height-18),{steps:10});
  if(await page.locator('.task-drag-ghost').count()!==1)throw Error('La bulle fantôme de déplacement ne s’affiche pas');
  // Sauvegarder uniquement lorsque la bulle est déposée dans sa nouvelle colonne.
  await page.mouse.up();
  await page.waitForFunction(()=>window.__orgaActionsTest.personal.tasks.find(t=>t.id==='move-1')?.status==='blocked');
  if(await page.locator('.task-list[data-status="blocked"] .task[data-id="move-1"]').count()!==1)throw Error('La tâche déplacée n’apparaît pas dans Bloqué');

  // 2b. Deuxième déplacement réel à la souris pour vérifier que le moteur
  // continue de fonctionner après un premier rendu/ré-enregistrement Firebase.
  const secondSource=await page.locator('.task[data-id="move-1"]').boundingBox();
  const boardBox=await page.locator('#board').boundingBox();
  if(!secondSource||!boardBox)throw Error('Zones du second déplacement introuvables');
  await page.mouse.move(secondSource.x+secondSource.width/2,secondSource.y+Math.min(30,secondSource.height/3));
  await page.mouse.down();
  // Faire défiler le tableau horizontalement vers une colonne encore masquée.
  await page.mouse.move(boardBox.x+boardBox.width-8,secondSource.y+25,{steps:10});
  await page.waitForTimeout(400);
  const secondTarget=await page.locator('.column[data-status="done"]').boundingBox();
  if(!secondTarget)throw Error('Colonne Fait introuvable après défilement');
  await page.mouse.move(Math.min(secondTarget.x+secondTarget.width/2,boardBox.x+boardBox.width-20),secondTarget.y+Math.max(55,secondTarget.height-18),{steps:10});
  await page.mouse.up();
  await page.waitForFunction(()=>window.__orgaActionsTest.personal.tasks.find(t=>t.id==='move-1')?.status==='done');
  if(await page.locator('.task-list[data-status="done"] .task[data-id="move-1"]').count()!==1)throw Error('Le second déplacement souris ne persiste pas');

  // 3. Archiver doit fonctionner même si la carte est draggable.
  const archiveCard=page.locator('.task[data-id="archive-1"]');
  await archiveCard.getByRole('button',{name:'Archiver'}).click();
  await page.waitForFunction(()=>window.__orgaActionsTest.personal.tasks.find(t=>t.id==='archive-1')?.archived===true);
  if(await page.locator('#board .task[data-id="archive-1"]').count()!==0)throw Error('La tâche archivée reste dans le tableau');
  if(await page.locator('#archiveList').getByText('Tâche à archiver').count()!==1)throw Error('La tâche archivée n’apparaît pas dans les archives');

  // 4. Restaurer remet la tâche dans son statut précédent.
  await page.locator('#archiveList').getByRole('button',{name:'Restaurer'}).click();
  await page.waitForFunction(()=>window.__orgaActionsTest.personal.tasks.find(t=>t.id==='archive-1')?.archived===false);
  const restored=await page.evaluate(()=>window.__orgaActionsTest.personal.tasks.find(t=>t.id==='archive-1'));
  if(restored.status!=='done')throw Error('La restauration ne conserve pas le statut précédent');

  const result=await page.evaluate(()=>({writes:window.__orgaActionsTest.writes.length,status:document.querySelector('#syncStatus')?.textContent||'',personal:window.__orgaActionsTest.personal.tasks,shared:window.__orgaActionsTest.shared.tasks}));
  if(result.writes<10)throw Error('Toutes les actions n’ont pas été persistées dans les deux copies Firebase');
  if(JSON.stringify(result.personal)!==JSON.stringify(result.shared))throw Error('La copie Firebase partagée ne suit pas les actions Organisation');
  if(errors.length)throw Error('JavaScript : '+errors.join('; '));
  console.log('OK : déplacements souris répétés, archivage et restauration Organisation');
  console.log('Écritures Firebase simulées : '+result.writes+' · '+result.status);
  await context.close();
}catch(error){
  failures++;
  console.error('ÉCHEC Organisation actions : '+String(error?.message||error));
}finally{
  await browser.close();
}
if(failures)process.exitCode=1;
