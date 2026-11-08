'use strict';
/* Original CLEA working cache, by Brzo i Lokalno.
 * RAM only: no DOM, platform API, filesystem, network or persistent storage.
 * Only a trusted caller's pure, typed computations belong here. A transaction
 * may reuse complete entries, but publishes new entries only on commit.
 * retainedBytes accounts bounded serialized keys/results, not total OS heap.
 */
(function(scope){
const FORMAT='clea7.working-cache/1',states=new WeakMap(),sessions=new WeakMap();
const forbidden=new Set(['__proto__','prototype','constructor']);
const LIMIT=Object.freeze({nodes:6000,depth:32,text:65536,canonical:262144,active:32,quarantined:128});
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const frozen=value=>Object.freeze(value);
function bytes(text){
 if(typeof TextEncoder==='function')return new TextEncoder().encode(text).length;
 let count=0;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c<128)count++;else if(c<2048)count+=2;else if(c>=0xd800&&c<=0xdbff&&i+1<text.length&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){count+=4;i++;}else count+=3;}return count;
}
function plain(value,array){
 const proto=Object.getPrototypeOf(value);if(proto===null)return !array;
 const descriptor=Object.getOwnPropertyDescriptor(proto,'constructor');
 if(!descriptor||!own(descriptor,'value')||typeof descriptor.value!=='function')return false;
 const native=Function.prototype.toString.call(descriptor.value);
 if(array)return /^function\s+Array\s*\(\s*\)\s*\{\s*\[native code\]\s*\}$/.test(native)&&Object.getPrototypeOf(Object.getPrototypeOf(proto))===null;
 return /^function\s+Object\s*\(\s*\)\s*\{\s*\[native code\]\s*\}$/.test(native)&&Object.getPrototypeOf(proto)===null;
}
// Canonical data equality is exact: no hash collision can turn a changed input
// into a hit. Records sort their keys; list order and negative zero are retained.
function data(value,maxCanonical=LIMIT.canonical){
 let nodes=0,size=0;const seen=new Set();
 const add=text=>{size+=text.length;if(size>maxCanonical)throw Error('data-limit');return text;};
 function visit(v,depth){
  if(++nodes>LIMIT.nodes||depth>LIMIT.depth)throw Error('data-limit');
  if(v===null)return {value:null,text:add('null')};
  if(typeof v==='boolean')return {value:v,text:add(v?'true':'false')};
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('invalid-data');return {value:v,text:add(Object.is(v,-0)?'-0':JSON.stringify(v))};}
  if(typeof v==='string'){if(v.length>LIMIT.text)throw Error('data-limit');return {value:v,text:add(JSON.stringify(v))};}
  if(typeof v!=='object'||seen.has(v))throw Error('invalid-data');
  const array=Array.isArray(v);if(!plain(v,array))throw Error('invalid-data');
  const descriptors=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(descriptors);
  if(keys.some(key=>typeof key!=='string'))throw Error('invalid-data');
  if(array){
   if(v.length>1000||keys.length!==v.length+1||!keys.includes('length'))throw Error('invalid-data');
   const out=[],parts=[];seen.add(v);add('[');for(let i=0;i<v.length;i++){const d=descriptors[String(i)];if(!d||!own(d,'value')||!d.enumerable)throw Error('invalid-data');const child=visit(d.value,depth+1);out.push(child.value);parts.push(child.text);if(i)add(',');}seen.delete(v);add(']');return {value:frozen(out),text:'['+parts.join(',')+']'};
  }
  if(keys.length>128)throw Error('data-limit');const out={},parts=[];seen.add(v);add('{');
  for(const key of keys.sort()){
   const d=descriptors[key];if(forbidden.has(key)||!d.enumerable||!own(d,'value')||key.length>256)throw Error('invalid-data');
   if(parts.length)add(',');const encoded=add(JSON.stringify(key)+':'),child=visit(d.value,depth+1);out[key]=child.value;parts.push(encoded+child.text);
  }
  seen.delete(v);add('}');return {value:frozen(out),text:'{'+parts.join(',')+'}'};
 }
 const result=visit(value,0);return {...result,bytes:bytes(result.text)};
}
function label(value,max){return typeof value==='string'&&value.length>0&&value.length<=max;}
function integer(value,min,max,name){if(!Number.isInteger(value)||value<min||value>max)throw new TypeError('Invalid cache '+name+'.');return value;}
function reason(s,name){s.reasons[name]=(s.reasons[name]||0)+1;}
function dataReason(error){return ['invalid-data','data-limit','invalid-key','invalid-type'].includes(error?.message)?error.message:'invalid-data';}
function state(cache){const s=states.get(cache);if(!s)throw new TypeError('Invalid cache owner.');return s;}
function transaction(tx){const t=sessions.get(tx);if(!t)throw new TypeError('Invalid cache transaction.');return t;}
function status(t){if(t.owner.closed)return 'closed';if(t.generation!==t.owner.generation)return 'stale-generation';if(!t.active)return t.reason||'transaction-finished';if(!t.owner.enabled)return 'disabled';return null;}
function keyFor(nodeId,dependencies,typeTag){
 if(!label(nodeId,256)||forbidden.has(nodeId))throw Error('invalid-key');
 if(typeof typeTag==='string'&&!label(typeTag,8192))throw Error('invalid-type');
 const deps=data(dependencies),type=data(typeTag,16384),key=JSON.stringify(nodeId)+'|'+type.text+'|'+deps.text;
 if(bytes(key)>LIMIT.canonical)throw Error('data-limit');return {key,nodeId};
}
function drop(s,key){const entry=s.entries.get(key);if(entry){s.entries.delete(key);s.baseBytes-=entry.bytes;return true;}return false;}
function dropStage(t,key){const entry=t.staged.get(key);if(entry){t.staged.delete(key);t.bytes-=entry.bytes;t.owner.stagedBytes-=entry.bytes;return true;}return false;}
function victim(s){
 let chosen=null,score=Infinity;
 for(const [key,entry]of s.entries){const age=Math.max(1,s.tick-entry.used+1),value=entry.computeMs*(entry.hits+1)/(entry.bytes*age);if(value<score){score=value;chosen=key;}}
 return chosen;
}
function reserve(s,size,count=1){
 while(s.entries.size&&(s.baseBytes+s.stagedBytes+size>s.budgetBytes||s.entries.size+s.stagedCount+count>s.maxEntries)){
  const key=victim(s);if(key===null)break;drop(s,key);s.stats.evictions++;reason(s,'evicted');
 }
 return s.baseBytes+s.stagedBytes+size<=s.budgetBytes&&s.entries.size+s.stagedCount+count<=s.maxEntries;
}
function quarantine(s,nodeId){
 if(s.quarantined.size<LIMIT.quarantined)s.quarantined.add(nodeId);else s.enabled=false;
 for(const [key,entry]of s.entries)if(entry.nodeId===nodeId)drop(s,key);
 for(const t of s.active)for(const [key,entry]of t.staged)if(entry.nodeId===nodeId){dropStage(t,key);s.stagedCount--;}
 s.stats.conflicts++;reason(s,'conflicting-result');
}
function finish(t){
 for(const key of [...t.staged.keys()]){dropStage(t,key);t.owner.stagedCount--;}
 t.active=false;t.owner.active.delete(t);
}
class Transaction{
 get(nodeId,dependencies,typeTag){
  const t=transaction(this),s=t.owner;s.stats.lookups++;const unavailable=status(t);
  if(unavailable){s.stats.misses++;reason(s,unavailable);return frozen({hit:false,reason:unavailable});}
  let key;try{key=keyFor(nodeId,dependencies,typeTag).key;}catch(error){const why=dataReason(error);s.stats.misses++;s.stats.rejected++;reason(s,why);return frozen({hit:false,reason:why});}
  if(s.quarantined.has(nodeId)){s.stats.misses++;reason(s,'quarantined-node');return frozen({hit:false,reason:'quarantined-node'});}
  const entry=t.staged.get(key)||s.entries.get(key);
  if(!entry){s.stats.misses++;reason(s,'not-found');return frozen({hit:false,reason:'not-found'});}
  // Never return the retained object itself, including to a trusted host.
  let value;try{value=data(entry.value).value;}catch{if(s.entries.has(key))drop(s,key);if(dropStage(t,key))s.stagedCount--;s.stats.misses++;s.stats.rejected++;reason(s,'invalid-entry');return frozen({hit:false,reason:'invalid-entry'});}
  entry.used=++s.tick;entry.hits++;s.stats.hits++;s.stats.referenceComputeMs+=entry.computeMs;reason(s,'reused');
  return frozen({hit:true,value,reason:'reused',...(entry.instructions===undefined?{}:{instructions:entry.instructions})});
 }
 put(nodeId,dependencies,typeTag,value,options={}){
  const t=transaction(this),s=t.owner,unavailable=status(t);if(unavailable){s.stats.rejected++;reason(s,unavailable);return frozen({stored:false,reason:unavailable});}
  const computeMs=options?.computeMs,instructions=options?.instructions;
  if(instructions!==undefined&&(!Number.isSafeInteger(instructions)||instructions<0||instructions>10000000)){s.stats.rejected++;reason(s,'invalid-instructions');return frozen({stored:false,reason:'invalid-instructions'});}
  if(typeof computeMs!=='number'||!Number.isFinite(computeMs)||computeMs<0){s.stats.rejected++;reason(s,'invalid-cost');return frozen({stored:false,reason:'invalid-cost'});}
  if(computeMs<s.minComputeMs){s.stats.rejected++;reason(s,'cheap-computation');return frozen({stored:false,reason:'cheap-computation'});}
  let identity,result;try{identity=keyFor(nodeId,dependencies,typeTag);result=data(value);}catch(error){const why=dataReason(error);s.stats.rejected++;reason(s,why);return frozen({stored:false,reason:why});}
  if(s.quarantined.has(nodeId)){s.stats.rejected++;reason(s,'quarantined-node');return frozen({stored:false,reason:'quarantined-node'});}
  const existing=t.staged.get(identity.key)||s.entries.get(identity.key);
  if(existing){
   if(existing.canonical!==result.text||existing.instructions!==instructions){quarantine(s,nodeId);s.stats.rejected++;return frozen({stored:false,reason:'conflicting-result'});}
   reason(s,'already-retained');return frozen({stored:true,reason:'already-retained'});
  }
  const size=bytes(identity.key)+result.bytes*2+96;
  if(size>s.budgetBytes||!reserve(s,size)){s.stats.rejected++;reason(s,'budget-pressure');return frozen({stored:false,reason:'budget-pressure'});}
  const entry={nodeId,value:result.value,canonical:result.text,bytes:size,computeMs,instructions,hits:0,used:++s.tick};
  t.staged.set(identity.key,entry);t.bytes+=size;s.stagedBytes+=size;s.stagedCount++;s.stats.staged++;reason(s,'staged');
  return frozen({stored:true,reason:'staged'});
 }
 commit(){
  const t=transaction(this),s=t.owner,unavailable=status(t);
  if(unavailable){finish(t);t.reason=unavailable;s.stats.rejected++;reason(s,unavailable);return frozen({committed:false,reason:unavailable});}
  for(const [key,entry]of [...t.staged]){
   if(!t.staged.has(key))continue;
   const old=s.entries.get(key);
   if(old&&(old.canonical!==entry.canonical||old.instructions!==entry.instructions)){quarantine(s,entry.nodeId);continue;}
   dropStage(t,key);s.stagedCount--;
   if(!old&&!s.quarantined.has(entry.nodeId)){s.entries.set(key,entry);s.baseBytes+=entry.bytes;s.stats.published++;}
  }
  finish(t);t.reason='committed';s.stats.commits++;reason(s,'committed');return frozen({committed:true,reason:'committed'});
 }
 rollback(){const t=transaction(this),s=t.owner;if(!t.active)return frozen({rolledBack:false,reason:t.reason||'transaction-finished'});finish(t);t.reason='rolled-back';s.stats.rollbacks++;reason(s,'rolled-back');return frozen({rolledBack:true,reason:'rolled-back'});}
}
class Cache{
 constructor(options={}){
  if(!options||typeof options!=='object'||Array.isArray(options))throw new TypeError('Invalid cache options.');
  const scopeId=options.scope===undefined?'local':options.scope,program=options.program===undefined?'bil':options.program;
  if(!label(scopeId,4096)||!label(program,1048576))throw new TypeError('Invalid cache context.');
  const budgetBytes=integer(options.budgetBytes===undefined?262144:options.budgetBytes,0,8*1024*1024,'budget'),maxEntries=integer(options.maxEntries===undefined?128:options.maxEntries,0,1024,'entry count');
  const enabled=options.enabled===undefined?true:options.enabled,minComputeMs=options.minComputeMs===undefined?.1:options.minComputeMs;
  if(typeof enabled!=='boolean'||typeof minComputeMs!=='number'||!Number.isFinite(minComputeMs)||minComputeMs<0||minComputeMs>60000)throw new TypeError('Invalid cache admission options.');
  states.set(this,{scope:scopeId,program,budgetBytes,maxEntries,enabled,minComputeMs,closed:false,generation:0,tick:0,entries:new Map(),active:new Set(),quarantined:new Set(),baseBytes:0,stagedBytes:0,stagedCount:0,reasons:Object.create(null),stats:{lookups:0,hits:0,misses:0,rejected:0,evictions:0,staged:0,published:0,commits:0,rollbacks:0,clears:0,conflicts:0,referenceComputeMs:0}});
 }
 begin(){
  const s=state(this),tx=new Transaction(),limited=s.active.size>=LIMIT.active;
  const t={owner:s,generation:s.generation,active:!s.closed&&!limited,reason:s.closed?'closed':limited?'transaction-limit':null,staged:new Map(),bytes:0};sessions.set(tx,t);if(t.active)s.active.add(t);if(limited)reason(s,'transaction-limit');return tx;
 }
 clear(){
  const s=state(this);s.generation++;s.entries.clear();s.baseBytes=0;
  for(const t of s.active){t.staged.clear();t.bytes=0;t.active=false;t.reason='stale-generation';}s.active.clear();s.stagedBytes=0;s.stagedCount=0;s.quarantined.clear();s.stats.clears++;reason(s,'cleared');
  return this.snapshot();
 }
 close(){const s=state(this);if(!s.closed){this.clear();s.closed=true;s.enabled=false;reason(s,'closed');}return this.snapshot();}
 snapshot(){
  const s=state(this);return frozen({format:FORMAT,enabled:s.enabled,closed:s.closed,generation:s.generation,budgetBytes:s.budgetBytes,maxEntries:s.maxEntries,minComputeMs:s.minComputeMs,entries:s.entries.size,stagedEntries:s.stagedCount,activeTransactions:s.active.size,retainedBytes:s.baseBytes+s.stagedBytes,publishedBytes:s.baseBytes,stagedBytes:s.stagedBytes,quarantinedNodes:s.quarantined.size,...s.stats,reasons:frozen({...s.reasons})});
 }
}
scope.CLEA7WorkingCache=frozen({format:FORMAT,Cache});
})(globalThis);
