'use strict';
/* Original CLEA authoring coordinator. Proposals are data until the actual
 * compiler, seven-pillar SHADOW path and reviewed Studio transaction accept. */
(function(scope){
const FORMAT='bil.author/1',certificates=new WeakMap(),clone=x=>JSON.parse(JSON.stringify(x));
const fault=(code,text)=>Object.assign(Error(text),{code});
function extract(reply){
 if(typeof reply!=='string'||reply.length>12000)throw fault('Source','Model nije vratio ograničen BIL odgovor.');
 const blocks=[...reply.matchAll(/```bil[^\S\r\n]*\r?\n([\s\S]*?)```/gi)];
 if(blocks.length!==1||(reply.match(/```/g)||[]).length!==2)throw fault('Source','Potreban je jedan potpun zatvoren BIL blok. Nepotpun kod nije primijenjen.');
 const source=blocks[0][1].trim()+'\n';if(new TextEncoder().encode(source).length>10000)throw fault('Source','Prijedlog prelazi ograničeni izvorni prozor. Kod nije skraćen.');return source;
}
function create({generate,onEvent=()=>{},attempts=3}={}){
 if(typeof generate!=='function'||![1,2,3].includes(attempts))throw fault('Input','Nedostaje stvarni jezički transport.');
 let busy=false;
 async function propose(intent,{project=null,mode='create',sourceApproved=false,signal,onDelta=()=>{},checks=[]}={}){
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
    check();const contract={format:FORMAT,mode,...(mode==='change'?{source:project.bil.source,sourceApproved:true}:{}),...(previous!==null?{previous,diagnostic}:{} )};
    onEvent({phase:'model',attempt,mode});
    const response=await generate(intent,{authoring:contract,signal,onDelta});check();
    let source=null;
    try{
     source=extract(response.reply);onEvent({phase:'verification',attempt});
     const verified=await scope.CLEA7Intelligence.verifyBIL(source,{metadata,checks,signal,modelAvailable:true,onEvent:e=>onEvent({phase:'runtime',event:e})});check();
     if(!verified.application.bil.ir.ui?.screens?.length)throw fault('UI','Prijedlog nema stvarni aplikacijski ekran.');
     const impact=project?.bil?scope.CLEA7Intelligence.impact(await scope.CLEA7Intelligence.dependencyGraph(project),verified.graph):null;
     history.push({attempt,passed:true});
     const proposal={format:'clea7.model-app-proposal/1',source,application:verified.application,receipt:verified.receipt,impact,attempts:clone(history),requiresReview:true,scope:verified.verifiedScope,modelProfile:response.modelProfile||'qwen3.5-9b-q4_k_m'};
     certificates.set(proposal,{base,source,mode});onEvent({phase:'ready',attempt});return proposal;
    }catch(error){
     check();history.push({attempt,passed:false,code:error.code||'Compiler',diagnostic:String(error.message).slice(0,600),line:error.location?.line||error.diagnostic?.line||error.line||null,column:error.location?.column||error.diagnostic?.column||error.column||null});
     if(attempt===attempts){error.attempts=clone(history);throw error;}
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
scope.CLEA7AppAuthoring=Object.freeze({FORMAT,extract,create,recheck,adopt});
})(globalThis);
