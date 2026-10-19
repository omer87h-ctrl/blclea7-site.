'use strict';
/* Trusted emulator-only adapter. BIL supplies operation data, never credentials or URLs. */
(function(scope){
const VERSION='firebase.development/1';
const OPS=Object.freeze(['auth.session','auth.register','auth.signIn','auth.signOut','document.get','document.set','document.delete']);
const SAFE=/^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const BAD=new Set(['__proto__','prototype','constructor']);
const copy=value=>JSON.parse(JSON.stringify(value));
class AdapterError extends Error {
 constructor(code,message,uncertain=false){super(message);this.name='CLEA7BackendError';this.code=code;this.uncertain=uncertain===true;}
}
const fault=(code,message,uncertain=false)=>new AdapterError(code,message,uncertain);
function origin(value){
 if(typeof value!=='string')throw fault('BackendConfiguration','An explicit loopback emulator origin is required.');
 let url;try{url=new URL(value);}catch{throw fault('BackendConfiguration','Invalid emulator origin.');}
 if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost'].includes(url.hostname)||!url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
  throw fault('BackendConfiguration','Only explicit localhost or 127.0.0.1 emulator ports are permitted.');
 return url.origin;
}
function path(value){
 if(typeof value!=='string'||value.length>1600)throw fault('BackendInput','Invalid document path.');
 const segments=value.split('/');
 if(segments.length<2||segments.length>12||segments.length%2||segments.some(s=>!/^[A-Za-z0-9_-]{1,128}$/.test(s)))throw fault('BackendInput','Document paths require 2–12 safe collection/document segments.');
 return segments.join('/');
}
function data(value){
 let nodes=0,bytes=0;
 function visit(v,depth){
  if(++nodes>3000||depth>16)throw fault('BackendInput','Document exceeds its structural budget.');
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='number'){if(!Number.isFinite(v)||Math.abs(v)>1e15)throw fault('BackendInput','A finite BIL number is required.');return;}
  if(typeof v==='string'){if(v.length>65536)throw fault('BackendInput','Document text exceeds 64 KiB.');bytes+=v.length;return;}
  if(Array.isArray(v)){if(v.length>1000)throw fault('BackendInput','Document list exceeds 1000 values.');v.forEach(x=>visit(x,depth+1));return;}
  if(!v||typeof v!=='object'||Object.getPrototypeOf(v)!==null&&Object.getPrototypeOf(Object.getPrototypeOf(v))!==null)throw fault('BackendInput','Document values must be BIL data.');
  const entries=Object.entries(v);if(entries.length>64)throw fault('BackendInput','Document records exceed 64 fields.');
  for(const [key,x]of entries){if(!SAFE.test(key)||BAD.has(key))throw fault('BackendInput','Unsafe document field.');bytes+=key.length;visit(x,depth+1);}
 }
 visit(value,0);if(bytes>131072||JSON.stringify(value).length>262144)throw fault('BackendInput','Document exceeds 256 KiB.');return value;
}
function encode(value){
 if(value===null)return {nullValue:null};
 if(typeof value==='boolean')return {booleanValue:value};
 if(typeof value==='number')return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
 if(typeof value==='string')return {stringValue:value};
 if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
 return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([key,x])=>[key,encode(x)]))}};
}
function decode(value,depth=0){
 if(depth>16||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1)throw fault('BackendResponse','Unsupported remote value.');
 const [type]=Object.keys(value),v=value[type];
 if(type==='nullValue'&&v===null)return null;
 if(type==='booleanValue'&&typeof v==='boolean')return v;
 if(type==='stringValue'&&typeof v==='string')return v;
 if(type==='integerValue'&&typeof v==='string'&&/^-?[0-9]+$/.test(v))return Number(v);
 if(type==='doubleValue'&&typeof v==='number')return v;
 if(type==='arrayValue'&&v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>k==='values')&&(v.values===undefined||Array.isArray(v.values)))return (v.values||[]).map(x=>decode(x,depth+1));
 if(type==='mapValue'&&v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>k==='fields'))return fields(v.fields||{},depth+1);
 throw fault('BackendResponse','Unsupported Firestore value type.');
}
function fields(value,depth=0){
 if(!value||typeof value!=='object'||Array.isArray(value))throw fault('BackendResponse','Invalid document fields.');
 return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,decode(v,depth+1)]));
}
function query(collection,q){
 if(typeof collection!=='string'||collection.length>1600)throw fault('BackendInput','Invalid collection path.');const parts=collection.split('/');if(parts.length<1||parts.length>11||parts.length%2!==1||parts.some(x=>!/^[A-Za-z0-9_-]{1,128}$/.test(x)))throw fault('BackendInput','Invalid collection path.');
 if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).sort().join(',')!=='descending,limit,offset,orderBy,where'||typeof q.descending!=='boolean'||!Number.isInteger(q.limit)||q.limit<1||q.limit>50||!Number.isInteger(q.offset)||q.offset<0||q.offset>1000||typeof q.orderBy!=='string'||q.orderBy!==''&&q.orderBy!=='__name__'&&(!SAFE.test(q.orderBy)||BAD.has(q.orderBy))||!Array.isArray(q.where)||q.where.length>5)throw fault('BackendInput','Invalid query contract.');
 const operations={'==':'EQUAL','!=':'NOT_EQUAL','<':'LESS_THAN','<=':'LESS_THAN_OR_EQUAL','>':'GREATER_THAN','>=':'GREATER_THAN_OR_EQUAL','array-contains':'ARRAY_CONTAINS'},filters=q.where.map(f=>{if(!f||typeof f!=='object'||Object.keys(f).sort().join(',')!=='field,flag,kind,number,op,text'||!SAFE.test(f.field)||BAD.has(f.field)||!Object.prototype.hasOwnProperty.call(operations,f.op)||!['text','number','flag','null'].includes(f.kind))throw fault('BackendInput','Invalid query filter.');for(const k of ['text','number','flag'])if(k===f.kind?f[k]===null||typeof f[k]!=={text:'string',number:'number',flag:'boolean'}[k]:f[k]!==null)throw fault('BackendInput','Filter value does not match its kind.');const value=f.kind==='null'?null:f[f.kind];data(value);return {fieldFilter:{field:{fieldPath:f.field},op:operations[f.op],value:encode(value)}};});
 const field=q.orderBy||'__name__',structuredQuery={from:[{collectionId:parts[parts.length-1]}],orderBy:[{field:{fieldPath:field},direction:q.descending?'DESCENDING':'ASCENDING'}],limit:q.limit,offset:q.offset};if(field!=='__name__')structuredQuery.orderBy.push({field:{fieldPath:'__name__'},direction:q.descending?'DESCENDING':'ASCENDING'});if(filters.length)structuredQuery.where=filters.length===1?filters[0]:{compositeFilter:{op:'AND',filters}};
 return {parent:parts.slice(0,-1).join('/'),structuredQuery};
}
function create(options){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['application','projectId','authOrigin','firestoreOrigin','storageOrigin','credentials','fetch','adapter','imageStore','timeoutMs','credentialTimeoutMs'].includes(k)))throw fault('BackendConfiguration','Unsupported emulator adapter configuration.');
 const {application,projectId,credentials}=options;
 const version=options.adapter||VERSION;if(![VERSION,'firebase.development/2','firebase.development/3','firebase.development/4'].includes(version))throw fault('BackendConfiguration','Unsupported adapter version.');
 if(!SAFE.test(application)||BAD.has(application)||typeof projectId!=='string'||!/^demo-clea7-[a-z0-9][a-z0-9-]{0,35}$/.test(projectId))throw fault('BackendConfiguration','A CLEA7 application and demo-clea7-* emulator project are required.');
 const authOrigin=origin(options.authOrigin),firestoreOrigin=origin(options.firestoreOrigin),storageOrigin=version==='firebase.development/4'?origin(options.storageOrigin):null;
 if(version!=='firebase.development/4'&&options.storageOrigin!==undefined)throw fault('BackendConfiguration','Storage requires adapter4.');
 if(typeof credentials!=='function')throw fault('BackendConfiguration','A trusted credential callback is required.');
 const transport=options.fetch||scope.fetch?.bind(scope);
 if(typeof transport!=='function')throw fault('BackendConfiguration','The host has no network transport.');
 const timeoutMs=options.timeoutMs===undefined?8000:options.timeoutMs;
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>15000)throw fault('BackendConfiguration','Adapter deadline must be 100–15000 ms.');
 const credentialTimeoutMs=options.credentialTimeoutMs===undefined?120000:options.credentialTimeoutMs;
 if(!Number.isInteger(credentialTimeoutMs)||credentialTimeoutMs<100||credentialTimeoutMs>120000)throw fault('BackendConfiguration','Credential deadline must be 100–120000 ms.');
 let session=null,epoch=0,closed=false;
 const active=new Set();
 const images=version==='firebase.development/4'?(options.imageStore||scope.CLEA7ImageStore?.create({application,projectId,principal:()=>session?.uid})):null;
 if(version==='firebase.development/4'&&!images)throw fault('BackendConfiguration','The trusted image host is unavailable.');
 const publicSession=()=>session?{uid:session.uid,email:session.email}:null;
 function invalidate(){epoch++;images?.invalidate();session=null;for(const controller of active)controller.abort();}
 function ensure(context,write=false){if(closed)throw fault('BackendClosed','Backend adapter is closed.',write);if(context.epoch!==epoch)throw fault('BackendSessionChanged','Authentication changed during the operation.',write);if(context.controller.signal.aborted)throw fault(context.timedOut?'BackendTimeout':'BackendCancelled',context.timedOut?'Backend operation exceeded its deadline.':'Backend operation was cancelled.',write);}
 async function readBody(response,context,write){
  const length=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(length)&&length>524288)throw fault('BackendResponse','Remote response exceeds 512 KiB.',write);
  let text='';
  if(response.body?.getReader){
   const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0;
   try{while(true){const part=await Promise.race([reader.read(),context.cancelled]);ensure(context,write);if(part.done)break;bytes+=part.value.byteLength;if(bytes>524288)throw fault('BackendResponse','Remote response exceeds 512 KiB.',write);text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}finally{try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}
  }else{text=await Promise.race([response.text(),context.cancelled]);if(text.length>524288)throw fault('BackendResponse','Remote response exceeds 512 KiB.',write);}
  ensure(context,write);try{return text?JSON.parse(text):{};}catch{throw fault('BackendResponse','Remote response is not valid JSON.',write);}
 }
 async function request(url,method,body,context,{write=false,token=null,missing=false,form=false,raw=false,contentType=null,bytes=false,upload=false}={}){
  ensure(context);let sent=false;
  try{
   const headers={'Content-Type':contentType||(form?'application/x-www-form-urlencoded':'application/json')};if(token)headers.Authorization='Bearer '+token;if(upload)headers['X-Goog-Upload-Protocol']='multipart';
   sent=true;
   const response=await Promise.race([transport(url,{method,headers,body:body===undefined?undefined:raw||form?body:JSON.stringify(body),signal:context.controller.signal,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'}),context.cancelled]);
   ensure(context,write);
   if(missing&&response.status===404)return null;
   if(!response.ok){
    // Never expose Firebase error bodies: Auth errors may contain private inputs.
    if(response.status===401)throw fault('BackendUnauthenticated','Authentication was rejected.');
    if(response.status===403)throw fault('BackendPermissionDenied','The server denied this operation.');
    if(response.status===404)throw fault('NotFound','The remote resource was not found.');
    if(response.status===400)throw fault('BackendRejected','The emulator rejected the operation.');
    if(response.status===429)throw fault('BackendRateLimited','The emulator rate limit was reached.');
    throw fault('BackendUnavailable','The emulator did not complete the operation.',write&&response.status>=500);
   }
   if(bytes){if((response.headers?.get('content-type')||'').split(';')[0]!=='image/jpeg')throw fault('BackendResponse','Remote image MIME type differs.');const length=Number(response.headers?.get('content-length'));if(length>5242880)throw fault('BackendResponse','Remote image exceeds 5 MiB.');const chunks=[];let count=0;if(!response.body?.getReader)throw fault('BackendResponse','A bounded binary stream is required.');const reader=response.body.getReader();try{while(true){const part=await Promise.race([reader.read(),context.cancelled]);ensure(context);if(part.done)break;count+=part.value.byteLength;if(count>5242880)throw fault('BackendResponse','Remote image exceeds 5 MiB.');chunks.push(part.value);}}finally{try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}if(!count)throw fault('BackendResponse','Remote image is empty.');const out=new Uint8Array(count);let at=0;for(const part of chunks){out.set(part,at);at+=part.length;}return out.buffer;}return await readBody(response,context,write);
  }catch(error){
   if(error instanceof AdapterError){if(context.controller.signal.aborted)ensure(context,write&&sent);throw error;}
   if(context.controller.signal.aborted){ensure(context,write&&sent);}
   throw fault('BackendUnavailable','Could not reach the configured emulator.',write&&sent);
  }
 }
 async function token(context){
  if(!session)throw fault('BackendUnauthenticated','Sign in before accessing remote documents.');
  if(session.expiresAt-Date.now()>30000)return session.token;
  const result=await request(authOrigin+'/securetoken.googleapis.com/v1/token?key=clea7-emulator-only','POST','grant_type=refresh_token&refresh_token='+encodeURIComponent(session.refresh),context,{form:true});
  ensure(context);if(typeof result.access_token!=='string'||typeof result.refresh_token!=='string'||result.user_id!==session.uid)throw fault('BackendResponse','Invalid emulator session refresh.');
  session={...session,token:result.access_token,refresh:result.refresh_token,expiresAt:Date.now()+Math.min(3600,Math.max(1,Number(result.expires_in)||1))*1000};return session.token;
 }
 function imagePath(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).join(',')!=='path'||typeof value.path!=='string'||!new RegExp('^apps/'+application+'/(shared|private)/[A-Za-z0-9_-]{1,128}/[0-9a-f]{32}[.]jpg$').test(value.path))throw fault('BackendInput','Invalid application image identity.');return value.path;}
 async function imageOperation(name,args,context){
  context.startNetwork();const authToken=await token(context);ensure(context);
  if(name==='image.choose'){context.startHuman();const result=await images.choose(context.controller.signal);ensure(context);context.startNetwork();return result;}
  if(name==='image.discard'){const result=await images.remove(args[0]?.handle);ensure(context);return result;}
  const bucket=projectId+'.appspot.com',base=storageOrigin+'/v0/b/'+bucket+'/o';
  if(name==='image.upload'){
   if(typeof args[1]!=='boolean')throw fault('BackendInput','Image sharing requires an explicit Boolean.');const bytes=await images.read(args[0]?.handle);ensure(context);if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<1||bytes.byteLength>5242880)throw fault('BackendInput','Invalid host image bytes.');
   const object='apps/'+application+'/'+(args[1]?'shared':'private')+'/'+session.uid+'/'+scope.crypto.randomUUID().replace(/-/g,'')+'.jpg',boundary='clea7_'+scope.crypto.randomUUID().replace(/-/g,''),metadata={name:object,contentType:'image/jpeg',metadata:{firebaseStorageDownloadTokens:''}},start=new TextEncoder().encode('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: image/jpeg\r\n\r\n'),end=new TextEncoder().encode('\r\n--'+boundary+'--\r\n'),body=new Uint8Array(start.length+bytes.byteLength+end.length);body.set(start);body.set(new Uint8Array(bytes),start.length);body.set(end,start.length+bytes.byteLength);
   const result=await request(base+'?name='+encodeURIComponent(object),'POST',body,context,{token:authToken,write:true,raw:true,upload:true,contentType:'multipart/related; boundary='+boundary});if(result.name!==object||result.contentType!=='image/jpeg'||Number(result.size)!==bytes.byteLength)throw fault('BackendResponse','Uploaded image identity differs.',true);return {path:object};
  }
  const object=imagePath(args[0]),url=base+'/'+encodeURIComponent(object);
  if(name==='image.load'){const bytes=await request(url+'?alt=media','GET',undefined,context,{token:authToken,bytes:true});ensure(context);const value=await images.save(bytes,context.controller.signal);ensure(context);return value;}
  if(name==='image.remove'){await request(url,'DELETE',undefined,context,{token:authToken,write:true});return true;}
  throw fault('BackendInput','Unsupported image operation.');
 }
 async function operation(name,args,context){
  if(name.startsWith('image.'))return imageOperation(name,args,context);
  if(name==='auth.register'||name==='auth.signIn'){
   const supplied=await Promise.race([Promise.resolve().then(()=>credentials(name,{signal:context.controller.signal,application})),context.cancelled]);
   ensure(context);
   if(!supplied||Object.keys(supplied).some(k=>!['email','password'].includes(k))||typeof supplied.email!=='string'||supplied.email.length>254||!/^\S+@\S+\.\S+$/.test(supplied.email)||typeof supplied.password!=='string'||supplied.password.length<6||supplied.password.length>256)throw fault('BackendCredentials','Valid credentials are required from the trusted host.');
   context.startNetwork();
   const result=await request(authOrigin+'/identitytoolkit.googleapis.com/v1/accounts:'+(name==='auth.register'?'signUp':'signInWithPassword')+'?key=clea7-emulator-only','POST',{email:supplied.email,password:supplied.password,returnSecureToken:true},context,{write:name==='auth.register'});
   ensure(context);
   if(typeof result.localId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(result.localId)||typeof result.email!=='string'||typeof result.idToken!=='string'||typeof result.refreshToken!=='string')throw fault('BackendResponse','The emulator returned an invalid session.',name==='auth.register');
   session={uid:result.localId,email:result.email,token:result.idToken,refresh:result.refreshToken,expiresAt:Date.now()+Math.min(3600,Math.max(1,Number(result.expiresIn)||1))*1000};return publicSession();
  }
  if(name==='document.add'){if(!['firebase.development/2','firebase.development/3','firebase.development/4'].includes(version))throw fault('BackendInput','Creation requires adapter2.');query(args[0],{where:[],orderBy:'',descending:false,limit:1,offset:0});if(!args[1]||typeof args[1]!=='object'||Array.isArray(args[1]))throw fault('BackendInput','A document must be a Record.');data(args[1]);const authToken=await token(context),response=await request(firestoreOrigin+'/v1/projects/'+projectId+'/databases/(default)/documents/'+args[0],'POST',{fields:encode(args[1]).mapValue.fields},context,{token:authToken,write:true}),prefix='projects/'+projectId+'/databases/(default)/documents/'+args[0]+'/';if(typeof response.name!=='string'||!response.name.startsWith(prefix)||!/^[A-Za-z0-9_-]{1,128}$/.test(response.name.slice(prefix.length)))throw fault('BackendResponse','Invalid created document identity.',true);return {id:response.name.slice(prefix.length),path:response.name.slice(('projects/'+projectId+'/databases/(default)/documents/').length)};}
  if(name==='query.list'||name==='query.documents'){
   if(name==='query.documents'&&!['firebase.development/3','firebase.development/4'].includes(version))throw fault('BackendInput','Document identities require adapter3.');
   if(!['firebase.development/2','firebase.development/3','firebase.development/4'].includes(version))throw fault('BackendInput','Queries require adapter2.');
   const compiled=query(args[0],args[1]),authToken=await token(context),parent=compiled.parent?'/'+compiled.parent:'';
   const result=await request(firestoreOrigin+'/v1/projects/'+projectId+'/databases/(default)/documents'+parent+':runQuery','POST',{structuredQuery:compiled.structuredQuery},context,{token:authToken});
   if(!Array.isArray(result)||result.length>args[1].limit+1)throw fault('BackendResponse','Query response exceeds its declared bound.');const rows=[],seen=new Set();
   for(const item of result){if(!item||typeof item!=='object'||Array.isArray(item))throw fault('BackendResponse','Invalid query response.');if(!item.document)continue;const doc=item.document,prefix='projects/'+projectId+'/databases/(default)/documents/'+args[0]+'/';if(typeof doc.name!=='string'||!doc.name.startsWith(prefix)||!/^[A-Za-z0-9_-]{1,128}$/.test(doc.name.slice(prefix.length)))throw fault('BackendResponse','Query document identity differs.');const id=doc.name.slice(prefix.length),value=copy(data(fields(doc.fields||{})));if(seen.has(id))throw fault('BackendResponse','Duplicate query document identity.');seen.add(id);rows.push(name==='query.documents'?{id,path:args[0]+'/'+id,value}:value);}
   if(rows.length>args[1].limit)throw fault('BackendResponse','Query exceeded its limit.');data(rows);return rows;
  }
  const documentPath=path(args[0]);
  if(name==='document.set'){if(!args[1]||typeof args[1]!=='object'||Array.isArray(args[1]))throw fault('BackendInput','A document must be a Record.');data(args[1]);}
  const authToken=await token(context),url=firestoreOrigin+'/v1/projects/'+projectId+'/databases/(default)/documents/'+documentPath;
  if(name==='document.get'){
   const result=await request(url,'GET',undefined,context,{token:authToken,missing:true});if(result===null)return null;
   try{return copy(data(fields(result.fields||{})));}catch(error){throw fault('BackendResponse','Remote document is outside the supported BIL data contract.');}
  }
  if(name==='document.set'){await request(url,'PATCH',{fields:encode(args[1]).mapValue.fields},context,{token:authToken,write:true});return true;}
  await request(url,'DELETE',undefined,context,{token:authToken,write:true});return true;
 }
 async function execute(request,{signal}={}){
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(k=>!['operation','args'].includes(k))||!(OPS.includes(request.operation)||['firebase.development/2','firebase.development/3','firebase.development/4'].includes(version)&&['query.list','document.add'].includes(request.operation)||['firebase.development/3','firebase.development/4'].includes(version)&&request.operation==='query.documents'||version==='firebase.development/4'&&['image.choose','image.upload','image.load','image.remove','image.discard'].includes(request.operation))||!Array.isArray(request.args))throw fault('BackendInput','Invalid backend request.');
  const name=request.operation,args=request.args,arity=request.operation==='image.upload'?2:['image.load','image.remove','image.discard'].includes(request.operation)?1:['document.set','document.add','query.list','query.documents'].includes(name)?2:name.startsWith('document.')?1:0;
  if(args.length!==arity)throw fault('BackendInput','Wrong backend operation argument count.');
  if(closed)throw fault('BackendClosed','Backend adapter is closed.');
  if(signal?.aborted)throw fault('BackendCancelled','Backend operation was cancelled.');
  if(name==='auth.session')return publicSession();
  if(name==='auth.signOut'){invalidate();return true;}
  if(name==='auth.register'||name==='auth.signIn')invalidate();
  if(active.size>=8)throw fault('BackendBusy','Backend operation limit reached.');
  const controller=new AbortController(),context={controller,epoch,timedOut:false};
  let rejectCancel;context.cancelled=new Promise((_,reject)=>{rejectCancel=reject;});
  // Attach before it can reject even when only the fetch path is active.
  context.cancelled.catch(()=>{});
  const abort=()=>controller.abort(),onAbort=()=>rejectCancel(fault(context.timedOut?'BackendTimeout':'BackendCancelled',context.timedOut?'Backend operation exceeded its deadline.':'Backend operation was cancelled.'));
  controller.signal.addEventListener('abort',onAbort,{once:true});signal?.addEventListener('abort',abort,{once:true});
  let timer;const deadline=ms=>{clearTimeout(timer);timer=setTimeout(()=>{context.timedOut=true;controller.abort();},ms);};context.startNetwork=()=>deadline(timeoutMs);context.startHuman=()=>deadline(credentialTimeoutMs);deadline(name==='auth.register'||name==='auth.signIn'||name==='image.choose'?credentialTimeoutMs:timeoutMs);active.add(controller);
  try{return await operation(name,args,context);}catch(error){if(error instanceof AdapterError)throw error;ensure(context);if(name.startsWith('image.')&&scope.CLEA7ImageStore?.isError?.(error)===true)throw fault(error.code,'The trusted image operation did not complete.');throw fault('BackendFailure','Backend operation failed.');}finally{clearTimeout(timer);active.delete(controller);controller.signal.removeEventListener('abort',onAbort);signal?.removeEventListener('abort',abort);controller.abort();}
 }
 return Object.freeze({version,execute,mediaUrl:handle=>images?.url(handle)||Promise.resolve(null),close(){if(!closed){closed=true;invalidate();images?.close();}},publicStatus(){return {version,application,development:true,authenticated:!!session,session:publicSession(),closed,subscriptions:false};}});
}
scope.CLEA7FirebaseDevelopment=Object.freeze({VERSION,versions:[VERSION,'firebase.development/2','firebase.development/3','firebase.development/4'],operations:OPS,query,create});
})(globalThis);

