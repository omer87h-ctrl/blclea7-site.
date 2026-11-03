'use strict';
/* Owner-authored bounded asset loading; no external model/service discovery. */
(function(scope){
function fault(code,message){const e=new Error(message);e.code=code;return e;}
async function sha(bytes){if(!scope.crypto?.subtle)throw fault('Unavailable','Ovaj host nema Web Crypto za provjeru modela.');return Array.from(new Uint8Array(await scope.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
function local(name,base){if(typeof name!=='string'||!/^[a-z][a-z0-9.-]{0,79}$/.test(name)||name.includes('..'))throw fault('Asset','Neispravan naziv lokalne datoteke.');const result=new URL(name,base);if(result.origin!==new URL(base).origin)throw fault('Asset','Model mora pripadati istom porijeklu kao aplikacija.');return result.href;}
async function read(url,maximum,expected,onProgress,options={}){
 const controller=new AbortController();let timedOut=false;const abort=()=>controller.abort();
 if(options.signal?.aborted)controller.abort();else options.signal?.addEventListener('abort',abort,{once:true});
 const budget=options.timeoutMs===undefined?15000:options.timeoutMs;if(!Number.isInteger(budget)||budget<1||budget>15000)throw fault('AssetLimit','Neispravan rok učitavanja.');
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},budget);
 try{
 const response=await fetch(url,{credentials:'omit',redirect:'error',cache:'no-cache',signal:controller.signal});if(!response.ok)throw fault('Asset','Nije učitana lokalna datoteka ('+response.status+').');
 const length=Number(response.headers.get('content-length'));if(Number.isFinite(length)&&length>maximum)throw fault('AssetLimit','Datoteka prelazi odobreni budžet.');
 let bytes;
 if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let count=0;try{for(;;){const next=await reader.read();if(next.done)break;count+=next.value.byteLength;if(count>maximum)throw fault('AssetLimit','Datoteka prelazi odobreni budžet.');chunks.push(next.value);onProgress?.(count);}bytes=new Uint8Array(count);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}}catch(error){await reader.cancel().catch(()=>{});throw error;}}
 else{bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>maximum)throw fault('AssetLimit','Datoteka prelazi odobreni budžet.');onProgress?.(bytes.length);}
 if(expected&&(bytes.length!==expected.bytes||await sha(bytes)!==expected.sha256))throw fault('Integrity','Sadržaj lokalnog modela ili baze nije prošao provjeru integriteta.');
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fault('Asset','Lokalna datoteka nema ispravan JSON zapis.');}
 return {value,bytes:bytes.length};
 }catch(error){if(timedOut)throw fault('AssetTimeout','Lokalna datoteka nije učitana u odobrenom roku.');throw error;}
 finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
function manifest(value){
 if(value?.format!=='clea7.chat.manifest/1'||value.originalWeights!==true||value.externalWeights!==false||value.inferenceServer!==false||!/^\w[\w.-]{0,40}$/.test(value.version)||!/^[a-f0-9]{64}$/.test(value.modelFingerprint))throw fault('Manifest','Nepodržan ugovor vlastitog CLEA modela.');
 for(const [key,max]of [['model',2097152],['knowledge',131072]]){const x=value[key];if(!x||!Number.isSafeInteger(x.bytes)||x.bytes<1||x.bytes>max||!/^[a-f0-9]{64}$/.test(x.sha256))throw fault('Manifest','Neispravni metapodaci modela.');local(x.path,'https://local.invalid/');}
 if(value.limits?.maxInputCharacters!==1200||value.limits?.maxOutputTokens!==48||value.limits?.maxHistoryTurns!==12)throw fault('Manifest','Nepodržane granice razgovora.');
 return value;
}
scope.CLEA7ChatAssets=Object.freeze({sha,local,read,manifest,fault});
})(globalThis);
