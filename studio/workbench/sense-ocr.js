'use strict';
/* Original local OCR host. Only approved bytes enter a disposable worker. */
(function(scope){
const script=scope.document?.currentScript,base=script?.src||scope.document?.baseURI;
const assets=base?new URL(script?.dataset?.ocrAssets||'vendor/ocr/',base):null;
const bundle=scope.CLEA7SenseOCRBundle;
const fault=(code,message)=>Object.assign(Error(message),{code});let active=null;
function capabilities(){return Object.freeze({format:'sense.ocr-capabilities/1',configured:(!!bundle&&typeof bundle.worker==='string'||!!assets&&['http:','https:'].includes(assets.protocol))&&typeof scope.Worker==='function'&&typeof scope.WebAssembly==='object'&&!!scope.CLEA7SenseOCRPolicy,local:true,languages:['bos','eng'],source:'Tesseract.js6.0.1/core6.1.2 + tessdata_fast4.1.0',neuralWeightsTrainedByCLEA:false});}
async function read(file,{approved=false,language='bos',signal,onProgress=()=>{},onDiagnostic=()=>{}}={}){
 if(approved!==true)throw fault('Permission','Prvo odaberi sliku i pokreni lokalno čitanje.');
 if(signal?.aborted)throw fault('Cancelled','Čitanje slike je zaustavljeno.');
 if(active)throw fault('Conflict','Jedno lokalno OCR čitanje već traje.');
 const policy=scope.CLEA7SenseOCRPolicy;if(!policy)throw fault('Unavailable','Lokalna OCR pravila nisu učitana.');policy.language(language);
 if(!file||typeof file.arrayBuffer!=='function'||!Number.isInteger(file.size)||file.size<24||file.size>policy.limits.fileBytes)throw fault('Budget','Slika mora imati najviše 5 MiB.');
 const identity={};active=identity;
 try{
  const bytes=new Uint8Array(await file.arrayBuffer());if(signal?.aborted)throw fault('Cancelled','Čitanje slike je zaustavljeno.');if(bytes.length!==file.size)throw fault('Invalid','Veličina slike se promijenila.');
  const dimensions=policy.image(bytes);if(!capabilities().configured)throw fault('Unavailable','Ovaj host ne nudi lokalni OCR worker. Otvori podržano web ili lokalno Runtime izdanje.');
  return await new Promise((resolve,reject)=>{
   let worker,workerURL,finished=false,timer;const finish=(value,error)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(worker){try{worker.postMessage({op:'cancel'});}catch{}const old=worker;setTimeout(()=>{old.terminate();if(workerURL)URL.revokeObjectURL(workerURL);},50);}error?reject(error):resolve(Object.freeze(value));};
   const abort=()=>finish(null,fault('Cancelled','Čitanje slike je zaustavljeno. Postojeći CV je sačuvan.'));
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
   timer=setTimeout(()=>finish(null,fault('Timeout','Čitanje slike je prekoračilo 90 sekundi. Pokušaj jasniju ili manju sliku.')),policy.limits.deadlineMilliseconds);
   try{if(bundle)workerURL=URL.createObjectURL(new Blob([bundle.worker],{type:'text/javascript'}));worker=new scope.Worker(workerURL||new URL('../../sense-ocr-worker.js',assets));}catch{finish(null,fault('Unavailable','Host nije dozvolio pokretanje lokalnog OCR-a.'));return;}
   worker.onerror=event=>{try{onDiagnostic({phase:'worker-load',message:String(event.message||'').slice(0,240),line:event.lineno,column:event.colno});}catch{}event.preventDefault();finish(null,fault('Unavailable','Lokalni OCR nije učitan. Provjeri dostupnost ili pripremljenu offline kopiju.'));};
   worker.onmessage=event=>{
    const message=event.data;if(finished||!message)return;
    if(message.kind==='diagnostic'){try{onDiagnostic({phase:message.phase,message:message.message});}catch{}return;}
    if(message.kind==='progress'){try{onProgress(Object.freeze({phase:message.phase,progress:message.progress}));}catch{}return;}
    if(message.kind==='error'){const labels={NoText:'Tekst nije prepoznat. Pokušaj jasniju i pravilno okrenutu sliku.',Budget:'Izdvojeni tekst prelazi dozvoljeni opseg.',Invalid:'Slika ili OCR rezultat nisu ispravni.'};finish(null,fault(Object.hasOwn(labels,message.code)?message.code:'Unavailable',labels[message.code]||'Lokalni OCR nije završio. Dokument nije poslan udaljenom servisu.'));return;}
    const r=message.result;if(message.kind!=='result'||r?.format!=='sense.ocr-result/1'||typeof r.text!=='string'||!r.text.trim()||r.text.length>policy.limits.textCharacters||r.text.includes('\0')||!Number.isFinite(r.confidence)||r.confidence<0||r.confidence>100||r.language!==language||r.width!==dimensions.width||r.height!==dimensions.height||r.local!==true||r.requiresReview!==true){finish(null,fault('Invalid','OCR rezultat nije prošao provjeru ugovora.'));return;}
    finish({...r},null);
   };
   worker.postMessage({op:'recognize',bytes:bytes.buffer,language},[bytes.buffer]);
  });
 }finally{if(active===identity)active=null;}
}
scope.CLEA7SenseOCR=Object.freeze({format:'sense.ocr/1',capabilities,read});
})(globalThis);
