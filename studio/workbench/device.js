'use strict';
/* Original bounded native bridge. User source supplies typed data, never code,
   file paths, URLs, shell commands or host identities. */
(function(scope){
const pending=new Map();let enabled=false,operations=[];
const fault=(code,uncertain=false)=>Object.assign(new Error('Native operation did not complete.'),{code,uncertain});
function metadata(){try{const p=JSON.parse(scope.CLEA7Device?.profile?.()||'{}');return p.format==='clea7.android-native/1'&&p.enabled===true?p:null;}catch{return null;}}
function send(method,data,{signal,timeout=95000}={}){
 if(signal?.aborted)return Promise.reject(fault('Cancelled'));if(!scope.CLEA7Device?.[method])return Promise.reject(fault('Unavailable'));if(pending.size>=8)return Promise.reject(fault('Budget'));
 return new Promise((resolve,reject)=>{const write=method==='request'&&['bil.camera.capture','bil.media.pick','bil.media.remove','bil.notification.post'].includes(data.operation),id=scope.CLEA7Format.newId('native'),abort=()=>finish(false,fault('Cancelled',write));let timer;
  function finish(ok,value){if(!pending.delete(id))return;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(!ok)try{scope.CLEA7Device.cancel?.(id);}catch{}ok?resolve(value):reject(value);}
  pending.set(id,{finish});timer=setTimeout(()=>finish(false,fault('Timeout',write)),timeout);signal?.addEventListener('abort',abort,{once:true});
  try{scope.CLEA7Device[method](JSON.stringify({...data,id}));}catch{finish(false,fault('Unavailable'));}
 });
}
const client={
 profile(){const p=metadata();return {platform:enabled||p?'android':'browser',operations:operations.slice(),typed:!!p,application:p?.application||null};},
 configure(data){operations=Object.keys(data||{});for(const [operation,definition]of Object.entries(data||{}))scope.CLEA7Format.registerNative(operation,definition.permission);enabled=typeof scope.CLEA7Device?.request==='function';},
 invoke(operation,input,options){if(!enabled)return Promise.reject(Error('Ova radnja zahtijeva Android Runtime; rezultat se ne simulira.'));return send('request',{operation,input:input||{}},options);},
 receive(message){const p=message&&pending.get(message.id);if(!p)return;p.finish(message.ok===true,message.ok===true?message.value:fault(['Denied','Cancelled','Timeout','Invalid','NotFound','Budget','Uncertain'].includes(message.code)?message.code:'Unavailable',message.code==='Uncertain'));},
 mediaUrl(handle){if(!/^media_[0-9a-f]{32}$/.test(handle||''))return null;try{const value=scope.CLEA7Device?.mediaUrl?.(handle);if(typeof value!=='string'||!/^https:\/\/clea7\.local\/owned-media\/[A-Za-z][A-Za-z0-9_]{0,63}\/[0-9a-f]{64}\/media_[0-9a-f]{32}\.jpg$/.test(value))return null;return value;}catch{return null;}},
 create({application,backend,operations:approved}){
  const p=metadata(),contracts=scope.CLEA7BIL.NATIVE_CONTRACTS;if(!p||p.application!==application||!Array.isArray(approved)||approved.some(op=>!Object.prototype.hasOwnProperty.call(contracts,op)))throw fault('Denied');let configured=null,closed=false;const active=new Set();
  return Object.freeze({version:'android.native/1',async execute(request,{signal}={}){if(closed||signal?.aborted)throw fault('Cancelled');if(!approved.includes(request.operation))throw fault('Denied');const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});active.add(controller);
   try{if(!configured)configured=send('configure',{application,backend,operations:approved},{signal:controller.signal}).catch(error=>{configured=null;throw error;});await configured;if(closed||controller.signal.aborted)throw fault('Cancelled');return await send('request',{operation:'bil.'+request.operation,input:{backend,args:request.args}},{signal:controller.signal});}finally{active.delete(controller);signal?.removeEventListener('abort',abort);}
  },close(){closed=true;for(const c of active)c.abort();configured=null;}});
 },
 close(){for(const p of [...pending.values()])p.finish(false,fault('Cancelled'));}
};scope.CLEA7DeviceClient=client;
})(globalThis);
