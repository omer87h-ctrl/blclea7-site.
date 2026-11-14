'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const web=process.env.CLEA7_SOURCE_WEB||'web',s={crypto:webcrypto,performance,TextEncoder,TextDecoder,URL,Blob,AbortController,setTimeout,clearTimeout,Date,console};s.globalThis=s;vm.createContext(s);
for(const f of ['runtime','workbench/living','workbench/bil-compiler','workbench/bil-runtime','workbench/working-cache','workbench/clea-core','workbench/bil-elements','workbench/clea-draw','workbench/studio-operator','workbench/format','workbench/plan','workbench/review','workbench/consumer','workbench/engine','workbench/intelligence','workbench/ai-authoring'])vm.runInContext(fs.readFileSync(web+'/'+f+'.js','utf8'),s);
const O=s.CLEA7StudioTools,A=s.CLEA7AppAuthoring,B=s.CLEA7BIL,D=s.CLEA7Draw,base='# Owner source must survive\nlet previous = 7\nfn own(n: Number) -> Number { return n * 3 }\nscreen home "Home" {show previous key original}\nstart home\n';
const app=B.compile(base,{id:'same_project',name:'My original'}).application;
let passed=0;async function check(name,fn){await fn();passed++;console.log('PASS Studio operator '+name);}
(async()=>{
 await check('one registered operator emits real UI, Draw, collection and independent BIL logic',()=>{
  const plan={format:O.FORMAT,operations:[{tool:'project.create',screen:'home',title:'Original world'},{tool:'screen.add',screen:'details',title:'Details'},
   {tool:'ui.add',spec:{screen:'home',id:'progress',label:'Progress',kind:'progress'}},{tool:'ui.collection',spec:{screen:'details',id:'library',label:'Library'}},
   {tool:'draw.add',spec:{screen:'home',id:'player',label:'Player',role:'actor'}},{tool:'draw.add',spec:{screen:'home',id:'door',label:'Door',role:'door',actor:'draw7_player',x:240,y:120}},
   {tool:'ui.add',spec:{screen:'home',id:'pages',label:'Navigation',kind:'navigation'}}]};
  const converted=O.emit(plan),c=B.compile(converted.source);assert.equal(c.ir.ui.screens.length,2);assert.equal(c.ir.ui.format,'bil.ui/3');assert(c.ir.handlers.library_add);assert(c.ir.handlers.draw7_player_right);assert(c.ir.handlers.progress_more);
 });
 await check('a documented local command executes actual seven-responsibility movement, proximity and restart checks',async()=>{
  const resolved=O.resolve('Napravi novu aplikaciju sa igračem i vratima koja se otvaraju kad priđe',base);assert(resolved.createsProject);
  const p=await A.operate(resolved.plan,{project:app,mode:'create'});assert.equal(p.modelInvoked,false);assert.equal(p.sourceOrigin,'local-studio-tools');assert.equal(p.receipt.results.s3.checks.length,5);assert(p.receipt.events.filter(e=>e.state==='completed'&&e.pillar).length===7);
  const verified=await A.recheck(p,app);assert(verified.bil.source.includes('draw7_near'));assert.equal(app.bil.source,base);
 });
 await check('visual and model tools preserve existing identity/source and reject stale or tampered reviewed proposals',async()=>{
  const p=await A.operate({format:O.FORMAT,operations:[{tool:'ui.add',spec:{screen:'home',kind:'progress',id:'speed',label:'Speed'}}],checks:[{flow:'speed_more',expect:{speed:10,previous:7}}]},{project:app});
  assert.equal(p.application.id,app.id);assert(p.source.includes('# Owner source must survive'));assert(p.source.includes('fn own(n: Number) -> Number { return n * 3 }'));await A.recheck(p,app);
  await assert.rejects(A.recheck(p,{...app,name:'Changed while reviewing'}));p.source+='\n';await assert.rejects(A.recheck(p,app));
 });
 await check('the actual model contract can invoke Draw tools with explicit source approval (inference transport fixture)',async()=>{
  let sent;const author=A.create({attempts:1,generate:async(_intent,options)=>{sent=options.authoring;return {reply:JSON.stringify({format:O.FORMAT,operations:[{tool:'draw.add',spec:{screen:'home',id:'player',label:'Player',role:'actor'}}],checks:[{flow:'draw7_player_right',expect:{draw7_player_x:96,previous:7}}]}),modelProfile:'qwen3.5-9b-q4_k_m'};}});
  await assert.rejects(author.propose('Add player',{project:app,mode:'change',representation:'tools'}));
  const p=await author.propose('Add player',{project:app,mode:'change',sourceApproved:true,representation:'tools'});assert.equal(sent.representation,'tools');assert.equal(sent.source,base);assert.equal(p.conversion.operations[0].tool,'draw.add');assert.equal(p.receipt.results.s3.checks.length,2);await A.recheck(p,app);
 });
 await check('position and proximity share checked source edits, preserve manual rules and do not guess external effects',()=>{
  const plan=O.resolve('Napravi novu aplikaciju sa igračem i vratima koja se otvaraju kad priđe',null).plan,source=O.emit(plan).source;
  const relation=D.relationship(source,'draw7_door');assert.equal(relation.actor,'draw7_player');
  const edited=O.emit({format:O.FORMAT,operations:[{tool:'draw.proximity',object:'draw7_door',actor:'draw7_player',radius:180},{tool:'draw.position',object:'draw7_door',x:300,y:120}]},{source}).source;
  assert.equal(D.relationship(edited,'draw7_door').radius,180);assert.equal(D.model(edited).objects.find(o=>o.key==='draw7_door').x,300);
  assert.throws(()=>D.setProximity(source.replace('derive draw7_door_open =','derive draw7_door_open  ='),'draw7_door','draw7_player',180));
  assert.equal(O.resolve('What is the capital of France?',base),null);
 });
 await check('Sense CV uses the byte-exact original accessible BIL example and real review/navigation checks',async()=>{
  const resolved=O.resolve('Napravi novu aplikaciju za CV',null);assert(resolved.createsProject);const source=O.emit(resolved.plan).source;assert.equal(source,fs.readFileSync('sdk-source/sdk/examples/bil/sense-cv.bil','utf8'));const p=await A.operate(resolved.plan,{mode:'create'});assert(p.receipt.results.s3.checks.length>=3);assert.equal(p.modelInvoked,false);assert(source.includes('sense.local/1'));assert(!source.includes('Omer'));
 });
 await check('unknown tools, replacement, declaration injection, oversized geometry and failing checks cannot change the project',async()=>{
  for(const operations of [[{tool:'shell',command:'whoami'}],[{tool:'project.create',screen:'other',title:'overwrite'}],[{tool:'bil.declaration',source:'let x = 1\non hidden {previous = 0}'}],[{tool:'draw.add',spec:{screen:'home',id:'bad',role:'actor',label:'Bad',points:[[0,0],[2000,0]]}}]])assert.throws(()=>O.emit({format:O.FORMAT,operations},{source:base}));
  await assert.rejects(A.operate({format:O.FORMAT,operations:[{tool:'ui.add',spec:{screen:'home',kind:'progress',id:'speed',label:'Speed'}}],checks:[{flow:'speed_more',expect:{speed:999}}]},{project:app}));assert.equal(app.bil.source,base);
 });
 console.log('STUDIO_OPERATOR_CHECKS',passed,'actual compiler/Core/operator groups; model transport fixture is explicit, no neural inference claimed');
})().catch(e=>{console.error(e);process.exitCode=1;});
