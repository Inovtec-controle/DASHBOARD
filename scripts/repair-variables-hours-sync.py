from pathlib import Path
p=Path('variables.js');s=p.read_text(encoding='utf-8')
def once(old,new):
 global s
 n=s.count(old)
 if n!=1: raise SystemExit(f'Expected one occurrence ({n}): {old[:105]}')
 s=s.replace(old,new,1)
def block(start,end,new):
 global s
 if s.count(start)!=1 or s.count(end)!=1:raise SystemExit('Nonunique source anchors: '+start[:75])
 a=s.index(start);b=s.index(end,a)
 s=s[:a]+new+s[b:]

once('let leaveEditRevision=null, leaveCloudReady=false, variablesCloudReady=false;', '''let leaveEditRevision=null, leaveCloudReady=false, variablesCloudReady=false;
let variableEditRevision=null, confirmedVariables=null, variableSaveInProgress=false, firstVariablesMigration=false;
''')
once('function openModal(){leaveEditRevision=null;resetForm();', 'function openModal(){leaveEditRevision=null;variableEditRevision=null;resetForm();')
once("  leaveEditRevision=r.source==='conges'?String(leaves.find(l=>String(l.id)===String(r.id))?.updatedAt||''):null;", "  leaveEditRevision=r.source==='conges'?String(leaves.find(l=>String(l.id)===String(r.id))?.updatedAt||''):null;\n  variableEditRevision=r.source==='variables'?String(state.entries.find(x=>String(x.id)===String(r.id))?.updatedAt||''):null;")
once('  const siteId=$("formSite").value,c=chantiers.find(x=>String(x.id)===String(siteId));let entry=source==="variables"?state.entries.find(x=>x.id===id):null;', '''  const siteId=$("formSite").value,c=chantiers.find(x=>String(x.id)===String(siteId));let entry=source==="variables"?state.entries.find(x=>x.id===id):null;
  if(id&&source==="variables"&&(!entry||entry.deleted||String(entry.updatedAt||"")!==String(variableEditRevision||"")))return alert("Cette variable a changé sur l’autre appareil. Rouvrez sa fiche.");''')
once('  if(r.source==="conges"){\n    const old=', '  if(r.source==="conges"){\n    const old=') if False else None
once('  const e=state.entries.find(x=>x.id===r.id);if(e){e.deleted=true;e.updatedAt=isoNow();markDraft(e.agentRefId);saveAndPush("delete");render()}', '''  const e=state.entries.find(x=>x.id===r.id);
  if(e&&!e.deleted){
    if(r.updatedAt&&String(e.updatedAt||"")!==String(r.updatedAt))return alert("Cette variable a changé. Actualisez la liste.");
    e.deleted=true;e.updatedAt=isoNow();markDraft(e.agentRefId);saveAndPush("delete");render();
  }''')
once(' closeModal();deleteRow({id,source,agentRefId:$("formAgent").value});', ''' if(source==="variables"&&String(state.entries.find(e=>String(e.id)===String(id))?.updatedAt||"")!==String(variableEditRevision||""))return alert("Cette variable a changé sur l’autre appareil. Rouvrez sa fiche.");
 closeModal();deleteRow({id,source,agentRefId:$("formAgent").value,updatedAt:variableEditRevision});''')
block('function mergeState(remote,local){\n','// Congés owns this collection.', '''function cloneVariableState(value){return cleanState(parse(JSON.stringify(value||{}),{}))}
function variableRowsById(items){return new Map((items||[]).filter(e=>e?.id).map(e=>[String(e.id),e]))}
async function saveAndPush(reason){
  const f=fb(),u=f?.auth()?.currentUser,base=confirmedVariables?cloneVariableState(confirmedVariables):null;
  if(!f||!u||!docRef||!variablesCloudReady||!base||variableSaveInProgress){
    syncNotice("Firebase non confirmé ou sauvegarde déjà en cours : variable non enregistrée.",true);
    if(base){state=cloneVariableState(base);saveLocal();render()}
    return false;
  }
  const intended=cloneVariableState(state),oldEntries=variableRowsById(base.entries);
  const changed=intended.entries.filter(e=>e?.id&&JSON.stringify(e)!==JSON.stringify(oldEntries.get(String(e.id))));
  const changedStatuses=Object.entries(intended.monthStatus||{}).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(base.monthStatus?.[key]));
  const changedMeta=Object.entries(intended.meta||{}).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(base.meta?.[key]));
  if(!changed.length&&!changedStatuses.length&&!changedMeta.length)return true;
  variableSaveInProgress=true;syncNotice("Synchronisation des variables…");
  let committed=null;
  try{
    await f.firestore().runTransaction(async tx=>{
      const snap=await tx.get(docRef),raw=snap.exists?snap.data()?.moduleSyncV1?.variables:null;
      if(raw&&typeof raw.payload!=="string")throw Error("Variables Firebase illisibles : aucune modification effectuée.");
      const parsed=raw?parse(raw.payload,null):{version:1,entries:[],monthStatus:{},meta:{}};
      if(!parsed||!Array.isArray(parsed.entries))throw Error("Variables Firebase invalides : aucune modification effectuée.");
      if(reason==="migration"&&raw)throw Error("Des variables existent déjà sur l’autre appareil : la copie locale n’a pas été importée.");
      const cloud=cloneVariableState(parsed),rows=variableRowsById(cloud.entries);
      for(const rec of changed){
        const key=String(rec.id),before=oldEntries.get(key),existing=rows.get(key);
        if(before){
          if(!existing||String(existing.updatedAt||"")!==String(before.updatedAt||"")||!!existing.deleted!==!!before.deleted)
            throw Error("Une variable a changé sur l’autre appareil. Actualisez la page avant de réessayer.");
          if(before.deleted&&!rec.deleted)throw Error("Une variable supprimée ne peut pas réapparaître.");
          const pos=cloud.entries.findIndex(e=>String(e?.id)===key);cloud.entries[pos]=rec;
        }else{
          if(existing)throw Error("Une variable portant cet identifiant existe déjà dans Firebase.");
          if(rec.legacyHourId&&cloud.entries.some(e=>e.legacyHourId&&String(e.legacyHourId)===String(rec.legacyHourId)))continue;
          if(reason.startsWith("migrate-")&&cloud.meta.legacyHoursMigrated)continue;
          cloud.entries.push(rec);
        }
      }
      for(const [key,value] of changedStatuses){
        const before=base.monthStatus?.[key],existing=cloud.monthStatus?.[key];
        if(String(existing?.updatedAt||"")!==String(before?.updatedAt||""))
          throw Error("Le statut de cette variable a changé sur l’autre appareil. Actualisez la page.");
        cloud.monthStatus[key]=value;
      }
      for(const [key,value] of changedMeta){
        if(key==="legacyHoursMigrated"&&cloud.meta.legacyHoursMigrated)continue;
        if(JSON.stringify(cloud.meta?.[key])!==JSON.stringify(base.meta?.[key]))continue;
        cloud.meta[key]=value;
      }
      committed=cloud;
      tx.set(docRef,{moduleSyncV1:{variables:{payload:JSON.stringify(cloud),updatedAtMs:Date.now(),client:"variables_"+u.uid.slice(0,6),reason,version:2}}},{merge:true});
    });
    if(committed){state=cloneVariableState(committed);confirmedVariables=cloneVariableState(committed);saveLocal();localStorage.setItem("inovtec_variables_cloud_seen_"+u.uid,"1");localStorage.setItem("inovtec_variables_cache_uid",u.uid);render()}
    syncNotice("Variables synchronisées avec Firebase");return true;
  }catch(error){
    console.warn("Variables Firebase",error);syncNotice(error?.message||"Variables non enregistrées : Firebase indisponible.",true);
    if(confirmedVariables){state=cloneVariableState(confirmedVariables);saveLocal();render()}
    if(reason!=="migration")alert(error?.message||"Variables non enregistrées : Firebase indisponible.");
    return false;
  }finally{variableSaveInProgress=false}
}
''')
once('  if(state.meta?.legacyHoursMigrated||!agents.length||!variablesReady||!legacyHoursResolved)return;', '  if(state.meta?.legacyHoursMigrated||!agents.length||!variablesReady||!legacyHoursResolved||!variablesCloudReady||!confirmedVariables||variableSaveInProgress)return;')
once('  if(!f){variablesReady=true;legacyHoursResolved=true;maybeMigrateLegacyHours();return}', '  if(!f){variablesReady=false;legacyHoursResolved=false;syncNotice("Firebase indisponible : enregistrement désactivé.",true);return}')
once('    if(!user){docRef=null;$("loginBox").classList.add("open");variablesReady=true;legacyHoursResolved=true;maybeMigrateLegacyHours();return}', '    if(!user){docRef=null;confirmedVariables=null;$("loginBox").classList.add("open");variablesReady=false;legacyHoursResolved=false;return}')
once('      variablesCloudReady=confirmed;\n      const d=s.exists?', '      variablesCloudReady=confirmed;\n      const d=s.exists?')
once('      if(ve?.payload){state=mergeState(parse(ve.payload,{}),state);saveLocal()}else if(state.entries.length||Object.keys(state.monthStatus).length)saveAndPush("migration");', '''      if(ve&&typeof ve.payload==="string"){
        const parsed=parse(ve.payload,null);
        if(parsed&&Array.isArray(parsed.entries)){
          confirmedVariables=cloneVariableState(parsed);
          if(!variableSaveInProgress){state=cloneVariableState(parsed);saveLocal()}
          if(confirmed){localStorage.setItem("inovtec_variables_cloud_seen_"+user.uid,"1");localStorage.setItem("inovtec_variables_cache_uid",user.uid)}
        }else{variablesCloudReady=false;syncNotice("Variables Firebase illisibles : aucune écriture autorisée.",true)}
      }else if(confirmed&&!variableSaveInProgress){
        const seen=localStorage.getItem("inovtec_variables_cloud_seen_"+user.uid)==="1";
        const wrongUser=!!localStorage.getItem("inovtec_variables_cache_uid")&&localStorage.getItem("inovtec_variables_cache_uid")!==user.uid;
        if(!seen&&!wrongUser&&!firstVariablesMigration&&(state.entries.length||Object.keys(state.monthStatus).length||Object.keys(state.meta).length)){
          confirmedVariables=cleanState({});firstVariablesMigration=true;
          saveAndPush("migration").finally(()=>{firstVariablesMigration=false});
        }else if(!firstVariablesMigration){state=cleanState({});confirmedVariables=cleanState({});saveLocal()}
      }''')
once('    },e=>{console.warn("Variables lecture Firebase",e);variablesReady=true;legacyHoursResolved=true;maybeMigrateLegacyHours()});', '    },e=>{console.warn("Variables lecture Firebase",e);variablesCloudReady=false;variablesReady=false;legacyHoursResolved=false;syncNotice("Firebase inaccessible : enregistrement désactivé.",true)});')
# Remember the record version selected when the form was opened, before asynchronous updates.
once('  if(id&&source==="variables"&&(!entry||entry.deleted||String(entry.updatedAt||"")!==String(variableEditRevision||"")))return alert("Cette variable a changé sur l’autre appareil. Rouvrez sa fiche.");','  if(id&&source==="variables"&&(!entry||entry.deleted||String(entry.updatedAt||"")!==String(variableEditRevision||"")))return alert("Cette variable a changé sur l’autre appareil. Rouvrez sa fiche.");') if False else None
if 'mergeState(' in s:raise SystemExit('Unsafe mergeState remains')
p.write_text(s,encoding='utf-8')
print('Variable hours: differential Firestore transaction and confirmed snapshots installed')
