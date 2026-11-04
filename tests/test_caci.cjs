'use strict';
// Original fictional cache fixtures only. The adapter below is a test storage
// double; these checks do not certify browser IndexedDB, physical RAM or speed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const source=()=>fs.readFileSync(path.join(process.env.CLEA7_SOURCE_WEB||path.join(__dirname,'../web'),'workbench/caci.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const clone=value=>structuredClone(value);
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

function load(extra={}){
 const context={TextEncoder,TextDecoder,crypto:webcrypto,performance,setTimeout,clearTimeout,Date,console,...extra};
 context.globalThis=context;vm.createContext(context);vm.runInContext(source(),context,{filename:'caci.js'});
 return context.CLEA7CACI;
}
class FixtureStorage{
 constructor(){this.spaces=new Map();this.calls={list:0,get:0,put:0,remove:0,clear:0};this.userProjects=new Map([['fictional_project',{source:'PRESERVE_PROJECT_SOURCE'}]]);}
 space(namespace){assert.match(namespace,/^[0-9a-f]{64}$/);if(!this.spaces.has(namespace))this.spaces.set(namespace,new Map());return this.spaces.get(namespace);}
 async list(namespace){this.calls.list++;if(this.failList)throw Error('PRIVATE_STORAGE_LIST_FAILURE');return [...this.space(namespace)].map(([key,record])=>({key,record:clone(record)}));}
 async get(namespace,key){this.calls.get++;if(this.getGate){this.getGate.entered.resolve();await this.getGate.release.promise;}if(this.failGet)throw Error('PRIVATE_STORAGE_GET_FAILURE');const value=this.space(namespace).get(key);return value===undefined?null:clone(value);}
 async put(namespace,key,record){this.calls.put++;if(this.failPut)throw Error('PRIVATE_STORAGE_QUOTA_FAILURE');this.space(namespace).set(key,clone(record));}
 async remove(namespace,key){this.calls.remove++;this.space(namespace).delete(key);}
 async clear(namespace){this.calls.clear++;if(this.failClear)throw Error('PRIVATE_STORAGE_CLEAR_FAILURE');this.space(namespace).clear();}
 entries(){return [...this.spaces].flatMap(([namespace,rows])=>[...rows].map(([key,record])=>({namespace,key,record})));}
}
let checks=0;
async function test(name,body){let timer;try{await Promise.race([body(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Test did not finish: '+name)),10000);})]);checks++;console.log('PASS CACI '+name);}finally{clearTimeout(timer);}}
const api=()=>load();
async function create(options={},API=api()){
 const cache=API.create({scope:'fixture_app/fixture_principal',...options});await cache.ready;return cache;
}
function bounded(cache){const s=cache.stats();for(const name of ['memoryRetainedBytes','persistentRetainedBytes','memoryEntries','persistentEntries','pending'])assert(Number.isFinite(s[name])&&s[name]>=0,name);assert(s.memoryRetainedBytes<=s.memoryBudgetBytes);assert(s.persistentRetainedBytes<=s.persistentBudgetBytes);return s;}
async function rejectedData(run){try{const result=await run();assert(result?.stored===false||result?.hit===false,'Invalid data unexpectedly accepted');}catch(error){assert(!/PRIVATE_|secret-payload/.test(error.message),'Private malformed data leaked through cache error');}}

(async()=>{
 await test('fingerprints are SHA256 stable for record order and sensitive to complete input data',async()=>{
  const API=api(),first=await API.fingerprint({source:'let value = 2',compiler:'bil/1',dependencies:[1,2]});
  assert.match(first,/^[0-9a-f]{64}$/);
  assert.equal(first,await API.fingerprint({dependencies:[1,2],compiler:'bil/1',source:'let value = 2'}));
  assert.notEqual(first,await API.fingerprint({source:'let value = 3',compiler:'bil/1',dependencies:[1,2]}));
  assert.notEqual(first,await API.fingerprint({source:'let value = 2',compiler:'bil/1',dependencies:[2,1]}));
  assert.notEqual(await API.fingerprint(-0),await API.fingerprint(0));
  const cache=await create({storage:false},API);try{assert.equal(await cache.fingerprint({a:1}),await API.fingerprint({a:1}));}finally{cache.close();}
 });
 await test('without IndexedDB the real cache remains usable in bounded RAM',async()=>{
  const cache=await create();try{
   assert.equal((await cache.get('analysis',{source:'original'})).hit,false);
   assert.equal((await cache.put('analysis',{source:'original'},{screens:2})).stored,true);
   const answer=await cache.get('analysis',{source:'original'});assert.equal(answer.hit,true);assert.deepEqual(plain(answer.value),{screens:2});
   assert.notEqual(cache.stats().persistence,'ready');assert(cache.stats().memoryHits>0);bounded(cache);
  }finally{cache.close();}
 });
 await test('categories complete keys and compiler/schema stamps cannot cross-feed work',async()=>{
  const cache=await create({storage:false});try{
   const key={source:'same original source',compiler:'bil/1',schema:1};await cache.put('index',key,{nodes:3});
   assert.equal((await cache.get('plan',key)).hit,false);
   assert.equal((await cache.get('index',{...key,compiler:'bil/2'})).hit,false);
   assert.equal((await cache.get('index',{...key,schema:2})).hit,false);
   assert.equal((await cache.get('index',{...key,source:key.source+' '})).hit,false);
   assert.equal((await cache.get('index',{schema:1,compiler:'bil/1',source:key.source})).hit,true);
  }finally{cache.close();}
 });
 await test('persistent fixture results survive a new cache instance without Studio or project storage',async()=>{
  const storage=new FixtureStorage(),first=await create({storage});
  assert.equal((await first.put('validated-plan',{input:'original'},{actions:['screen','button']})).stored,true);assert.equal(storage.entries().length,1);first.close();
  const second=await create({storage});try{
   const result=await second.get('validated-plan',{input:'original'});assert.equal(result.hit,true);assert.equal(result.layer,'persistent');assert.deepEqual(plain(result.value),{actions:['screen','button']});assert(second.stats().persistentHits>0);bounded(second);
   assert.deepEqual(storage.userProjects.get('fictional_project'),{source:'PRESERVE_PROJECT_SOURCE'});
  }finally{second.close();}
 });
 await test('different application/principal scopes isolate persistent records with identical keys',async()=>{
  const storage=new FixtureStorage(),a=await create({storage,scope:'app_A/principal_A'}),b=await create({storage,scope:'app_B/principal_B'});
  try{await a.put('index',{value:1},{owner:'A'});assert.equal((await b.get('index',{value:1})).hit,false);await b.put('index',{value:1},{owner:'B'});assert.equal((await a.get('index',{value:1})).value.owner,'A');assert.equal((await b.get('index',{value:1})).value.owner,'B');assert.equal(storage.spaces.size,2);}finally{a.close();b.close();}
 });
 await test('retained values never share writable caller-owned objects',async()=>{
  const storage=new FixtureStorage(),cache=await create({storage}),key={inputs:[1,2]},value={screens:[{title:'Original'}]};
  try{await cache.put('plan',key,value);key.inputs[0]=99;value.screens[0].title='Changed';const answer=await cache.get('plan',{inputs:[1,2]});assert.deepEqual(plain(answer.value),{screens:[{title:'Original'}]});try{answer.value.screens[0].title='Tampered';}catch{}assert.equal((await cache.get('plan',{inputs:[1,2]})).value.screens[0].title,'Original');}finally{cache.close();}
 });
 await test('changed persistent payload fails integrity verification instead of becoming a cache hit',async()=>{
  const storage=new FixtureStorage(),first=await create({storage});await first.put('index',{v:1},{valid:true});first.close();const row=storage.entries()[0];row.record.value={valid:false,secret:'PRIVATE_TAMPERED_RESULT'};
  const reopened=await create({storage});try{const result=await reopened.get('index',{v:1});assert.equal(result.hit,false);assert(reopened.stats().corruptions>=1);assert(!JSON.stringify(reopened.stats()).includes('PRIVATE_TAMPERED_RESULT'));assert.equal(storage.entries().length,0);}finally{reopened.close();}
 });
 await test('mismatched persistent key and old entry format/version are not trusted',async()=>{
  for(const mutate of [record=>{record.key='f'.repeat(64);},record=>{record.format='clea7.caci.entry/0';},record=>{record.version='caci/0';}]){
   const storage=new FixtureStorage(),first=await create({storage});await first.put('index',{v:1},{valid:true});first.close();mutate(storage.entries()[0].record);const next=await create({storage});try{assert.equal((await next.get('index',{v:1})).hit,false);}finally{next.close();}
  }
 });
 await test('quota and persistence failures leave verified RAM work usable without leaking errors',async()=>{
  const storage=new FixtureStorage(),cache=await create({storage});storage.failPut=true;
  try{const put=await cache.put('plan',{v:1},{result:7});assert.equal(put.stored,true);assert.equal((await cache.get('plan',{v:1})).value.result,7);assert(cache.stats().storageFailures>=1);assert(!JSON.stringify(cache.stats()).includes('PRIVATE_STORAGE_QUOTA_FAILURE'));bounded(cache);}finally{cache.close();}
  const unavailable=new FixtureStorage();unavailable.failList=true;const fallback=await create({storage:unavailable});try{await fallback.put('index',{},3);assert.equal((await fallback.get('index',{})).value,3);assert.notEqual(fallback.stats().persistence,'ready');}finally{fallback.close();}
 });
 await test('an unreadable persistent result is a miss that callers can genuinely recompute',async()=>{
  const storage=new FixtureStorage(),first=await create({storage});await first.put('index',{v:1},2);first.close();const next=await create({storage});storage.failGet=true;
  try{const result=await next.get('index',{v:1});assert.equal(result.hit,false);const calculated=1+1;await next.put('index',{v:1},calculated);assert.equal((await next.get('index',{v:1})).value,2);assert(!JSON.stringify(next.stats()).includes('PRIVATE_STORAGE_GET_FAILURE'));}finally{next.close();}
 });
 await test('RAM and persistent eviction stay within their separate accounting budgets',async()=>{
  const storage=new FixtureStorage(),cache=await create({storage,memoryBytes:2048,persistentBytes:8192});try{
   for(let n=0;n<40;n++){await cache.put('index',{index:n},{source:'x'.repeat(200),node:n});bounded(cache);}
   assert(cache.stats().evictions>0);assert(storage.entries().length<40);
   const fresh=await cache.get('index',{index:39});assert.equal(fresh.hit,true);assert.equal(fresh.value.node,39);
  }finally{cache.close();}
 });
 await test('concurrent cache writes share bounded accounting rather than independent unbounded reservations',async()=>{
  const storage=new FixtureStorage(),cache=await create({storage,memoryBytes:4096,persistentBytes:12288});try{
   await Promise.all(Array.from({length:30},(_,n)=>cache.put('fragment',{n},{value:'x'.repeat(300),n})));bounded(cache);assert.equal(cache.stats().pending,0);
   for(const row of storage.entries())assert(row.record.bytes>0&&Number.isSafeInteger(row.record.bytes));
  }finally{cache.close();}
 });
 await test('cache off performs no reuse or new persistence and does not alter computed results',async()=>{
  const storage=new FixtureStorage(),enabled=await create({storage}),disabled=await create({storage,enabled:false});let computations=0;
  async function calculate(cache,input){const key={input},hit=await cache.get('plan',key);if(hit.hit)return hit.value;computations++;const value={squared:input*input};await cache.put('plan',key,value);return value;}
  try{const on=await calculate(enabled,6),again=await calculate(enabled,6);assert.deepEqual(plain(on),plain(again));assert.equal(computations,1);const persisted=storage.calls.put;const off=await calculate(disabled,6),offAgain=await calculate(disabled,6);assert.deepEqual(plain(on),plain(off));assert.deepEqual(plain(off),plain(offAgain));assert.equal(computations,3);assert.equal(storage.calls.put,persisted);assert.equal(disabled.stats().hits,0);}finally{enabled.close();disabled.close();}
 });
 await test('clear is scoped to regenerable cache and never removes another scope or user projects',async()=>{
  const storage=new FixtureStorage(),a=await create({storage,scope:'first'}),b=await create({storage,scope:'second'});try{
   await a.put('plan',{},1);await b.put('plan',{},2);await a.clear();assert.equal(a.stats().memoryEntries,0);assert.equal((await a.get('plan',{})).hit,false);assert.equal((await b.get('plan',{})).value,2);assert.deepEqual(storage.userProjects.get('fictional_project'),{source:'PRESERVE_PROJECT_SOURCE'});
   const secondReload=await create({storage,scope:'second'});try{assert.equal((await secondReload.get('plan',{})).value,2);}finally{secondReload.close();}
  }finally{a.close();b.close();}
 });
 await test('a failed persistent clear is reported instead of claiming that stored cache was removed',async()=>{
  const storage=new FixtureStorage(),cache=await create({storage});try{
   await cache.put('index',{v:1},2);storage.failClear=true;
   try{const result=await cache.clear();assert.equal(result.persistentCleared,false);}catch(error){assert(!error.message.includes('PRIVATE_STORAGE_CLEAR_FAILURE'));}
   assert.equal(cache.stats().memoryEntries,0);assert.equal(storage.entries().length,1);assert.deepEqual(storage.userProjects.get('fictional_project'),{source:'PRESERVE_PROJECT_SOURCE'});assert(!JSON.stringify(cache.stats()).includes('PRIVATE_STORAGE_CLEAR_FAILURE'));
  }finally{cache.close();}
 });
 await test('clearing only active RAM allows a verified persistent result to be reloaded',async()=>{
  const storage=new FixtureStorage(),cache=await create({storage});try{await cache.put('index',{v:1},2);await cache.clear({persistent:false});assert.equal(cache.stats().memoryEntries,0);const result=await cache.get('index',{v:1});assert.equal(result.hit,true);assert.equal(result.layer,'persistent');assert.equal(result.value,2);}finally{cache.close();}
 });
 await test('close invalidates an in-flight persistent read before it can refill RAM or expose data',async()=>{
  const storage=new FixtureStorage(),first=await create({storage});await first.put('index',{v:1},{secret:'PRIVATE_CLOSED_VALUE'});first.close();const cache=await create({storage});storage.getGate={entered:deferred(),release:deferred()};const pending=cache.get('index',{v:1});await storage.getGate.entered.promise;cache.close();assert.equal(cache.stats().closed,true);storage.getGate.release.resolve();const result=await pending;assert.equal(result.hit,false);assert.equal(cache.stats().memoryEntries,0);assert.equal((await cache.put('index',{v:2},4)).stored,false);assert.equal((await cache.get('index',{v:1})).hit,false);
 });
 await test('close during hashing prevents a late persistent put',async()=>{
  const entered=deferred(),release=deferred();let gate=false;const crypto={subtle:{digest:async(...args)=>{if(gate){entered.resolve();await release.promise;}return webcrypto.subtle.digest(...args);}}};const API=load({crypto}),storage=new FixtureStorage(),cache=await create({storage},API);gate=true;const pending=cache.put('index',{v:1},2);await entered.promise;cache.close();release.resolve();const result=await pending;assert.equal(result.stored,false);assert.equal(storage.calls.put,0);assert.equal(cache.stats().memoryEntries,0);
 });
 await test('malformed executable accessor cyclic and prototype-bearing values never enter retained work',async()=>{
  const cache=await create({storage:false}),cycle={};cycle.self=cycle;let getterReads=0;const accessor={};Object.defineProperty(accessor,'secret',{enumerable:true,get(){getterReads++;return 'secret-payload';}});const sparse=[];sparse.length=2;
  const invalid=[undefined,NaN,Infinity,1n,()=>1,new Date(),new Map(),Object.create({inherited:1}),cycle,accessor,sparse,JSON.parse('{"__proto__":{"polluted":true}}'),{constructor:'bad'},'x'.repeat(2*1024*1024)];
  try{for(const value of invalid){await rejectedData(()=>cache.put('index',{v:1},value));await rejectedData(()=>cache.get('index',{value}));}assert.equal(getterReads,0);assert.equal(cache.stats().memoryEntries,0);assert.equal({}.polluted,undefined);}finally{cache.close();}
 });
 await test('diagnostic counters reveal no private scope key source or cached payload',async()=>{
  const cache=await create({storage:false,scope:'PRIVATE_SCOPE_ID'});try{
   await cache.put('analysis',{source:'PRIVATE_BIL_SOURCE',compiler:'PRIVATE_STAMP'},{value:'PRIVATE_RESULT_TEXT'});await cache.get('analysis',{source:'PRIVATE_BIL_SOURCE',compiler:'PRIVATE_STAMP'});const snapshot=cache.stats(),text=JSON.stringify(snapshot);
   for(const secret of ['PRIVATE_SCOPE_ID','PRIVATE_BIL_SOURCE','PRIVATE_STAMP','PRIVATE_RESULT_TEXT'])assert(!text.includes(secret));assert(snapshot.hits>=1);assert(snapshot.hashedBytes>0);assert.equal(snapshot.savedMilliseconds,undefined);assert.equal(snapshot.physicalRamBytes,undefined);
  }finally{cache.close();}
 });
 await test('invalid host cache configuration fails explicitly',async()=>{
  const API=api();for(const options of [null,[],{scope:''},{scope:3},{scope:'valid',memoryBytes:-1},{scope:'valid',memoryBytes:1.5},{scope:'valid',persistentBytes:-1},{scope:'valid',enabled:'yes'}])assert.throws(()=>API.create(options));
 });
 console.log('CACI_CHECKS '+checks+' passed; fixture persistence is not real IndexedDB or physical-device certification');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
