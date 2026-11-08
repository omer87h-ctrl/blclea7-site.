/* Original public offline SDK proof, fictional data only. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const scope={performance,TextEncoder,TextDecoder,AbortController,setTimeout,clearTimeout,console};
scope.globalThis=scope;vm.createContext(scope);
for(const file of ['web/workbench/bil-compiler.js','web/workbench/bil-runtime.js','web/sense/sense-lexicon.js','web/sense/sense-engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),scope,{filename:file});
vm.runInContext(`(async()=>{
 const engine=new CLEA7Sense.SenseEngine();
 const live=await engine.analyze({cvText:'Koristio sam SQL pri izradi evidencije.',jobText:'Obavezno je poznavanje SQL.'});
 const requirement=live.requirements.find(r=>r.key==='sql');
 if(!requirement||requirement.status!=='unconfirmed')throw Error('Original source must require confirmation');
 const baseline=JSON.stringify(live);
 const alternative=await engine.shadow(live,{confirmations:{[requirement.id]:'confirmed'}});
 if(!alternative.liveUnchanged||JSON.stringify(live)!==baseline)throw Error('SHADOW changed original report');
 if(alternative.report.counts.supported!==1)throw Error('Actual BIL policy did not confirm evidence');
 const draft=engine.createDraft(alternative.report);
 if(!draft.text.includes('SQL')||!draft.claims.length)throw Error('Draft lost confirmed source');
 if(!alternative.report.trace.some(e=>e.instruction==='BRANCH'))throw Error('Real BIL trace missing');
 return {format:'clea7.sdk.sense-proof/1',passed:true,testData:'fictional',liveSupported:live.counts.supported,shadowSupported:alternative.report.counts.supported,liveUnchanged:true,instructions:alternative.report.metrics.instructions,claims:draft.claims.length,networkUsed:false,devicePermissionsRequested:false};
})()`,scope).then(value=>{process.stdout.write(JSON.stringify(value)+'\n');}).catch(error=>{console.error(error.message);process.exitCode=1;});
