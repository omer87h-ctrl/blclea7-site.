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
 const messages={Denied:'Backend operation was not authorized.',Unavailable:'The development backend is unavailable.',Cancelled:'The request was cancelled.',Timeout:'The backend request timed out.',Invalid:'The backend returned data outside the declared contract.',Authentication:'Authentication failed.',NotFound:'The requested resource was not found.',Conflict:'A conflicting request is already active.',Budget:'The remote operation budget was exceeded.',Persistence:'The remote result could not be stored locally.',Uncertain:'The remote write may have completed. Check the server before repeating it.'};
 return {code,message:messages[code],uncertain:error?.uncertain===true};
}
function registry(){const native=scope.CLEA7AndroidBackend?.available();return native||scope.CLEA7FirebaseDevelopment?{'firebase.development/1':{operations:OPS.slice(),targets:native?['android']:['browser']}}:{};}
function validateBinding(binding){
 if(!binding||binding.adapter!=='firebase.development/1'||!/^demo-clea7-[a-z0-9][a-z0-9-]{0,35}$/.test(binding.projectId||''))throw new RemoteFault('Invalid','Only an isolated demo-clea7 Firebase project is supported.');
 const endpoints={authOrigin:9099,firestoreOrigin:8080};
 for(const [key,port]of Object.entries(endpoints)){
  let url;try{url=new URL(binding[key]);}catch{throw new RemoteFault('Invalid','Invalid emulator endpoint.');}
  if(url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||Number(url.port)!==port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new RemoteFault('Denied','Only the documented loopback emulator ports are supported.');
 }
 const keys=Object.keys(binding).sort().join(',');if(keys!=='adapter,authOrigin,firestoreOrigin,projectId')throw new RemoteFault('Invalid','Unknown backend configuration field.');
 return {adapter:binding.adapter,projectId:binding.projectId,authOrigin:new URL(binding.authOrigin).origin,firestoreOrigin:new URL(binding.firestoreOrigin).origin};
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
  const native=!adapterFactory&&scope.CLEA7AndroidBackend?.available(),factory=adapterFactory||(native?scope.CLEA7AndroidBackend.create:scope.CLEA7FirebaseDevelopment?.create);
  if(!factory)throw new RemoteFault('Unavailable','The requested development adapter is not installed.');
  const {adapter:adapterName,...config}=binding;const adapter=factory(native?{application:project.id,backend:alias,operations:contract.operations.slice(),projectId:config.projectId}:{...config,application:project.id,credentials});
  if(adapter.version!==contract.adapter||typeof adapter.execute!=='function')throw new RemoteFault('Invalid','Invalid backend adapter.');
  adapters.set(alias,adapter);identities.set(alias,null);
 }
 function authorize(requests){
  if(closed)throw new RemoteFault('Cancelled','Backend context is closed.');
  if(!Array.isArray(requests)||requests.length+active.size>8)throw new RemoteFault('Budget','At most eight remote requests can be active.');
  const seen=new Set();const changes=requests.filter(r=>['auth.register','auth.signIn','auth.signOut'].includes(r.operation));if(changes.length&&(changes.length!==1||requests.length!==1))throw new RemoteFault('Conflict','An authentication transition must be its own event.');
  for(const r of requests){
   if(!declared[r.backend]?.operations.includes(r.operation)||!OPS.includes(r.operation)||!adapters.has(r.backend))throw new RemoteFault('Denied','Operation not declared by this application.');
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
  const task=Promise.resolve().then(()=>run({signal:controller.signal,execute}));
  task.catch(()=>{}).finally(()=>{active.delete(request.id);});return task;
 }

 return Object.freeze({application:project.id,authorize,submit,principal,onPrincipal(listener){if(typeof listener!=='function')throw new RemoteFault('Invalid','Invalid identity listener.');listeners.add(listener);return ()=>listeners.delete(listener);},get pending(){return active.size;},get closed(){return closed;},close(){if(closed)return;closed=true;listeners.clear();for(const {controller}of active.values())controller.abort();for(const adapter of adapters.values())adapter.close?.();},status(){return {format:'clea7.remote-status/1',pending:active.size,closed,backends:Object.entries(declared).map(([alias,c])=>({alias,adapter:c.adapter,operations:c.operations.slice()}))};}});
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
scope.CLEA7Remote={create,registry,validateBinding,credentials,publicError,RemoteFault,OPS};
})(globalThis);
