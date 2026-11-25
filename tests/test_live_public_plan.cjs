const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const work=path.resolve(__dirname,'../studio/workbench');
if(!globalThis.crypto)globalThis.crypto=require('node:crypto').webcrypto;
for(const file of ['../runtime.js','living.js','resources.js','resource-host.js','depth.js','bil-compiler.js','bil-runtime.js','working-cache.js','clea-core.js','format.js','device.js','plan.js','review.js','consumer.js','image-store.js','firebase-development.js','android-backend.js','remote.js','engine.js','intelligence.js','public-plan.js','ai-authoring.js']){
 const p=path.join(work,file);vm.runInThisContext(fs.readFileSync(p,'utf8'),{filename:p});
}
const fixture={v:[['title',''],['day',''],['note',''],['entries','']],e:[['add',[['entries','entries + title + " / " + day + " / " + note + "\\n"']]],['clear',[['entries','""']]]],s:[['home','Rokovnik',[['i','title','Naslov'],['i','day','Datum'],['i','note','Bilješka'],['b','Dodaj','add'],['o','entries'],['b','Obriši','clear']]]]};
(async()=>{
 const P=CLEA7PublicPlan,A=CLEA7AppAuthoring;
 const converted=A.emitPlan(P.expand(JSON.stringify(fixture)));
 const verified=await CLEA7Intelligence.verifyBIL(converted.source,{metadata:{id:'fixture_plan',name:'Rokovnik'},checks:[{flow:'add',expect:{entries:' /  / \n'}},{flow:'clear',expect:{entries:''}}]});
 assert.equal(verified.receipt.results.s3.checks.length,3);
 assert.throws(()=>P.expand(JSON.stringify({...fixture,backend:'x'})));
 assert.throws(()=>P.expand('{"v":[]}'));
 console.log('COMPACT_CODEC_AND_BIL_RUNTIME_FIXTURE_PASS');
 if(!process.env.CLEA_REAL_MODEL_TEST)return;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=(url,init)=>originalFetch(url,{...init,headers:{...init.headers,Origin:'https://clea7.brzoilokalno.com'}});
 const creator=A.create({generate:(question,{authoring,signal})=>P.generate(question,authoring,{signal}),attempts:2,onEvent:e=>console.log('AUTHORING_EVENT',e.phase,e.attempt||'',e.diagnostic||'')});
 const question='Napravi rokovnik. Unos naslova, datuma i bilješke; Dodaj spaja upis u tekstualnu listu obaveza; Prikaži listu i Obriši sve. Bosanski.';
 const start=Date.now();
 const result=await creator.propose(question,{mode:'create',representation:'public-compact'});
 const p=result.application.bil.ir;
 assert.ok(p.ui.screens.length&&Object.keys(p.handlers).length>=2);
 assert.ok(result.modelInvoked);
 console.log('REAL_QWEN_COMPACT_BIL_RUNTIME_PASS',Math.round((Date.now()-start)/1000),'seconds',p.ui.screens.length,'screens',Object.keys(p.handlers).length,'handlers');
 console.log('MODEL_BIL_SOURCE',JSON.stringify(result.source));
})().catch(error=>{console.error('TEST_FAILED',error.message);process.exitCode=1;});
