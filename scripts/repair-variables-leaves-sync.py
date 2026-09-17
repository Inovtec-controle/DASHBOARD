from pathlib import Path
p=Path('variables.js')
s=p.read_text(encoding='utf-8')

def once(a,b):
 global s
 n=s.count(a)
 if n!=1: raise SystemExit(f'Expected one occurrence ({n}): {a[:90]}')
 s=s.replace(a,b,1)

def block(a,b,new):
 global s
 if s.count(a)!=1 or s.count(b)!=1: raise SystemExit(f'Expected unique anchors {a[:70]} {b[:70]}')
 i=s.index(a); j=s.index(b,i)
 s=s[:i]+new+s[j:]

once('let planningSuggestions=[];', '''let planningSuggestions=[];
// An absence is edited against the exact revision opened by the user.
let leaveEditRevision=null, leaveCloudReady=false, variablesCloudReady=false;
function syncNotice(message,error=false){
 let el=document.getElementById('variablesFirebaseNotice');
 if(!el){el=document.createElement('div');el.id='variablesFirebaseNotice';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.style.cssText='font:600 12px Inter,sans-serif;padding:8px 12px;white-space:normal';document.querySelector('.top')?.after(el)}
 el.textContent=message;el.style.color=error?'#ad382d':'#12623e';
}
''')
once('function openModal(){resetForm();', 'function openModal(){leaveEditRevision=null;resetForm();')
once('function openEdit(r){\n  buildFormOptions();', '''function openEdit(r){
  leaveEditRevision=r.source==='conges'?String(leaves.find(l=>String(l.id)===String(r.id))?.updatedAt||''):null;
  buildFormOptions();''')
start='  if(wantsAbs){\n';end='  const minutes=parseDuration($("formDuration").value);'
assert s.count(start)==1
block(start,end,'''  if(wantsAbs){
    const start=$("formStart").value,end=$("formEnd").value;
    if(!start||!end||end<start)return alert("Vérifiez les dates de début et de fin.");
    const old=source==="conges"?leaves.find(x=>String(x.id)===String(id)):null;
    if(id&&source==="conges"&&!old)return alert("Cette absence a changé. Rechargez sa fiche.");
    const timestamp=isoNow();
    const rec={id:old?.id||uid("leave"),agentRefId:agentId,agentName:displayAgent(a),sourceType:old?.sourceType||"absence",type:TYPE_TO_LEAVE[type]||"Autre absence",startDate:start,endDate:end,startPart:$("formStartPart").value,endPart:$("formEndPart").value,comment:$("formNote").value.trim(),status:old?.status||"approved",payrollMeta:{...(old?.payrollMeta||{}),justificatif:$("formDoc").checked,updatedFrom:"variables",updatedAt:timestamp},createdAt:old?.createdAt||timestamp,updatedAt:timestamp};
    const ok=await saveLeaveChange(old?"edit":"create",rec,leaveEditRevision);
    if(ok){closeModal();markDraft(agentId);await saveAndPush("absence-changed");render()}
    return;
  }
''')
once('  if(r.source==="conges"){leaves=leaves.filter(x=>x.id!==r.id);markDraft(r.agentRefId);pushLeaves("variables-delete-absence");render();return}', '''  if(r.source==="conges"){
    const old=leaves.find(x=>String(x.id)===String(r.id));
    if(!old)return alert("Cette absence a changé. Actualisez la page.");
    saveLeaveChange("delete",{id:old.id},String(old.updatedAt||"")).then(async ok=>{
      if(ok){markDraft(r.agentRefId);await saveAndPush("absence-deleted");render()}
    });
    return;
  }''')
once('function deleteCurrent(){const id=$("editId").value,source=$("editSource").value;if(!id)return;closeModal();deleteRow({id,source,agentRefId:$("formAgent").value})}', '''function deleteCurrent(){
 const id=$("editId").value,source=$("editSource").value;if(!id)return;
 if(source==="conges"){
   if(!confirm("Supprimer cette variable ?"))return;
   const agentId=$("formAgent").value;
   saveLeaveChange("delete",{id},leaveEditRevision).then(async ok=>{
     if(ok){closeModal();markDraft(agentId);await saveAndPush("absence-deleted");render()}
   });
   return;
 }
 closeModal();deleteRow({id,source,agentRefId:$("formAgent").value});
}''')
block('async function pushLeaves(reason){\n','function bindHub(){\n','''// Congés owns this collection. Variables updates exactly one record in a
// server-side transaction; it must never write its entire cached list.
async function saveLeaveChange(kind,record,expected){
 const f=fb(),u=f?.auth()?.currentUser;
 if(!f||!u||!docRef||!variablesCloudReady||(!leaveCloudReady&&leaves.length)){
   syncNotice("Firebase non confirmé : absence non enregistrée. Ouvrez Congés si une reprise de données est nécessaire.",true);
   return false;
 }
 syncNotice("Synchronisation de l’absence…");
 try{
   const reference=docRef,uidAtStart=u.uid;
   await f.firestore().runTransaction(async tx=>{
     const snap=await tx.get(reference);
     const entry=snap.exists?snap.data()?.moduleSyncV1?.conges:null;
     if(entry&&typeof entry.payload!=="string")throw Error("Format Firebase des absences invalide.");
     const rows=entry?parse(entry.payload,null):[];
     if(!Array.isArray(rows))throw Error("Absences Firebase illisibles : enregistrement bloqué.");
     if(kind!=="create"&&!entry)throw Error("Absence introuvable dans Firebase.");
     const pos=rows.findIndex(r=>String(r?.id)===String(record.id)),previous=pos<0?null:rows[pos];
     if(kind==="create"&&previous)throw Error("Cette absence existe déjà sur l’autre appareil.");
     if(kind!=="create"&&(!previous||previous.deleted||String(previous.updatedAt||"")!==String(expected||"")))throw Error("Cette absence a changé sur l’autre appareil. Rouvrez sa fiche avant de réessayer.");
     const next=rows.slice();
     if(kind==="create")next.push(record);
     else if(kind==="delete")next[pos]={...previous,deleted:true,status:"cancelled",updatedAt:isoNow()};
     else next[pos]={...previous,...record};
     tx.set(reference,{moduleSyncV1:{conges:{payload:JSON.stringify(next),updatedAtMs:Date.now(),client:"variables_"+uidAtStart.slice(0,6),reason:"variables-"+kind,version:2}}},{merge:true});
   });
   syncNotice("Absence synchronisée avec Firebase");return true;
 }catch(error){console.warn("Variables / congés Firebase",error);syncNotice(error?.message||"Enregistrement Firebase impossible.",true);alert(error?.message||"Absence non enregistrée : Firebase indisponible.");return false}
}
''')
once('    unsub=docRef.onSnapshot(s=>{\n      const d=s.exists?', '''    unsub=docRef.onSnapshot({includeMetadataChanges:true},s=>{
      const confirmed=!(s.metadata?.fromCache||s.metadata?.hasPendingWrites);
      variablesCloudReady=confirmed;
      const d=s.exists?''')
once('      if(ce?.payload){const r=parse(ce.payload,[]);if(Array.isArray(r)){leaves=r;saveLeavesLocal()}}else if(leaves.length)pushLeaves("migration");', '''      if(ce&&typeof ce.payload==="string"){
        const r=parse(ce.payload,null);
        if(Array.isArray(r)){
          leaves=r;saveLeavesLocal();leaveCloudReady=confirmed;
          if(confirmed){localStorage.setItem("inovtec_conges_cloud_seen_"+user.uid,"1");localStorage.setItem("inovtec_conges_cache_uid",user.uid)}
        }else{leaveCloudReady=false;syncNotice("Absences Firebase illisibles : aucune écriture autorisée.",true)}
      }else{
        leaveCloudReady=confirmed&&!leaves.length;
        if(confirmed&&leaves.length)syncNotice("Absences locales à reprendre : ouvrez Congés & absences avant de modifier depuis Variables.",true);
      }''')
once('    user=u||null;if(unsub){try{unsub()}catch{}unsub=null}', '    user=u||null;variablesCloudReady=false;leaveCloudReady=false;if(unsub){try{unsub()}catch{}unsub=null}')
if 'pushLeaves(' in s: raise SystemExit('Unexpected remaining legacy pushLeaves reference')
p.write_text(s,encoding='utf-8')
print('Variables / congés: transactional single-record writes installed')
