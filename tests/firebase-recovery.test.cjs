const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  const timers = new Map(), values = new Map();
  let timerId = 0, callback, failWrite = false, writes = 0, subscriptions = 0;
  const user = {uid:'test-user',getIdToken:async()=> 'test-token'};
  const ref = {
    set: async()=> { writes++; if(failWrite) throw Object.assign(new Error('offline'),{code:'unavailable'}); },
    onSnapshot: (next,error)=> { subscriptions++; callback={next,error}; return ()=>{}; }
  };
  const window = {addEventListener(){},dispatchEvent(){}};
  const context = {
    window, location:{search:'?mode=planning'}, URLSearchParams, Blob,
    document:{getElementById:id=>id==='ivCloudLogin'?{style:{}}:null}, sessionStorage:{},
    localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
    navigator:{onLine:true}, CustomEvent:class {}, console:{warn(){}},
    setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id), setInterval(){},
    firebase:{firestore:()=>({collection:()=>({doc:()=>ref})})}
  };
  let code=fs.readFileSync('inovtec-cloud-sync.js','utf8');
  code=code.replace(/\}\)\(\);\s*$/, 'window.testSync={push,start,meta};})();');
  vm.runInNewContext(code,context);
  values.set('inovtec_plannings_v2',JSON.stringify({agents:[],weeks:{}}));
  return {api:window.testSync,user,timers,fail:()=>{failWrite=true;},
    recover:()=>{failWrite=false;}, writes:()=>writes, subscriptions:()=>subscriptions,
    callback:()=>callback};
}

test('failed Firebase write is retried and only acknowledged after success',async()=>{
  const h=harness(); h.api.start(h.user); h.fail();
  await h.api.push('test');
  assert.equal(h.api.meta().hash,undefined);
  const retry=[...h.timers.values()].find(t=>t.ms===3500);
  assert.ok(retry);
  h.recover(); await retry.fn(); await new Promise(setImmediate);
  assert.equal(h.writes(),2);
  assert.ok(h.api.meta().hash);
});

test('terminated realtime listener is resubscribed',async()=>{
  const h=harness(); h.api.start(h.user);
  h.callback().error({code:'unavailable'});
  const retry=[...h.timers.values()].find(t=>t.ms===1500);
  assert.ok(retry); await retry.fn();
  assert.equal(h.subscriptions(),2);
});

test('signout cancels pending reconnect and write retries',async()=>{
  const h=harness(); h.api.start(h.user); h.fail();
  await h.api.push('test'); h.callback().error({code:'unavailable'});
  h.api.start(null);
  assert.equal(h.timers.size,0);
});
