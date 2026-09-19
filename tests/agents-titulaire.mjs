import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const key='kontrol_agents_classeur_v2';
const errors=[];
page.on('pageerror',error=>errors.push(String(error?.message||error)));
const assert=(yes,message)=>{if(!yes)throw Error(message)};
const read=()=>page.evaluate(storage=>JSON.parse(localStorage.getItem(storage)||'[]'),key);
const get=async id=>(await read()).find(agent=>agent.id===id);
const open=async id=>{
  await page.locator(`.listItem[data-agent-id="${id}"]`).click();
  await page.waitForFunction(agentId=>document.querySelector('#agentList .listItem.active')?.dataset.agentId===agentId,id);
};
try{
  await page.goto('http://127.0.0.1:8765/AGENTS-LEGACY.html',{waitUntil:'domcontentloaded'});
  const fixtures=[
    {id:'titulaire-1',identity:{prenom:'Camille',nom:'Fictive'},job:{poste:'Agent de service'},docs:[],incidents:[]},
    {id:'remplacant-1',identity:{prenom:'Alex',nom:'Fictif'},job:{poste:'Agent de service'},docs:[],incidents:[]},
    {id:'autre-1',identity:{prenom:'Noa',nom:'Fictif'},job:{poste:'Agent de service',notes:'Ne pas modifier'},docs:[],incidents:[]}
  ];
  await page.evaluate(([storage,agents])=>localStorage.setItem(storage,JSON.stringify(agents)),[key,fixtures]);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.listItem[data-agent-id="titulaire-1"]').waitFor();
  await open('titulaire-1');
  assert(await page.locator('#f_estTitulaire').isVisible(),'Case Agent titulaire manquante');
  await page.locator('#f_estTitulaire').check();
  assert(await page.locator('#ivAgentRemplacement').isHidden(),'Choix du remplacé non masqué pour un titulaire');
  await page.locator('#btnSaveAgent').click();
  assert((await get('titulaire-1'))?.job?.estTitulaire===true,'Statut titulaire non enregistré');
  assert(await page.locator('.listItem[data-agent-id="titulaire-1"] .iv-agent-role').innerText()==='Titulaire','Badge titulaire absent');

  await open('remplacant-1');
  assert(!(await page.locator('#f_estTitulaire').isChecked()),'Remplaçant marqué titulaire par défaut');
  await page.locator('#f_titulaireRemplace').selectOption('titulaire-1');
  await page.locator('#btnSaveAgent').click();
  assert((await get('remplacant-1'))?.job?.titulaireRemplaceId==='titulaire-1','Lien de remplacement non enregistré');
  assert((await page.locator('.listItem[data-agent-id="remplacant-1"] .iv-agent-role').innerText()).includes('Camille'),'Nom du titulaire remplacé non affiché');
  await page.reload({waitUntil:'domcontentloaded'});
  await open('remplacant-1');
  assert(await page.locator('#f_titulaireRemplace').inputValue()==='titulaire-1','Lien perdu à la réouverture');

  await page.locator('#f_estTitulaire').check();
  await page.locator('#btnSaveAgent').click();
  const promoted=await get('remplacant-1');
  assert(promoted.job.estTitulaire===true&&promoted.job.titulaireRemplaceId==='','Passage titulaire : ancien rattachement conservé');
  await open('titulaire-1');
  await page.locator('#btnDuplicateAgent').click();
  const copies=(await read()).filter(agent=>!fixtures.some(f=>f.id===agent.id));
  assert(copies.length===1&&!copies[0].job.estTitulaire&&!copies[0].job.titulaireRemplaceId,'La duplication hérite à tort du statut titulaire');
  assert((await get('autre-1'))?.job?.notes==='Ne pas modifier','Une fiche non concernée a été modifiée');
  assert(!errors.length,'Erreur JavaScript : '+errors.join('; '));
  console.log('OK : titulaire identifié, remplaçant rattaché, persistance, changement de statut, duplication sans attribution automatique et autres fiches intactes.');
}catch(error){console.error('::error::Agents titulaire/remplacement : '+error.message);process.exitCode=1}
finally{await browser.close()}
