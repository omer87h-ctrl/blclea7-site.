const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const work=path.resolve(__dirname,'../studio/workbench');
if(!globalThis.crypto)globalThis.crypto=require('node:crypto').webcrypto;
for(const file of ['../runtime.js','living.js','resources.js','resource-host.js','depth.js','bil-compiler.js','bil-runtime.js','working-cache.js','clea-core.js','format.js','device.js','plan.js','review.js','consumer.js','image-store.js','firebase-development.js','android-backend.js','remote.js','engine.js','intelligence.js','studio-operator.js','public-plan.js','ai-authoring.js','public-studio-agent.js']){
 const p=path.join(work,file);vm.runInThisContext(fs.readFileSync(p,'utf8'),{filename:p});
}
const structure={title:'Notes',v:[['draft','Text'],['entries','List<Text>']],e:[['add','append note'],['clear','clear all notes']],s:[['home','Notes','write and view notes']]};
const add={steps:[['set','entries','collections.append(entries,draft)']],test:{inputs:{draft:'test entry'},expect:{entries:['test entry']}}};
const clear={steps:[['set','entries','collections.slice(entries,0,0)']],test:{inputs:{},expect:{entries:[]}}};
const screen={bg:'#112233',fg:'#ffffff',accent:'#445566',layout:'column',nodes:[['card','New note',[['m','draft','Note'],['b','Add','add']]],['o','entries'],['b','Clear','clear']]};
(async()=>{
 let bad=true;const calls=[];
 const ask=async question=>{calls.push(question);let value;
 if(question.startsWith('Plan app.'))value=structure;
 else if(question.startsWith('Write event add:')){if(bad){bad=false;return {reply:'{"broken":true}'};}value=add;}
 else if(question.startsWith('Write event clear:'))value=clear;
 else if(question.startsWith('Design screen home '))value=screen;
 else throw Error('Unexpected phase');
 return {reply:JSON.stringify(value)};
 };
 const result=await CLEA7PublicStudioAgent.generate('A new independent notes app',{ask});
 assert.equal(result.checks.length,2);assert.ok(result.trace.some(t=>!t.passed));assert.ok(result.source.includes('collections.append'));
 assert.ok(result.source.includes('background "#112233"'));
 assert.equal(calls.length,5);
 const compiled=CLEA7BIL.compile(result.source);
 assert.ok(compiled.ir.ui.screens.length===1);
 const checked=await CLEA7Intelligence.verifyBIL(result.source,{metadata:{id:'staged_fixture',name:'Notes'},checks:result.checks});
 assert.ok(checked.receipt.results.s3.checks.every(x=>x.passed));
 console.log('STAGED_FIXTURE_REPAIR_DRAW_REAL_RUNTIME_PASS');
 if(!process.env.CLEA_REAL_MODEL_TEST)return;
 const realFetch=globalThis.fetch;
 globalThis.fetch=(url,init)=>realFetch(url,{...init,headers:{...init.headers,Origin:'https://clea7.brzoilokalno.com'}});
 const creator=CLEA7AppAuthoring.create({generate:(intent,{signal})=>CLEA7PublicStudioAgent.generate(intent,{signal,onStatus:message=>console.log('MODEL_STAGE',message.replace(/ · Qwen sastavlja plan · \d+ znakova$/,''))}),attempts:1});
 const proposal=await creator.propose('Napravi mali rokovnik na bosanskom: upis naslova bilješke, dugme dodaj, prikaz svih bilješki i obriši sve.',{mode:'create',representation:'public-staged'});
 assert.ok(proposal.modelInvoked&&proposal.application.bil.ir.ui.screens.length);
 assert.ok(proposal.agentTrace.some(t=>t.stage==='Runtime'&&t.passed));
 console.log('REAL_STAGED_QWEN_DRAW_BIL_RUNTIME_PASS',JSON.stringify({name:proposal.application.name,screens:proposal.application.bil.ir.ui.screens.length,checks:proposal.receipt.results.s3.checks,trace:proposal.agentTrace}));
 console.log('ACTUAL_MODEL_GENERATED_SOURCE',JSON.stringify(proposal.source));
})().catch(e=>{console.error('STAGED_AGENT_FAIL',e.message,JSON.stringify(e.trace||[]),e.stack);process.exitCode=1;});
