'use strict';
/* Seven-pillar execution contracts, by Brzo i Lokalno.
 * Extends the existing compiler/Runtime. Registered tools are trusted host code;
 * model plans are bounded data and cannot register tools or obtain privileges.
 */
(function(scope){
const FORMAT='clea7.intelligence/1',VERSION='0.36.0';
const PILLARS=Object.freeze(scope.CLEA7.PILLARS.map(row=>row[0]));
const issued=new WeakMap();
const copy=value=>JSON.parse(JSON.stringify(value)),clock=()=>performance.now();
const fail=(code,message)=>Object.assign(Error(message),{code});
const token=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_.:-]{0,95}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
function bounded(value,limit=2*1024*1024){
 let count=0;
 function visit(v,depth){
  if(++count>50000||depth>48)throw fail('Budget','Intelligence data budget exceeded.');
  if(v===null||typeof v==='boolean'||typeof v==='string')return;
  if(typeof v==='number'&&Number.isFinite(v))return;
  if(!v||typeof v!=='object')throw fail('Type','Only finite data values are accepted.');
  const proto=Object.getPrototypeOf(v),constructor=proto&&Object.getOwnPropertyDescriptor(proto,'constructor');
  if(proto!==null&&(!constructor||typeof constructor.value!=='function'||!/^function\s+(Object|Array)\s*\([^)]*\)\s*\{\s*\[native code\]\s*\}$/.test(Function.prototype.toString.call(constructor.value))))throw fail('Type','Only plain data containers are accepted.');
  const descriptors=Object.getOwnPropertyDescriptors(v);
  for(const key of Reflect.ownKeys(descriptors)){
   const field=descriptors[key];if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)||!Object.hasOwn(field,'value'))throw fail('Type','Executable or unsafe data rejected.');
   if(Array.isArray(v)&&key==='length')continue;visit(field.value,depth+1);
  }
 }
 visit(value,0);const raw=JSON.stringify(value);if(new TextEncoder().encode(raw).length>limit)throw fail('Budget','Intelligence byte budget exceeded.');return JSON.parse(raw);
}
function create({grants=[],maxSteps=16,timeoutMs=15000,onEvent=()=>{}}={}){
 if(!Array.isArray(grants)||grants.some(x=>!token(x))||!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>32||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw fail('Policy','Invalid execution policy.');
 const permissions=new Set(grants),registry=new Map();let active=false,sequence=0;
 const register=descriptor=>{
  if(active||!descriptor||!token(descriptor.id)||!(typeof descriptor.version==='string'&&/^[0-9]+(?:\.[0-9]+)*$/.test(descriptor.version))||!PILLARS.includes(descriptor.pillar)||!token(descriptor.permission)||!['pure','isolated'].includes(descriptor.effects)||!['run','input','output'].every(k=>typeof descriptor[k]==='function')||registry.has(descriptor.id))throw fail('Registry','Invalid or duplicate host capability.');
  registry.set(descriptor.id,Object.freeze({...descriptor}));
 };
 const manifest=()=>({format:FORMAT,version:VERSION,capabilities:[...registry.values()].map(({id,version,pillar,permission,effects})=>({id,version,pillar,permission,effects}))});
 function start(plan,seed,{signal}={}){
  if(active)throw fail('Busy','An intelligence task is already running.');
  bounded(seed);
  if(!Array.isArray(plan)||!plan.length||plan.length>maxSteps)throw fail('Plan','Invalid bounded plan.');
  const seen=new Set(),steps=plan.map(step=>{
   if(!step||Object.keys(step).some(k=>!['id','tool','version','after'].includes(k))||!token(step.id)||seen.has(step.id)||!Array.isArray(step.after)||step.after.some(id=>!seen.has(id)))throw fail('Plan','Plan contains a duplicate, cycle or unknown dependency.');
   const tool=registry.get(step.tool);if(!tool||tool.version!==step.version)throw fail('Capability','Capability/version is unavailable.');
   if(!permissions.has(tool.permission))throw fail('Permission','Capability permission was not granted.');
   seen.add(step.id);return {...step,tool};
  });
  active=true;const controller=new AbortController(),started=clock(),id='intelligence_'+Date.now().toString(36)+'_'+(++sequence),events=[],context={seed:bounded(seed),results:Object.create(null)};
  const task={id,state:'running',result:null,error:null};
  const emit=(step,state,extra={})=>{const event=Object.freeze({format:'clea7.pillar-event/1',task:id,step:step?.id||null,pillar:step?.tool?.pillar||null,capability:step?.tool?.id||null,state,elapsedMs:Math.max(0,clock()-started),...extra});events.push(event);try{onEvent(event);}catch{}};
  const check=()=>{if(controller.signal.aborted)throw fail('Cancelled','Intelligence task cancelled.');if(clock()-started>timeoutMs)throw fail('Timeout','Intelligence task exceeded its time budget.');};
  const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  let rejectAbort;const interrupted=new Promise((_,reject)=>rejectAbort=reject);
  controller.signal.addEventListener('abort',()=>{task.state='cancelled';task.result=null;task.error='Cancelled';emit(null,'cancelled');rejectAbort(fail('Cancelled','Intelligence task cancelled.'));},{once:true});
  const timer=setTimeout(cancel,timeoutMs);
  const finished=(async()=>{
   try{
    for(const step of steps){
     check();if(step.tool.input(context)!==true)throw fail('InputContract','Capability input contract rejected.');emit(step,'running');
     const result=await step.tool.run(context,controller.signal);check();
     const data=bounded(result);if(step.tool.output(data)!==true)throw fail('OutputContract','Capability output contract rejected.');
     context.results[step.id]=data;emit(step,'completed');
    }
    check();task.state='completed';task.result=copy(context.results);emit(null,'completed');return {format:FORMAT,id,state:task.state,results:task.result,events:copy(events),durationMs:clock()-started};
   }catch(error){
    task.result=null;task.state=controller.signal.aborted?'cancelled':'failed';task.error=error.code||'ToolFailure';emit(null,task.state,{code:task.error});throw error;
   }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);active=false;}
  })();
  // A cancelled caller receives no successful result. The single-task gate
  // stays owned until a trusted tool actually settles/cleans up its isolated work.
  const promise=Promise.race([finished,interrupted]);
  if(controller.signal.aborted)cancel();
  return Object.freeze({id,promise,cancel,snapshot:()=>({id,state:task.state,error:task.error,events:copy(events),busy:active})});
 }
 return Object.freeze({register,manifest,operator:Object.freeze({start,manifest}),get busy(){return active;}});
}

async function dependencyGraph(application){
 const app=scope.CLEA7Core.validateApplication(application),ir=app.bil?.ir;if(!ir)throw fail('Project','A checked BIL project is required.');
 const modules=Object.create(null),clean=value=>{
  if(Array.isArray(value))return value.map(clean);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['loc','sourceMap','id'].includes(key)).map(([key,v])=>[key,clean(v)]));return value;
 };
 const add=(id,body)=>modules[id]={body,dependencies:new Set(id==='environment'?[]:['environment'])};
 add('environment',{imports:ir.imports,records:ir.records,compiler:scope.CLEA7BIL.VERSION,protocol:VERSION});
 for(const [name,value]of Object.entries(ir.globals))add('value:'+name,{type:value,initial:ir.main.filter(n=>n.op==='STORE_NEW'&&n.name===name)});
 for(const [name,value]of Object.entries(ir.functions))add('function:'+name,value);
 for(const [name,value]of Object.entries(ir.handlers))if(!name.startsWith('ui_'))add('event:'+name,value);
 for(const screen of ir.ui?.screens||[])add('screen:'+screen.id,screen);
 if(!ir.ui)for(const screen of app.screens)add('screen:'+screen.id,{screen,controls:ir.controls});
 function references(value,out){
  if(!value||typeof value!=='object')return;
  if(value.op==='CALL'&&modules['function:'+value.call])out.add('function:'+value.call);
  if((value.op==='LOAD'||value.op==='STORE')&&modules['value:'+value.name])out.add('value:'+value.name);
  if(typeof value.handler==='string'&&modules['event:'+value.handler])out.add('event:'+value.handler);
  for(const key of ['target','name'])if(typeof value[key]==='string'&&modules['value:'+value[key]])out.add('value:'+value[key]);
  for(const child of Object.values(value))if(child&&typeof child==='object')Array.isArray(child)?child.forEach(v=>references(v,out)):references(child,out);
 }
 const result={format:'clea7.project-dependencies/1',compiler:scope.CLEA7BIL.CORE_FEATURES,modules:{}};
 for(const [id,node]of Object.entries(modules)){references(node.body,node.dependencies);node.dependencies.delete(id);const hash=await scope.CLEA7.digest(scope.CLEA7.stable(clean(node.body)));if(!hash)throw fail('Integrity','SHA-256 unavailable.');result.modules[id]={hash,dependencies:[...node.dependencies].sort()};}
 return result;
}
function impact(before,after){
 if(before?.format!=='clea7.project-dependencies/1'||after?.format!==before.format)throw fail('Graph','Invalid graph version.');
 const ids=new Set([...Object.keys(before.modules),...Object.keys(after.modules)]),compilerChanged=scope.CLEA7.stable(before.compiler)!==scope.CLEA7.stable(after.compiler),changed=new Set([...ids].filter(id=>compilerChanged||before.modules[id]?.hash!==after.modules[id]?.hash));
 const affected=new Set(changed);let more=true;
 while(more){more=false;for(const id of ids)if(!affected.has(id)&&[...(before.modules[id]?.dependencies||[]),...(after.modules[id]?.dependencies||[])].some(dep=>affected.has(dep))){affected.add(id);more=true;}}
 return {format:'clea7.project-impact/1',changed:[...changed].sort(),affected:[...affected].sort(),retained:[...ids].filter(id=>!affected.has(id)&&after.modules[id]).sort()};
}
async function verifyBIL(source,{metadata={},checks=[],signal,onEvent,modelAvailable=false}={}){
 if(typeof source!=='string'||new TextEncoder().encode(source).length>131072||!Array.isArray(checks)||checks.length>20||typeof modelAvailable!=='boolean')throw fail('Input','Invalid BIL verification request.');
 const service=create({grants:['project.read','bil.compile','runtime.shadow','interface.describe','verification.read'],onEvent});
 let application,engine=null,execution=null;
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const register=(id,pillar,permission,run,output=object)=>service.register({id,version:'1',pillar,permission,effects:id==='runtime.shadow'?'isolated':'pure',input:context=>object(context.seed),output,run});
 register('request.validate',PILLARS[0],'project.read',()=>({sourceBytes:new TextEncoder().encode(source).length,requestedChecks:checks.length,bounded:true}));
 register('source.snapshot',PILLARS[1],'project.read',async()=>{const hash=await scope.CLEA7.digest(source);if(!hash)throw fail('Integrity','SHA-256 unavailable.');return {sourceHash:hash,compiler:scope.CLEA7BIL.VERSION};});
 register('bil.compile',PILLARS[2],'bil.compile',()=>{application=scope.CLEA7Core.compile(source,metadata).application;scope.CLEA7Core.validateApplication(application);if(application.remote&&Object.values(application.remote.backends).some(b=>b.adapter!=='sense.local/1'))throw fail('Permission','SHADOW verification does not grant remote/native access.');return {application:application.id,format:application.format,typed:true};});
 register('runtime.shadow',PILLARS[3],'runtime.shadow',async(context,abort)=>{
  const vault=new scope.CLEA7.MemoryVault();engine=new scope.CLEA7Engine.Engine(application,{vault,reality:'SHADOW',modules:null,cacheEnabled:false});
  const results=[],cancel=()=>engine?.close();abort.addEventListener('abort',cancel,{once:true});
  try{
   await engine.open();results.push({name:'initialization',passed:true});
   for(const test of checks){
    if(abort.aborted)throw fail('Cancelled','Verification cancelled.');
    if(!test||typeof test.flow!=='string'||!Object.hasOwn(application.flows,'bil_'+test.flow)||!object(test.expect)||Object.keys(test).some(k=>!['flow','expect'].includes(k)))throw fail('Test','Invalid checked handler expectation.');
    await engine.dispatch('bil_'+test.flow);
    for(const [name,value]of Object.entries(test.expect))if(!Object.hasOwn(application.bil.ir.globals,name)||scope.CLEA7.stable(engine.state.bilValues[name])!==scope.CLEA7.stable(value))throw fail('Verification','Runtime expectation failed.');
    results.push({name:'event:'+test.flow,passed:true});
   }
   execution={reality:'SHADOW',checks:results,events:engine.events.length,localStateDiscarded:true};return execution;
  }finally{abort.removeEventListener('abort',cancel);engine.close();engine=null;}
 });
 register('interface.describe',PILLARS[4],'interface.describe',()=>({screens:(application.bil.ir.ui?.screens||application.screens).map(screen=>({id:screen.id,label:screen.label||screen.name||screen.id,controls:screen.children.map(n=>({id:n.id,kind:n.type,label:n.label||n.name||n.target||n.type}))})),visualStepRequired:false}));
 register('fallback.resolve',PILLARS[5],'verification.read',()=>({modelRequired:false,modelAvailable,route:'deterministic-compiler-and-shadow',fallbackUsed:!modelAvailable,noGeneratedAnswer:true}));
 register('verification.report',PILLARS[6],'verification.read',context=>{
  if(!execution?.checks.length||execution.checks.some(check=>check.passed!==true))throw fail('Verification','Unverified execution cannot be confirmed.');
  return {passed:true,sourceHash:context.results.s1.sourceHash,scope:'initialization and explicitly supplied checks only',checkCount:execution.checks.length};
 });
 const ids=['request.validate','source.snapshot','bil.compile','runtime.shadow','interface.describe','fallback.resolve','verification.report'];
 const plan=ids.map((tool,index)=>({id:'s'+index,tool,version:'1',after:index?['s'+(index-1)]:[]}));
 const task=service.operator.start(plan,{kind:'bil.verify'},{signal}),receipt=await task.promise;
 const graph=await dependencyGraph(application),result={format:'clea7.verified-proposal/1',application,receipt,graph,verifiedScope:receipt.results.s6.scope};
 issued.set(result,{application:application.id,sourceHash:receipt.results.s6.sourceHash,checksHash:await scope.CLEA7.digest(scope.CLEA7.stable(checks)),engine:VERSION,checkCount:execution.checks.length,graph:copy(graph)});
 return result;
}
function createMemory({vault,scopeId,approved=false}={}){
 if(!vault||!token(scopeId)||approved!==true)throw fail('Permission','Persistent execution memory requires an explicit owner/project scope and approval.');
 const key='intelligence-memory:'+scopeId;
 async function read(){const value=await vault.get(key);if(value===null)return {format:'clea7.execution-memory/1',entries:[]};const checked=bounded(value,131072);if(checked.format!=='clea7.execution-memory/1'||!Array.isArray(checked.entries)||checked.entries.length>32)throw fail('Memory','Invalid execution memory.');return checked;}
 return Object.freeze({
  async remember(result){
   const certificate=issued.get(result);if(!certificate)throw fail('Verification','Only a result verified by this execution instance can be remembered.');
   const previous=await vault.get(key),value=previous===null?{format:'clea7.execution-memory/1',entries:[]}:await read();
   const entries=value.entries.filter(row=>!(row.sourceHash===certificate.sourceHash&&row.checksHash===certificate.checksHash));entries.push({...copy(certificate),verifiedAt:Date.now()});while(entries.length>32)entries.shift();
   const next=bounded({format:value.format,entries},131072);await vault.batchConditional(key,previous,[[key,next]]);return {stored:true,entries:entries.length,persistent:vault.persistent===true};
  },
  async lookup(source,checks=[]){
   if(typeof source!=='string'||source.length>131072)throw fail('Input','Invalid source.');const sourceHash=await scope.CLEA7.digest(source),checksHash=await scope.CLEA7.digest(scope.CLEA7.stable(bounded(checks))),value=await read();
   const entry=value.entries.find(row=>row.sourceHash===sourceHash&&row.checksHash===checksHash&&row.engine===VERSION);
   return entry?{found:true,evidence:copy(entry),requiresFreshVerification:true}:{found:false,requiresFreshVerification:true};
  },
  async clear(){await vault.remove(key);return {cleared:true};}
 });
}
scope.CLEA7Intelligence=Object.freeze({FORMAT,VERSION,PILLARS,create,verifyBIL,dependencyGraph,impact,createMemory});
})(globalThis);
