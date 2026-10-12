import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1365,height:900},serviceWorkers:'block'});
const errors=[];
page.on('pageerror',error=>errors.push(String(error.message||error)));
await page.addInitScript(()=>{
  const originalRows=[
    {id:'leave-1',agentRefId:'one',agentName:'Mme Da Silva',type:'Congés payés',
     startDate:'2026-10-19',endDate:'2026-10-23',status:'pending',updatedAt:'2026-10-12T09:00:00Z'},
    {id:'leave-2',agentRefId:'two',agentName:'M. Martin',type:'Congés payés',
     startDate:'2026-11-03',endDate:'2026-11-09',status:'approved',updatedAt:'2026-10-11T09:00:00Z'},
    {id:'leave-3',agentRefId:'three',agentName:'Mme Lopez',type:'Absence',
     startDate:'2025-10-05',endDate:'2025-10-09',status:'approved',updatedAt:'2025-09-25T09:00:00Z'},
    {id:'leave-4',agentRefId:'four',agentName:'Mme Refusée',type:'Congés payés',
     startDate:'2026-11-10',endDate:'2026-11-12',status:'rejected'},
    {id:'leave-5',agentRefId:'five',agentName:'M. Annulé',type:'Congés payés',
     startDate:'2026-11-10',endDate:'2026-11-12',status:'cancelled'},
    {id:'leave-6',agentRefId:'six',agentName:'M. Supprimé',type:'Congés payés',
     startDate:'2026-11-10',endDate:'2026-11-12',status:'pending',deleted:true},
    {id:'leave-7',agentRefId:'seven',agentName:'<img src=x onerror=alert(1)>',type:'Test',
     startDate:'2027-04-01',endDate:'2027-04-03',status:'approved'},
    {id:'leave-1',agentRefId:'one',agentName:'Ancienne donnée',type:'Congés payés',
     startDate:'2026-10-19',endDate:'2026-10-23',status:'pending',updatedAt:'2026-10-11T09:00:00Z'}
  ];
  const store={users:[],snapshots:[],uid:'dashboard-demo',rows:originalRows,writes:0,unsubCount:0};
  store.emit=(metadata={fromCache:false,hasPendingWrites:false})=>{
    const entry={moduleSyncV1:{conges:{payload:JSON.stringify(store.rows)}}};
    const snap={exists:true,data:()=>entry,metadata};
    store.snapshots.forEach(c=>c(snap));
  };
  store.setRows=rows=>{store.rows=rows;store.emit()};
  store.auth=next=>{store.uid=next;store.users.forEach(cb=>cb(next?{uid:next}:null))};
  const auth={onAuthStateChanged(cb){store.users.push(cb);queueMicrotask(()=>cb({uid:store.uid}));return()=>{}}};
  const firestore={collection(name){
    if(name!=='kanban')throw Error('Unexpected Firestore collection: '+name);
    return{doc(uid){
      return{onSnapshot(opts,handler,errorHandler){
        if(uid!==store.uid)throw Error('Incorrect account for leave overview');
        const callback=typeof opts==='function'?opts:handler;
        store.snapshots.push(callback);
        queueMicrotask(()=>store.emit());
        return()=>{store.snapshots=store.snapshots.filter(x=>x!==callback);store.unsubCount++};
      }};
    }};
  }};
  window.__leaveDashboardTest=store;
  window.firebase={apps:[{}],auth:()=>auth,firestore:()=>firestore};
  window.INOVTEC_FIREBASE_CONFIG={projectId:'fixture'};
});
await page.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
await page.route('**/*.js*',route=>{
  if(route.request().url().includes('/dashboard-conges-overview.js'))return route.continue();
  return route.fulfill({status:200,contentType:'application/javascript',body:''});
});
try{
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#c3LeavesAllCount')?.textContent==='4',{timeout:10000});
  const assert=(value,message)=>{if(!value)throw Error(message)};
  assert(await page.locator('#c3LeavesPendingCount').innerText()==='1','Une demande à valider attendue');
  assert(await page.locator('#c3LeavesApprovedCount').innerText()==='3','Trois demandes approuvées attendues');
  assert(await page.locator('#c3LeavesRows .c3-leaves-row').count()===4,'Toutes les périodes doivent être visibles, y compris les anciennes');
  assert((await page.locator('#c3LeavesRows .c3-leaves-row').first().innerText()).includes('Mme Da Silva'),'La demande en attente doit apparaître en premier');
  assert(!(await page.locator('#c3LeavesRows').innerText()).includes('Ancienne donnée'),'Ne pas montrer un doublon obsolète');
  assert(!(await page.locator('#c3LeavesRows').innerText()).includes('Refusée'),'Ne pas afficher les demandes refusées');
  assert(await page.locator('#c3LeavesRows img').count()===0,'Les noms sont insérés en texte sans HTML');
  assert(await page.locator('.c3-leaves-status.pending').count()===1,'La demande à valider doit être identifiée');

  await page.locator('[data-leave-filter="pending"]').click();
  assert(await page.locator('#c3LeavesRows .c3-leaves-row').count()===1,'Filtre en attente incorrect');
  assert(await page.locator('[data-leave-filter="pending"]').getAttribute('aria-pressed')==='true','Bouton de filtre non sélectionné');

  // Modification confirmée par Firebase sans rechargement.
  await page.evaluate(()=>{
    const s=window.__leaveDashboardTest;
    s.rows=s.rows.filter(x=>x.agentName!=='Ancienne donnée').map(x=>x.id==='leave-1'?{...x,status:'approved',updatedAt:'2026-10-12T13:00:00Z'}:x);
    s.emit();
  });
  await page.waitForFunction(()=>document.querySelector('#c3LeavesPendingCount')?.textContent==='0');
  assert(await page.locator('#c3LeavesApprovedCount').innerText()==='4','Le compteur des congés validés ne se met pas à jour');
  assert((await page.locator('#c3LeavesRows').innerText()).includes('Aucune demande en attente'),'Le filtre doit rester actif après changement');

  await page.locator('[data-leave-filter="approved"]').click();
  assert(await page.locator('#c3LeavesRows .c3-leaves-row').count()===4,'Les congés validés ne sont pas tous affichés');

  // Les snapshots provenant uniquement du cache ne doivent pas valider artificiellement des congés.
  await page.evaluate(()=>{
    const s=window.__leaveDashboardTest;
    s.rows=[{id:'new',agentName:'Cache uniquement',status:'pending',startDate:'2026-10-20',endDate:'2026-10-21'}];
    s.emit({fromCache:true,hasPendingWrites:false});
  });
  assert(await page.locator('#c3LeavesAllCount').innerText()==='4','Un cache non confirmé a remplacé les valeurs Firebase');
  assert(!(await page.locator('#c3LeavesRows').innerText()).includes('Cache uniquement'),'Un cache non confirmé apparaît comme acquis');

  // Une déconnexion ne doit jamais laisser les congés de l'ancien compte affichés.
  await page.evaluate(()=>window.__leaveDashboardTest.auth(null));
  await page.waitForFunction(()=>document.querySelector('#c3LeavesAllCount')?.textContent==='—');
  assert(!(await page.locator('#c3LeavesRows').innerText()).includes('Mme Da Silva'),'Le tableau doit être nettoyé à la déconnexion');
  assert(await page.evaluate(()=>window.__leaveDashboardTest.unsubCount)>0,'L’ancien abonnement doit être coupé');

  // Vérification de l'affichage mobile réel de la nouvelle carte.
  await page.setViewportSize({width:390,height:844});
  const size=await page.locator('.c3-leaves-panel').boundingBox();
  assert(size?.width>0&&size.width<=390,'La carte doit tenir dans une largeur mobile');
  if(errors.length)throw Error('Erreurs JavaScript : '+errors.join('; '));
  console.log('OK : dashboard congés Firebase live, toutes périodes, filtres, statuts, dédoublonnage, protection cache, déconnexion et mobile');
}finally{
  await browser.close();
}
