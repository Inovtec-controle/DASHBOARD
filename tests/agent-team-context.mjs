import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1365,height:900},serviceWorkers:'block'});
 page.on('pageerror',error=>console.error('ERREUR PAGE',String(error)));
 await page.addInitScript(()=>{
  try{
   if(!localStorage.getItem('kontrol_agents_classeur_v2')){
    const now=new Date().toISOString();
    localStorage.setItem('kontrol_agents_classeur_v2',JSON.stringify([
     {id:'test_team_agent_1',identity:{prenom:'Camille',nom:'Test'},job:{},docs:[],incidents:[],createdAt:now,updatedAt:now},
     {id:'test_team_agent_2',identity:{prenom:'Alex',nom:'Test'},job:{},docs:[],incidents:[],createdAt:now,updatedAt:now}
    ]));
   }
   if(!localStorage.getItem('inovtec_plannings_v2')){
    localStorage.setItem('inovtec_plannings_v2',JSON.stringify({agents:[
     {id:'test_team_agent_1',refId:'test_team_agent_1',name:'Camille Test',color:'#4f9f57',copies:2},
     {id:'test_team_agent_2',refId:'test_team_agent_2',name:'Alex Test',color:'#4f8fd8',copies:2}
    ],weeks:{
     '2026-W37':[
      {id:'reference',agentId:'test_team_agent_1',day:0,start:'09:00',end:'11:00',task:'Planning partagé',site:'Chantier A'},
      {id:'personnalise',agentId:'test_team_agent_2',day:1,start:'13:00',end:'15:00',task:'Intervention individuelle à conserver',site:'Chantier B'}
     ],
     '2026-W38':[{id:'reference-libre',agentId:'test_team_agent_1',day:2,start:'10:00',end:'12:00',task:'Intervention commune',site:'Chantier C'}]
    },selected:null}));
   }
  }catch{}
 });
 await page.goto('http://127.0.0.1:8765/inovtec-page-shell.html?mode=agents&page=AGENTS-LEGACY.html',{waitUntil:'domcontentloaded',timeout:45000});
 const frame=page.frameLocator('#legacyFrame');
 await frame.locator('#agentList .listItem[data-agent-id="test_team_agent_1"]').waitFor({state:'attached',timeout:30000});
 await frame.locator('#agentList .listItem[data-agent-id="test_team_agent_1"]').dispatchEvent('contextmenu',{bubbles:true,cancelable:true,clientX:100,clientY:100});
 const link=frame.locator('#ivAgentTeamContext button');
 await link.waitFor({state:'visible',timeout:10000});
 if(!/Lier des agents au même planning/.test(await link.innerText()))throw Error('Action de liaison absente du clic droit Classeur agents');
 if(await frame.locator('#btnSaveAgent').count()!==1)throw Error('Le bouton de sauvegarde du Classeur a été touché');
 await link.evaluate(button=>button.click());
 await page.waitForURL(/mode=planning/,{timeout:30000});
 await frame.locator('#ivTeamModal.open').waitFor({state:'visible',timeout:12000});
 if(!await frame.locator('#ivTeamMembers input[value="test_team_agent_1"]').isChecked())throw Error('L’agent du clic droit n’est pas présélectionné');
 const stateBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('inovtec_plannings_v2')||'{}'));
 if((stateBefore.teamPlanning?.teams||[]).length)throw Error('Une équipe a été créée sans validation');
 const protectedBefore=JSON.stringify(stateBefore.weeks?.['2026-W37']?.find(e=>e.id==='personnalise'));
 // La CI ne s'authentifie pas : l'écran de session doit rester bloquant.
 // On teste uniquement les callbacks de la fenêtre avec ses données fictives.
 await frame.locator('#ivTeamName').fill('Équipe de test');
 await frame.locator('#ivTeamMembers input[value="test_team_agent_2"]').evaluate(input=>{input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}))});
 await frame.locator('#ivTeamReference').selectOption('test_team_agent_1');
 await frame.locator('#ivTeamSave').evaluate(button=>button.click());
 await page.waitForFunction(()=>{
  const s=JSON.parse(localStorage.getItem('inovtec_plannings_v2')||'{}');
  return s.teamPlanning?.teams?.some(t=>t.members?.includes('test_team_agent_1')&&t.members?.includes('test_team_agent_2'));
 },null,{timeout:12000});
 const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('inovtec_plannings_v2')||'{}'));
 const team=result.teamPlanning.teams.find(t=>t.members.includes('test_team_agent_1'));
 if(team.referenceAgentId!=='test_team_agent_1'||team.members.length!==2)throw Error('Membres ou référence du planning liés incorrects');
 if(JSON.stringify(result.weeks?.['2026-W37']?.find(e=>e.id==='personnalise'))!==protectedBefore)throw Error('Un planning individuel existant a été écrasé ou modifié');
 if(!team.exceptions?.['2026-W37']?.includes('test_team_agent_2'))throw Error('L’exception individuelle du planning existant est absente');
 const copies=(result.weeks?.['2026-W38']||[]).filter(e=>e.agentId==='test_team_agent_2');
 if(copies.length!==1||copies[0].task!=='Intervention commune'||copies[0]._teamInheritedFrom!=='test_team_agent_1')throw Error('Le planning commun n’a pas été recopié dans la semaine libre');
 if((result.weeks?.['2026-W37']||[]).length!==2)throw Error('Une intervention existante a été modifiée ou dupliquée');
 if((result.weeks?.['2026-W38']||[]).length!==2)throw Error('Une semaine libre a reçu un nombre incorrect d’interventions');
 console.log('OK : clic droit Classeur agents, équipe enregistrée, planning libre partagé et interventions individuelles préservées.');
 await browser.close();
}catch(error){await browser.close();throw error}
