import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';

const repairSource=readFileSync('inovtec-firebase-capacity-fix.js','utf8');
const directSource=readFileSync('planning-firebase-direct-v2.js','utf8');
assert.ok(directSource.includes('planningDirectV1:firebase.firestore.FieldValue.delete()'),
  'Le Planning doit retirer la copie secondaire lors de la sauvegarde');
assert.ok(!/planningDirectV1:\s*\{\s*payload:written/.test(directSource),
  'Le Planning ne doit pas dupliquer la charge utile de nouveau');

async function scenario(kind){
 const original='{"agents":[{"id":"alpha"}],"weeks":{"2026-W46":[{"id":"task"}]}}';
 const doc={
   moduleSyncV1:{planning:{payload:original,updatedAtMs:123},agents:{payload:'[{"id":"agent"}]'}},
   tasks:[{id:"keep"}],
   referentialAgents:[{id:"keep-agent"}]
 };
 if(kind==='identical')doc.planningDirectV1={payload:original,version:2,writeId:'old'};
 if(kind==='different')doc.planningDirectV1={payload:original+' different',version:2};
 const before={
   primary:JSON.stringify(doc.moduleSyncV1),
   tasks:JSON.stringify(doc.tasks),
   agents:JSON.stringify(doc.referentialAgents)
 };
 let writes=0;
 const deletionToken=Symbol('firebase-delete');
 const ref={get:async()=>({data:()=>doc})};
 const db={
   collection(name){assert.equal(name,'kanban');return {doc(uid){assert.equal(uid,'fixture-uid');return ref}}},
   async runTransaction(fn){
     return fn({
       get:async()=>({exists:true,data:()=>JSON.parse(JSON.stringify(doc))}),
       update(target,patch){
         assert.equal(target,ref);
         assert.equal(patch.planningDirectV1,deletionToken);
         writes++;delete doc.planningDirectV1;
       }
     });
   }
 };
 let handler;
 const auth={currentUser:{uid:'fixture-uid'},onAuthStateChanged(fn){handler=fn;Promise.resolve().then(()=>fn(this.currentUser))}};
 const firebase={
   apps:[],
   initializeApp(){this.apps.push({})},
   auth:()=>auth,
   firestore:Object.assign(()=>db,{FieldValue:{delete:()=>deletionToken}})
 };
 const window={firebase,INOVTEC_FIREBASE_CONFIG:{projectId:'fixture'},addEventListener(){},dispatchEvent(){}};
 window.top=window;
 runInNewContext(repairSource,{
   window,firebase,navigator:{onLine:true},setTimeout,console,
   CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}}
 });
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(JSON.stringify(doc.moduleSyncV1),before.primary,'Le document canonique a changé');
 assert.equal(JSON.stringify(doc.tasks),before.tasks,'Les tâches ont changé');
 assert.equal(JSON.stringify(doc.referentialAgents),before.agents,'Les agents ont changé');
 if(kind==='identical'){
   assert.equal(writes,1,'Le doublon strictement identique doit être retiré');
   assert.equal(doc.planningDirectV1,undefined);
   assert.equal(window.InovtecFirebaseCapacityFix.state,'repaired');
 }else if(kind==='different'){
   assert.equal(writes,0,'Des copies différentes ne doivent pas être modifiées');
   assert.ok(doc.planningDirectV1);
   assert.equal(window.InovtecFirebaseCapacityFix.state,'blocked');
 }else{
   assert.equal(writes,0,'Le nettoyage ne doit pas créer une écriture inutile');
   assert.equal(window.InovtecFirebaseCapacityFix.state,'ok');
 }
 // Ne pas recommencer de migration déjà validée pendant la même session.
 handler({uid:'fixture-uid'});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(writes,kind==='identical'?1:0);
}
for(const kind of ['identical','different','absent'])await scenario(kind);
console.log('OK : doublon retiré seulement si identique ; modules Agents, tâches et Planning principal intacts.');
