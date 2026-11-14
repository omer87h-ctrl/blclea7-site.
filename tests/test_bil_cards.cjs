'use strict';
// Real compiler, Core, isolated Engine and package checks. No network or AI fixture.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const scope={crypto:webcrypto,performance,TextEncoder,TextDecoder,URL,Blob,AbortController,setTimeout,clearTimeout,Date,console,btoa:x=>Buffer.from(x,'binary').toString('base64'),atob:x=>Buffer.from(x,'base64').toString('binary')};scope.globalThis=scope;vm.createContext(scope);
const web=process.env.CLEA7_SOURCE_WEB||'web';
for(const f of ['runtime','workbench/living','workbench/bil-compiler','workbench/bil-runtime','workbench/working-cache','workbench/clea-core','workbench/bil-elements','workbench/format','workbench/plan','workbench/review','workbench/publisher','workbench/package','workbench/engine'])vm.runInContext(fs.readFileSync(web+'/'+f+'.js','utf8'),scope);
const B=scope.CLEA7BIL,E=scope.CLEA7Engine.Engine,P=scope.CLEA7Package,Core=scope.CLEA7Core,plain=x=>JSON.parse(JSON.stringify(x));
const source=`record Lesson { id: Text, title: Text, description: Text, points: Number }
let lessons: List<Lesson> = [new Lesson {id:"a",title:"Prva",description:"Prvi sadržaj",points:7}, new Lesson {id:"b",title:"Druga",description:"Drugi sadržaj",points:11}]
let chosen = ""
let displayed = ""
let score = 0
on choose {
 for lesson in lessons {
  if lesson.id == chosen { displayed = lesson.title; score = score + lesson.points }
 }
}
on reorder { lessons = [lessons[1], lessons[0]] }
on clear { lessons = [] }
on duplicate { lessons = [lessons[0], lessons[0]] }
on rename { lessons[0].id = "" }
on fail { raise "Rejected", "Keep old data" }
screen home "Učenje" {
 cards lessons label "Moje lekcije" fields [title:"Naslov",description:"Opis",points:"Bodovi"] identity id select chosen action "Otvori" runs choose empty "Nema lekcija." key lessons_cards
 show displayed
 show score
}
`;
let checks=0;async function check(name,run){await run();checks++;console.log('PASS BIL cards '+name);}
async function engine(text=source){const e=new E(B.compile(text,{id:'card_unit'}).application,{vault:new scope.CLEA7.MemoryVault()});await e.open();return e;}
(async()=>{
 await check('formal syntax, typed source mapping, canonical UI3 and reproducible lowering',()=>{const a=B.compile(source),b=B.compile(source),node=a.ir.ui.screens[0].children[0];assert.deepEqual(plain(a),plain(b));assert.equal(a.ir.ui.format,'bil.ui/3');assert.equal(node.type,'cards');assert.equal(node.identity,'id');assert.equal(node.entry,'ui_bilui_lessons_cards');assert(a.ir.sourceMap.some(m=>m.id===node.id&&m.op==='UI_EVENT'));B.validateApplication(a.application);});
 await check('invalid collection, key, labels, image type, selection and callback reject statically',()=>{for(const text of [source.replace('identity id','identity points'),source.replace('let chosen = ""','let chosen = 0'),source.replace('runs choose','runs absent'),source.replace('fields [title:"Naslov",description:"Opis",points:"Bodovi"]','fields [missing]'),source.replace('identity id select chosen','identity id select chosen image description'),source.replace('action "Otvori"','action ""')])assert.throws(()=>B.compile(text));});
 await check('a stable-key action selects and executes the real handler atomically after reorder',async()=>{const e=await engine();try{const node=e.project.bil.ir.ui.screens[0].children[0];await e.dispatch('bil_reorder');await e.dispatch('bil_'+node.entry,{value:'a'});assert.equal(e.state.bilValues.chosen,'a');assert.equal(e.state.bilValues.displayed,'Prva');assert.equal(e.state.bilValues.score,7);assert(e.events.some(x=>JSON.stringify(x.bil||[]).includes('ui-event')));}finally{e.close();}});
 await check('a removed key cannot invoke a handler or change state',async()=>{const e=await engine();try{const node=e.project.bil.ir.ui.screens[0].children[0];await e.dispatch('bil_clear');await assert.rejects(()=>e.dispatch('bil_'+node.entry,{value:'a'}),x=>x.code==='Bounds');assert.equal(e.state.bilValues.score,0);assert.equal(e.state.bilValues.chosen,'');}finally{e.close();}});
 await check('duplicate/empty keys and failing row handlers roll back local state',async()=>{for(const block of ['duplicate','rename']){const e=await engine();try{const before=JSON.stringify(e.state);await assert.rejects(()=>e.dispatch('bil_'+block),x=>x.code==='Identity');assert.equal(JSON.stringify(e.state),before);}finally{e.close();}}const e=await engine(source.replace('runs choose','runs fail'));try{const node=e.project.bil.ir.ui.screens[0].children[0];await assert.rejects(()=>e.dispatch('bil_'+node.entry,{value:'b'}),x=>x.code==='Rejected');assert.equal(e.state.bilValues.chosen,'');assert.equal(e.state.bilValues.score,0);}finally{e.close();}});
 await check('SDK/Core/package require Runtime0.40; old hosts and understated manifests reject',async()=>{const app=B.compile(source).application,pkg=await P.create(app,{targets:['browser','windows','android']});assert.equal(pkg.manifest.runtime,'0.40.0');assert.equal(Core.minimumRuntime(app),'0.40.0');assert(Core.describe(app).capabilities.includes('bil.ui-model/3'));assert.equal(Core.negotiate(app,Core.profile()).compatible,true);assert.equal(Core.negotiate(app,Core.profile({runtime:'0.39.0'})).compatible,false);for(const version of ['0.7.0','0.37.0']){const bad=plain(pkg);bad.manifest.runtime=version;await assert.rejects(()=>P.validate(bad),/0.40.0/);}await P.validate(pkg,'android');});
 await check('existing UI1/UI2 programs retain original representations and ABI floors',async()=>{for(const [text,format,floor]of [['screen home "Home" { text "Keep" }','bil.ui/1','0.7.0'],['screen home "Home" { text "Keep" style { fontSize 20 } }','bil.ui/2','0.14.0']]){const c=B.compile(text);assert.equal(c.ir.ui.format,format);assert.equal((await P.create(c.application)).manifest.runtime,floor);}assert.equal(B.compile('let cards = 2\nshow cards').ir.globals.cards.type,'Number');});
 await check('visual collection authoring preserves old code and starts with real empty data',async()=>{const original='# Developer code retained\nlet original = 7\nfn triple(n: Number) -> Number {return n * 3}\nscreen home "Home" { show original key old_value }\n';const next=scope.CLEA7BILElements.buildCollection(original,{screen:'home',id:'library',label:'Moja biblioteka'});assert(next.source.includes(original.split('screen home')[0]));assert(next.source.includes('show original key old_value'));const e=await engine(next.source);try{assert.equal(e.state.bilValues.library_items.length,0);await e.dispatch('bil_ui_bilui_library_title_input',{value:'Moja lekcija'});await e.dispatch('bil_ui_bilui_library_detail_input',{value:'Moj stvarni sadržaj'});await e.dispatch('bil_library_add');assert.equal(e.state.bilValues.library_items[0].id,'library_1');await e.dispatch('bil_ui_bilui_library_cards',{value:'library_1'});assert.equal(e.state.bilValues.library_shown_detail,'Moj stvarni sadržaj');assert.equal(e.state.bilValues.original,7);}finally{e.close();}assert.throws(()=>scope.CLEA7BILElements.buildCollection(next.source,{screen:'home',id:'library'}));});
 await check('existing record collections bind only declared data, identity, selection and handlers',()=>{const next=scope.CLEA7BILElements.buildCollection(source,{screen:'home',id:'second',collection:'lessons',identity:'id',selection:'chosen',handler:'choose'});assert.equal(B.compile(next.source).ir.ui.screens[0].children.filter(x=>x.type==='cards').length,2);for(const changes of [{identity:'points'},{selection:'score'},{handler:'unknown'},{columns:['missing']},{id:'bad; open other'}])assert.throws(()=>scope.CLEA7BILElements.buildCollection(source,{screen:'home',id:'second',collection:'lessons',identity:'id',selection:'chosen',handler:'choose',...changes}));});
 console.log('BIL_CARD_CHECKS',checks,'actual compiler/Core/transaction/package groups');
})().catch(error=>{console.error(error,error.location);process.exitCode=1;});
