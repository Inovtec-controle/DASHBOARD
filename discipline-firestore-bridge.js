(function(){
  "use strict";
  if(!window.firebase || typeof firebase.firestore !== "function") return;

  function hiddenDoc(ref, type){
    return {
      get:function(){return ref.get();},
      onSnapshot:function(){return ref.onSnapshot.apply(ref,arguments);},
      set:function(data,options){return ref.set(Object.assign({_hidden:true,_type:type},data||{}),options);},
      update:function(){return ref.update.apply(ref,arguments);},
      delete:function(){return ref.delete();}
    };
  }

  function redirectedCollection(db, originalCollection, name){
    if(name!=="discipline" && name!=="kanban") return originalCollection.call(db,name);
    var real=originalCollection.call(db,"chantiers");
    return {
      doc:function(uid){
        var prefix=name==="discipline"?"__discipline_data__":"__discipline_backup__";
        var type=name==="discipline"?"disciplineData":"disciplineBackup";
        return hiddenDoc(real.doc(prefix+uid),type);
      }
    };
  }

  var FirestoreClass=firebase.firestore.Firestore;
  if(FirestoreClass && FirestoreClass.prototype && typeof FirestoreClass.prototype.collection==="function"){
    var originalCollection=FirestoreClass.prototype.collection;
    if(!originalCollection.__inovtecDisciplineBridge){
      var patched=function(name){return redirectedCollection(this,originalCollection,name);};
      patched.__inovtecDisciplineBridge=true;
      FirestoreClass.prototype.collection=patched;
    }
    return;
  }

  var originalFirestore=firebase.firestore;
  function wrappedFirestore(){
    var realDb=originalFirestore.apply(firebase,arguments);
    var originalCollection=realDb.collection;
    realDb.collection=function(name){return redirectedCollection(realDb,originalCollection,name);};
    return realDb;
  }
  Object.getOwnPropertyNames(originalFirestore).forEach(function(key){try{wrappedFirestore[key]=originalFirestore[key];}catch(e){}});
  try{firebase.firestore=wrappedFirestore;}catch(e){console.warn("Pont Firebase Discipline non installé",e);}
})();