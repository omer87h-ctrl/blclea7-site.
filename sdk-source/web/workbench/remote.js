'use strict';
/* BLclea7 typed external-effect coordinator. Original Brzo i Lokalno code. */
(function(scope){
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const OPS=Object.freeze(['auth.session','auth.register','auth.signIn','auth.signOut','document.get','document.set','document.delete']);
class RemoteFault extends Error{
 constructor(code,message,uncertain=false){super(message);this.name='CLEA7RemoteError';this.code=code;this.uncertain=uncertain===true;}
}
function publicError(error){
 const allowed=['Denied','Unavailable','Cancelled','Timeout','Invalid','Authentication','NotFound','Conflict','Budget','Persistence','Uncertain'];
 const mapped={BackendPermissionDenied:'Denied',BackendUnauthenticated:'Authentication',BackendCredentials:'Authentication',BackendRejected:'Invalid',BackendConfiguration:'Invalid',BackendInput:'Invalid',BackendResponse:'Invalid',BackendClosed:'Cancelled',BackendSessionChanged:'Cancelled',BackendCancelled:'Cancelled',BackendTimeout:'Timeout',BackendBusy:'Budget',BackendRateLimited:'Budget',RemoteType:'Invalid',RemoteContract:'Invalid'}[error?.code]||error?.code;const code=allowed.includes(mapped)?mapped:'Unavailable';
 // Arbitrary transport/provider messages can contain URLs, credentials or private data.
 const messages={Denied:'Backend operation was not authorized.',Unavailable:'The development backend is unavailable.',Cancelled:'The request was cancelled.',Timeout:'The backend request timed out.',Invalid:'The backend returned data outside the declared contract.',Authentication:'Authentication failed.',NotFound:'The requested resource was not found.',Conflict:'A conflicting request is already active.',Budget:'The remote operation budget was exceeded.',Persistence:'Local data could not be read or stored safely.',Uncertain:'The remote write may have completed. Check the server before repeating it.'};
 return {code,message:messages[code],uncertain:error?.uncertain===true};
}
const OPS2=Object.freeze([...OPS,'document.add','query.list','observe.document.get','observe.query.list']);
const OPS3=Object.freeze([...OPS2,'query.documents','observe.query.documents']);
const OPS4=Object.freeze([...OPS3,'image.choose','image.upload','image.load','image.remove','image.discard']);
function registry(){const native=scope.CLEA7AndroidBackend?.profile(),versions=native?(native.adapters||[native.adapter]):scope.CLEA7FirebaseDevelopment?.versions|| (scope.CLEA7FirebaseDevelopment?['firebase.development/1']:[]);const entries=Object.fromEntries(versions.map(version=>[version,{operations:(version==='firebase.development/4'?OPS4:version==='firebase.development/3'?OPS3:version==='firebase.development/2'?OPS2:OPS).slice(),targets:native?['android']:['browser']}]));if(scope.CLEA7DeviceClient?.profile().typed===true)entries['android.native/1']={operations:Object.keys(scope.CLEA7BIL.NATIVE_CONTRACTS),targets:['android']};return entries;}

function validateBinding(binding){
 if(binding?.adapter==='android.native/1'){if(Object.keys(binding).join('|')!=='adapter')throw new RemoteFault('Invalid','Native binding cannot contain endpoints or credentials.');return {adapter:'android.native/1'};}
 if(!binding||!['firebase.development/1','firebase.development/2','firebase.development/3','firebase.development/4'].includes(binding.adapter)||!/^demo-clea7-[a-z0-9][a-z0-9-]{0,35}$/.test(binding.projectId||''))throw new RemoteFault('Invalid','Only an isolated demo-clea7 Firebase project is supported.');
 const endpoints={authOrigin:9099,firestoreOrigin:8080,...(binding.adapter==='firebase.development/4'?{storageOrigin:9199}:{})};
 for(const [key,port]of Object.entries(endpoints)){
  let url;try{url=new URL(binding[key]);}catch{throw new RemoteFault('Invalid','Invalid emulator endpoint.');}
  if(url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||Number(url.port)!==port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new RemoteFault('Denied','Only the documented loopback emulator ports are supported.');
 }
 const keys=Object.keys(binding).sort().join(',');if(keys!== (binding.adapter==='firebase.development/4'?'adapter,authOrigin,firestoreOrigin,projectId,storageOrigin':'adapter,authOrigin,firestoreOrigin,projectId'))throw new RemoteFault('Invalid','Unknown backend configuration field.');
 return {adapter:binding.adapter,projectId:binding.projectId,authOrigin:new URL(binding.authOrigin).origin,firestoreOrigin:new URL(binding.firestoreOrigin).origin,...(binding.adapter==='firebase.development/4'?{storageOrigin:new URL(binding.storageOrigin).origin}:{})};
}
function create(project,{bindings={},grants={},credentials,adapterFactory=null}={}){
 const declared=project.remote?.backends;if(!declared)throw new RemoteFault('Invalid','This application has no remote contract.');
 if(Object.keys(bindings).sort().join('|')!==Object.keys(declared).sort().join('|')||Object.keys(grants).sort().join('|')!==Object.keys(declared).sort().join('|'))throw new RemoteFault('Denied','Backend bindings and grants must match this application.');const adapters=new Map(),active=new Map(),identities=new Map(),listeners=new Set();let closed=false,epoch=0;
 const principal=()=>({format:'clea7.principal/1',application:project.id,backends:[...identities].sort(([a],[b])=>a.localeCompare(b)).map(([backend,uid])=>({backend,adapter:declared[backend].adapter,projectId:bindings[backend].projectId,uid}))});
 async function changed(){const snapshot=principal();try{await Promise.all([...listeners].map(listener=>listener(snapshot)));}catch{closed=true;for(const running of active.values())running.controller.abort();for(const adapter of adapters.values())adapter.close?.();listeners.clear();throw new RemoteFault('Persistence','Could not open the authenticated storage context.');}}
 function authenticated(value){if(value===null)return null;if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='email,uid'||typeof value.email!=='string'||typeof value.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value.uid))throw new RemoteFault('Invalid','Invalid host authentication identity.');return value.uid;}

 for(const [alias,contract]of Object.entries(declared)){
  if(!own(bindings,alias))throw new RemoteFault('Unavailable','Configure the declared development backend before running this application.');
  const binding=validateBinding(bindings[alias]);
  if(binding.adapter!==contract.adapter)throw new RemoteFault('Denied','Backend adapter differs from the source contract.');
  const approved=grants[alias];
  if(!Array.isArray(approved)||new Set(approved).size!==approved.length||contract.operations.some(op=>!approved.includes(op))||approved.some(op=>!contract.operations.includes(op)))throw new RemoteFault('Denied','Approve exactly the backend operations declared by this application.');
  const device=binding.adapter==='android.native/1',native=!adapterFactory&&scope.CLEA7AndroidBackend?.available(),factory=adapterFactory||(device?scope.CLEA7DeviceClient?.create: native?scope.CLEA7AndroidBackend.create:scope.CLEA7FirebaseDevelopment?.create);
  if(!factory)throw new RemoteFault('Unavailable','The requested development adapter is not installed.');
  const {adapter:adapterName,...config}=binding;const adapter=factory(device?{application:project.id,backend:alias,operations:contract.operations.slice()}:native?{application:project.id,backend:alias,operations:contract.operations.slice(),projectId:config.projectId,...(contract.adapter!=='firebase.development/1'?{adapter:contract.adapter}:{})}:{...config,application:project.id,credentials,...(contract.adapter!=='firebase.development/1'?{adapter:contract.adapter}:{})});
  if(adapter.version!==contract.adapter||typeof adapter.execute!=='function')throw new RemoteFault('Invalid','Invalid backend adapter.');
  adapters.set(alias,adapter);if(binding.adapter!=='android.native/1')identities.set(alias,null);
 }
 function authorize(requests){
  if(closed)throw new RemoteFault('Cancelled','Backend context is closed.');
  if(!Array.isArray(requests)||requests.length+active.size>8)throw new RemoteFault('Budget','At most eight remote requests can be active.');
  const seen=new Set();const changes=requests.filter(r=>['auth.register','auth.signIn','auth.signOut'].includes(r.operation));if(changes.length&&(changes.length!==1||requests.length!==1))throw new RemoteFault('Conflict','An authentication transition must be its own event.');
  for(const r of requests){
   if(!declared[r.backend]?.operations.includes(r.operation)||!(declared[r.backend]?.adapter==='android.native/1'?own(scope.CLEA7BIL.NATIVE_CONTRACTS,r.operation):OPS.includes(r.operation)||['firebase.development/2','firebase.development/3','firebase.development/4'].includes(declared[r.backend]?.adapter)&&['query.list','document.add'].includes(r.operation)||['firebase.development/3','firebase.development/4'].includes(declared[r.backend]?.adapter)&&r.operation==='query.documents'||declared[r.backend]?.adapter==='firebase.development/4'&&Object.prototype.hasOwnProperty.call(scope.CLEA7BIL.IMAGE_CONTRACTS,r.operation))||!adapters.has(r.backend))throw new RemoteFault('Denied','Operation not declared by this application.');
   if(!changes.length&&[...active.values()].some(a=>a.authChange&&!a.controller.signal.aborted))throw new RemoteFault('Conflict','Authentication is changing.');
   if(typeof r.id!=='string'||!/^remote_[A-Za-z0-9_]{1,80}$/.test(r.id)||active.has(r.id)||seen.has(r.id))throw new RemoteFault('Invalid','Invalid remote request identity.');
   const target=r.resultTarget,authChange=['auth.register','auth.signIn','auth.signOut'].includes(r.operation),conflicting=[...active.values()].some(a=>!a.controller.signal.aborted&&!(authChange&&a.backend===r.backend)&&[a.target,a.errorTarget].some(slot=>slot===target||slot===r.errorTarget));if(typeof target!=='string'||conflicting||seen.has('target:'+target)||seen.has('target:'+r.errorTarget))throw new RemoteFault('Conflict','A request for this result is already active.');
   seen.add(r.id);seen.add('target:'+target);seen.add('target:'+r.errorTarget);
  }
 }
 function submit(request,run){
  authorize([request]);const controller=new AbortController(),authChange=['auth.register','auth.signIn','auth.signOut'].includes(request.operation);
  let transition=Promise.resolve();
  if(authChange){epoch++;for(const running of active.values())running.controller.abort();identities.set(request.backend,null);transition=changed();transition.catch(()=>{});}
  const submittedEpoch=epoch;
  active.set(request.id,{controller,backend:request.backend,target:request.resultTarget,errorTarget:request.errorTarget,authChange});
  const ensure=()=>{if(closed||controller.signal.aborted||epoch!==submittedEpoch)throw new RemoteFault('Cancelled','Authentication context changed.');};
  const execute=async()=>{
   await transition;ensure();const value=await adapters.get(request.backend).execute({operation:request.operation,args:request.args},{signal:controller.signal});ensure();
   if(['auth.session','auth.register','auth.signIn'].includes(request.operation)){
    const uid=authenticated(value);if(identities.get(request.backend)!==uid){identities.set(request.backend,uid);for(const [id,running]of active)if(id!==request.id)running.controller.abort();await changed();ensure();}
   }
   return value;
  };
  const release=()=>{active.delete(request.id);};const task=Promise.resolve().then(()=>run({signal:controller.signal,execute,release}));
  task.catch(()=>{}).finally(()=>{active.delete(request.id);});return task;
 }

 return Object.freeze({application:project.id,authorize,submit,async mediaUrl(handle){if(closed)return null;const current=epoch;for(const [alias,adapter]of adapters){if(!declared[alias].operations.some(op=>['image.choose','image.load'].includes(op)))continue;const url=await adapter.mediaUrl?.(handle);if(closed||epoch!==current)return null;if(url)return url;}return null;},principal,onPrincipal(listener){if(typeof listener!=='function')throw new RemoteFault('Invalid','Invalid identity listener.');listeners.add(listener);return ()=>listeners.delete(listener);},cancel(id){active.get(id)?.controller.abort();},get pending(){return active.size;},get closed(){return closed;},close(){if(closed)return;closed=true;listeners.clear();for(const {controller}of active.values())controller.abort();for(const adapter of adapters.values())adapter.close?.();},status(){return {format:'clea7.remote-status/1',pending:active.size,closed,backends:Object.entries(declared).map(([alias,c])=>({alias,adapter:c.adapter,operations:c.operations.slice()}))};}});
}
class Observations {
 constructor(engine){this.engine=engine;this.entries=new Map();this.closed=false;this.visibility=()=>{for(const entry of this.entries.values())if(!entry.running)this.schedule(entry,0);};scope.document?.addEventListener('visibilitychange',this.visibility);}
 alive(entry){return !this.closed&&!this.engine.closed&&this.entries.get(entry.name)===entry&&entry.epoch===this.engine.principalEpoch&&entry.generation===this.engine.remoteGeneration;}
 authorize(requests,actions){
  const planned=new Map(this.entries),starts=[];
  for(const action of actions){if(action.kind==='cancel'){planned.delete(action.name);continue;}const r=action.request,name=r.subscription.name,contract=this.engine.project.remote?.backends[r.backend];
   if(this.engine.reality!=='LIVE'||!this.engine.remote||!['firebase.development/2','firebase.development/3','firebase.development/4'].includes(contract?.adapter)||!contract.operations.includes('observe.'+r.operation)||!['document.get','query.list','query.documents'].includes(r.operation)||planned.has(name)||planned.size>=4)throw new RemoteFault('Conflict','A subscription is already active or is outside the approved contract.');
   for(const item of planned.values()){const x=item.request;if([x.resultTarget,x.errorTarget].some(k=>k===r.resultTarget||k===r.errorTarget))throw new RemoteFault('Conflict','Subscriptions require separate result and error values.');}
   planned.set(name,{request:r});starts.push(r);
  }
  for(const r of requests)if(!['auth.register','auth.signIn','auth.signOut'].includes(r.operation))for(const {request:x}of planned.values())if([x.resultTarget,x.errorTarget].some(k=>k===r.resultTarget||k===r.errorTarget))throw new RemoteFault('Conflict','This result belongs to an active subscription. Cancel it first.');
  if(requests.length||starts.length)this.engine.remote?.authorize([...requests,...starts]);
 }
 apply(actions){for(const action of actions){if(action.kind==='cancel')this.stop(action.name,'explicit',true);else this.start(action.request);}}
 start(request){const entry={name:request.subscription.name,id:request.id,request,epoch:this.engine.principalEpoch,generation:this.engine.remoteGeneration,sequence:0,polls:0,updates:0,errors:0,delay:request.subscription.interval,running:false,timer:null,controller:null,last:null,lastError:null,hasValue:false,state:'starting'};this.entries.set(entry.name,entry);this.schedule(entry,0);this.trace(entry,'started');}
 trace(entry,state,extra={}){this.engine.recordEvent({state:'subscription-'+state,mode:'LIVE',subscriptionId:entry.id,sourceId:entry.request.sourceId,location:entry.request.location,backend:entry.request.backend,operation:entry.request.operation,sequence:entry.sequence,transport:'bounded-polling',replayable:false,...extra});}
 schedule(entry,delay){clearTimeout(entry.timer);entry.timer=null;if(!this.alive(entry))return;if(scope.document?.hidden===true){entry.state='paused';return;}entry.timer=setTimeout(()=>{entry.timer=null;this.tick(entry);},delay);}
 async tick(entry){if(!this.alive(entry)||entry.running)return;entry.running=true;if(this.engine.guard){try{await this.engine.guard();}catch{this.stop(entry.name,'installation-changed',false);this.engine.notifySafe('Praćenje je zaustavljeno jer instalacija više nije aktivna.');return;}if(!this.alive(entry)){entry.running=false;return;}}entry.state='reading';entry.polls++;const request={...entry.request,id:scope.CLEA7Format.newId('remote')};delete request.subscription;let job;
  try{job=(entry.pendingId=request.id,this.engine.remote.submit(request,async({signal,execute,release})=>{
   let value,error;try{value=scope.CLEA7BILRuntime.validateRemoteResult(request,await execute());}catch(e){error=publicError(e);}
   if(!this.alive(entry)||signal.aborted)return;
   const changed=error?entry.lastError!==error.code:!entry.hasValue||entry.last!==scope.CLEA7.stable(value)||entry.lastError!==null;
   if(changed){const kind=error?'error':entry.lastError?'recovered':'update',context={subscriptionId:entry.id,sourceId:request.sourceId,backend:request.backend,operation:request.operation,sequence:entry.sequence+1,kind};
    await this.engine.enqueue(async()=>{if(!this.alive(entry)||signal.aborted)throw new RemoteFault('Cancelled','Subscription context changed.');release();await this.engine.completeRemote({...request,observationContext:context},value,error,entry.generation,()=>this.alive(entry)&&!signal.aborted);});
    if(!this.alive(entry))return;entry.sequence++;if(error){entry.errors++;entry.lastError=error.code;}else{entry.updates++;entry.hasValue=true;entry.last=scope.CLEA7.stable(value);entry.lastError=null;}this.trace(entry,error?'error':'updated',{error:error?.code||null});
   }
   if(error){if(['Unavailable','Timeout','Budget','Conflict'].includes(error.code)){entry.delay=Math.min(30000,Math.max(entry.request.subscription.interval,entry.delay*2));entry.state='reconnecting';}else this.stop(entry.name,'terminal-error',false);}else{entry.delay=entry.request.subscription.interval;entry.state='waiting';}
  }));}catch(error){entry.errors++;entry.state='reconnecting';entry.delay=Math.min(30000,entry.delay*2);this.trace(entry,'backpressure',{error:publicError(error).code});job=Promise.resolve();}
  this.engine.remoteJobs.add(job);try{await job;}catch{if(this.alive(entry)){this.trace(entry,'delivery-failed',{error:'Persistence'});this.stop(entry.name,'delivery-failed',false);this.engine.notifySafe('Praćenje je zaustavljeno jer rezultat nije mogao biti potvrđen lokalno.');}}finally{this.engine.remoteJobs.delete(job);entry.running=false;if(this.alive(entry))this.schedule(entry,entry.delay);}
 }
 stop(name,reason='closed',notify=false){const entry=this.entries.get(name);if(!entry)return false;this.entries.delete(name);clearTimeout(entry.timer);entry.timer=null;entry.last=null;entry.lastError=null;entry.hasValue=false;entry.state='cancelled';this.trace(entry,'cancelled',{reason});
  // Active read completion is invalidated by membership/epoch even if a host cannot abort transport.
  if(entry.pendingId)this.engine.remote.cancel?.(entry.pendingId);
  if(notify&&!this.engine.closed){const epoch=entry.epoch,generation=entry.generation,handler=entry.request.completion.stopped,context={subscriptionId:entry.id,sourceId:entry.request.sourceId,backend:entry.request.backend,operation:entry.request.operation,sequence:entry.sequence+1,kind:'cancelled'},valid=()=>!this.closed&&!this.engine.closed&&epoch===this.engine.principalEpoch&&generation===this.engine.remoteGeneration;
   const job=this.engine.enqueue(()=>{if(!valid())throw new RemoteFault('Cancelled','Subscription context changed.');return this.engine.run('bil_'+handler,{}, {},{state:scope.CLEA7Format.clone(this.engine.state),valid,invocation:{handler,arguments:[true,context],depth:0}});});this.engine.remoteJobs.add(job);job.catch(()=>{}).finally(()=>this.engine.remoteJobs.delete(job));
  }return true;
 }
 stopAll(reason){for(const name of [...this.entries.keys()])this.stop(name,reason,false);}
 close(){this.stopAll('closed');this.closed=true;scope.document?.removeEventListener('visibilitychange',this.visibility);}
 status(){return {format:'bil.observations/1',transport:'bounded-polling',active:this.entries.size,subscriptions:[...this.entries.values()].map(e=>({id:e.id,name:e.name,sourceId:e.request.sourceId,backend:e.request.backend,operation:e.request.operation,interval:e.request.subscription.interval,state:e.state,sequence:e.sequence,polls:e.polls,updates:e.updates,errors:e.errors,nextDelay:e.delay}))};}
}
function credentials(operation,{signal}={}){
 if(typeof document==='undefined')return Promise.reject(new RemoteFault('Unavailable','This host has no secure credential prompt.'));
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.className='clea7-review remote-credentials';dialog.setAttribute('aria-label',operation==='auth.register'?'Registracija na testni backend':'Prijava na testni backend');
  const title=document.createElement('h2');title.textContent=operation==='auth.register'?'Novi testni račun':'Prijava na testni račun';
  const note=document.createElement('p');note.textContent='Firebase razvojni emulator. Lozinka ide samo Auth servisu; BIL kod, projekti i dijagnostika je ne dobijaju.';
  const form=document.createElement('form');form.method='dialog';
  const field=(label,type,autocomplete)=>{const l=document.createElement('label');l.textContent=label;const i=document.createElement('input');i.type=type;i.required=true;i.autocomplete=autocomplete;i.setAttribute('aria-label',label);l.append(i);form.append(l);return i;};
  const email=field('Email testnog računa','email','username'),password=field('Lozinka testnog računa','password',operation==='auth.register'?'new-password':'current-password');password.minLength=6;
  const submit=document.createElement('button');submit.type='submit';submit.textContent=operation==='auth.register'?'Registruj testni račun':'Prijavi se';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Odustani';form.append(submit,cancel);dialog.append(title,note,form);document.body.append(dialog);
  let finished=false;function finish(value,error){if(finished)return;finished=true;signal?.removeEventListener('abort',abort);const payload=value?{email:email.value,password:password.value}:null;email.value='';password.value='';dialog.close();dialog.remove();error?reject(error):resolve(payload);}
  function abort(){finish(false,new RemoteFault('Cancelled','Credential entry was cancelled.'));}
  form.addEventListener('submit',e=>{e.preventDefault();if(form.reportValidity())finish(true);});cancel.onclick=abort;dialog.addEventListener('cancel',e=>{e.preventDefault();abort();});signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted){abort();return;}dialog.showModal();email.focus();
 });
}
scope.CLEA7Remote={create,registry,validateBinding,credentials,publicError,RemoteFault,OPS,OPS2,OPS3,OPS4,Observations};
})(globalThis);

