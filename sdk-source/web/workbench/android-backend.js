'use strict';
/* Original CLEA7 Android operation adapter. Native host owns credentials/network. */
(function(scope){
const pending=new Map();let sequence=0;
function profile(){try{const p=JSON.parse(scope.CLEA7BackendBridge?.profile?.()||'{}');return p.format==='clea7.android-backend/1'&&p.adapter==='firebase.development/1'&&p.enabled===true?p:null;}catch{return null;}}
function fault(code,uncertain=false){return Object.assign(new Error('Android backend operation did not complete.'),{code,uncertain});}
function send(method,data,{signal,timeout=130000}={}){
 if(!profile())return Promise.reject(fault('BackendConfiguration'));
 if(signal?.aborted)return Promise.reject(fault('BackendCancelled'));
 return new Promise((resolve,reject)=>{
  const id='android_backend_'+Date.now().toString(36)+'_'+(++sequence),abort=()=>finish(false,fault('BackendCancelled'));
  const timer=setTimeout(()=>finish(false,fault('BackendTimeout',method==='request'&&['auth.register','document.set','document.delete'].includes(data.operation))),timeout);
  function finish(ok,value){if(!pending.has(id))return;pending.delete(id);clearTimeout(timer);signal?.removeEventListener('abort',abort);if(!ok)try{scope.CLEA7BackendBridge.cancel(id);}catch{}ok?resolve(value):reject(value);}
  pending.set(id,{finish});signal?.addEventListener('abort',abort,{once:true});
  try{scope.CLEA7BackendBridge[method](JSON.stringify({...data,id}));}catch{finish(false,fault('BackendUnavailable'));}
 });
}
function receive(response){if(!response||typeof response.id!=='string')return;const p=pending.get(response.id);if(!p)return;if(response.ok===true)p.finish(true,response.value);else p.finish(false,fault(typeof response.error?.code==='string'?response.error.code:'BackendUnavailable',response.error?.uncertain===true));}
function create(options){
 const p=profile();if(!p||p.application!==options.application)throw fault('BackendConfiguration');
 const {application,backend,operations,projectId}=options;let configured=null,closed=false;const active=new Set();
 const configuration={application,backend,adapter:'firebase.development/1',projectId,operations};
 async function execute(request,{signal}={}){
  if(closed)throw fault('BackendClosed');if(signal?.aborted)throw fault('BackendCancelled');
  if(!operations.includes(request.operation))throw fault('BackendPermissionDenied');
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});active.add(controller);
  try{
   if(!configured)configured=send('configure',configuration,{signal:controller.signal}).catch(error=>{configured=null;throw error;});
   await configured;if(closed||controller.signal.aborted)throw fault('BackendCancelled');
   return await send('request',{backend,operation:request.operation,args:request.args},{signal:controller.signal});
  }finally{active.delete(controller);signal?.removeEventListener('abort',abort);}

 }
 return Object.freeze({version:'firebase.development/1',execute,close(){closed=true;for(const c of active)c.abort();configured=null;},publicStatus(){return {application,backend,native:true,credentials:'native-memory',closed};}});
}
scope.CLEA7AndroidBackend=Object.freeze({profile,available:()=>!!profile(),create,receive});
})(globalThis);
