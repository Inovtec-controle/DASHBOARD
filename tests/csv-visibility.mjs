import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const config=readFileSync('firebase-config.js','utf8');
const editor=readFileSync('variables-editor-nav.js','utf8');
if(!config.includes('inovtec-hide-csv-exports.js?v=20260917-no-csv1'))throw Error('Le module commun ne charge pas le masquage CSV');
if(!editor.includes('inovtec-hide-csv-exports.js?v=20260917-no-csv1'))throw Error('La vue Variables autonome ne charge pas le masquage CSV');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/tests/csv-visibility-fixture.html',{waitUntil:'load'});
 const hidden=async locator=>locator.evaluate(e=>getComputedStyle(e).display==='none' && (e.hidden||e.getAttribute('aria-hidden')==='true'));
 for(const id of ['exportHistory','exportCsv','exportMaterial','exportBtn']){
   if(!await hidden(page.locator('#'+id)))throw Error('Export CSV toujours affiché : '+id);
 }
 for(const id of ['exportPDF','exportJSON','importCSV']){
   if(!await page.locator('#'+id).isVisible())throw Error('Une fonction non CSV a été masquée : '+id);
 }
 const nested=page.frameLocator('#nested');
 await nested.locator('#nestedCsv').waitFor();
 await page.waitForFunction(()=>{
   const doc=document.querySelector('#nested')?.contentDocument;
   return doc&&getComputedStyle(doc.getElementById('nestedCsv')).display==='none';
 });
 if(!await nested.locator('#nestedPdf').isVisible())throw Error('Export PDF du cadre masqué par erreur');
 await page.evaluate(()=>{
   const wrap=document.querySelector('#dynamic');
   const button=document.createElement('button');button.id='lateCsv';button.textContent='Exporter CSV';wrap.append(button);
   const renamed=document.createElement('button');renamed.id='renamedCsv';renamed.textContent='Autre action';wrap.append(renamed);
   queueMicrotask(()=>{renamed.textContent='Exporter CSV'});
 });
 await page.waitForFunction(()=>['lateCsv','renamedCsv'].every(id=>document.getElementById(id)?.hidden));
 if(errors.length)throw Error('Erreur JavaScript : '+errors.join(' ; '));
 console.log('OK : CSV masqués dans les pages, les cadres et les ajouts dynamiques ; PDF, JSON et import CSV conservés.');
}finally{await browser.close()}
