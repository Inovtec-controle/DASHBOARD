import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(path,'utf8');
const minutes=time=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
const scenarios=[
 {name:'pause séparée',events:[
  {start:'08:00',end:'12:00',task:'Travail'},
  {start:'12:00',end:'13:00',task:'Pause'},
  {start:'13:00',end:'17:00',task:'Déplacement'}
 ],expected:480},
 {name:'pause dans un créneau de travail',events:[
  {start:'08:00',end:'17:00',task:'Travail'},
  {start:'12:00',end:'13:00',task:'Pause'}
 ],expected:480,visibleTime:'8h00 - 17h00 8h00'},
 {name:'trajet superposé, pause déduite',events:[
  {start:'08:00',end:'12:00',task:'Travail'},
  {start:'11:30',end:'12:30',task:'Déplacement'},
  {start:'12:30',end:'13:00',task:'Pause'},
  {start:'13:00',end:'17:00',task:'Travail'}
 ],expected:510}
];
const monthlySource=read('variables-monthly-planning.js');
const monthlyPart=monthlySource.slice(monthlySource.indexOf('function effectiveDayMinutes('),monthlySource.indexOf('function calculate(){'));
if(!monthlyPart.startsWith('function effectiveDayMinutes('))throw Error('Calcul mensuel introuvable');
const effectiveDayMinutes=vm.runInNewContext(monthlyPart+';effectiveDayMinutes');
const guardSource=read('planning-legal-guard.js');
const guardPart=guardSource.slice(guardSource.indexOf('function mergeIntervals('),guardSource.indexOf('function summaries('));
if(!guardPart.startsWith('function mergeIntervals('))throw Error('Contrôle Planning introuvable');
const daySummary=vm.runInNewContext('(()=>{const dateKey=()=> "2026-10-12";'+guardPart+';return daySummary;})()');

for(const scenario of scenarios){
 const normalized=scenario.events.map(e=>({start:minutes(e.start),end:minutes(e.end),pause:e.task==='Pause'}));
 const estimated=effectiveDayMinutes(normalized);
 if(estimated!==scenario.expected)throw Error(scenario.name+' : estimation '+estimated+' au lieu de '+scenario.expected);
 const legalRows=normalized.map(e=>({key:'2026-10-12',startMin:e.start,endMin:e.end,pause:e.pause}));
 const effective=daySummary(legalRows,new Date(2026,9,12)).effective;
 if(effective!==scenario.expected)throw Error(scenario.name+' : contrôle '+effective+' au lieu de '+scenario.expected);
}

for(const file of ['planning-pdf.js','planning-pdf-robust-text.js']){
 const source=read(file);
 for(const scenario of scenarios){
  const allText=[];
  let pdfSaved=false;
  class FakePDF{
   setFillColor(){return this}setDrawColor(){return this}setLineWidth(){return this}
   roundedRect(){return this}rect(){return this}line(){return this}
   setTextColor(){return this}setFont(){return this}setFontSize(){return this}
   addPage(){return this}save(){pdfSaved=true;return this}
   splitTextToSize(v){return[String(v??'')]}
   getTextWidth(v){return String(v??'').length*.4}
   text(v){allText.push(...(Array.isArray(v)?v:[v]).map(String));return this}
  }
  const agentId='test-agent';
  const rows=scenario.events.map((e,i)=>({...e,id:String(i),agentId,day:0}));
  const state={agents:[{id:agentId,name:'Agent Test',copies:2}],selected:agentId,weeks:{'2026-W42':rows}};
  const window={jspdf:{jsPDF:FakePDF},InovtecPlanningAPI:{getState:()=>state},InovtecPlanningPDF:null};
  const document={readyState:'complete',getElementById:id=>id==='week'?{value:'2026-W42'}:null,addEventListener(){}};
  const context={window,document,parent:{InovtecDataHub:{readyAgents:false,agents:[]}},console,
    alert:message=>{throw Error(String(message))},setTimeout:fn=>{fn();return 1},clearTimeout(){}};
  vm.runInNewContext(source,context,{filename:file});
  window.InovtecPlanningPDF.generateSingle();
  if(!pdfSaved)throw Error(file+' : PDF non enregistré');
  const index=allText.indexOf('TOTAL SEMAINE');
  const expected=Math.floor(scenario.expected/60)+'h'+String(scenario.expected%60).padStart(2,'0');
  if(allText[index+1]!==expected)throw Error(file+' / '+scenario.name+' : total incorrect '+allText[index+1]+' au lieu de '+expected);
  if(scenario.visibleTime&&!allText.some(text=>text.includes(scenario.visibleTime))){
   throw Error(file+' : le bloc Travail affiche encore une durée brute différente du total ('+JSON.stringify(allText.filter(t=>t.includes('17h00')))+')');
  }
 }
}
console.log('OK : durées des cartes PDF, totaux hebdomadaires, estimation mensuelle et contrôle Planning cohérents ; travail + déplacement - pause.');
