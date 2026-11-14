/* Original CLEA local-file boundary. Android SAF owns paths and user consent.
 * Opening text never parses, executes, connects a device, or grants filesystem access. */
const MAX_BYTES=1048576, brokers=new WeakMap();
const EXPORT_MIMES=Object.freeze({json:'application/json',bil:'text/plain',txt:'text/plain',csv:'text/csv',html:'text/html'});
const fault=(message,name='Error')=>Object.assign(new Error(message),{name});
const bytes=text=>new TextEncoder().encode(text).length;
const plain=value=>value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).every(key=>typeof key==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
function validText(text){
 if(typeof text!=='string'||text.length>MAX_BYTES)return false;
 for(let i=0;i<text.length;i++){const code=text.charCodeAt(i);if(code>=0xd800&&code<=0xdbff){const next=text.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}else if(code>=0xdc00&&code<=0xdfff)return false;}
 return bytes(text)<=MAX_BYTES;
}
const safeMessage=(value,fallback)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,240)||fallback:fallback;
export function hasNativeFiles(scope=globalThis){return scope.location?.origin==='https://clea.auto.local'&&typeof scope.CleaAutoFiles?.postMessage==='function';}
function broker(scope){
 if(brokers.has(scope)){const existing=brokers.get(scope);scope.__cleaAutoFilesResponse=existing.receive;return existing;}
 const b={pending:null,sequence:0};
 b.receive=raw=>{
  let message;
  try{if(typeof raw==='string'&&raw.length>MAX_BYTES*6+4096)return;message=typeof raw==='string'?JSON.parse(raw):raw;}catch{return;}
  if(!plain(message)||message.v!==1||typeof message.id!=='string'||!b.pending||message.id!==b.pending.id)return;
  const p=b.pending;
  const allowed=message.ok===false?['v','id','ok','name','message']:p.op==='open'?['v','id','ok','text','name']:['v','id','ok'];
  if(typeof message.ok!=='boolean'||Object.keys(message).some(key=>!allowed.includes(key))||(message.ok&&p.op==='open'&&(!validText(message.text)||typeof message.name!=='string'||message.name.length>160))){p.finish(fault('Android je vratio neispravnu lokalnu datoteku.','DataError'));return;}
  if(!message.ok){p.finish(fault(safeMessage(message.message,'Datoteka nije potvrđena.'),safeMessage(message.name,'OperationError')));return;}
  p.finish(null,p.op==='open'?{name:message.name,text:message.text,native:true}:p.op==='print'?{native:true,started:true}:{native:true,saved:true});
 };
 scope.__cleaAutoFilesResponse=b.receive;brokers.set(scope,b);return b;
}
function request(op,fields,{scope=globalThis,signal,timeoutMs=180000}={}){
 if(!hasNativeFiles(scope))return Promise.reject(fault('Android izbor datoteke dostupan je samo u CLEA Auto aplikaciji.','NotSupportedError'));
 if(signal?.aborted)return Promise.reject(fault('Datoteka je otkazana.','AbortError'));
 const b=broker(scope);if(b.pending)return Promise.reject(fault('Prethodni izbor datoteke još traje.','InvalidStateError'));
 const id='file-'+Date.now().toString(36)+'-'+(++b.sequence),host=scope.CleaAutoFiles;
 return new Promise((resolve,reject)=>{
  let timer;
  const finish=(error,value)=>{if(b.pending?.id!==id)return;b.pending=null;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve(value);};
  const cancel=reason=>{if(b.pending?.id!==id)return;finish(reason);try{host.postMessage(JSON.stringify({v:1,id:'file-cancel-'+(++b.sequence),op:'cancel',requestId:id}));}catch{}};
  const abort=()=>cancel(fault('Izbor datoteke je otkazan.','AbortError'));
  b.pending={id,op,finish};signal?.addEventListener('abort',abort,{once:true});
  const duration=Math.max(20,Math.min(300000,Number(timeoutMs)||180000));
  timer=setTimeout(()=>cancel(fault('Izbor ili obrada datoteke nisu završeni u dozvoljenom vremenu.','TimeoutError')),duration);
  try{host.postMessage(JSON.stringify({v:1,id,op,...fields}));}catch(error){finish(error);}
 });
}
export function openNativeText(kind,options={}){
 if(!['json','bil'].includes(kind))return Promise.reject(fault('Nepodržana vrsta lokalne datoteke.','DataError'));
 return request('open',{kind},options);
}
export async function saveTextFile(name,text,mime='application/json',options={}){
 const type=typeof mime==='string'?mime.split(';',1)[0].trim():'';
 if(typeof name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.(json|bil|txt|csv|html)$/.test(name)||!validText(text)||type!==EXPORT_MIMES[name.slice(name.lastIndexOf('.')+1)])throw fault('Izvoz zahtijeva siguran naziv i UTF-8 tekst do 1 MiB.','DataError');
 const scope=options.scope||globalThis;
 if(hasNativeFiles(scope))return request('save',{name,mime:type,text},options);
 if(options.signal?.aborted)throw fault('Izvoz je otkazan.','AbortError');
 const url=scope.URL.createObjectURL(new scope.Blob([text],{type})),a=scope.document.createElement('a');
 try{a.href=url;a.download=name;scope.document.body.append(a);a.click();}finally{a.remove();setTimeout(()=>scope.URL.revokeObjectURL(url),30000);}
 // Browser download initiation is observable; disk completion is not.
 return {native:false,started:true};
}

/** Request the system print dialog; acknowledgement never means printed or saved. */
export async function printCurrentDocument(options={}){
 const scope=options.scope||globalThis;
 if(options.signal?.aborted)throw fault('Zahtjev za štampu je otkazan.','AbortError');
 if(hasNativeFiles(scope))return request('print',{},options);
 if(typeof scope.print!=='function')throw fault('Sistemska štampa nije dostupna u ovom prikazu.','NotSupportedError');
 scope.print();
 return {native:false,started:true};
}
