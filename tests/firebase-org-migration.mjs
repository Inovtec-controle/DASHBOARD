import { chromium } from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const scenarios=[
  {name:"Copie locale migrée uniquement si les sources Firebase n'existent pas",canonical:null,personal:null,shared:null,local:[{id:"local-a",title:"Depuis ordinateur"}],expected:["local-a"]},
  {name:"Ancienne source Firebase partagée retrouvée",canonical:null,personal:null,shared:{tasks:[{id:"shared-a",title:"Depuis autre appareil"}]},local:[{id:"old-local",title:"Ancien cache"}],expected:["shared-a"]},
  {name:"Liste distante vide respectée",canonical:null,personal:null,shared:{tasks:[]},local:[{id:"deleted",title:"Tâche effacée"}],expected:[]},
  {name:"Tâches Firebase personnelles reprises",canonical:null,personal:{tasks:[{id:"personal-a",title:"Copie personnelle"}]},shared:null,local:[],expected:["personal-a"]},
  {name:"Source principale prioritaire sans écrasement",canonical:{tasks:[{id:"current-a",title:"À conserver"}]},personal:{tasks:[{id:"old-a",title:"Sauvegarde ancienne"}]},shared:null,local:[],expected:["current-a"],offerRecovery:true},
  {name:"Ancienne source récente prioritaire",canonical:null,personal:{tasks:[{id:"personal-new",title:"Nouveau"}],tasksUpdatedAtMs:300},shared:{tasks:[{id:"shared-old",title:"Ancien"}],tasksUpdatedAtMs:100},local:[],expected:["personal-new"]}
];
try{
  for(const scenario of scenarios){
    const context=await browser.newContext({serviceWorkers:"block"});
    await context.addInitScript(sc=>{
      localStorage.setItem("orga_task_board_v2",JSON.stringify(sc.local));
      const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
      const state={canonical:clone(sc.canonical),personal:clone(sc.personal),shared:clone(sc.shared),writes:[],watchers:{canonical:[],personal:[],shared:[]}};
      window.__orgMigration=state;
      const key=(collection,id)=>collection==="kanban"?"personal":id==="inovtec_organisation_tasks_v2"?"canonical":"shared";
      const snap=k=>({exists:state[k]!==null,data:()=>state[k]||{},metadata:{fromCache:false,hasPendingWrites:false}});
      const set=(k,data)=>{
        state[k]={...(state[k]||{}),...clone(data)};
        state.writes.push(k);
        queueMicrotask(()=>state.watchers[k].forEach(cb=>cb(snap(k))));
      };
      const db={
        collection:collection=>({doc:id=>{
          const k=key(collection,id);
          return{
            key:k,
            onSnapshot(options,callback){const cb=typeof options==="function"?options:callback;state.watchers[k].push(cb);queueMicrotask(()=>cb(snap(k)));return()=>{state.watchers[k]=state.watchers[k].filter(fn=>fn!==cb)};},
            get(){return Promise.resolve(snap(k))},
            set(data){set(k,data);return Promise.resolve();}
          };
        }}),
        async runTransaction(fn){
          const writes=[];
          const tx={get:ref=>Promise.resolve(snap(ref.key)),set:(ref,data)=>writes.push([ref.key,data])};
          await fn(tx);
          writes.forEach(([k,data])=>set(k,data));
        }
      };
      const auth={currentUser:{uid:"test-user",email:"test@example.com"},onAuthStateChanged(cb){queueMicrotask(()=>cb(this.currentUser));return()=>{}},signOut(){return Promise.resolve()}};
      const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=>({toMillis:()=>Date.now()})};
      window.firebase={apps:[],initializeApp(){this.apps.push({})},auth:()=>auth,firestore};
      window.INOVTEC_FIREBASE_CONFIG={projectId:"test-only"};
    },scenario);
    const page=await context.newPage();
    await page.route("https://www.gstatic.com/firebasejs/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:""}));
    await page.route("**/firebase-config.js*",route=>route.fulfill({status:200,contentType:"application/javascript",body:'window.INOVTEC_FIREBASE_CONFIG={projectId:"test-only"};'}));
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    try{
      await page.goto("http://127.0.0.1:8765/ORGANISATION-V17.html",{waitUntil:"domcontentloaded",timeout:30000});
      await page.waitForFunction(()=>document.querySelector("#syncStatus")?.textContent.includes("Synchronisé avec Firebase"),null,{timeout:15000});
      const info=await page.evaluate(()=>({
        ids:(window.__orgMigration.state||window.__orgMigration).canonical?.tasks?.map(x=>x.id)||[],
        writes:window.__orgMigration.writes.slice(),
        restore:document.getElementById("ivOrgaRestore")?.hidden===false
      }));
      if(JSON.stringify(info.ids)!==JSON.stringify(scenario.expected))throw Error("Liste inattendue : "+JSON.stringify(info));
      if(scenario.canonical&&info.writes.includes("canonical"))throw Error("Écrasement d'une source Firebase déjà existante");
      if(scenario.offerRecovery){
        await page.waitForFunction(()=>document.getElementById("ivOrgaRestore")?.hidden===false,null,{timeout:7000});
      }
      if(errors.length)throw Error("JavaScript : "+errors.join("; "));
      console.log("OK : "+scenario.name);
    }finally{await context.close();}
  }
}finally{await browser.close();}
console.log("Organisation : migration de six scénarios validée");
