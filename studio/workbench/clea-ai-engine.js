'use strict';
/* Original local CLEA application planner, by Brzo i Lokalno.
 * A small learned classifier may suggest an intent. Checked grammar, typed BIL
 * and actual Runtime probes remain authoritative. No network, eval or shell.
 * This is a bounded application-generation experiment, not a general LLM.
 */
(function(scope){
const FORMAT='clea7.ai.proposal/1',VERSION='clea.ai.rules/1.0.0',OPS=Object.freeze([
 {id:'add',symbol:'+',label:'Saberi',expected:10},
 {id:'subtract',symbol:'-',label:'Oduzmi',expected:4},
 {id:'multiply',symbol:'*',label:'Pomnoži',expected:21},
 {id:'divide',symbol:'/',label:'Podijeli',expected:7/3}
]);
const clone=value=>JSON.parse(JSON.stringify(value));
const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
const now=()=>performance.now();
function fault(code,message){const e=new Error(message);e.code=code;return e;}
function aborted(signal){if(signal?.aborted){const e=fault('Cancelled','Lokalni zadatak je otkazan.');e.name='AbortError';throw e;}}
async function checkpoint(signal){aborted(signal);await new Promise(resolve=>setTimeout(resolve,0));aborted(signal);}
const normal=text=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'dj').toLowerCase();
function intent(request){
 if(typeof request!=='string'||!request.trim()||request.length>1200)throw fault('Request','Zahtjev treba imati 1–1200 znakova.');
 const text=normal(request),words=text.match(/[a-z0-9]+/g)||[];
 if(/\b(shell|terminal|eval|password|lozink|bluetooth|video|scientific|integral|trigonometry|currency|server|cloud|upload|api)\w*\b/.test(text)||/\b(delete|obrisi|erase)\b/.test(text)||/\b(do not|dont|never|nemoj)\b/.test(text))throw fault('Unsupported','Ovaj lokalni eksperiment podržava kalkulator i dodavanje reset dugmeta; zahtjev nije dozvoljen tom ugovoru.');
 // Reject unsatisfied extra features instead of silently reducing the request.
 const allowed=/^(a|an|the|my|please|can|could|you|i|want|need|to|me|for|with|and|in|using|new|basic|simple|application|app|program|create|make|build|generate|calculator|arithmetic|add|reset|restart|clear|button|inputs?|fields?|values?|zero|napravi|kreiraj|izradi|dodaj|jednostavan|jednostavni|jednostavnu|novi|novu|moj|moja|mi|molim|te|kalkulator|aplikaciju|aplikacija|program|dugme|dugmad|taster|ponisti|ocisti|vrijednosti|vrijednost|polja|polje|ulaze|brojeve|na|u|i|za|sve|nulu|nula)$/;
 if(words.some(word=>!allowed.test(word)))throw fault('Unsupported','Zahtjev sadrži mogućnosti izvan provjerenog lokalnog ugovora. Dodatne funkcije neće biti tiho izostavljene.');
 const reset=words.some(w=>/^(reset|restart|clear|ponist|ocist|nulu|nula)/.test(w));
 const button=words.some(w=>/^(button|dugm|taster|polj|field|input|vrijednost|value|broj|calculator|kalkulator)/.test(w));
 const calc=words.some(w=>/^(calculator|kalkulator|arithmetic|aritmeti)/.test(w));
 if(reset&&button)return 'calculator.reset';
 if(calc)return 'calculator.create';
 throw fault('Unsupported','Podržani prvi zahtjevi su „Create a simple calculator application.“ i „Add a reset button.“.');
}
function metadata(project,identity){return {id:identity||project.id,name:identity?'Moj kalkulator':project.name,package:identity?'com.brzoilokalno.ai.calc'+identity.slice(3,15):project.package,version:identity?1:project.version,licenses:clone(project.licenses||[])};}
function calculator(){
 const functions=OPS.map(op=>'fn clea_'+op.id+'(left: Number, right: Number) -> Number {\n'+(op.id==='divide'?'    if right == 0 { raise "ZeroDivision", "Dijeljenje nulom nije dozvoljeno." }\n':'')+'    return left '+op.symbol+' right\n}');
 const handlers=OPS.map(op=>'on '+op.id+' {\n'+(op.id==='divide'?'    try {\n        result = clea_divide(first, second)\n        message = ""\n    } catch failure { message = failure.message }':'    result = clea_'+op.id+'(first, second)\n    message = ""')+'\n}');
 return '# CLEA local structural generator: arithmetic/1\n'+functions.join('\n\n')+'\n\nlet first = 0\nlet second = 0\nlet result = 0\nlet message = ""\n\nscreen calculator "Moj kalkulator" {\n    input first label "Prvi broj"\n    input second label "Drugi broj"\n'+OPS.map(op=>'    button '+JSON.stringify(op.label)+' runs '+op.id).join('\n')+'\n    show result\n    show message\n}\n\n'+handlers.join('\n\n')+'\n';
}
function uiNodes(items){return items.flatMap(n=>[n,...uiNodes(n.children||[])]);}
function checkedIndex(project){
 if(!project.bil)return {format:'clea7.ai.project-index/1',language:'json',screens:project.screens.map(p=>({id:p.id,label:p.name||p.id})),globals:[],handlers:[]};
 const ir=project.bil.ir;
 return {format:'clea7.ai.project-index/1',language:'bil',screens:(ir.ui?.screens||[]).map(p=>({id:p.id,label:p.label,location:p.loc,components:uiNodes(p.children).map(n=>({id:n.id,type:n.type,name:n.name||n.target||n.handler||'',location:n.loc}))})),globals:Object.entries(ir.globals).map(([name,g])=>({name,type:g.type,mutable:g.mutable})),handlers:Object.keys(ir.handlers).filter(n=>!n.startsWith('ui_'))};
}
function validIndex(value,project){
 // Cache content is regenerable, never an authority over the project's plan.
 // Compare bounded derived metadata against the already-validated IR. This
 // still costs validation work; cache reuse does not bypass that boundary.
 try{return scope.CLEA7.stable(value)===scope.CLEA7.stable(checkedIndex(project));}catch{return false;}
}
function resetPlan(project){
 if(!project.bil?.ir.ui?.screens?.length)throw fault('Project','Za dodavanje reset dugmeta otvori podržanu BIL aplikaciju.');
 const ir=project.bil.ir,page=ir.ui.screens[0],nodes=uiNodes(page.children);
 const inputs=nodes.filter(n=>n.type==='input'&&n.inputType==='Number');
 const outputs=nodes.filter(n=>n.type==='view'&&ir.globals[n.target]?.type==='Number'&&ir.globals[n.target]?.mutable);
 if(inputs.length!==2||outputs.length!==1)throw fault('Project','Prvi reset postupak zahtijeva dva brojčana ulaza i jedan promjenjivi brojčani rezultat na prvom ekranu.');
 const names=[...new Set([...inputs.map(n=>n.name),outputs[0].target])];
 if(names.some(name=>!ir.globals[name]?.mutable||typeof project.state.bilValues[name]!=='number'))throw fault('Project','Reset ciljevi nisu promjenjivi brojčani podaci.');
 if(ir.globals.message?.mutable&&ir.globals.message.type==='Text'&&project.bil.source.startsWith('# CLEA local structural generator: arithmetic/1'))names.push('message');
 const existing=nodes.find(n=>n.type==='button'&&n.label==='Reset'&&n.handler&&n.handler.startsWith('clea_reset'));
 let handler=existing?.handler||'clea_reset',suffix=2;
 if(!existing)while(ir.handlers[handler]||ir.functions[handler]||ir.globals[handler])handler='clea_reset_'+suffix++;
 const initials={};for(const name of names){const declaration=ir.main.find(n=>n.op==='STORE_NEW'&&n.name===name&&n.coreFeature!=='derive');if(declaration?.value?.op!=='CONST'||!['number','string'].includes(typeof declaration.value.value))throw fault('Project','Prvi reset postupak zahtijeva literalne početne vrijednosti odabranih polja.');initials[name]=declaration.value.value;}
 return {page,inputs,outputs,names,initials,handler,existing:!!existing};
}
function resetSource(project,plan){
 const source=project.bil.source;if(plan.existing)return {source,changes:[],changed:false};
 // The authoritative compiler's source span identifies the real closing brace,
 // including when comments and strings contain other braces.
 const at=plan.page.loc.end-1;if(source[at]!=='}')throw fault('SourceMap','Ekran nema provjerenu završnu izvornu lokaciju.');
 const insertion=(source.slice(0,at).endsWith('\n')?'':'\n')+'    button "Reset" runs '+plan.handler+'\n';
 const body='\non '+plan.handler+' {\n'+plan.names.map(name=>'    '+name+' = '+JSON.stringify(plan.initials[name])).join('\n')+'\n}\n';
 return {source:source.slice(0,at)+insertion+source.slice(at)+body,changed:true,changes:[{file:'app.bil',kind:'insert',start:at,end:at,text:insertion},{file:'app.bil',kind:'append',start:source.length,end:source.length,text:body}]};
}
async function runtimeCheck(application,kind,reset,signal){
 const engine=new scope.CLEA7Engine.Engine(application,{vault:new scope.CLEA7.MemoryVault(),reality:'SHADOW',modules:null,cacheEnabled:false,diagnosticsMode:'development'}),checks=[];
 function check(name,passed){checks.push({name,passed:passed===true});if(!passed)throw fault('Validation','Runtime provjera nije prošla: '+name);}
 try{
  await engine.open();aborted(signal);
  const page=application.bil.ir.ui.screens[0],nodes=uiNodes(page.children),inputs=nodes.filter(n=>n.type==='input'&&n.inputType==='Number');
  check('Stvarni Runtime otvorio je provjereni BIL projekt',inputs.length===2);
  for(const [index,value]of [7,3].entries()){await engine.dispatch('bil_'+inputs[index].entry,{value});aborted(signal);}
  if(kind==='calculator.create'){
   for(const operation of OPS){await engine.dispatch('bil_'+operation.id);aborted(signal);check(operation.label+' daje očekivani broj',engine.state.bilValues.result===operation.expected);}
   await engine.dispatch('bil_'+inputs[1].entry,{value:0});await engine.dispatch('bil_divide');check('Dijeljenje nulom daje obrađenu stvarnu grešku',engine.state.bilValues.message.length>0&&Number.isFinite(engine.state.bilValues.result));
  }else{
   const before=clone(engine.state.bilValues);await engine.dispatch('bil_'+reset.handler);aborted(signal);
   check('Reset vraća samo deklarisane ciljeve',reset.names.every(name=>scope.CLEA7.stable(engine.state.bilValues[name])===scope.CLEA7.stable(reset.initials[name])));
   check('Ostali podaci nisu promijenjeni',Object.keys(before).filter(name=>!reset.names.includes(name)).every(name=>scope.CLEA7.stable(before[name])===scope.CLEA7.stable(engine.state.bilValues[name])));
  }
  return {passed:true,runtime:'CLEA Core '+scope.CLEA7Core.VERSION+' / stvarni izolovani SHADOW Engine',checks,executedEvents:engine.events.length};
 }finally{engine.close();}
}
function create({cache,router=scope.CLEA7LocalIntentModel}={}){
 if(!scope.CLEA7CACI||!scope.CLEA7Core||!scope.CLEA7Engine)throw fault('Unavailable','CLEA Core, Runtime ili lokalna memorija nisu dostupni.');
 const ownCache=!cache,storage=cache||scope.CLEA7CACI.create({scope:'clea-ai-local',storage:false});
 const fingerprint=project=>scope.CLEA7CACI.fingerprint({format:VERSION,project:scope.CLEA7Format.validate(project)});
 async function matchesBase(proposal,project){try{return proposal?.format===FORMAT&&proposal.baseFingerprint===await fingerprint(project);}catch{return false;}}
 async function propose({request,project,signal,cacheEnabled=true}={}){
  const started=now();await storage.ready;aborted(signal);const checked=scope.CLEA7Format.validate(project),baseFingerprint=await fingerprint(checked),kind=intent(request),trace=[],metrics={analysisMs:0,generationMs:0,validationMs:0,cacheHits:0,bytesHashed:bytes(checked),bytesIndexed:0,accountedActiveBytes:0};
  const record=(stage,status,detail)=>trace.push({stage,status,detail});record('Zahtjev','checked','Podržana tipizirana namjera: '+kind+'.');
  let model={kind:'rules',abstained:false};
  if(router?.predict)try{const prediction=router.predict(request);model={kind:'trained-local',version:prediction.version,confidence:prediction.confidence,label:prediction.label,abstained:prediction.abstain===true||prediction.label!==kind,reason:prediction.reason,modelFingerprint:prediction.modelFingerprint};record('Lokalni model',model.abstained?'abstained':'matched','Rezultat malog klasifikatora provjeren je prema zatvorenoj gramatici; ne izvršava kod.');}catch{model={kind:'rules',abstained:true,reason:'model-unavailable'};}
  await checkpoint(signal);
  const analysisStarted=now(),key={version:VERSION,compiler:scope.CLEA7BIL.CORE_FEATURES,baseFingerprint};let index=null;
  if(cacheEnabled)try{const saved=await storage.get('project-index',key);if(saved.hit&&saved.value?.format==='clea7.ai.project-index/1'&&validIndex(saved.value,checked)){index=saved.value;metrics.cacheHits++;record('Projektna memorija','hit','Ponovo korišten indeks istog provjerenog projekta.');}}catch{record('Projektna memorija','bypass','Indeks nije dostupan; struktura se ponovo analizira.');}
  if(!index){index=checkedIndex(checked);metrics.bytesIndexed=bytes(checked.bil?.source||checked);if(cacheEnabled)try{await storage.put('project-index',key,index);}catch{}record('Projektna memorija','computed','Izveden indeks provjerenih ekrana, komponenti, tipova i događaja.');}
  metrics.analysisMs=Math.max(0,now()-analysisStarted);await checkpoint(signal);
  const generateStarted=now();let candidateSource,identity=null,changes,changed=true,reset=null;
  if(kind==='calculator.create'){candidateSource=calculator();identity='ai_'+baseFingerprint.slice(0,24);changes=[{file:'app.bil',kind:'new-project',before:checked.bil?.source||'',after:candidateSource}];}
  else{reset=resetPlan(checked);const patch=resetSource(checked,reset);candidateSource=patch.source;changes=patch.changes;changed=patch.changed;}
  if(bytes(candidateSource)>131072)throw fault('Budget','Predloženi izvor prelazi BIL budžet.');
  // Cached indices never supply executable source or positions. Compilation and
  // real Runtime validation run again even on a warm analysis-cache hit.
  const expectedMetadata=metadata(checked,identity),sourceHash=await scope.CLEA7CACI.fingerprint(candidateSource),compileKey={version:VERSION,compiler:scope.CLEA7BIL.CORE_FEATURES,sourceHash,metadata:expectedMetadata};let application=null;
  if(cacheEnabled)try{const saved=await storage.get('compiled-application',compileKey);if(saved.hit&&saved.value?.bil?.source===candidateSource&&['id','name','package','version'].every(name=>saved.value[name]===expectedMetadata[name])&&scope.CLEA7.stable(saved.value.licenses||[])===scope.CLEA7.stable(expectedMetadata.licenses)){
   try{application=scope.CLEA7Core.validateApplication(saved.value);metrics.cacheHits++;record('Kompajlerska memorija','hit','Ponovo korišteni kompajlirani model ponovo je provjeren prema stvarnom izvoru.');}catch{record('Kompajlerska memorija','rejected','Neispravan zadržani model se ponovo kompajlira.');}
  }}catch{record('Kompajlerska memorija','bypass','Kompajlerski cache nije dostupan.');}
  if(!application){const compiled=scope.CLEA7Core.compile(candidateSource,expectedMetadata);application=scope.CLEA7Core.validateApplication(compiled.application);if(cacheEnabled)try{await storage.put('compiled-application',compileKey,application);}catch{}}

  if(checked.licenses?.some(entry=>!application.licenses.some(other=>scope.CLEA7.stable(entry)===scope.CLEA7.stable(other))))throw fault('Licence','Prijedlog nije sačuvao postojeće licence.');
  metrics.generationMs=Math.max(0,now()-generateStarted);record('BIL','compiled','Kreiran i statički provjeren stvarni BIL izvor; nema proizvoljnog JavaScripta.');await checkpoint(signal);
  const validateStarted=now(),coordinated=scope.CLEA7Intelligence?await scope.CLEA7Intelligence.verifyBIL(candidateSource,{metadata:expectedMetadata,signal,modelAvailable:model.kind==='trained-local'}):null;
  const validation=await runtimeCheck(application,kind,reset,signal);if(coordinated)validation.executionProtocol=coordinated.receipt;
  metrics.validationMs=Math.max(0,now()-validateStarted);record('Runtime','passed','Kandidat je izvršen u zasebnom stanju. Živi projekt nije promijenjen.');
  if(cacheEnabled)try{await storage.put('verified-generation',{...key,kind,sourceHash},{format:'clea7.ai.verified-result/1',sourceHash,passed:validation.passed,checks:validation.checks.map(c=>c.name)});}catch{}
  metrics.accountedActiveBytes=bytes(index)+bytes(candidateSource)+bytes(application);metrics.totalMs=Math.max(0,now()-started);aborted(signal);
  return {format:FORMAT,version:VERSION,intent:kind,changed,source:candidateSource,application,baseFingerprint,sourceHash,changes,plan:[{kind:'analyse',label:'Pregled provjerenog projekta',reads:index.globals.map(v=>v.name),components:index.screens.map(v=>v.id)},{kind:kind,label:kind==='calculator.create'?'Sastavi tipizirani kalkulator':'Dodaj reset bez prepisivanja postojećeg koda',writes:kind==='calculator.create'?['app.bil']:reset.names,components:application.bil.ir.ui.screens.map(p=>p.id)},{kind:'validate',label:'Kompajler i stvarni Runtime',reads:['BIL izvor','IR','izolovano stanje']}],validation,metrics,trace,model,cache:clone(storage.stats()),disclosure:'Lokalni eksperiment: mali naučeni klasifikator + provjereni strukturni planer. Nije opći razgovorni model.'};
 }
 return Object.freeze({VERSION,propose,fingerprint,matchesBase,close(){if(ownCache)storage.close();}});
}
scope.CLEA7AIEngine=Object.freeze({FORMAT,VERSION,create});
})(globalThis);
