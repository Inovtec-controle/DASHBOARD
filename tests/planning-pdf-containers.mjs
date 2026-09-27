import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("planning-pdf-robust-text.js","utf8");
const texts=[];
let lastPdf=null;

class FakePDF{
  constructor(){lastPdf=this}
  setFillColor(){return this}
  setDrawColor(){return this}
  setLineWidth(){return this}
  roundedRect(){return this}
  rect(){return this}
  line(){return this}
  setTextColor(){return this}
  setFont(){return this}
  setFontSize(){return this}
  addPage(){return this}
  save(){return this}
  splitTextToSize(value){return [String(value??"")]}
  text(value){
    if(Array.isArray(value))value.forEach(v=>texts.push(String(v)));
    else texts.push(String(value??""));
    return this;
  }
}

const state={
  agents:[{id:"a1",name:"Agent Test",copies:2}],
  selected:"a1",
  weeks:{
    "2026-W40":[{
      id:"e1",
      agentId:"a1",
      day:0,
      start:"08:00",
      end:"10:00",
      task:"Résidence Test",
      site:"Nettoyage halls",
      containerTasks:[
        {id:"sortieOM",action:"sortie",typeConteneur:"OM",label:"Sortie OM"},
        {id:"rentreeTRI",action:"rentree",typeConteneur:"TRI",label:"Rentrée TRI"}
      ]
    }]
  }
};

const week={value:"2026-W40"};
const window={
  jspdf:{jsPDF:FakePDF},
  InovtecPlanningAPI:{getState:()=>state},
  InovtecPlanningPDF:null
};
const document={
  readyState:"complete",
  getElementById:id=>id==="week"?week:null,
  addEventListener(){}
};
const context={
  window,
  document,
  parent:{InovtecDataHub:{readyAgents:false,agents:[]}},
  alert:message=>{throw new Error(String(message))},
  setTimeout:fn=>{fn();return 1},
  clearTimeout(){},
  console
};

vm.runInNewContext(source,context,{filename:"planning-pdf-robust-text.js"});
if(typeof window.InovtecPlanningPDF?.generateSingle!=="function")throw new Error("API PDF non installée");
window.InovtecPlanningPDF.generateSingle();
if(!lastPdf)throw new Error("PDF non créé");

const joined=texts.join("\n");
if(!joined.includes("Conteneurs : Sortie OM · Rentrée TRI")){
  throw new Error("Les missions conteneurs sélectionnées ne sont pas présentes dans le PDF : "+joined);
}
if(!joined.includes("Résidence Test"))throw new Error("Le chantier a disparu du PDF");
console.log("OK : les bulles conteneurs sélectionnées sont reprises automatiquement dans le PDF.");
