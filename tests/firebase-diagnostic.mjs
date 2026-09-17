import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base='http://127.0.0.1:8765/firebase-diagnostic.html';
const assert=(ok,message)=>{if(!ok)throw Error(message)};
async function scenario(denied=false){
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.addInitScript(deny=>{
    const record={existingPlanning:'DO_NOT_CHANGE'};
    const writes=[];
    window.__firebaseDiagnosticFixture={record,writes};
    const snapshot=()=>({exists:true,get:key=>record[key],data:()=>({...record})});
    const doc={
      get:async options=>{if(options?.source!=='server')throw Error('Lecture serveur requise');return snapshot()},
      set:async (value,options)=>{if(deny)throw{code:'permission-denied'};if(options?.merge!==true)throw Error('La fusion est obligatoire');Object.assign(record,value);writes.push('set')},
      update:async value=>{if(deny)throw{code:'permission-denied'};for(const [key,v] of Object.entries(value)){if(v==='__DIAGNOSTIC_DELETE__')delete record[key];else record[key]=v}writes.push('update')}
    };
    const firestore=()=>({
      collection(name){
        if(name==='kanban')return {doc(uid){if(uid!=='fake-user')throw Error('Mauvais compte');return doc}};
        return {limit(){return {get:async options=>{if(options?.source!=='server')throw Error('Lecture serveur requise');return {empty:true}}}}};
      }
    });
    firestore.FieldValue={delete:()=> '__DIAGNOSTIC_DELETE__'};
    const auth=()=>({onAuthStateChanged:fn=>{fn({uid:'fake-user'});return()=>{}},signInWithEmailAndPassword:async()=>({user:{uid:'fake-user'}})});
    window.firebase={apps:[],initializeApp:config=>{window.firebase.apps.push({options:config})},app:()=>window.firebase.apps[0],auth,firestore};
  },denied);
  await page.route('**/firebase-*-compat.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* Firebase SDK simulé : aucune requête réelle */'}));
  try{
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('#read:not([disabled])').waitFor({timeout:18000});
    assert(await page.evaluate(()=>window.__firebaseDiagnosticFixture.writes.length===0),'Écriture lancée automatiquement sans clic');
    await page.locator('#read').click();
    await page.waitForFunction(()=>document.getElementById('report').textContent.includes('LECTURE CHANTIERS'));
    await page.locator('#write').click();
    await page.waitForFunction(()=>document.getElementById('report').textContent.includes('NETTOYAGE'));
    const outcome=await page.evaluate(()=>({report:document.getElementById('report').textContent,record:window.__firebaseDiagnosticFixture.record,writes:window.__firebaseDiagnosticFixture.writes}));
    assert(outcome.record.existingPlanning==='DO_NOT_CHANGE','Une donnée métier a été modifiée');
    assert(!Object.keys(outcome.record).some(key=>key.startsWith('ivDiagnostic_')),'Champ temporaire non retiré');
    if(denied){assert(outcome.report.includes('permission-denied'),'Erreur de permission non identifiée');assert(!outcome.report.includes('RELECTURE — OK'),'Fausse confirmation de relecture')}
    else{assert(outcome.report.includes('ÉCRITURE — OK')&&outcome.report.includes('RELECTURE — OK')&&outcome.report.includes('NETTOYAGE — champ temporaire retiré'),'Parcours écriture / relecture / nettoyage incomplet');assert(outcome.writes.join(',')==='set,update','Écritures non limitées au test et nettoyage')}
    assert(!errors.length,'Erreur JavaScript : '+errors.join(' ; '));
    console.log(denied?'OK : permission refusée identifiée sans fausse réussite':'OK : lecture, écriture, relecture et nettoyage sans toucher au planning fictif');
  }finally{await context.close()}
}
try{await scenario(false);await scenario(true)}catch(error){console.error('::error::Diagnostic Firebase : '+error.message);process.exitCode=1}finally{await browser.close()}
