'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const web=process.env.CLEA7_SOURCE_WEB||'web';
const scope={crypto:webcrypto,performance,TextEncoder,TextDecoder,URL,Blob,AbortController,setTimeout,clearTimeout,Date,console,btoa:x=>Buffer.from(x,'binary').toString('base64'),atob:x=>Buffer.from(x,'base64').toString('binary')};scope.globalThis=scope;vm.createContext(scope);
for(const f of ['runtime','workbench/living','workbench/bil-compiler','workbench/bil-runtime','workbench/working-cache','workbench/clea-core','workbench/bil-elements','workbench/format','workbench/plan','workbench/review','workbench/publisher','workbench/package','workbench/engine'])vm.runInContext(fs.readFileSync(web+'/'+f+'.js','utf8'),scope);
const B=scope.CLEA7BIL,L=scope.CLEA7BILElements,E=scope.CLEA7Engine.Engine;
const own='# Keep the developer algorithm and comment exactly\nfn own_logic(n: Number) -> Number { return n * 7 }\n';
const source='let existing = 4\nlet caption = "Original"\nlet enabled = false\nconst locked = 9\n'+own+'screen home "Home" {\n    heading "Original screen" key original_heading\n    show existing key original_value\n}\nscreen other "Other" { text "Do not replace" key other_text }\non original { existing = own_logic(existing) }\nstart home\n';
const spec=(kind,extra={})=>({kind,id:'piece',label:'My element',screen:'home',options:'First | Second',target:'existing',...extra});
let count=0;async function check(label,fn){await fn();count++;console.log('PASS working BIL elements '+label);}
(async()=>{
 await check('all nine reusable elements compile through the real BIL parser without replacing the project',()=>{
  for(const [kind]of L.kinds){const result=L.build(source,spec(kind));assert(result.source.includes(own));assert(result.source.includes('heading "Original screen" key original_heading'));assert(result.source.includes('screen other "Other" { text "Do not replace" key other_text }'));assert(B.compile(result.source).ir.ui.screens.length===2);}
 });
 await check('invalid ranges, names, options, frozen state and injected handlers are rejected',()=>{
  for(const s of [spec('progress',{min:9,max:2}),spec('motion',{min:-5000}),spec('select',{options:['same','same']}),spec('text',{id:'existing'}),spec('text',{id:'original_heading'}),spec('action',{target:'locked'}),spec('action',{handler:'original; open other'}),spec('unknown'),spec('text',{screen:'missing'}),spec('text',{id:'__proto__'}),spec('progress',{step:Infinity})])assert.throws(()=>L.build(source,s));
  assert.equal(B.compile(source).ir.globals.existing.type,'Number');
 });
 await check('bounded progress executes real handlers and clamps to declared bounds',async()=>{
  const next=L.build(source,spec('progress',{min:0,max:20,step:7}));const e=new E(B.compile(next.source,{id:'working_progress'}).application,{vault:new scope.CLEA7.MemoryVault()});
  try{await e.open();for(let i=0;i<5;i++)await e.dispatch('bil_piece_more');assert.equal(e.state.bilValues.piece,20);for(let i=0;i<5;i++)await e.dispatch('bil_piece_less');assert.equal(e.state.bilValues.piece,0);assert.equal(e.state.bilValues.existing,4);}finally{e.close();}
 });
 await check('motion has real source-mapped gestures, bounded movement and an executable reset',async()=>{
  const next=L.build(source,spec('motion'));const c=B.compile(next.source),shape=c.ir.ui.screens[0].children.at(-1).children.find(n=>n.type==='shape');assert(shape?.gestures.swipeLeft);assert.equal(shape.motion.preset,'move');
  const e=new E(c.application,{vault:new scope.CLEA7.MemoryVault()});try{await e.open();await e.dispatch('bil_piece_more');assert.equal(e.state.bilValues.piece,24);await e.dispatch('bil_piece_reset');assert.equal(e.state.bilValues.piece,0);}finally{e.close();}
 });
 await check('action buttons change existing typed state and preserve original algorithms',async()=>{
  for(const [target,extra,expected]of [['existing',{amount:3},7],['caption',{text:'Updated'},'Updated'],['enabled',{},true]]){
   const next=L.build(source,spec('action',{target,...extra})),e=new E(B.compile(next.source).application,{vault:new scope.CLEA7.MemoryVault()});try{await e.open();await e.dispatch('bil_piece_run');assert.equal(e.state.bilValues[target],expected);}finally{e.close();}
  }
  const linked=L.build(source,spec('action',{handler:'original'})),e=new E(B.compile(linked.source).application,{vault:new scope.CLEA7.MemoryVault()});try{await e.open();await e.dispatch('bil_original');assert.equal(e.state.bilValues.existing,28);}finally{e.close();}
 });
 await check('adding an element keeps the existing application identity and persisted state',async()=>{
  const vault=new scope.CLEA7.MemoryVault(),metadata={id:'owned_working_app'},first=new E(B.compile(source,metadata).application,{vault});await first.open();await first.dispatch('bil_original');first.close();
  const next=L.build(source,spec('toggle')),app=B.compile(next.source,metadata).application,second=new E(app,{vault});try{await second.open();assert.equal(app.id,metadata.id);assert.equal(second.state.bilValues.existing,28);assert.equal(second.state.bilValues.piece,false);}finally{second.close();}
 });
 console.log('WORKING_ELEMENT_CHECKS',count,'real compiler/Core checks; no model or device fixture');
})().catch(error=>{console.error(error);process.exitCode=1;});
