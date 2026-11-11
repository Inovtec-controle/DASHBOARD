import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

const cloud=fs.readFileSync("kontrol-cloud.js","utf8");
const history=fs.readFileSync("inovtec-info-control-history.js","utf8");

// La fiche lit directement les documents liés à la résidence, sans attendre
// qu'un abonnement global à tous les contrôles du compte ait abouti.
const startHistory=history.indexOf("function bindSelectedSiteIndex(){");
const endHistory=history.indexOf("function activityRows(siteId){",startHistory);
assert(startHistory>=0&&endHistory>startHistory,"Liaison historique résidence introuvable");
const linked=history.slice(startHistory,endHistory);
assert.match(linked,/where\("chantierId","==",siteId\)\.onSnapshot/);
assert.match(linked,/upsertRecords\(linkedRows\.filter\(x=>x\._type===RECORD_TYPE\)\)/);
assert.match(linked,/upsertMetas\(linkedRows\.filter\(x=>x\._type===META_TYPE\)\)/);

// La saisie Firebase est prioritaire : un échec du PDF ne doit pas effacer
// un contrôle déjà réalisé.
const saveClick=cloud.slice(cloud.indexOf('saveControlBtn.addEventListener("click"'),cloud.indexOf("  function safeFileName("));
assert(saveClick.indexOf("await saveControlDirect();")>=0);
assert(saveClick.indexOf("await saveControlDirect();")<saveClick.indexOf("await generate();"),"Le contrôle doit être enregistré avant le PDF");
assert.match(saveClick,/controlSaved\s*=\s*true/);

const startSave=cloud.indexOf("  async function saveControlDirect() {");
const endSave=cloud.indexOf("  async function archivePdfBlob(",startSave);
assert(startSave>=0&&endSave>startSave,"Sauvegarde Firebase du contrôle introuvable");
const source=cloud.slice(startSave,endSave);
const store=new Map([["residence-a",{nom:"Résidence A"}]]);
let serverReads=0,commitCount=0;
const firebase={firestore:{FieldValue:{arrayUnion:(...values)=>({__union:values})}}};
const db={
  collection(name){
    assert.equal(name,"chantiers");
    return {doc(id){
      return {id,async get(options){
        assert.equal(options?.source,"server","La confirmation doit lire le serveur");
        serverReads++;
        const record=store.get(id);
        return {id,exists:!!record,data:()=>record};
      }};
    }};
  },
  batch(){
    const writes=[];
    return {
      set(ref,data){writes.push([ref.id,data]);},
      async commit(){
        commitCount++;
        for(const [id,data] of writes){
          const previous=store.get(id)||{};
          const values={...previous};
          for(const [key,value] of Object.entries(data)){
            values[key]=value?.__union
              ? [...new Set([...(Array.isArray(values[key])?values[key]:[]),...value.__union])]
              : value;
          }
          store.set(id,values);
        }
      }
    };
  }
};
const hash=value=>createHash("sha256").update(String(value)).digest("hex").slice(0,16);
const input={
  site:"Résidence A",chantierId:"residence-a",controlDate:"2026-11-11",
  controlTime:"10:15",controller:"Contrôleur test",agents:"Agent test",
  category:"Résidence",score:"88 %",observations:"RAS"
};
const fixture=new Function("deps",`
  const {db,auth,firebase,hash,resolveChantierId,readKontrolMetadata,readKontrolTasks,readKontrolPhotos,window,CustomEvent}=deps;
  let pendingDirectControl=null;
  const DIRECT_CONTROL_TYPE="kontrolControlRecord";
  ${source}
  return {saveControlDirect};
`)({
  db,firebase,hash,resolveChantierId:async details=>details.chantierId,auth:{currentUser:{uid:"test-user",email:"test@example.invalid"}},
  readKontrolMetadata:()=>input,
  readKontrolTasks:()=>[{taskId:"task-1",title:"Hall",status:"ok",comment:""}],
  readKontrolPhotos:()=>[],
  window:{dispatchEvent(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}}
});

const first=await fixture.saveControlDirect();
assert.equal(first.chantierId,"residence-a");
assert.equal(store.get(first.recordId)?.chantierId,"residence-a");
assert.deepEqual(store.get("residence-a")?.kontrolHistoryRecordIds,[first.recordId]);
assert.equal(serverReads,2,"Le contrôle et l'index résidence doivent être relus sur le serveur");

const retry=await fixture.saveControlDirect();
assert.equal(retry.recordId,first.recordId,"Relancer le PDF ne doit pas dupliquer le contrôle");
assert.equal(store.get("residence-a").kontrolHistoryRecordIds.length,1);
assert.equal(commitCount,2,"Les nouvelles tentatives doivent rester idempotentes");

console.log("KONTROL : lien historique temps réel, sauvegarde prioritaire, confirmation serveur et nouvelle tentative sans doublon OK");
