'use strict';
/* Original CLEA OCR coordinator. Licensed recognition runs in a child worker. */
importScripts('sense-ocr-policy.js');
const policy=globalThis.CLEA7SenseOCRPolicy,children=new Set(),OriginalWorker=globalThis.Worker;
globalThis.Worker=class extends OriginalWorker{constructor(...args){super(...args);children.add(this);}postMessage(message,...rest){if(message?.action==='initialize'&&Array.isArray(message.payload?.langs)&&message.payload.langs.some(x=>x&&typeof x==='object'))message={...message,payload:{...message.payload,langs:message.payload.langs.map(x=>typeof x==='string'?x:x.code)}};return super.postMessage(message,...rest);}terminate(){children.delete(this);super.terminate();}};
let active=false,stopped=false;
const cleanup=()=>{stopped=true;for(const worker of [...children])worker.terminate();};
onmessage=async event=>{
 const message=event.data;
 if(message?.op==='cancel'){cleanup();close();return;}
 if(active||message?.op!=='recognize')return;active=true;
 try{
  if(!(message.bytes instanceof ArrayBuffer))throw Object.assign(Error(),{code:'Invalid'});
  const bytes=new Uint8Array(message.bytes),dimensions=policy.image(bytes),language=policy.language(message.language);
  const asset=new URL('vendor/ocr/',location.href);importScripts(new URL('tesseract.min.js',asset).href);
  const worker=await Tesseract.createWorker(language,1,{workerPath:new URL('worker.min.js',asset).href,corePath:new URL('tesseract-core-lstm.wasm.js',asset).href,langPath:asset.href,workerBlobURL:false,cacheMethod:'none',gzip:true,logger:row=>{if(!stopped)postMessage({kind:'progress',phase:String(row.status||'').slice(0,80),progress:Number.isFinite(row.progress)?Math.max(0,Math.min(1,row.progress)):0});},errorHandler:error=>{postMessage({kind:'diagnostic',phase:'engine-load',message:String(error).slice(0,240)});}});
  if(stopped){await worker.terminate();return;}
  await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'150'});
  const result=await worker.recognize(bytes,{}, {text:true,blocks:false,hocr:false,tsv:false,box:false,unlv:false,osd:false});
  if(stopped)return;
  const text=String(result.data?.text||'').replace(/\r\n?/g,'\n').trim();
  if(!text||text.includes('\0'))throw Object.assign(Error(),{code:'NoText'});
  if(text.length>policy.limits.textCharacters)throw Object.assign(Error(),{code:'Budget'});
  const confidence=Number(result.data.confidence);if(!Number.isFinite(confidence)||confidence<0||confidence>100)throw Object.assign(Error(),{code:'Invalid'});
  postMessage({kind:'result',result:{format:'sense.ocr-result/1',text,confidence,language,...dimensions,local:true,requiresReview:true,engine:'Tesseract.js6.0.1/core6.1.2'}});
 }catch(error){if(!stopped)postMessage({kind:'error',code:['Budget','Invalid','NoText'].includes(error?.code)?error.code:'Unavailable'});}
 finally{cleanup();close();}
};
