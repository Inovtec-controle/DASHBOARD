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
        ],weeks:{},selected:null}));
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
  await page.waitForURL(/mode=planning/, {timeout:30000});
  await page.waitForTimeout(1800);
  console.log('DIAGNOSTIC ÉQUIPE',JSON.stringify(await page.evaluate(()=>{
    const frame=document.getElementById('legacyFrame'),d=frame?.contentDocument;
    const state=JSON.parse(localStorage.getItem('inovtec_plannings_v2')||'{}');
    return {url:location.href,request:sessionStorage.getItem('ivAgentsOpenTeamEditorV1'),bridge:window.__IV_AGENTS_TEAM_CONTEXT_V1__,iframeUrl:frame?.src,iframeReady:d?.readyState,agents:state.agents?.map(a=>({id:a.id,refId:a.refId})).slice(0,10),selected:state.selected,rows:[...(d?.querySelectorAll('.agent-row[data-agent-id]')||[])].slice(0,10).map(r=>({id:r.dataset.agentId,text:r.innerText.slice(0,50)})),menu:d?.getElementById('contextMenu')?.outerHTML?.slice(0,1300),modal:d?.getElementById('ivTeamModal')?.outerHTML?.slice(0,300),notes:d?.body?.innerText?.slice(-250)};
  })));
  await frame.locator('#ivTeamModal.open').waitFor({state:'visible',timeout:4000});
  if(!await frame.locator('#ivTeamModal #ivTeamMembers input[value="test_team_agent_1"]').isChecked())throw Error('L’agent du clic droit n’est pas présélectionné');
  const stateBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('inovtec_plannings_v2')||'{}'));
  if((stateBefore.teamPlanning?.teams||[]).length)throw Error('Une équipe a été créée sans validation');
  await frame.locator('#ivTeamName').fill('Équipe de test');
  await frame.locator('#ivTeamMembers input[value="test_team_agent_2"]').check();
  await frame.locator('#ivTeamReference').selectOption('test_team_agent_1');
  await frame.locator('#ivTeamSave').click();
  await page.waitForFunction(()=>{
    const s=JSON.parse(localStorage.getItem('inovtec_plannings_v2')||'{}');
    return s.teamPlanning?.teams?.some(t=>t.members?.includes('test_team_agent_1')&&t.members?.includes('test_team_agent_2'));
  },null,{timeout:12000});
  const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('inovtec_plannings_v2')||'{}'));
  const team=result.teamPlanning.teams.find(t=>t.members.includes('test_team_agent_1'));
  if(team.referenceAgentId!=='test_team_agent_1'||team.members.length!==2)throw Error('Membres ou référence du planning liés incorrects');
  if(Object.values(result.weeks||{}).some(rows=>rows?.length))throw Error('Le test a créé des interventions inattendues');
  console.log('OK : clic droit Classeur agents, éditeur existant ouvert, liaison enregistrée sans modifier les interventions.');
  await browser.close();
}catch(error){await browser.close();throw error}
