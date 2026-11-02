'use strict';
/* CLEA Adaptive Cache Intelligence — original local cache infrastructure.
 * This module learns no model parameters and opens no network connection.
 * Cache data is disposable and lives apart from the user's project database.
 * Byte counters describe bounded encoded data, not an OS heap/RAM limit.
 */
(function(scope){
const FORMAT='clea7.caci/1',ENTRY='clea7.caci.entry/1',VERSION='caci/1';
const states=new WeakMap(),forbidden=new Set(['__proto__','prototype','constructor']);
const LIMIT=Object.freeze({bytes:2097152,nodes:100000,depth:128,text:262144,array:8192,fields:512,entries:256,pending:32});
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k),freeze=Object.freeze;
const textBytes=text=>new TextEncoder().encode(text).length;
function error(code,message){const e=new Error(message);e.code=code;return e;}
function plain(value,array){
 const proto=Object.getPrototypeOf(value);if(proto===null)return !array;
 const d=Object.getOwnPropertyDescriptor(proto,'constructor');if(!d||!own(d,'value')||typeof d.value!=='function')return false;
 const signature=Function.prototype.toString.call(d.value);
 return array?/^function\s+Array\s*\(\s*\)\s*\{\s*\[native code\]\s*\}$/.test(signature)&&Object.getPrototypeOf(Object.getPrototypeOf(proto))===null:/^function\s+Object\s*\(\s*\)\s*\{\s*\[native code\]\s*\}$/.test(signature)&&Object.getPrototypeOf(proto)===null;
}
function data(value){
 let nodes=0,size=0;const seen=new Set();
 const part=t=>{size+=t.length;if(size>LIMIT.bytes)throw error('DataLimit','Cache data exceeds its encoding limit.');return t;};
 function visit(v,depth){
  if(++nodes>LIMIT.nodes||depth>LIMIT.depth)throw error('DataLimit','Cache data exceeds its structural limit.');
  if(v===null)return {value:null,text:part('null')};
  if(typeof v==='boolean')return {value:v,text:part(v?'true':'false')};
  if(typeof v==='number'){if(!Number.isFinite(v))throw error('InvalidData','Cache data requires finite numbers.');return {value:v,text:part(Object.is(v,-0)?'-0':JSON.stringify(v))};}
  if(typeof v==='string'){if(v.length>LIMIT.text)throw error('DataLimit','Cache text exceeds its limit.');return {value:v,text:part(JSON.stringify(v))};}
  if(!v||typeof v!=='object'||seen.has(v))throw error('InvalidData','Cache accepts bounded plain data only.');
  const array=Array.isArray(v);if(!plain(v,array))throw error('InvalidData','Cache accepts plain records and lists only.');
  const descriptors=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(descriptors);
  if(keys.some(k=>typeof k!=='string'))throw error('InvalidData','Cache data cannot contain symbols.');
  seen.add(v);
  if(array){
   if(v.length>LIMIT.array||keys.length!==v.length+1)throw error('DataLimit','Cache list is sparse or exceeds its limit.');
   const out=[],parts=[];part('[');
   for(let i=0;i<v.length;i++){const d=descriptors[String(i)];if(!d||!own(d,'value')||!d.enumerable)throw error('InvalidData','Cache data cannot contain accessors.');if(i)part(',');const child=visit(d.value,depth+1);out.push(child.value);parts.push(child.text);}
   part(']');seen.delete(v);return {value:freeze(out),text:'['+parts.join(',')+']'};
  }
  if(keys.length>LIMIT.fields)throw error('DataLimit','Cache record exceeds its field limit.');
  const out=Object.create(null),parts=[];part('{');
  for(const k of keys.sort()){
   const d=descriptors[k];if(forbidden.has(k)||k.length>256||!d.enumerable||!own(d,'value'))throw error('InvalidData','Cache data contains an unsupported field.');
   if(parts.length)part(',');const prefix=part(JSON.stringify(k)+':'),child=visit(d.value,depth+1);out[k]=child.value;parts.push(prefix+child.text);
  }
  part('}');seen.delete(v);return {value:freeze(out),text:'{'+parts.join(',')+'}'};
 }
 const result=visit(value,0),bytes=textBytes(result.text);if(bytes>LIMIT.bytes)throw error('DataLimit','Cache UTF-8 encoding exceeds its limit.');return {...result,bytes};
}
async function hash(text,s=null){
 if(!scope.crypto?.subtle?.digest)throw error('HashUnavailable','Content hashing requires Web Crypto in this host.');
 const encoded=new TextEncoder().encode(text);if(s)s.counters.hashedBytes+=encoded.length;
 const digest=await scope.crypto.subtle.digest('SHA-256',encoded);return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
async function fingerprint(value){return hash(data(value).text);}
function boundedInt(v,min,max){return Number.isSafeInteger(v)&&v>=min&&v<=max;}
function reason(s,name){s.reasons[name]=(s.reasons[name]||0)+1;}
function status(s,g=s.generation){return s.closed?'closed':g!==s.generation?'stale-generation':!s.enabled?'disabled':null;}
function getState(instance){const s=states.get(instance);if(!s)throw TypeError('Invalid CACI cache owner.');return s;}
function miss(s,name){s.counters.misses++;reason(s,name);return freeze({hit:false,reason:name,layer:'none'});}
function rejected(s,name){s.counters.rejected++;reason(s,name);return freeze({stored:false,reason:name,layer:'none'});}
function invalidReason(e){return e?.code==='HashUnavailable'?'hash-unavailable':e?.code==='DataLimit'?'data-limit':'invalid-data';}
function metadata(key,record){
 if(!/^[a-f0-9]{64}$/.test(key)||!record||typeof record!=='object')return null;
 const d=Object.getOwnPropertyDescriptors(record);if(Object.values(d).some(v=>!own(v,'value')))return null;
 if(d.format?.value!==ENTRY||d.version?.value!==VERSION||d.key?.value!==key||!boundedInt(d.bytes?.value,1,8*LIMIT.bytes)||!boundedInt(d.used?.value,0,Number.MAX_SAFE_INTEGER))return null;
 return {key,format:ENTRY,version:VERSION,bytes:d.bytes.value,used:d.used.value};
}
function dropMemory(s,key){const old=s.memory.get(key);if(old){s.memory.delete(key);s.memoryUsed-=old.bytes;}}
function admit(s,record){
 if(record.bytes>s.memoryBudget||!s.memoryBudget)return false;
 dropMemory(s,record.key);
 while(s.memory.size&&(s.memoryUsed+record.bytes>s.memoryBudget||s.memory.size>=LIMIT.entries)){
  const first=[...s.memory.values()].reduce((a,b)=>a.used<=b.used?a:b);dropMemory(s,first.key);s.counters.evictions++;reason(s,'memory-evicted');
 }
 s.memory.set(record.key,record);s.memoryUsed+=record.bytes;return true;
}
function persistentSize(s){return [...s.headers.values()].reduce((sum,row)=>sum+row.bytes,0);}
function storageFault(s){s.counters.storageFailures++;reason(s,'storage-unavailable');s.persistence='unavailable';s.headers.clear();try{s.storage?.close?.();}catch{}s.storage=null;}
async function nativeStorage(){
 if(!scope.indexedDB?.open||typeof scope.Blob!=='function')throw error('PersistenceUnavailable','Local cache persistence is unavailable.');
 const database=await new Promise((resolve,reject)=>{
  let settled=false;const request=scope.indexedDB.open('clea7-caci',1),timer=setTimeout(()=>{if(!settled){settled=true;reject(error('PersistenceUnavailable','Local cache persistence did not open in time.'));}},1500);
  request.onupgradeneeded=()=>{const db=request.result;for(const name of ['payloads','headers'])if(!db.objectStoreNames.contains(name)){const store=db.createObjectStore(name,{keyPath:'id'});store.createIndex('scope','scope',{unique:false});}};
  request.onerror=()=>{clearTimeout(timer);if(!settled){settled=true;reject(error('PersistenceUnavailable','Local cache persistence could not open.'));}};
  request.onblocked=()=>{clearTimeout(timer);if(!settled){settled=true;reject(error('PersistenceUnavailable','Local cache persistence is blocked.'));}};
  request.onsuccess=()=>{clearTimeout(timer);if(settled){request.result.close();return;}settled=true;resolve(request.result);};
 });
 let closed=false;const active=new Set();database.onversionchange=()=>{closed=true;database.close();};
 function tx(names,mode,action){return new Promise((resolve,reject)=>{
  if(closed){reject(error('PersistenceUnavailable','Local cache connection is closed.'));return;}
  const transaction=database.transaction(names,mode);active.add(transaction);let result;
  transaction.oncomplete=()=>{active.delete(transaction);resolve(result);};transaction.onabort=transaction.onerror=()=>{active.delete(transaction);reject(error('PersistenceUnavailable','Local cache transaction failed.'));};
  try{action(transaction,value=>{result=value;});}catch(e){try{transaction.abort();}catch{}reject(e);}
 });}
 function headers(transaction,namespace,done){
  const records=[],request=transaction.objectStore('headers').index('scope').openCursor(namespace);
  request.onsuccess=()=>{const cursor=request.result;if(!cursor){done(records);return;}if(records.length>=LIMIT.entries+1){try{transaction.abort();}catch{}return;}records.push({key:cursor.value.key,record:cursor.value.record});cursor.continue();};
 }
 return {
  list:namespace=>tx(['headers'],'readonly',(t,set)=>headers(t,namespace,set)),
  async get(namespace,key){
   const row=await tx(['payloads'],'readonly',(t,set)=>{const r=t.objectStore('payloads').get(namespace+':'+key);r.onsuccess=()=>set(r.result);});
   if(!row)return null;if(row.scope!==namespace||row.key!==key||!row.payload||typeof row.payload.text!=='function'||!boundedInt(row.payload.size,0,LIMIT.bytes))throw error('CorruptRecord','Local cache payload is invalid.');
   return JSON.parse(await row.payload.text());
  },
  put(namespace,key,record){return this.putBounded(namespace,key,record,{budgetBytes:16*LIMIT.bytes,maxEntries:LIMIT.entries});},
  putBounded(namespace,key,record,policy){
   const wire=data(record).text,payload=new scope.Blob([wire],{type:'application/json'});
   return tx(['headers','payloads'],'readwrite',(t,set)=>headers(t,namespace,rows=>{
    const kept=rows.filter(row=>row.key!==key&&metadata(row.key,row.record));let size=kept.reduce((n,row)=>n+row.record.bytes,0),evicted=0;
    const remove=k=>{t.objectStore('headers').delete(namespace+':'+k);t.objectStore('payloads').delete(namespace+':'+k);};
    for(const row of rows)if(!metadata(row.key,row.record)){remove(row.key);evicted++;}
    kept.sort((a,b)=>a.record.used-b.record.used);
    while(kept.length&&(size+record.bytes>policy.budgetBytes||kept.length>=policy.maxEntries)){const row=kept.shift();size-=row.record.bytes;remove(row.key);evicted++;}
    if(size+record.bytes>policy.budgetBytes){set({stored:false,evicted,rows:kept});return;}
    t.objectStore('payloads').put({id:namespace+':'+key,scope:namespace,key,payload});
    const head={format:ENTRY,version:VERSION,key,bytes:record.bytes,used:record.used};t.objectStore('headers').put({id:namespace+':'+key,scope:namespace,key,record:head});kept.push({key,record:head});set({stored:true,evicted,rows:kept});
   }));
  },
  remove: (namespace,key)=>tx(['headers','payloads'],'readwrite',(t)=>{for(const name of ['headers','payloads'])t.objectStore(name).delete(namespace+':'+key);}),
  clear:namespace=>tx(['headers','payloads'],'readwrite',(t)=>{for(const name of ['headers','payloads']){const r=t.objectStore(name).index('scope').openCursor(namespace);r.onsuccess=()=>{const cursor=r.result;if(cursor){cursor.delete();cursor.continue();}};}}),
  touch: (namespace,key,used)=>tx(['headers'],'readwrite',(t)=>{const store=t.objectStore('headers'),r=store.get(namespace+':'+key);r.onsuccess=()=>{if(r.result){r.result.record.used=used;store.put(r.result);}};}),
  close(){closed=true;for(const transaction of active)try{transaction.abort();}catch{}database.close();}
 };
}
async function loadHeaders(s){
 const rows=await s.storage.list(s.namespace);if(!Array.isArray(rows)||rows.length>LIMIT.entries+1)throw error('PersistenceUnavailable','Local cache metadata exceeds its limit.');
 s.headers.clear();for(const row of rows){const checked=metadata(row?.key,row?.record);if(!checked){if(typeof row?.key==='string')await s.storage.remove(s.namespace,row.key);s.counters.corruptions++;reason(s,'invalid-metadata');continue;}s.headers.set(checked.key,checked);s.tick=Math.max(s.tick,checked.used);}
 while(s.headers.size&&(persistentSize(s)>s.persistentBudget||s.headers.size>LIMIT.entries)){const victim=[...s.headers.values()].reduce((a,b)=>a.used<=b.used?a:b);await s.storage.remove(s.namespace,victim.key);s.headers.delete(victim.key);s.counters.evictions++;reason(s,'persistent-evicted');}
}
async function initialize(s,option){
 if(!s.enabled||option===false||!s.persistentBudget){s.persistence='disabled';return;}
 try{
  s.namespace=await hash(data({format:FORMAT,version:VERSION,scope:s.scope,stamp:s.stamp}).text,s);
  if(s.closed)return;s.storage=option===undefined?await nativeStorage():option;
  if(!s.storage||!['get','put','list','remove','clear'].every(name=>typeof s.storage[name]==='function'))throw error('PersistenceUnavailable','Cache storage adapter is incomplete.');
  if(s.closed){try{s.storage.close?.();}catch{}s.storage=null;return;}
  await loadHeaders(s);if(s.closed){try{s.storage?.close?.();}catch{}s.storage=null;return;}s.persistence='ready';
 }catch{storageFault(s);}
}
function queue(s,kind,operation){
 const unavailable=status(s);if(unavailable)return Promise.resolve(kind==='get'?miss(s,unavailable):rejected(s,unavailable));
 if(s.pending>=LIMIT.pending)return Promise.resolve(kind==='get'?miss(s,'queue-limit'):rejected(s,'queue-limit'));
 const generation=s.generation;s.pending++;
 const result=s.tail.then(async()=>{await s.ready;const unavailable=status(s,generation);if(unavailable)return kind==='get'?miss(s,unavailable):rejected(s,unavailable);return operation(generation);});
 s.tail=result.catch(()=>{});return result.finally(()=>s.pending--);
}
async function identity(s,category,keyParts){
 if(typeof category!=='string'||!/^[a-z][a-z0-9._/-]{0,79}$/.test(category))throw error('InvalidData','Cache category must be a bounded identifier.');
 const encoded=data({format:FORMAT,version:VERSION,scope:s.scope,stamp:s.stamp,category,parts:keyParts});return {text:encoded.text,key:await hash(encoded.text,s),category};
}
function body(record){return {format:record.format,version:record.version,key:record.key,category:record.category,identity:record.identity,value:record.value};}
async function makeRecord(s,id,value){
 const checked=data(value),record={format:ENTRY,version:VERSION,key:id.key,category:id.category,identity:id.text,value:checked.value};
 const encoded=data(body(record));record.digest=await hash(encoded.text,s);record.bytes=encoded.bytes*2+256;record.used=++s.tick;return record;
}
async function checkedRecord(s,id,raw){
 const record=data(raw).value;
 if(Object.keys(record).sort().join('|')!=='bytes|category|digest|format|identity|key|used|value|version'||!metadata(id.key,record)||record.category!==id.category||record.identity!==id.text||!/^[a-f0-9]{64}$/.test(record.digest))throw error('CorruptRecord','Local cache record does not match its requested identity.');
 const encoded=data(body(record));if(record.bytes!==encoded.bytes*2+256||record.digest!==await hash(encoded.text,s))throw error('CorruptRecord','Local cache integrity verification failed.');
 return {...record,value:data(record.value).value};
}
class Cache{
 constructor(options={}){
  if(!options||typeof options!=='object'||Array.isArray(options))throw TypeError('CACI options must be an object.');
  const descriptors=Object.getOwnPropertyDescriptors(options);if(Object.values(descriptors).some(d=>!own(d,'value')))throw TypeError('CACI options cannot use accessors.');
  const scopeName=options.scope,stamp=options.version===undefined?VERSION:options.version,memoryBudget=options.memoryBytes===undefined?262144:options.memoryBytes,persistentBudget=options.persistentBytes===undefined?2097152:options.persistentBytes,enabled=options.enabled===undefined?true:options.enabled;
  if(typeof scopeName!=='string'||!scopeName.length||scopeName.length>512||typeof stamp!=='string'||!stamp.length||stamp.length>128||!boundedInt(memoryBudget,0,8*1048576)||!boundedInt(persistentBudget,0,16*1048576)||typeof enabled!=='boolean')throw TypeError('CACI scope, version or budget is invalid.');
  const s={scope:scopeName,stamp,memoryBudget,persistentBudget,enabled,closed:false,generation:0,memory:new Map(),memoryUsed:0,headers:new Map(),storage:null,namespace:null,persistence:'disabled',tick:0,pending:0,tail:Promise.resolve(),reasons:Object.create(null),counters:{lookups:0,hits:0,memoryHits:0,persistentHits:0,misses:0,puts:0,rejected:0,evictions:0,corruptions:0,storageFailures:0,hashedBytes:0,clears:0}};
  states.set(this,s);s.ready=initialize(s,options.storage);Object.defineProperty(this,'ready',{value:s.ready,enumerable:true});
 }
 fingerprint(value){const s=getState(this);return hash(data(value).text,s);}
 get(category,keyParts){const s=getState(this);s.counters.lookups++;return queue(s,'get',async generation=>{
  let id;try{id=await identity(s,category,keyParts);}catch(e){return miss(s,invalidReason(e));}if(status(s,generation))return miss(s,status(s,generation));
  const retained=s.memory.get(id.key);
  if(retained&&retained.identity===id.text){retained.used=++s.tick;s.counters.hits++;s.counters.memoryHits++;reason(s,'memory-hit');return freeze({hit:true,value:data(retained.value).value,layer:'memory',reason:'verified-memory'});}
  if(!s.storage)return miss(s,'not-retained');let raw;
  try{raw=await s.storage.get(s.namespace,id.key);}catch{storageFault(s);return miss(s,'storage-unavailable');}
  if(status(s,generation))return miss(s,status(s,generation));if(!raw)return miss(s,'not-retained');
  let record;try{record=await checkedRecord(s,id,raw);}catch{
   s.counters.corruptions++;reason(s,'corrupt-record');s.headers.delete(id.key);try{await s.storage?.remove(s.namespace,id.key);}catch{storageFault(s);}return miss(s,'corrupt-record');
  }
  if(status(s,generation))return miss(s,status(s,generation));if(record.bytes>s.persistentBudget){try{await s.storage.remove(s.namespace,id.key);}catch{storageFault(s);}s.headers.delete(id.key);return miss(s,'budget-pressure');}
  record.used=++s.tick;admit(s,record);s.headers.set(id.key,metadata(id.key,record));s.counters.hits++;s.counters.persistentHits++;reason(s,'persistent-hit');
  if(s.storage?.touch)try{await s.storage.touch(s.namespace,id.key,record.used);}catch{storageFault(s);}
  if(status(s,generation))return miss(s,status(s,generation));return freeze({hit:true,value:data(record.value).value,layer:'persistent',reason:'verified-persistent'});
 });}
 put(category,keyParts,value){const s=getState(this);s.counters.puts++;return queue(s,'put',async generation=>{
  let id,record;try{id=await identity(s,category,keyParts);record=await makeRecord(s,id,value);}catch(e){return rejected(s,invalidReason(e));}
  if(status(s,generation))return rejected(s,status(s,generation));let memory=admit(s,record),persisted=false;
  if(s.storage&&record.bytes<=s.persistentBudget){
   try{
    if(typeof s.storage.putBounded==='function'){
     const result=await s.storage.putBounded(s.namespace,id.key,record,{budgetBytes:s.persistentBudget,maxEntries:LIMIT.entries});persisted=result?.stored===true;
     if(Array.isArray(result?.rows)){s.headers.clear();for(const row of result.rows){const checked=metadata(row.key,row.record);if(checked)s.headers.set(checked.key,checked);}}
     if(boundedInt(result?.evicted,0,1000000))s.counters.evictions+=result.evicted;
    }else{
     await loadHeaders(s);if(status(s,generation))return rejected(s,status(s,generation));
     const previous=s.headers.get(id.key);let size=persistentSize(s)-(previous?.bytes||0);
     while(s.headers.size&&(size+record.bytes>s.persistentBudget||s.headers.size-(previous?1:0)>=LIMIT.entries)){
      const candidates=[...s.headers.values()].filter(e=>e.key!==id.key);if(!candidates.length)break;const victim=candidates.reduce((a,b)=>a.used<=b.used?a:b);await s.storage.remove(s.namespace,victim.key);s.headers.delete(victim.key);size-=victim.bytes;s.counters.evictions++;reason(s,'persistent-evicted');
     }
     if(status(s,generation))return rejected(s,status(s,generation));await s.storage.put(s.namespace,id.key,data(record).value);persisted=true;s.headers.set(id.key,metadata(id.key,record));
    }
   }catch{storageFault(s);}
  }
  if(status(s,generation)){dropMemory(s,id.key);return rejected(s,status(s,generation));}
  if(!memory&&!persisted)return rejected(s,'budget-pressure');reason(s,persisted?'persisted':'memory-retained');return freeze({stored:true,layer:persisted?(memory?'memory+persistent':'persistent'):'memory',reason:persisted?'persisted':'memory-retained'});
 });}
 async clear({persistent=true}={}){
  const s=getState(this);if(typeof persistent!=='boolean')throw TypeError('Persistent clear must be Boolean.');if(s.closed)return freeze({cleared:false,persistentCleared:false,reason:'closed'});
  s.generation++;s.memory.clear();s.memoryUsed=0;s.counters.clears++;reason(s,'cleared');let persistentCleared=false;
  const task=s.tail.then(async()=>{await s.ready;if(s.closed)return;if(persistent&&s.storage)try{await s.storage.clear(s.namespace);s.headers.clear();persistentCleared=true;}catch{storageFault(s);}});s.tail=task.catch(()=>{});await task;
  return freeze({cleared:!s.closed,persistentCleared,reason:s.closed?'closed':persistent&&!persistentCleared?'persistent-unavailable':'cleared'});
 }
 close(){const s=getState(this);if(!s.closed){s.closed=true;s.generation++;s.memory.clear();s.memoryUsed=0;try{s.storage?.close?.();}catch{}s.storage=null;s.headers.clear();reason(s,'closed');}return this.stats();}
 stats(){const s=getState(this);return freeze({format:FORMAT,version:VERSION,enabled:s.enabled,closed:s.closed,persistence:s.persistence,memoryBudgetBytes:s.memoryBudget,persistentBudgetBytes:s.persistentBudget,memoryRetainedBytes:s.memoryUsed,persistentRetainedBytes:persistentSize(s),memoryEntries:s.memory.size,persistentEntries:s.headers.size,pending:s.pending,...s.counters,reasons:freeze({...s.reasons})});}
}
scope.CLEA7CACI=freeze({FORMAT,VERSION,create:options=>new Cache(options),fingerprint});
})(globalThis);
