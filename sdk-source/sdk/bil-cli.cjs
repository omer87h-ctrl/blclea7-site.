'use strict';
// Executes only the repository's compiler/Core/interpreter. BIL input is data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),scope={crypto:webcrypto,performance,TextEncoder,TextDecoder,URL,Blob,AbortController,setTimeout,clearTimeout,Date,console};scope.globalThis=scope;vm.createContext(scope);
for(const f of ['runtime','workbench/living','workbench/bil-compiler','workbench/bil-runtime','workbench/working-cache','workbench/clea-core','workbench/format','workbench/plan','workbench/review','workbench/consumer','workbench/engine','workbench/intelligence'])vm.runInContext(fs.readFileSync(path.join(root,'web',f+'.js'),'utf8'),scope);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key),copy=value=>JSON.parse(JSON.stringify(value));
function options(request){
 if(request.cache!==undefined&&!['enabled','off'].includes(request.cache))throw Error('Use cache enabled or off.');
 if(request.diagnostics!==undefined&&!['development','production'].includes(request.diagnostics))throw Error('Use development or production diagnostics.');
 const result={cacheEnabled:request.cache!=='off',diagnosticsMode:request.diagnostics||'development'};
 if(request.cacheBudgetBytes!==undefined){if(!Number.isInteger(request.cacheBudgetBytes)||request.cacheBudgetBytes<0||request.cacheBudgetBytes>32*1024*1024)throw Error('Invalid cache byte budget.');result.cacheBudgetBytes=request.cacheBudgetBytes;}
 if(request.cacheMinComputeMs!==undefined){if(typeof request.cacheMinComputeMs!=='number'||!Number.isFinite(request.cacheMinComputeMs)||request.cacheMinComputeMs<0||request.cacheMinComputeMs>1000)throw Error('Invalid cache admission threshold.');result.cacheMinComputeMs=request.cacheMinComputeMs;}
 return result;
}
function cacheReport(engine){const cache=engine.workingCache||engine.bilWorkingCache;return cache&&typeof cache.snapshot==='function'?cache.snapshot():null;}
function validateTests(suite,app){
 if(!suite||typeof suite!=='object'||Array.isArray(suite)||JSON.stringify(suite).length>262144||Object.keys(suite).sort().join('|')!=='cases|format'||suite.format!=='clea7.project-tests/1'||!Array.isArray(suite.cases)||!suite.cases.length||suite.cases.length>20)throw Error('Project tests need clea7.project-tests/1 and 1–20 cases.');
 let total=0;const names=new Set();
 for(const test of suite.cases){
  if(!test||Object.keys(test).sort().join('|')!=='name|steps'||typeof test.name!=='string'||!test.name.trim()||test.name.length>100||names.has(test.name)||!Array.isArray(test.steps)||!test.steps.length||test.steps.length>20)throw Error('A project case needs a unique name and 1–20 steps.');names.add(test.name);
  for(const step of test.steps){
   if(++total>100||!step||typeof step!=='object'||Array.isArray(step)||Object.keys(step).some(k=>!['flow','restart','expect'].includes(k))||!step.expect||typeof step.expect!=='object'||Array.isArray(step.expect))throw Error('A project step needs an expectation; at most 100 steps.');
   if(step.restart===true){if(own(step,'flow'))throw Error('A restart step cannot dispatch a flow.');}else if(own(step,'restart')||typeof step.flow!=='string'||!own(app.flows,'bil_'+step.flow)||step.flow==='main')throw Error('Use an existing ordinary BIL handler, or restart:true.');
   const expected=step.expect;if(Object.keys(expected).some(k=>!['values','screen','error'].includes(k))||!Object.keys(expected).length)throw Error('Unknown or empty project expectation.');
   if(expected.values!==undefined){if(!expected.values||typeof expected.values!=='object'||Array.isArray(expected.values)||!Object.keys(expected.values).length)throw Error('Expected values must be a nonempty object.');for(const [key,value]of Object.entries(expected.values)){if(!own(app.bil.ir.globals,key))throw Error('Expected value is not a BIL global: '+key);scope.CLEA7BILRuntime.bounded(value);if(!scope.CLEA7BILRuntime.isType(value,app.bil.ir.globals[key].type))throw Error('Expected BIL value has the wrong declared type: '+key);}}
   if(expected.screen!==undefined&&(typeof expected.screen!=='string'||!app.bil.ir.ui?.screens.some(s=>s.id===expected.screen)))throw Error('Expected screen does not exist.');
   if(expected.error!==undefined&&(typeof expected.error!=='string'||!expected.error.length||expected.error.length>200))throw Error('Expected error must be bounded text.');
  }
 }
 return copy(suite);
}
async function testProject(request,app){
 if(app.remote)throw Error('Project unit tests do not implicitly configure network or native adapters.');
 const suite=validateTests(request.tests,app),host=options(request),cases=[],started=performance.now();
 for(const test of suite.cases){
  const vault=new scope.CLEA7.MemoryVault(),create=()=>new scope.CLEA7Engine.Engine(app,{vault,modules:null,reality:'SHADOW',...host});let engine=create();const steps=[];
  try{await engine.open();for(const step of test.steps){
   if(performance.now()-started>15000)throw Error('Project tests exceeded their 15-second budget.');
   let error=null;try{if(step.restart===true){engine.close();engine=create();await engine.open();}else await engine.dispatch('bil_'+step.flow);}catch(fault){error=fault.message;}
   const assertions=[{kind:'error',passed:step.expect.error!==undefined?error!==null&&error.includes(step.expect.error):error===null,expected:step.expect.error??null,actual:error}];
   for(const [key,expected]of Object.entries(step.expect.values||{})){const actual=engine.state.bilValues[key];assertions.push({kind:'value',key,expected,actual:copy(actual),passed:scope.CLEA7.stable(actual)===scope.CLEA7.stable(expected)});}
   if(step.expect.screen!==undefined)assertions.push({kind:'screen',expected:step.expect.screen,actual:engine.state.bilScreen,passed:engine.state.bilScreen===step.expect.screen});
   steps.push({flow:step.flow||null,restart:step.restart===true,passed:assertions.every(x=>x.passed),assertions,cache:cacheReport(engine)});if(!steps[steps.length-1].passed)break;
  }}finally{engine.close();}
  cases.push({name:test.name,passed:steps.length===test.steps.length&&steps.every(x=>x.passed),steps});
 }
 return {format:'clea7.project-test-report/1',passed:cases.every(x=>x.passed),application:app.id,core:scope.CLEA7Core.FORMAT,reality:'SHADOW',storage:'fresh MemoryVault per case; shared across restart steps',ms:performance.now()-started,cases};
}
async function run(request){
 if(request.action==='doctor')return {format:'clea7.sdk.doctor/1',node:process.versions.node,minimumNode:'22.0.0',nodeSupported:Number(process.versions.node.split('.')[0])>=22,compiler:{language:scope.CLEA7BIL.VERSION,ir:scope.CLEA7BIL.IR,coreFeatures:scope.CLEA7BIL.CORE_FEATURES},offline:true};
 if(request.action==='verify')return scope.CLEA7Intelligence.verifyBIL(request.source,{metadata:request.metadata||{},checks:request.checks||[]});
 const result=scope.CLEA7Core.compile(request.source,request.metadata||{}),features=scope.CLEA7Core.featuresFor(result),extra=features.version>=2?{features}:{};
 if(request.action==='features')return {valid:true,features};
 if(request.action==='info')return {valid:true,core:scope.CLEA7Core.FORMAT,coreVersion:scope.CLEA7Core.VERSION,requirements:scope.CLEA7Core.describe(result,request.targets||[])};
 if(request.action==='check')return {valid:true,language:result.ir.language,ir:result.ir.format,globals:result.ir.globals,sourceLocations:result.sourceMap.length,application2:result.application2!==null,...extra};
 if(request.action==='check-project'){const tests=validateTests(request.tests,result.application);return {valid:true,language:result.ir.language,ir:result.ir.format,globals:result.ir.globals,sourceLocations:result.sourceMap.length,testsValidated:true,testCaseCount:tests.cases.length,...extra};}
 if(request.action==='compile'){const app=request.target==='application2'?result.application2:result.application;if(!app)throw Error('This program requires '+result.application.format+'; application/2 cannot represent it.');scope.CLEA7Format.validate(app);return {valid:true,application:app,...extra};}
 if(request.action==='test')return testProject(request,result.application);
 if(request.action==='run'){
  const host=options(request),engine=new scope.CLEA7Engine.Engine(result.application,{vault:new scope.CLEA7.MemoryVault(),...host});
  try{await engine.open();if(request.flow&&request.flow!=='main')await engine.dispatch('bil_'+request.flow);const output={passed:true,state:engine.state.bilValues,views:engine.state.bilViews,trace:engine.events[0]?.bil||[],diagnostics:engine.diagnostics().bil,...extra,...(request.cache!==undefined||request.diagnostics!==undefined?{cache:cacheReport(engine)}:{})};return host.diagnosticsMode==='production'?scope.CLEA7Core.publicResult(output,'production'):output;}finally{engine.close();}
 }
 throw Error('Use BIL check, features, compile, run, info or test.');
}
async function finish(request){try{const result=await run(request);process.stdout.write(JSON.stringify(result));if(result.passed===false)process.exitCode=2;}catch(error){process.stderr.write(JSON.stringify({code:error.code||'BIL_SDK',message:error.message,location:error.location||null}));process.exitCode=1;}}
if(process.argv.length>2){try{
 const [action,file,...args]=process.argv.slice(2);if(action==='doctor'){if(file)throw Error('doctor takes no file or options.');finish({action});}
 else{if(!file||fs.statSync(file).size>131072)throw Error('BIL input must be a file of at most 128 KiB.');const request={action,source:fs.readFileSync(file,'utf8'),metadata:{}};let output=null;
  for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!value)throw Error('Missing CLI argument.');if(key==='--id')request.metadata.id=value;else if(key==='--name')request.metadata.name=value;else if(key==='--flow')request.flow=value;else if(key==='--target')request.target=value;else if(key==='--output')output=value;else if(key==='--cache')request.cache=value;else if(key==='--diagnostics')request.diagnostics=value;else if(key==='--tests'){if(fs.statSync(value).size>262144)throw Error('Project tests exceed 256 KiB.');request.tests=JSON.parse(fs.readFileSync(value,'utf8'));}else throw Error('Unknown CLI option.');}
  if(output){if(fs.existsSync(output))throw Error('Output exists; choose a new file.');run(request).then(result=>{fs.writeFileSync(output,JSON.stringify(result.application||result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({valid:true,output}));}).catch(error=>{console.error(error.message);process.exitCode=1;});}else finish(request);
 }
}catch(error){console.error(error.message);process.exitCode=1;}}
else{let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',text=>{input+=text;if(input.length>1048576){process.stderr.write('BIL SDK request exceeds 1 MiB.');process.exit(1);}});process.stdin.on('end',()=>{try{finish(JSON.parse(input));}catch(error){console.error(error.message);process.exitCode=1;}});}
