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
  if(result.refGets<2)throw Error('L’écriture doit être précédée et suivie d’une lecture Firebase confirmée : '+JSON.stringify(result));
  const saved=result.payload.find(x=>x.id==='agent_firebase_test');
  if(!saved||saved.identity?.prenom!=='Dupont'||saved.job?.poste!=='Agent')throw Error('Le profil complet n’est pas écrit dans Firebase : '+JSON.stringify(result));
  if(result.local!==null)throw Error('Le module Agents écrit encore dans localStorage');
  if(!/synchronisé/i.test(result.status))throw Error('Le statut Firebase ne confirme pas la transaction : '+JSON.stringify(result));
  if(errors.length)throw Error('Erreur navigateur : '+errors.join(' ; '));

  const incidentResult=await page.evaluate(async()=>{
    const cloud=window.InovtecAgentsCloud;
    const state=window.__agentsFirebaseTest;
    const old={
      id:'old-inc',date:'2026-10-12',titre:'Incident ancien',description:'Pièce existante',
      photos:[{id:'old-photo',name:'ancien.png',type:'image/png',dataUrl:'data:image/png;base64,'+'A'.repeat(460000)}]
    };
    const agents=JSON.parse(state.doc.moduleSyncV1.agents.payload);
    agents[0].incidents=[old];
    agents.push({id:'agent-preserve',identity:{prenom:'Autre',nom:'Agent'},job:{poste:'Test'},docs:[],incidents:[]});
    state.doc.moduleSyncV1.agents.payload=JSON.stringify(agents);
    state.doc.moduleSyncV1.planning={payload:'X'.repeat(330000)};
    state.notifyMain();
    const latest={
      id:'new-inc',date:'2026-10-13',titre:'Incident Paulino',description:'Doit survivre au rechargement',
      photos:[{id:'new-photo',name:'nouveau.png',type:'image/png',dataUrl:'data:image/png;base64,'+'A'.repeat(470000)}]
    };
    // Le document principal est quasiment plein : l'incident s'enregistre à part.
    const originalMain=state.doc.moduleSyncV1.agents.payload;
    const originalMainWrites=state.mainWrites;
    await cloud.saveIncident('agent_firebase_test',latest,'add');
    const mainUnchanged=originalMain===state.doc.moduleSyncV1.agents.payload&&originalMainWrites===state.mainWrites;
    const remote=await cloud.load();
    const full=JSON.stringify(state.doc);
    const saved=remote.find(a=>a.id==='agent_firebase_test');
    const oldSaved=saved?.incidents?.find(i=>i.id==='old-inc');
    const latestSaved=saved?.incidents?.find(i=>i.id==='new-inc');
    const loadedData=await cloud.readMedia(latestSaved.photos[0]);
    return{
      size:new Blob([full]).size,
      agentCount:remote.length,
      oldPreserved:!!oldSaved?.photos?.[0]?.dataUrl,
      newStored:!!latestSaved?.photos?.[0]?.ivStorageV1?.path&&!latestSaved.photos[0].dataUrl,
      photoRecovered:loadedData.startsWith('data:image/png;base64,'),
      privateWrites:state.incidentWrites,
      privateRecords:state.incidentRecords.size,
      mainUnchanged,
      files:state.files.size,
      names:remote.map(a=>a.id)
    };
  });
  if(incidentResult.size>1048576||!incidentResult.oldPreserved||!incidentResult.newStored||!incidentResult.photoRecovered||incidentResult.files!==1||!incidentResult.mainUnchanged||(incidentResult.privateWrites!==1||incidentResult.privateRecords!==1)||!incidentResult.names.includes('agent-preserve')){
    throw Error('Incident non durable ou modification du document Agents lors de la sauvegarde privée : '+JSON.stringify(incidentResult));
  }
  console.log('OK : incident enregistré dans document privé, aucune migration lente, photos et agents préservés');
  console.log('OK : Agents -> Firebase direct, sans stockage local, avec relecture serveur confirmée');
}finally{
  await browser.close();
}