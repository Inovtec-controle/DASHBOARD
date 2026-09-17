import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('inovtec-variables-sync-bridge.js','utf8');
const docs=new Map(),watchers=new Map();
const clone=x=>JSON.parse(JSON.stringify(x));
const refs=(key)=>({
 onSnapshot(next){const list=watchers.get(key)||new Set();list.add(next);watchers.set(key,list);queueMicrotask(()=>next({data:()=>clone(docs.get(key)||{})}));return()=>list.delete(next)},
 async set(patch){const old=docs.get(key)||{};docs.set(key,{...old,moduleSyncV1:{...(old.moduleSyncV1||{}),...(patch.moduleSyncV1||{})}});for(const next of watchers.get(key)||[])queueMicrotask(()=>next({data:()=>clone(docs.get(key)||{})}));}
});
const authHandlers=[];
const firebase={apps:[{}],auth:()=>({onAuthStateChanged(cb){authHandlers.push(cb)}}),firestore:()=>({collection(c){return {doc(id){return refs(c+'/'+id)}}}})};
const state=(entries,monthStatus={})=>({version:1,entries,monthStatus,meta:{}});
const entry=(id,minutes,date,deleted=false)=>({id,agentRefId:'agent',type:'heures_supplementaires',date:'2026-09-17',minutes,updatedAt:date,deleted});
const put=(key,value)=>docs.set(key,{moduleSyncV1:{variables:{payload:JSON.stringify(value)}}});
const shared='chantiers/__inovtec_shared_workspace_v1__';
const personal='kanban/user-phone';
const other='kanban/user-desktop';
const old='2026-09-17T08:00:00.000Z',newer='2026-09-17T09:00:00.000Z';
put(shared,state([entry('shared',30,old),entry('edited',30,old)]));
put(personal,state([entry('phone',120,newer),entry('edited',60,newer),entry('deleted',0,newer,true)]));
put(other,state([entry('desktop',45,old),entry('deleted',20,old)]));
function start(uid,initial){
 const values=new Map([['inovtec_variables_v1',JSON.stringify(initial)]]);
 const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const sessionStorage={getItem:k=>values.get('session:'+k)||null,setItem:(k,v)=>values.set('session:'+k,v)};
 const events=new Map();
 const window={firebase,INOVTEC_FIREBASE_CONFIG:{},addEventListener:(k,cb)=>events.set(k,cb),dispatchEvent:()=>{}};
 const document={hidden:false,getElementById:()=>null,addEventListener:()=>{}};
 const ctx={window,document,location:{search:'?mode=variables'},URLSearchParams,localStorage,sessionStorage,Blob,Date,console,setTimeout,clearTimeout,setInterval:()=>0,CustomEvent:class{constructor(type){this.type=type}}};
 vm.runInNewContext(source,ctx);
 authHandlers.at(-1)({uid});
 return {get:()=>JSON.parse(values.get('inovtec_variables_v1')),values};
}
const phone=start('user-phone',state([entry('local-only',25,newer)]));
const desktop=start('user-desktop',state([]));
await new Promise(resolve=>setTimeout(resolve,800));
const remote=JSON.parse(docs.get(shared).moduleSyncV1.variables.payload);
const ids=new Set(remote.entries.map(e=>e.id));
for(const id of ['phone','desktop','shared','local-only','edited','deleted'])assert.ok(ids.has(id),'Entrée manquante : '+id);
assert.equal(remote.entries.find(e=>e.id==='edited').minutes,60,'La modification récente doit prévaloir');
assert.equal(remote.entries.find(e=>e.id==='deleted').deleted,true,'La suppression récente doit rester une tombstone');
assert.deepEqual(new Set(phone.get().entries.map(e=>e.id)),ids,'Le téléphone reçoit les autres saisies');
assert.deepEqual(new Set(desktop.get().entries.map(e=>e.id)),ids,'L’ordinateur reçoit les saisies du téléphone');
assert.deepEqual(new Set(JSON.parse(docs.get(personal).moduleSyncV1.variables.payload).entries.map(e=>e.id)),ids);
assert.deepEqual(new Set(JSON.parse(docs.get(other).moduleSyncV1.variables.payload).entries.map(e=>e.id)),ids);
assert.ok([...phone.values.keys()].some(k=>k.startsWith('iv_variables_backup_local_')),'Sauvegarde locale avant fusion');
console.log('PASS : fusion Firebase, 2 appareils, comptes différents, mise à jour récente, tombstones, sauvegarde locale.');
