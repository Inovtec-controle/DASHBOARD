import { chromium } from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));
try{
  await page.goto(base+'/tests/agents-firebase-direct-fixture.html?mode=agents',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.InovtecAgentsCloud,{timeout:10000});
  const agent={
    id:'agent_firebase_test',
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    identity:{prenom:'Dupont',nom:'Jeanne',telephone:'0600000000',email:'jeanne@test.fr',adresse:'Test',dateNaissance:'',secu:'',permis:'',vehicule:''},
    job:{poste:'Agent',typeContrat:'CDI',dateEntree:'',sitePrincipal:'Site A',disponibilites:'',notes:'Test'},
    docs:[],incidents:[]
  };
  const result=await page.evaluate(async a=>{
    localStorage.removeItem('kontrol_agents_classeur_v2');
    await window.InovtecAgentsCloud.saveAgent(a);
    const payload=JSON.parse(window.__agentsFirebaseTest.doc.moduleSyncV1.agents.payload);
    return{
      transactions:window.__agentsFirebaseTest.transactions,
      refGets:window.__agentsFirebaseTest.refGets,
      payload,
      local:localStorage.getItem('kontrol_agents_classeur_v2'),
      status:document.getElementById('syncMirror')?.textContent||''
    };
  },agent);
  if(result.transactions!==1)throw Error('La sauvegarde agent ne fait pas exactement une transaction Firebase : '+JSON.stringify(result));
  if(result.refGets!==0)throw Error('Une relecture serveur supplémentaire est encore imposée après la transaction : '+JSON.stringify(result));
  const saved=result.payload.find(x=>x.id==='agent_firebase_test');
  if(!saved||saved.identity?.prenom!=='Dupont'||saved.job?.poste!=='Agent')throw Error('Le profil complet n’est pas écrit dans Firebase : '+JSON.stringify(result));
  if(result.local!==null)throw Error('Le module Agents écrit encore dans localStorage');
  if(!/synchronisé/i.test(result.status))throw Error('Le statut Firebase ne confirme pas la transaction : '+JSON.stringify(result));
  if(errors.length)throw Error('Erreur navigateur : '+errors.join(' ; '));
  console.log('OK : Agents -> Firebase direct, sans stockage local, sans fausse relecture');
}finally{
  await browser.close();
}