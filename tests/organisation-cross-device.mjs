import { chromium } from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const clone=v=>JSON.parse(JSON.stringify(v));
const seed={id:"shared-seed",title:"Tâche ordinateur",status:"todo",priority:"normal",createdAt:"2026-11-10T09:00:00.000Z",updatedAt:"2026-11-10T09:00:00.000Z"};
const server={
  canonical:{tasks:[seed],version:2},
  personal:{tasks:[seed]},
  shared:{tasks:[seed]}
};
const pages=[];
function kind(collection,id){
  return collection==="kanban"?"personal":id==="inovtec_organisation_tasks_v2"?"canonical":"shared";
}
function dataSnap(data){return{exists:!!data,data:()=>data||{},metadata:{fromCache:false,hasPendingWrites:false}};}
const contexts=[];
try{
  for(let i=0;i<2;i++){
    const context=await browser.newContext({serviceWorkers:"block"});contexts.push(context);
    await context.addInitScript(()=>{
      const watchers={canonical:[],personal:[],shared:[]};
      const snap=data=>({exists:data!==null,data:()=>data||{},metadata:{fromCache:false,hasPendingWrites:false}});
      window.__mockPush=(key,data)=>{
        for(const cb of watchers[key]||[])cb(snap(data));
      };
      function ref(key){
        return{
          async get(){return snap(await window.__readFirebaseMock(key));},
          async set(data){await window.__writeFirebaseMock(key,data);},
          onSnapshot(options,callback){
            const cb=typeof options==="function"?options:callback;
            watchers[key].push(cb);
            void window.__readFirebaseMock(key).then(data=>cb(snap(data)));
            return()=>{watchers[key]=watchers[key].filter(x=>x!==cb);};
          }
        };
      }
      const db={
        collection(name){return{doc(id){return ref(name==="kanban"?"personal":id==="inovtec_organisation_tasks_v2"?"canonical":"shared");}};},
        async runTransaction(fn){
          let out=[];
          await fn({get:ref=>ref.get(),set:(ref,data)=>out.push([ref,data])});
          for(const [r,data] of out)await r.set(data);
        }
      };
      const auth={currentUser:{uid:"same-workspace",email:"test@example.com"},
        onAuthStateChanged(cb){queueMicrotask(()=>cb(this.currentUser));return()=>{};},
        signOut(){return Promise.resolve();}};
      const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=>new Date().toISOString()};
      window.firebase={apps:[],initializeApp(){this.apps.push({})},auth:()=>auth,firestore};
      window.INOVTEC_FIREBASE_CONFIG={projectId:"mock-project"};
    });
    const page=await context.newPage();pages.push(page);
    await page.exposeFunction("__readFirebaseMock",key=>server[key]?clone(server[key]):null);
    await page.exposeFunction("__writeFirebaseMock",async(key,data)=>{
      server[key]={...(server[key]||{}),...clone(data)};
      const update=clone(server[key]);
      // L'autre navigateur reçoit aussi les changements depuis le même serveur simulé.
      for(const p of pages){await p.evaluate(({key,update})=>window.__mockPush?.(key,update),{key,update}).catch(()=>{});}
    });
    await page.route("https://www.gstatic.com/firebasejs/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:""}));
    await page.route("**/firebase-config.js*",route=>route.fulfill({status:200,contentType:"application/javascript",body:'window.INOVTEC_FIREBASE_CONFIG={projectId:"mock-project"};'}));
    page.on("pageerror",e=>{throw Error("Erreur JavaScript : "+e.message)});
    await page.goto("http://127.0.0.1:8765/ORGANISATION-V17.html",{waitUntil:"domcontentloaded",timeout:30000});
    await page.locator('.task[data-id="shared-seed"]').waitFor({timeout:15000});
  }
  await pages[0].locator('.task[data-id="shared-seed"] .task-targets button[data-target-status="inprogress"]').click();
  await pages[1].locator('.task-list[data-status="inprogress"] .task[data-id="shared-seed"]').waitFor({timeout:12000});
  if(server.canonical.tasks[0].status!=="inprogress")throw Error("Statut non synchronisé");
  console.log("OK : déplacement depuis session A visible sur session B");

  await pages[1].locator("#title").fill("Tâche ajoutée sur mobile");
  await pages[1].locator('#taskForm button[type="submit"]').click();
  await pages[0].getByText("Tâche ajoutée sur mobile",{exact:true}).waitFor({timeout:12000});
  const created=server.canonical.tasks.find(t=>t.title==="Tâche ajoutée sur mobile");
  if(!created)throw Error("Création non synchronisée");
  console.log("OK : création depuis session B visible sur session A");

  await pages[0].locator('.task[data-id="shared-seed"]').getByRole("button",{name:"Archiver",exact:true}).click();
  await pages[1].locator('.task[data-id="shared-seed"]').waitFor({state:"detached",timeout:12000});
  await pages[1].reload({waitUntil:"domcontentloaded"});
  await pages[1].locator("#openArchiveBtn").click();
  await pages[1].locator("#archiveList").getByText("Tâche ordinateur",{exact:true}).waitFor({timeout:12000});
  console.log("OK : archivage persistant après rechargement sur le second appareil");
}finally{
  for(const c of contexts)await c.close();
  await browser.close();
}
