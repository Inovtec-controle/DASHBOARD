import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1400,height:950}});
const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
let alertMessages=[];page.on('dialog',async d=>{alertMessages.push(d.message());await d.accept()});
try{
 await page.goto('http://127.0.0.1:8765/__period_test_empty__.html',{waitUntil:'domcontentloaded'});
 await page.setContent('<div class="calendar-toolbar"></div><div id="calendarViewport"></div><div id="agentList"></div><div id="contextMenu"></div>');
 await page.evaluate(()=>{
   const events={
     '2026-W42':[
       {id:'site-a-mon',agentId:'original',chantierId:'site-a',task:'Résidence A',site:'Entretien escaliers',day:0,start:'09:00',end:'11:00'},
       {id:'site-a-tue',agentId:'original',chantierId:'site-a',task:'Résidence A',site:'Entretien escaliers',day:1,start:'09:00',end:'11:00'},
       {id:'site-a-wed',agentId:'original',chantierId:'site-a',task:'Résidence A',site:'Entretien escaliers',day:2,start:'09:00',end:'11:00'},
       {id:'site-b-mon',agentId:'original',chantierId:'site-b',task:'Résidence B',site:'Nettoyage',day:0,start:'14:00',end:'15:00'},
       {id:'busy-alpha',agentId:'alpha',chantierId:'other',task:'Autre chantier',site:'Mission existante',day:2,start:'09:30',end:'10:30'}
     ]
   };
   const state={p:{
     agents:[{id:'original',name:'Agent absente',refId:'original-ref'},
       {id:'alpha',name:'Agent Alpha'},
       {id:'beta',name:'Agent Bêta'}],
     selected:'original',weeks:events
   },leaves:[{id:'conge-period',agentRefId:'original-ref',agentName:'Agent absente',status:'approved',
     startDate:'2026-10-12',endDate:'2026-10-16',type:'Congés payés'}],
     callbacks:[],writes:0};
   state.doc={moduleSyncV1:{conges:{payload:JSON.stringify(state.leaves)}}};
   window.__periodTest=state;
   window.InovtecPlanningAPI={getState:()=>state.p,replaceState:next=>{state.writes++;state.p=next}};
   window.firebase={
     auth:()=>({onAuthStateChanged:cb=>{queueMicrotask(()=>cb({uid:'period-test'}));return()=>{}}}),
     firestore:()=>({collection:()=>({doc:()=>({onSnapshot:cb=>{
       state.callbacks.push(cb);queueMicrotask(()=>cb({exists:true,data:()=>state.doc}));
       return()=>{};
     }})})})
   };
 });
 await page.addScriptTag({url:'http://127.0.0.1:8765/planning-replacement.js?v=period-test'});
 await page.evaluate(()=>{
   const menu=document.getElementById('contextMenu');
   menu.className='agent-context open';menu.dataset.agentId='original';
   menu.appendChild(document.createElement('span'));
 });
 await page.locator('.iv-optimal-replacement').click();
 await page.locator('.iv-period-card').first().waitFor();
 const groups=page.locator('.iv-period-card');
 if(await groups.count()!==2)throw Error('Les chantiers ne sont pas regroupés : attendu 2 cartes');
 if(await page.locator('.iv-period-exception').count()!==0)throw Error('Affichage jour par jour encore visible par défaut');
 const a=groups.filter({hasText:'Résidence A'}),b=groups.filter({hasText:'Résidence B'});
 if(await a.count()!==1||await b.count()!==1)throw Error('Le regroupement par chantier est erroné');
 if(!(await a.locator('.iv-period-head small').first().innerText()).includes('3 interventions'))throw Error('Le nombre et la période du chantier A manquent');
 const alphaFull=a.locator('.iv-period-agent option[value="alpha"]');
 if(!await alphaFull.evaluate(option=>option.disabled))throw Error('Un agent en conflit est proposé pour la période entière');
 if(await a.locator('.iv-period-agent').inputValue()!=='beta')
   throw Error('La meilleure proposition de remplacement complet devrait être Bêta');

 // Répartir uniquement les 12 et 13 octobre à Alpha, puis garder Bêta le 14.
 await a.getByRole('button',{name:'Répartir la période'}).click();
 await a.locator('.iv-period-dates input').nth(0).fill('2026-10-12');
 await a.locator('.iv-period-dates input').nth(0).dispatchEvent('change');
 await a.locator('.iv-period-dates input').nth(1).fill('2026-10-13');
 await a.locator('.iv-period-dates input').nth(1).dispatchEvent('change');
 await a.locator('.iv-period-range select').selectOption('alpha');
 await a.getByRole('button',{name:'Attribuer cette plage'}).click();
 if(await a.locator('.iv-period-agent').inputValue()!=='')
   throw Error('Une période répartie entre plusieurs agents est faussement présentée comme uniforme');

 // Ajustement exceptionnel d'un seul jour, sans modifier les autres dates.
 await a.getByRole('button',{name:'Modifier certains jours'}).click();
 if(await a.locator('.iv-period-exception').count()!==3)throw Error('Les exceptions ne sont pas affichées');
 await a.locator('.iv-period-exception select').nth(1).selectOption('beta');
 const ready=await page.locator('#ivApplyReplacements').isEnabled();
 if(!ready)throw Error('La période complète correctement couverte doit être applicable');

 // Un autre utilisateur ajoute un conflit au dernier moment : aucune écriture ne doit passer.
 await page.evaluate(()=>{
   window.__periodTest.p.weeks['2026-W42'].push({id:'busy-beta',agentId:'beta',day:2,start:'09:15',end:'10:00',task:'Urgence'});
 });
 await page.locator('#ivApplyReplacements').click();
 if(await page.evaluate(()=>window.__periodTest.writes)!==0)
   throw Error('Une modification partielle a été enregistrée malgré un conflit');
 if(!alertMessages.some(m=>m.includes('Conflit')))throw Error('Le conflit au moment de la validation n’a pas été signalé');

 // La période reste sélectionnée. Après suppression du conflit, un seul enregistrement.
 await page.evaluate(()=>{window.__periodTest.p.weeks['2026-W42']=window.__periodTest.p.weeks['2026-W42'].filter(e=>e.id!=='busy-beta')});
 await page.locator('#ivApplyReplacements').click();
 const result=await page.evaluate(()=>({writes:window.__periodTest.writes,rows:window.__periodTest.p.weeks['2026-W42']}));
 if(result.writes!==1)throw Error('La validation doit enregistrer une seule modification globale');
 const byId=id=>result.rows.find(e=>e.id===id);
 for(const [id,agent] of [['site-a-mon','alpha'],['site-a-tue','beta'],['site-a-wed','beta']]){
   if(byId(id)?.agentId!==agent)throw Error('Mauvais remplaçant sur '+id);
   if(byId(id)?._replacementFor?.leaveId!=='conge-period')throw Error('Historique de remplacement absent : '+id);
 }
 if(byId('busy-alpha')?.agentId!=='alpha')throw Error('L’intervention existante a été modifiée');
 if(result.rows.filter(e=>e.agentId==='original').length!==0)throw Error('Des interventions n’ont pas été remplacées');
 if(errors.length)throw Error('JavaScript : '+errors.join('; '));
 console.log('OK : chantiers regroupés, remplacement sur période, plages partielles, exception, conflit et sauvegarde globale unique');
}finally{await browser.close()}
