'use strict';
/* Original CLEA authoring coordinator. Proposals are data until the actual
 * compiler, seven-pillar SHADOW path and reviewed Studio transaction accept. */
(function(scope){
const FORMAT='bil.author/1',PLAN_FORMAT='clea7.authoring-plan/1',certificates=new WeakMap(),clone=x=>JSON.parse(JSON.stringify(x));
const fault=(code,text)=>Object.assign(Error(text),{code});
function emitPlan(plan){
 const bad=text=>{throw fault('Plan',text);},own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const shape=(x,keys,optional=[])=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k)&&!optional.includes(k))||keys.some(k=>!own(x,k)))bad('Nepotpuna ili nepoznata struktura CLEA prijedloga.');};
 const text=x=>{if(typeof x!=='string'||x.length>800)bad('Tekst plana prelazi ograničenje.');return x;};
 const name=x=>{if(typeof x!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(x)||!scope.CLEA7BIL.safe(x))bad('Neispravan identifikator plana.');return x;};
 const list=(x,max)=>{if(!Array.isArray(x)||x.length>max)bad('Previše elemenata u planu.');return x;};
 const parsed=(source,kind)=>{const body=scope.CLEA7BIL.parse(source).body;if(body.length!==1||body[0].kind!==kind)bad('Polje plana mora sadržavati jednu odgovarajuću BIL konstrukciju.');return body[0];};
 const expression=x=>{text(x);if(!x.trim())bad('Nedostaje izraz.');parsed('let cleaProbe = '+x,'declare');return x;};
 if(new TextEncoder().encode(JSON.stringify(plan)).length>12000)bad('Strukturirani prijedlog prelazi ograničenje.');
 shape(plan,['format','state','backends','events','screens','start'],['declarations']);if(plan.format!==PLAN_FORMAT)bad('Nepodržana verzija CLEA plana.');
 const lines=[],sourceMap=[],inferred=[];let total=0;
 const put=(path,source)=>{sourceMap.push({path,line:lines.length+1});lines.push(...source.split('\n'));};
 for(const [i,source] of list(plan.declarations||[],16).entries()){
  text(source);const body=scope.CLEA7BIL.parse(source).body;if(body.length!==1||!['import','record','function'].includes(body[0].kind))bad('Deklaracije plana prihvataju BIL module, zapise i funkcije.');put('declarations.'+i,source);
 }
 const states=list(plan.state,32).slice(),declared=new Set(states.map(s=>s?.name)),backends=new Map(list(plan.backends,4).map(b=>[b?.name,b?.adapter]));
 for(const event of list(plan.events,32))for(const step of list(event.steps,32))if(step?.op==='request'&&backends.get(step.backend)===scope.CLEA7BIL.SENSE_ADAPTER){
  const contract=own(scope.CLEA7BIL.SENSE_CONTRACTS,step.operation)?scope.CLEA7BIL.SENSE_CONTRACTS[step.operation]:null;if(!contract)continue;
  for(const [target,type,value] of [[step.result,contract.result,scope.CLEA7BIL.defaultValue(contract.result)],[step.error,'RemoteFailure?',null]]){
   name(target);if(!declared.has(target)){declared.add(target);states.push({name:target,type,value});inferred.push({name:target,type,reason:'typed local operation completion',operation:step.operation});}
  }
 }
 if(states.length>48)bad('Previše deklarisanih i izvedenih stanja.');
 function literal(value,depth=0){
  if(depth>8)bad('Početna vrijednost je preduboka.');
  if(value===null||typeof value==='string'&&value.length<=800||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e15)return JSON.stringify(value);
  if(Array.isArray(value)&&value.length<=64)return '['+value.map(v=>literal(v,depth+1)).join(', ')+']';
  bad('Početna vrijednost mora biti ograničen JSON literal.');
 }
 for(const [i,state] of states.entries()){
  shape(state,['name','type'],['initial','value']);name(state.name);text(state.type);
  if(own(state,'initial')===own(state,'value'))bad('Stanje treba jednu početnu vrijednost.');
  const initial=own(state,'value')?literal(state.value):expression(state.initial);
  if(!/^[A-Za-z][A-Za-z0-9_<>? ]{0,127}$/.test(state.type))bad('Neispravan tip stanja.');
  const source='let '+state.name+': '+state.type+' = '+initial;parsed(source,'declare');put('state.'+i,source);
 }
 for(const [i,backend] of list(plan.backends,4).entries()){
  shape(backend,['name','adapter']);name(backend.name);text(backend.adapter);put('backends.'+i,'backend '+backend.name+' using '+JSON.stringify(backend.adapter));
 }
 for(const [i,event] of list(plan.events,32).entries()){
  shape(event,['name','steps']);name(event.name);put('events.'+i,'on '+event.name+' {');
  for(const [j,step] of list(event.steps,32).entries()){
   if(++total>256)bad('Plan prelazi ukupni budžet naredbi.');let source;
   switch(step?.op){
    case 'set':shape(step,['op','target','expression']);text(step.target);source=step.target+' = '+expression(step.expression);parsed(source,'assign');break;
    case 'compose':
     shape(step,['op','target','parts']);name(step.target);if(!step.parts?.length)bad('Sastavljanje teksta treba dijelove.');
     source=step.target+' = '+list(step.parts,32).map(part=>{if(part&&own(part,'text')){shape(part,['text']);return JSON.stringify(text(part.text));}shape(part,['value']);return '('+expression(part.value)+')';}).join(' + ');parsed(source,'assign');break;
    case 'open':shape(step,['op','screen']);source='open '+name(step.screen);break;
    case 'request':
     shape(step,['op','backend','operation','args','result','error']);
     if(typeof step.operation!=='string'||!/^[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*$/.test(step.operation))bad('Operacija mora biti GROUP.OPERATION.');
     source='request '+name(step.backend)+'.'+step.operation+'('+list(step.args,8).map(expression).join(', ')+') into '+name(step.result)+' catch '+name(step.error);parsed(source,'request');break;
    case 'bil':shape(step,['op','source']);source=text(step.source);parsed('on cleaProbe {\n'+source+'\n}','handler');break;
    default:bad('Nepodržana naredba plana.');
   }
   put('events.'+i+'.steps.'+j,' '+source.replaceAll('\n','\n '));
  }
  lines.push('}');
 }
 const screens=list(plan.screens,16);if(!screens.length)bad('Plan nema ekran.');
 for(const [i,screen] of screens.entries()){
  shape(screen,['id','title','items']);name(screen.id);text(screen.title);put('screens.'+i,'screen '+screen.id+' '+JSON.stringify(screen.title)+' {');
  for(const [j,item] of list(screen.items,64).entries()){
   if(++total>256)bad('Plan prelazi ukupni budžet komponenti.');let source;
   switch(item?.kind){
    case 'input':case 'toggle':shape(item,['kind','name','label']);source=item.kind+' '+name(item.name)+' label '+JSON.stringify(text(item.label));break;
    case 'button':shape(item,['kind','label','runs']);source='button '+JSON.stringify(text(item.label))+' runs '+name(item.runs);break;
    case 'show':shape(item,['kind','expression']);source='show '+expression(item.expression);break;
    case 'heading':case 'text':shape(item,['kind','label']);source=item.kind+' '+JSON.stringify(text(item.label));break;
    case 'bil':shape(item,['kind','source']);source=text(item.source);parsed('screen cleaProbe "Probe" {\n'+source+'\n}','screen');break;
    default:bad('Nepodržana komponenta plana.');
   }
   if(item.kind!=='bil')source+=' key ai_s'+i+'_n'+j;
   put('screens.'+i+'.items.'+j,' '+source.replaceAll('\n','\n '));
  }
  lines.push('}');
 }
 put('start','start '+name(plan.start));const source=lines.join('\n')+'\n';
 if(new TextEncoder().encode(source).length>10000)bad('BIL prijedlog prelazi ograničenje; izvor nije skraćen.');
 scope.CLEA7BIL.parse(source);return {source,sourceMap,inferred};
}
function decode(reply){
 if(typeof reply!=='string'||reply.length>12000)throw fault('Source','Model nije vratio ograničen BIL odgovor.');
 const trimmed=reply.trim();
 if(trimmed.startsWith('{')){let plan;try{plan=JSON.parse(trimmed);}catch{throw fault('Plan','Model nije završio JSON plan; nepotpun prijedlog nije primijenjen.');}return {...emitPlan(plan),representation:'plan',planFormat:PLAN_FORMAT};}
 const blocks=[...reply.matchAll(/```bil[^\S\r\n]*\r?\n([\s\S]*?)```/gi)];
 if(blocks.length!==1||(reply.match(/```/g)||[]).length!==2)throw fault('Source','Potreban je jedan potpun zatvoren BIL blok. Nepotpun kod nije primijenjen.');
 const source=blocks[0][1].trim()+'\n';if(new TextEncoder().encode(source).length>10000)throw fault('Source','Prijedlog prelazi ograničeni izvorni prozor. Kod nije skraćen.');return {source,representation:'bil',sourceMap:[],inferred:[]};
}
function extract(reply){return decode(reply).source;}
function create({generate,onEvent=()=>{},attempts=3}={}){
 if(typeof generate!=='function'||![1,2,3].includes(attempts))throw fault('Input','Nedostaje stvarni jezički transport.');
 let busy=false;
 async function propose(intent,{project=null,mode='create',sourceApproved=false,signal,onDelta=()=>{},checks=[],representation='plan'}={}){
  if(busy)throw fault('Busy','Kreiranje aplikacije je već pokrenuto.');
  if(typeof intent!=='string'||!intent.trim()||intent.length>1200||!['create','change'].includes(mode))throw fault('Input','Napiši opis aplikacije do 1200 znakova.');
  if(mode==='change'&&(!project?.bil||sourceApproved!==true))throw fault('Permission','Za izmjenu izričito odobri slanje BIL izvora trenutnog projekta svom modelu.');
  const base=project?scope.CLEA7.stable(project):null;
  if(mode==='change'&&new TextEncoder().encode(project.bil.source).length>10000)throw fault('Context','Projekt je veći od trenutnog modelskog prozora. Izvor nije skraćen niti poslan.');
  const metadata=mode==='change'?Object.fromEntries(['id','name','package','version','licenses'].filter(k=>project[k]!==undefined).map(k=>[k,clone(project[k])])):{id:scope.CLEA7Format.newId('ai'),name:'Moja CLEA aplikacija'};
  const history=[];let previous=null,diagnostic=null;busy=true;
  const check=()=>{if(signal?.aborted)throw fault('Cancelled','Kreiranje je zaustavljeno. Projekt nije promijenjen.');};
  try{
   for(let attempt=1;attempt<=attempts;attempt++){
    check();const contract={format:FORMAT,mode,...(mode==='create'&&representation==='plan'?{representation:'plan'}:{}),...(mode==='change'?{source:project.bil.source,sourceApproved:true}:{}),...(previous!==null?{previous,diagnostic}:{} )};
    onEvent({phase:'model',attempt,mode});
    const response=await generate(intent,{authoring:contract,signal,onDelta});check();
    let source=null;
    try{
     const conversion=decode(response.reply);source=conversion.source;onEvent({phase:'verification',attempt});
     const verified=await scope.CLEA7Intelligence.verifyBIL(source,{metadata,checks,signal,modelAvailable:true,onEvent:e=>onEvent({phase:'runtime',event:e})});check();
     if(!verified.application.bil.ir.ui?.screens?.length)throw fault('UI','Prijedlog nema stvarni aplikacijski ekran.');
     const impact=project?.bil?scope.CLEA7Intelligence.impact(await scope.CLEA7Intelligence.dependencyGraph(project),verified.graph):null;
     history.push({attempt,passed:true});
     const proposal={format:'clea7.model-app-proposal/1',source,application:verified.application,receipt:verified.receipt,impact,conversion:{representation:conversion.representation,sourceMap:conversion.sourceMap,inferred:conversion.inferred},attempts:clone(history),requiresReview:true,scope:verified.verifiedScope,modelProfile:response.modelProfile||'qwen3.5-9b-q4_k_m'};
     certificates.set(proposal,{base,source,mode});onEvent({phase:'ready',attempt});return proposal;
    }catch(error){
     check();history.push({attempt,passed:false,code:error.code||'Compiler',diagnostic:String(error.message).slice(0,600),line:error.location?.line||error.diagnostic?.line||error.line||null,column:error.location?.column||error.diagnostic?.column||error.column||null});
     if(attempt===attempts){error.attempts=clone(history);error.failedProposal=source||response.reply;throw error;}
     // Retry only inference/compilation. No uncertain external effect is repeated.
     // An incomplete source is never auto-repaired by guessing its missing end.
     previous=source||'';diagnostic=(String(error.message)+' '+JSON.stringify(error.diagnostic||error.location||error.loc||{})).slice(0,600);
     onEvent({phase:'repair',attempt,diagnostic});
    }
   }
  }finally{busy=false;}
 }
 return Object.freeze({propose,get busy(){return busy;}});
}
async function recheck(proposal,current,{signal}={}){
 const certificate=certificates.get(proposal);
 if(!certificate||proposal.source!==certificate.source||proposal.application?.bil?.source!==certificate.source)throw fault('Verification','Ovaj prijedlog nema važeću lokalnu provjeru.');
 if(certificate.base!==null&&scope.CLEA7.stable(current)!==certificate.base)throw fault('Stale','Projekt ili BIL skica su promijenjeni nakon zahtjeva. Novi rad nije prepisan.');
 const metadata=Object.fromEntries(['id','name','package','version','licenses'].filter(k=>proposal.application[k]!==undefined).map(k=>[k,clone(proposal.application[k])]));
 const verified=await scope.CLEA7Intelligence.verifyBIL(certificate.source,{metadata,signal,modelAvailable:true});
 return verified.application;
}
async function adopt(source,{project=null}={}){
 if(typeof source!=='string'||new TextEncoder().encode(source).length>10000)throw fault('Source','Uvezeni izvor prelazi ograničenje.');
 const verified=await scope.CLEA7Intelligence.verifyBIL(source,{metadata:{id:scope.CLEA7Format.newId('ai'),name:'Moja CLEA aplikacija'},modelAvailable:false});
 const proposal={format:'clea7.model-app-proposal/1',source,application:verified.application,receipt:verified.receipt,impact:null,attempts:[],requiresReview:true,scope:verified.verifiedScope,modelProfile:null,sourceOrigin:'explicit-browser-handoff',modelInvoked:false};
 certificates.set(proposal,{base:project?scope.CLEA7.stable(project):null,source,mode:'create'});return proposal;
}
scope.CLEA7AppAuthoring=Object.freeze({FORMAT,PLAN_FORMAT,emitPlan,extract,create,recheck,adopt});
})(globalThis);
