import { chromium } from 'playwright';
import fs from 'node:fs';

const base='http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});

await context.addInitScript(()=>{
  const original=EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener=function(type,listener,options){
    try{
      if(type==='submit'&&this instanceof HTMLFormElement)this.dataset.ivSubmitListener='1';
      if(type==='click'&&this instanceof HTMLButtonElement)this.dataset.ivClickListener='1';
    }catch{}
    return original.call(this,type,listener,options);
  };
});

const failures=[];
async function check(label,path,formSelector,buttonSelector){
  const page=await context.newPage();
  page.on('pageerror',e=>failures.push(label+' JS: '+String(e?.message||e).slice(0,220)));
  try{
    await page.goto(base+'/'+path,{waitUntil:'domcontentloaded',timeout:45000});
    if(formSelector)await page.locator(formSelector).waitFor({state:'attached',timeout:15000});
    if(buttonSelector)await page.locator(buttonSelector).waitFor({state:'attached',timeout:15000});
    await page.waitForTimeout(500);
    const result=await page.evaluate(({formSelector,buttonSelector})=>{
      const form=formSelector?document.querySelector(formSelector):null;
      const button=buttonSelector?document.querySelector(buttonSelector):null;
      return {
        formBound:!!form&&(form.dataset.ivSubmitListener==='1'||typeof form.onsubmit==='function'),
        buttonBound:!!button&&(button.dataset.ivClickListener==='1'||typeof button.onclick==='function'),
        buttonType:button?.type||''
      };
    },{formSelector,buttonSelector});
    if(!result.formBound&&!result.buttonBound)throw new Error('aucun handler de sauvegarde actif détecté');
    if(buttonSelector&&result.buttonType==='submit'&&!result.formBound)throw new Error('bouton submit présent mais formulaire non relié');
    console.log('OK : '+label);
  }catch(e){
    failures.push(label+' : '+String(e?.message||e));
    console.error('ÉCHEC : '+label+' : '+String(e?.message||e));
  }finally{await page.close();}
}

await check('Agents — Enregistrer','AGENTS-LEGACY.html',null,'#btnSaveAgent');
await check('Infos chantier — Enregistrer','INFOCHANTIERS-V2-LEGACY.html','#siteForm','#siteForm button[type="submit"]');
await check('Congés — Enregistrer','CONGES-LEGACY.html','#leaveForm','#leaveForm button[type="submit"]');
await check('Variables — Enregistrer','VARIABLES-LEGACY.html','#variableForm','#variableForm button[type="submit"]');
await check('Organisation — Ajouter / Enregistrer','ORGA-LEGACY.html','#taskForm','#taskForm button[type="submit"]');
await check('Discipline — Enregistrer','DISCIPLINE-V9-LEGACY.html','#recordForm','#saveBtn');
await check('Matériel — Enregistrer','MATERIEL-LEGACY.html','#materialForm','#materialForm button[type="submit"]');
await check('Réassort rapide — Enregistrer','REASSORT.html','#quickForm','#quickSubmit');
await check('Réassort demande — Enregistrer','REASSORT.html','#orderForm','#orderForm button[type="submit"]');
await check('Réassort livraison — Confirmer','REASSORT.html','#receiptForm','#receiveBtn');

const kontrol=fs.readFileSync('kontrol-cloud.js','utf8');
if(!/saveControlBtn\.addEventListener\(["']click/.test(kontrol)||!/saveControlDirect\(\)/.test(kontrol)){
  failures.push('KONTROL — Enregistrer + PDF : handler direct absent');
}else console.log('OK : KONTROL — Enregistrer + PDF');

console.log('BILAN SAUVEGARDES : '+(failures.length?failures.length+' anomalie(s)':'tous les contrôles sont reliés'));
for(const issue of failures)console.log('::error::'+issue);
await browser.close();
if(failures.length)process.exitCode=1;
