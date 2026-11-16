import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync("dashboard-firebase-capacity.js","utf8");
const html=readFileSync("index.html","utf8");
for(const id of ["ivCapToggle","ivCapText","ivCapFill","ivCapState","ivCapBackup","ivCapArchive","ivCapModal","ivCapModalBar"]){
 assert.ok(html.includes('id="'+id+'"'),"Élément manquant : "+id);
}
assert.ok(html.includes("dashboard-firebase-capacity.js"),"Script de la jauge non chargé");
assert.ok(!/\.delete\s*\(|\.set\s*\(|\.update\s*\(|\.runTransaction\s*\(/.test(source),"Le module ne doit jamais écrire dans Firebase");

const els=new Map(),downloads=[],urls=new Map();
function el(id){
 if(!els.has(id)){
  els.set(id,{id,style:{},dataset:{},hidden:id==="ivCapModal",textContent:"",
    listeners:{},setAttribute(k,v){this[k]=v},addEventListener(name,cb){this.listeners[name]=cb},
    classList:{add(){},remove(){}},focus(){},appendChild(){},remove(){}});
 }
 return els.get(id);
}
const document={
 readyState:"complete",body:{appendChild(){}},getElementById:el,
 addEventListener(){},createElement(tag){
  if(tag!=="a")throw Error("Unexpected element");
  return {style:{},download:"",href:"",click(){downloads.push({file:this.download,url:this.href})},remove(){}};
 }
};
const oldWeek="2024-W05",currentWeek="2099-W20";
const planning={agents:[{id:"agent1"}],weeks:{[oldWeek]:[{id:"older"}],[currentWeek]:[{id:"future"}]},selected:"agent1"};
let currentDoc={
 moduleSyncV1:{planning:{payload:JSON.stringify(planning)},agents:{payload:"[]"}},
 unused:"x".repeat(747*1024-300)
};
let snapListener=null;
const docRef={
 onSnapshot(opts,cb){assert.equal(opts.includeMetadataChanges,true);snapListener=cb;cb({exists:true,metadata:{fromCache:false,hasPendingWrites:false},data:()=>currentDoc});return()=>{}},
 async get(opts){assert.equal(opts.source,"server");return {exists:true,data:()=>currentDoc}}
};
const database={collection(name){assert.equal(name,"kanban");return {doc(uid){assert.equal(uid,"fixture-user");return docRef}}}};
const auth={onAuthStateChanged(cb){cb({uid:"fixture-user"})}};
const firebase={apps:[{}],auth:()=>auth,firestore:()=>database};
const window={firebase,INOVTEC_FIREBASE_CONFIG:{projectId:"fixture"},__IV_CAPACITY_DASHBOARD_V1__:false};
const URL={createObjectURL(blob){const id="blob:test"+urls.size;urls.set(id,blob);return id},revokeObjectURL(){}};
runInNewContext(source,{window,document,firebase,URL,Blob,setTimeout:()=>1,console,Date,JSON,navigator:{onLine:true}});
const pct=Math.round(new Blob([JSON.stringify(currentDoc)]).size/1048576*100);
assert.equal(el("ivCapText").textContent,pct+" %");
assert.equal(el("ivCapModalBar").style.width,Math.min(100,pct)+"%");
assert.equal(el("ivCapWidget").dataset.level,"warning");
assert.ok(!el("ivCapSize").textContent.includes("illimité"));
el("ivCapBackup").listeners.click();
await new Promise(resolve=>setTimeout(resolve,20));
assert.equal(downloads.length,1);
assert.ok(downloads[0].file.startsWith("INOVTEC-sauvegarde-principale-"));
const backup=JSON.parse(await urls.get(downloads[0].url).text());
assert.equal(backup.format,"inovtec-personal-backup-v1");
assert.equal(backup.document.moduleSyncV1.planning.payload,JSON.stringify(planning));
el("ivCapArchive").listeners.click();
await new Promise(resolve=>setTimeout(resolve,20));
assert.equal(downloads.length,2);
const archive=JSON.parse(await urls.get(downloads[1].url).text());
assert.equal(archive.format,"inovtec-planning-weeks-archive-v1");
assert.deepEqual(Object.keys(archive.weeks),[oldWeek]);
assert.equal(archive.weekCount,1);
assert.ok(el("ivCapFeedback").textContent.includes("Rien n'a été effacé"));
console.log("OK : jauge à "+pct+" %, sauvegarde JSON, archives historiques, aucune écriture Firestore.");
