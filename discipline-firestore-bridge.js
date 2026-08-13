(function(){
  "use strict";
  if(!window.firebase || typeof firebase.firestore !== "function") return;

  var originalFirestore = firebase.firestore;

  function hiddenDoc(ref, type){
    return {
      get: function(){ return ref.get(); },
      onSnapshot: function(){ return ref.onSnapshot.apply(ref, arguments); },
      set: function(data, options){
        var payload = Object.assign({_hidden:true, _type:type}, data || {});
        return ref.set(payload, options);
      },
      update: function(){ return ref.update.apply(ref, arguments); },
      delete: function(){ return ref.delete(); }
    };
  }

  function wrappedFirestore(){
    var realDb = originalFirestore.apply(firebase, arguments);
    return new Proxy(realDb, {
      get: function(target, prop){
        if(prop === "collection"){
          return function(name){
            if(name === "discipline"){
              return {
                doc: function(uid){
                  return hiddenDoc(target.collection("chantiers").doc("__discipline_data__" + uid), "disciplineData");
                }
              };
            }
            if(name === "kanban"){
              return {
                doc: function(uid){
                  return hiddenDoc(target.collection("chantiers").doc("__discipline_backup__" + uid), "disciplineBackup");
                }
              };
            }
            return target.collection(name);
          };
        }
        var value = target[prop];
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
  }

  Object.getOwnPropertyNames(originalFirestore).forEach(function(key){
    try{ wrappedFirestore[key] = originalFirestore[key]; }catch(e){}
  });
  firebase.firestore = wrappedFirestore;
})();