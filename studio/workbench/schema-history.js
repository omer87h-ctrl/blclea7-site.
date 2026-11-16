'use strict';
/* Original CLEA Studio schema history. Explicit source Undo never destroys values. */
(function(scope){
const PREFIX='schema-history1:',MAX_BYTES=8*1024*1024,MAX_ENTRIES=32,copy=x=>JSON.parse(JSON.stringify(x)),bytes=x=>new TextEncoder().encode(JSON.stringify(x)).byteLength;
const fail=message=>{throw Object.assign(Error(message),{code:'SchemaHistory'});};
async function hash(value){if(!scope.crypto?.subtle)fail('Sigurna provjera lokalne historije nije dostupna.');const bytes=new TextEncoder().encode(typeof value==='string'?value:scope.CLEA7.stable(value));return [...new Uint8Array(await scope.crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function check(app){const value=scope.CLEA7Format.validate(app);if(!value.bil||value.remote)fail('Automatska arhiva zahtijeva lokalni BIL projekt bez udaljenog korisničkog konteksta.');return value;}
async function entries(vault,id){if(!scope.CLEA7BIL.safe(id))fail('Neispravan projekt arhive.');const rows=await vault.entries(PREFIX+id+':');if(rows.length>MAX_ENTRIES||bytes(rows)>MAX_BYTES)fail('Arhiva poništavanja prelazi dozvoljeni lokalni opseg.');return rows.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);}
async function transition({from,to,vault,direction='undo',approved=false,current=()=>true}={}){
 if(approved!==true||!['undo','redo'].includes(direction)||!vault?.batchConditional)fail('Prijenos podataka zahtijeva izričitu Studio historiju.');
 if(!from?.bil||!to?.bil||from.id!==to.id||from.remote||to.remote)return {changed:false,reason:'separate-project-or-account-scope'};
 const a=check(from),b=check(to),before=await vault.get('app2:'+a.id);if(!before)return {changed:false};
 const values=before.state?.bilValues;if(!values||typeof values!=='object'||Array.isArray(values))fail('Sačuvano stanje nema provjerljiv BIL model.');scope.CLEA7BILRuntime.bounded(values);
 const old=a.bil.ir.globals,next=b.bil.ir.globals;
 for(const [name,value]of Object.entries(values)){if(!old[name]||!scope.CLEA7BILRuntime.isType(value,old[name].type)||next[name]&&!scope.CLEA7BILRuntime.isType(value,next[name].type))fail('Tip podataka zahtijeva zasebnu migraciju. Izvor i podaci nisu promijenjeni.');}
 const removed=Object.keys(values).filter(name=>!next[name]),fromHash=await hash(a.bil.source),toHash=await hash(b.bil.source),archives=await entries(vault,a.id),retained=Object.fromEntries(Object.entries(values).filter(([name])=>next[name])),puts=[];
 let restored=0;
 if(direction==='redo'){
  const candidates=archives.filter(r=>r.value?.format==='clea7.schema-history/1'&&r.value.from===toHash&&r.value.to===fromHash).sort((a,b)=>b.value.time-a.value.time);
  const prior=candidates[0]?.value;
  for(const [name,item]of Object.entries(prior?.removed||{}))if(!Object.hasOwn(retained,name)&&next[name]&&scope.CLEA7BILRuntime.isType(item.value,next[name].type)){retained[name]=copy(item.value);restored++;}
 }
 if(!removed.length&&!restored)return {changed:false};
 if(removed.length){
  const archive={format:'clea7.schema-history/1',application:a.id,from:fromHash,to:toHash,time:Date.now(),removed:Object.fromEntries(removed.map(name=>[name,{type:copy(old[name].type),value:copy(values[name])}]))};
  const key=PREFIX+a.id+':'+scope.CLEA7Format.newId('change');
  if(archives.length>=MAX_ENTRIES||bytes([...archives,{key,value:archive}])>MAX_BYTES)fail('Arhiva poništavanja je puna. Preuzmi i ukloni je kroz Izvoz; sačuvani podaci nisu obrisani.');
  puts.push([key,archive]);
 }
 const state=Object.fromEntries(Object.keys(b.state).map(key=>[key,copy(before.state[key]??b.state[key])]));state.bilValues=retained;
 state.bilViews=(state.bilViews||[]).filter(v=>Object.hasOwn(next,v.target));state.bilMotion=(state.bilMotion||[]).filter(name=>Object.hasOwn(next,name));
 if(b.bil.ir.ui&&!b.bil.ir.ui.screens.some(s=>s.id===state.bilScreen))state.bilScreen=b.bil.ir.ui.start;
 const after={...copy(before),state,version:b.version,revision:scope.CLEA7Format.newId('revision')};puts.push(['app2:'+a.id,after]);
 if(!current())fail('Projekt se promijenio tokom poništavanja.');await vault.batchConditional('app2:'+a.id,before,puts);
 return {changed:true,archived:removed.length,restored,privateLocalOnly:true};
}
async function exportArchive(vault,id){const rows=await entries(vault,id),value={format:'clea7.schema-history-export/1',application:id,entries:rows},json=JSON.stringify(value,null,2);return {json,digest:await hash(rows),entries:rows.length};}
async function clearArchive(vault,id,{approved=false,expectedDigest}={}){if(!approved||typeof expectedDigest!=='string')fail('Prvo preuzmi i izričito potvrdi uklanjanje arhive.');const rows=await entries(vault,id);if(await hash(rows)!==expectedDigest)fail('Arhiva se promijenila nakon preuzimanja. Preuzmi novu kopiju.');if(typeof vault.batchConditions!=='function')fail('Host nema atomsku arhivu.');await vault.batchConditions(rows.map(r=>[r.key,r.value]),[],rows.map(r=>r.key));return {removed:rows.length};}
scope.CLEA7SchemaHistory=Object.freeze({format:'clea7.schema-history/1',transition,exportArchive,clearArchive});
})(globalThis);
