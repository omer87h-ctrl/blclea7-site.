'use strict';
// Exercise explicit Studio source history against the real compiler, storage and Core.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const web=process.env.CLEA7_SOURCE_WEB||'web';
const s={crypto:webcrypto,performance,TextEncoder,TextDecoder,URL,Blob,AbortController,setTimeout,clearTimeout,Date,console};s.globalThis=s;vm.createContext(s);
for(const file of ['runtime','workbench/living','workbench/bil-compiler','workbench/bil-runtime','workbench/working-cache','workbench/clea-core','workbench/format','workbench/plan','workbench/review','workbench/consumer','workbench/engine','workbench/schema-history'])vm.runInContext(fs.readFileSync(web+'/'+file+'.js','utf8'),s);
const B=s.CLEA7BIL,H=s.CLEA7SchemaHistory,E=s.CLEA7Engine.Engine,clone=x=>JSON.parse(JSON.stringify(x));
const source='let count = 0\nscreen home "Home" {button "More" runs more\nshow count}\non more {count = count + 1}\nstart home\n';
const old=B.compile(source,{id:'history_app'}).application,extended=B.compile('let added = 7\n'+source,{id:'history_app'}).application;
let count=0;async function check(name,fn){await fn();count++;console.log('PASS schema history '+name);}
async function opened(app,vault){const e=new E(app,{vault});await e.open();return e;}
async function fixture(){const vault=new s.CLEA7.MemoryVault();let e=await opened(old,vault);await e.dispatch('bil_more');e.close();e=await opened(extended,vault);await e.dispatch('bil_more');e.close();return vault;}
(async()=>{
 await check('Undo archives retired fields atomically, preserves subsequent live edits and restarts the prior program',async()=>{
  const vault=await fixture(),r=await H.transition({from:extended,to:old,vault,approved:true});assert.equal(r.archived,1);
  const rows=await vault.entries('schema-history1:history_app:');assert.equal(rows.length,1);assert.equal(rows[0].value.removed.added.value,7);
  const e=await opened(old,vault);assert.equal(e.state.bilValues.count,2);assert.equal(Object.hasOwn(e.state.bilValues,'added'),false);await e.dispatch('bil_more');e.close();
  const redo=await H.transition({from:old,to:extended,vault,direction:'redo',approved:true});assert.equal(redo.restored,1);const re=await opened(extended,vault);assert.equal(re.state.bilValues.added,7);assert.equal(re.state.bilValues.count,3);re.close();
 });
 await check('changed retired values survive repeated Undo and Redo instead of resetting to initial values',async()=>{
  const changed=B.compile('let added = 7\n'+source+'on changeAdded {added = 99}\n',{id:'history_app'}).application,vault=new s.CLEA7.MemoryVault();const e=await opened(changed,vault);await e.dispatch('bil_changeAdded');e.close();
  await H.transition({from:changed,to:old,vault,approved:true});await H.transition({from:old,to:changed,vault,direction:'redo',approved:true});const re=await opened(changed,vault);assert.equal(re.state.bilValues.added,99);re.close();
 });
 await check('type changes, stale source and conflicting storage never remove user data',async()=>{
  const vault=await fixture(),before=clone(await vault.get('app2:history_app'));
  const incompatible=B.compile('let count = "text"\nscreen home "Home" {show count}\nstart home\n',{id:'history_app'}).application;
  await assert.rejects(H.transition({from:extended,to:incompatible,vault,approved:true}),/Tip/);assert.deepEqual(clone(await vault.get('app2:history_app')),before);
  await assert.rejects(H.transition({from:extended,to:old,vault,approved:true,current:()=>false}),/promijenio/);assert.equal((await vault.entries('schema-history1:')).length,0);
  const original=vault.batchConditional.bind(vault);vault.batchConditional=async(key,expected,puts)=>{await vault.put(key,{...before,revision:'other-tab'});return original(key,expected,puts);};
  await assert.rejects(H.transition({from:extended,to:old,vault,approved:true}),/drugoj sesiji/);assert.equal((await vault.entries('schema-history1:')).length,0);assert.equal((await vault.get('app2:history_app')).state.bilValues.added,7);
 });
 await check('archive export and explicit digest-bound removal leave active application state intact',async()=>{
  const vault=await fixture();await H.transition({from:extended,to:old,vault,approved:true});const exported=await H.exportArchive(vault,'history_app'),before=clone(await vault.get('app2:history_app'));
  assert.equal(exported.entries,1);assert.equal(JSON.parse(exported.json).entries[0].value.removed.added.value,7);
  await assert.rejects(H.clearArchive(vault,'history_app',{expectedDigest:exported.digest}),/potvrdi/);await assert.rejects(H.clearArchive(vault,'history_app',{approved:true,expectedDigest:'stale'}),/promijenila/);
  assert.equal((await H.clearArchive(vault,'history_app',{approved:true,expectedDigest:exported.digest})).removed,1);assert.deepEqual(clone(await vault.get('app2:history_app')),before);
 });
 await check('migration is explicit, scoped to the same local BIL project and bounded without pruning archives',async()=>{
  const vault=await fixture();await assert.rejects(H.transition({from:extended,to:old,vault}),/izričitu/);const other=clone(old);other.id='other_app';assert.equal((await H.transition({from:extended,to:other,vault,approved:true})).changed,false);
  const remote=clone(extended);remote.remote={};assert.equal((await H.transition({from:remote,to:old,vault,approved:true})).changed,false);
  for(let i=0;i<32;i++)await vault.put('schema-history1:history_app:change_'+i,{fixture:i});await assert.rejects(H.transition({from:extended,to:old,vault,approved:true}),/puna/);assert.equal((await vault.get('app2:history_app')).state.bilValues.added,7);assert.equal((await vault.entries('schema-history1:history_app:')).length,32);
 });
 console.log('SCHEMA_HISTORY_CHECKS '+count+' passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
