#!/usr/bin/env python3
"""Correctif ciblé et vérifié : migration Organisation lorsque personal.tasks est absent.
Ne lit ni ne modifie aucune donnée Firebase réelle ; ne change que le fichier source.
"""
from pathlib import Path
import subprocess

path = Path('ORGA-LEGACY.html')
expected_blob = '39c0e27c14fa186711cff260c0b3d29f801fba21'
actual_blob = subprocess.check_output(['git', 'hash-object', str(path)], text=True).strip()
if actual_blob != expected_blob:
    raise SystemExit('Source Organisation modifiée depuis l’audit : arrêt sans changement.')
src = path.read_text(encoding='utf-8')
old_declaration = '  let draggedId = null;\n'
new_declaration = '  let draggedId = null;\n  let migrationPending = false;\n'
old_handler = '''  function startRealtime(){
    if(unsubscribe){ unsubscribe(); unsubscribe = null; }
    setSync("Synchronisation…");
    unsubscribe = db.collection("kanban").doc(currentUser.uid).onSnapshot(snap=>{
      syncingFromCloud = true;
      if(snap.exists && Array.isArray(snap.data().tasks)){
        tasks = snap.data().tasks;
        saveLocal();
      }else{
        loadLocal();
        if(tasks.length) saveCloud();
      }
      render();
      setSync("Synchronisé","ok");
      setTimeout(()=>{ syncingFromCloud = false; },0);
    }, error=>{
      console.error(error);
      loadLocal();
      render();
      setSync("Mode local","warning");
    });
  }
'''
new_handler = '''  function startRealtime(){
    if(unsubscribe){ unsubscribe(); unsubscribe = null; }
    setSync("Synchronisation…");
    unsubscribe = db.collection("kanban").doc(currentUser.uid).onSnapshot(snap=>{
      syncingFromCloud = true;
      if(snap.exists && Array.isArray(snap.data().tasks)){
        tasks = snap.data().tasks;
        saveLocal();
        setSync("Synchronisé","ok");
      }else{
        loadLocal();
        if(tasks.length && !migrationPending && currentUser){
          // Une lecture distante ne doit pas se transformer en remplacement aveugle
          // de tâches déjà présentes dans le document partagé ou personnel.
          migrationPending = true;
          const owner = currentUser.uid;
          const localCopy = JSON.parse(JSON.stringify(tasks));
          setSync("Vérification des tâches partagées…");
          db.collection("chantiers").doc("__inovtec_shared_workspace_v1__").get()
            .then(shared=>{
              if(currentUser?.uid !== owner) return;
              if(shared.exists && Array.isArray(shared.data()?.tasks)){
                setSync("Reprise depuis l’espace partagé en cours…");
                return;
              }
              // Relecture serveur immédiatement avant la migration : ne jamais
              // remplacer une liste créée entre-temps par un autre appareil.
              return db.collection("kanban").doc(owner).get({source:"server"}).then(fresh=>{
                if(currentUser?.uid !== owner) return;
                if(fresh.exists && Array.isArray(fresh.data()?.tasks)) return;
                return db.collection("kanban").doc(owner).set({
                  tasks:localCopy,
                  updatedAt:firebase.firestore.FieldValue.serverTimestamp()
                },{merge:true}).then(()=>setSync("Tâches locales enregistrées sur Firebase","ok"));
              });
            })
            .catch(error=>{
              console.error("Reprise Firebase des tâches locales",error);
              setSync("Reprise Firebase impossible — tâches locales conservées","warning");
            })
            .finally(()=>{migrationPending=false;});
        }else if(!tasks.length){
          setSync("Aucune tâche enregistrée","ok");
        }
      }
      render();
      setTimeout(()=>{ syncingFromCloud = false; },0);
    }, error=>{
      console.error(error);
      loadLocal();
      render();
      setSync("Mode local","warning");
    });
  }
'''
for label, old in [('déclaration', old_declaration), ('synchronisation', old_handler)]:
    if src.count(old) != 1:
        raise SystemExit(f'Fragment {label} non unique ou absent : arrêt sans changement.')
updated = src.replace(old_declaration, new_declaration, 1).replace(old_handler, new_handler, 1)
if updated == src or 'if(tasks.length) saveCloud();' in updated:
    raise SystemExit('Correctif non appliqué intégralement : arrêt.')
path.write_text(updated, encoding='utf-8')
print('Organisation : migration des tâches locales protégée et écriture Firebase rétablie.')
