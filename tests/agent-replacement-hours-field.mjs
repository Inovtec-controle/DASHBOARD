import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1450,height:950}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.message||e)));
page.on('dialog',async d=>{if(d.type()==='alert')await d.dismiss();else await d.accept()});
try{
  await page.goto('http://127.0.0.1:8765/__agent_hours_fixture__.html?mode=agents',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    const agent={id:'agent-hours-fixture',identity:{prenom:'Claire',nom:'Martin'},
      job:{poste:'Agent',typeContrat:'CDI',contractHoursWeekly:30,replacementHoursAvailableWeekly:3},
      docs:[],incidents:[],createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z'};
    window.__agentHoursTest={agents:[agent],saves:0};
    window.InovtecAgentsCloud={
      load:async()=>structuredClone(window.__agentHoursTest.agents),
      saveAgent:async row=>{
        window.__agentHoursTest.saves++;
        const next=window.__agentHoursTest.agents.filter(a=>a.id!==row.id);
        next.push(structuredClone(row));
        window.__agentHoursTest.agents=next;
        return structuredClone(next);
      },
      saveAll:async rows=>{
        window.__agentHoursTest.saves++;
        window.__agentHoursTest.agents=structuredClone(rows);
        return structuredClone(rows);
      }
    };
  });
  await page.setContent('<iframe id="legacyFrame" title="Fiche agent fictive" src="http://127.0.0.1:8765/AGENTS-LEGACY.html" style="width:100%;height:850px;border:0"></iframe>');
  const frame=page.frameLocator('#legacyFrame');
  await frame.locator('#f_contrat').waitFor({state:'attached',timeout:15000});
  await page.addScriptTag({url:'http://127.0.0.1:8765/inovtec-agent-contract-hours.js?v=agent-hours-regression'});
  await frame.locator('#f_heuresContrat').waitFor({timeout:8000});
  await frame.locator('#f_heuresDisponibles').waitFor({timeout:8000});
  await frame.locator('#f_heuresContrat').waitFor({state:'visible',timeout:8000});
  const inputs=await frame.locator('#ivAgentHoursRow > .field').count();
  if(inputs!==2)throw Error('Les heures contractuelles et disponibles ne sont pas côte à côte');
  await page.waitForFunction(()=>{
    const doc=document.getElementById('legacyFrame')?.contentDocument;
    return doc?.getElementById('f_heuresContrat')?.value==='30'&&doc?.getElementById('f_heuresDisponibles')?.value==='3';
  },null,{timeout:8000});
  await frame.locator('#f_heuresContrat').fill('30');
  await frame.locator('#f_heuresDisponibles').fill('5');
  await frame.locator('#btnSaveAgent').click();
  await page.waitForFunction(()=>window.__agentHoursTest?.saves>0,{timeout:8000});
  const result=await page.evaluate(()=>window.__agentHoursTest.agents.find(a=>a.id==='agent-hours-fixture'));
  if(result?.job?.replacementHoursAvailableWeekly!==5)throw Error('Les heures disponibles ne sont pas enregistrées avec la fiche agent');
  if(result?.job?.contractHoursWeekly!==30)throw Error('Les heures contractuelles ont été perdues');
  if(errors.length)throw Error('Erreurs JavaScript : '+errors.join('; '));
  console.log('OK : champ heures disponibles côte à côte, relecture fiche et sauvegarde du profil Firebase simulé');
}finally{await browser.close()}
