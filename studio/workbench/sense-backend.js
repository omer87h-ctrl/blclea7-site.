'use strict';
/* Permission-controlled BIL device/document adapter. No implicit sensor access. */
(function(scope){
const VERSION='sense.local/1',fault=(code,message,uncertain=false)=>Object.assign(Error(message),{code,uncertain});
let owner=null;
const pending=new Map();
function metadata(){try{const value=JSON.parse(scope.CLEA7SenseDevice?.profile?.()||'{}');return value.format==='clea7.sense-native/1'&&value.version===VERSION?value:null;}catch{return null;}}
function profile(){const value=metadata();return value?.enabled===true?value:null;}
function target(){return metadata()?'android':'browser';}
function nativeSend(method,data,{signal}={}){
 if(signal?.aborted)return Promise.reject(fault('Cancelled','Sense radnja je otkazana.'));
 if(!profile()||typeof scope.CLEA7SenseDevice?.[method]!=='function'||pending.size>=8)return Promise.reject(fault('Unavailable','Native Sense nije dostupan.'));
 const id=scope.CLEA7Format.newId('sense');
 return new Promise((resolve,reject)=>{
  const cancel=()=>finish(false,fault('Cancelled','Sense radnja je otkazana.')),timer=setTimeout(()=>finish(false,fault('Timeout','Sense radnja je istekla.')),125000);
  function finish(ok,value){if(!pending.delete(id))return;clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(!ok)try{scope.CLEA7SenseDevice.cancel(JSON.stringify({id}));}catch{}ok?resolve(value):reject(value);}
  pending.set(id,finish);signal?.addEventListener('abort',cancel,{once:true});try{scope.CLEA7SenseDevice[method](JSON.stringify({...data,id}));}catch{finish(false,fault('Unavailable','Native Sense nije prihvatio zahtjev.'));}
 });
}
function receive(data){const finish=data&&pending.get(data.id);if(!finish)return;const code=['Denied','Cancelled','Timeout','Invalid','Unavailable','Conflict','Budget','Uncertain'].includes(data.code)?data.code:'Unavailable';finish(data.ok===true,data.ok===true?data.value:fault(code,'Native Sense nije završio radnju.',data.uncertain===true));}
const labels={'speech.speak':'Izgovori potvrđeni tekst','speech.listen':'Pretvori govor u tekst','speech.stop':'Zaustavi govor','document.docx':'Pripremi DOCX preuzimanje','haptic.cue':'Taktilni signal'};
function ask(operation,text,signal){
 const d=scope.document;if(!d?.createElement)return Promise.reject(fault('Unavailable','Ova mogućnost zahtijeva interaktivni preglednik.'));
 return new Promise((resolve,reject)=>{
  const el=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n;},dialog=el('dialog'),title=el('h2',labels[operation]),description=el('p');dialog.className='clea7-review';dialog.setAttribute('aria-label',labels[operation]);
  description.textContent=operation==='document.docx'?'Preuzimanje sadrži samo prikazani tekst. Pregledaj ga prije potvrde.':operation==='speech.listen'?'Mikrofon se uključuje tek kada potvrdiš. Prepoznati tekst treba pregledati.':'Radnja se izvršava na ovom uređaju tek nakon tvoje potvrde.';
  const preview=el('pre',text),voiceLabel=el('label','Lokalni glas uređaja'),voice=el('select'),systemLabel=el('label'),system=el('input');voiceLabel.append(voice);system.type='checkbox';systemLabel.append(system,d.createTextNode(' Biram sistemsko prepoznavanje i dopuštam da zvuk napusti uređaj prema pravilima preglednika.'));
  const approve=el('button','Potvrdi ovu radnju'),cancel=el('button','Odustani');approve.type=cancel.type='button';approve.dataset.senseApprove='true';cancel.dataset.senseCancel='true';
  let settled=false;const finish=(value,error)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);scope.speechSynthesis?.removeEventListener?.('voiceschanged',voices);dialog.close();dialog.remove();error?reject(error):resolve(value);};
  const abort=()=>finish(null,fault('Cancelled','Sense radnja je otkazana.'));
  const voices=()=>{const previous=voice.value;voice.replaceChildren();for(const row of scope.CLEA7SenseSDK.speaker().voices()){const option=el('option',row.name+' · '+row.language);option.value=row.name;voice.append(option);}if([...voice.options].some(row=>row.value===previous))voice.value=previous;approve.disabled=operation==='speech.speak'&&!voice.value;};
  dialog.append(title,description);if(operation!=='speech.listen')dialog.append(preview);if(operation==='speech.speak'){dialog.append(voiceLabel);voices();scope.speechSynthesis?.addEventListener?.('voiceschanged',voices);}if(operation==='speech.listen')dialog.append(systemLabel);
  approve.onclick=()=>finish({voiceName:voice.value,allowSystemService:system.checked});cancel.onclick=abort;dialog.addEventListener('cancel',event=>{event.preventDefault();abort();});dialog.append(approve,cancel);d.body.append(dialog);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}dialog.showModal();cancel.focus();
 });
}
function download(bytes){const d=scope.document,url=scope.URL.createObjectURL(new scope.Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})),a=d.createElement('a');a.href=url;a.download='CLEA-CV.docx';d.body.append(a);a.click();a.remove();setTimeout(()=>scope.URL.revokeObjectURL(url),3000);}
function create({application,backend,operations,prompt=ask,save=download}={}){
 const contracts=scope.CLEA7BIL.SENSE_CONTRACTS;
 if(!scope.CLEA7BIL.safe(application)||!Array.isArray(operations)||new Set(operations).size!==operations.length||operations.some(op=>!Object.hasOwn(contracts,op))||!scope.CLEA7SenseSDK||!scope.CLEA7SenseDocument)throw fault('Denied','Neispravan Sense ugovor.');
 if(profile()){
  if(profile().application!==application||!scope.CLEA7BIL.safe(backend))throw fault('Denied','Native Sense pripada drugoj aplikaciji.');
  let configured=null,closed=false;const active=new Set();
  return Object.freeze({version:VERSION,async execute(request,{signal}={}){
   if(closed||signal?.aborted)throw fault('Cancelled','Sense kontekst je zatvoren.');if(!operations.includes(request.operation)||!Array.isArray(request.args)||request.args.length!==contracts[request.operation].arguments||request.args.some(value=>typeof value!=='string'))throw fault('Denied','Sense operacija nije odobrena.');if(request.args.some(value=>value.length>(request.operation==='document.docx'?30000:3000)))throw fault('Budget','Sense tekst prelazi budžet.');
   const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});active.add(controller);
   try{if(!configured)configured=nativeSend('configure',{application,backend,operations},{signal:controller.signal}).catch(error=>{configured=null;throw error;});await configured;if(closed||controller.signal.aborted)throw fault('Cancelled','Sense kontekst je zatvoren.');return await nativeSend('request',{application,backend,operation:request.operation,args:request.args},{signal:controller.signal});}
   finally{active.delete(controller);signal?.removeEventListener('abort',cancel);}
  },close(){closed=true;for(const controller of active)controller.abort();configured=null;}});
 }
 let closed=false,current=null;const speaker=scope.CLEA7SenseSDK.speaker();
 return Object.freeze({version:VERSION,async execute(request,{signal}={}){
  if(closed||signal?.aborted)throw fault('Cancelled','Sense kontekst je zatvoren.');
  if(!operations.includes(request.operation)||!Object.hasOwn(contracts,request.operation)||!Array.isArray(request.args)||request.args.length!==contracts[request.operation].arguments||request.args.some(v=>typeof v!=='string'))throw fault('Denied','Sense operacija nije odobrena ovim ugovorom.');
  if(request.operation==='speech.stop'){if(owner&&owner!==application)throw fault('Denied','Govor pripada drugoj aplikaciji.');current?.abort();speaker.stop();return true;}
  if(current||owner)throw fault('Conflict','Druga Sense radnja još traje.');
  const controller=new AbortController(),cancel=()=>controller.abort();current=controller;owner=application;signal?.addEventListener('abort',cancel,{once:true});let began=false,listener=null;
  const abort=()=>{speaker.stop();listener?.abort();};controller.signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(cancel,120000);
  try{
   const text=request.args[0]||'';if(text.length>(request.operation==='document.docx'?30000:3000))throw fault('Budget','Sense tekst prelazi budžet.');
   if(request.operation==='speech.stop'){speaker.stop();return true;}
   const permission=await prompt(request.operation,text,controller.signal);if(controller.signal.aborted)throw fault('Cancelled','Sense radnja je otkazana.');
   if(request.operation==='document.docx'){const data=scope.CLEA7SenseDocument.renderDOCX(text);began=true;save(data);return true;}
   if(request.operation==='speech.speak'){began=true;const result=await speaker.speak(text,{approved:true,voiceName:permission.voiceName});return result.spoken===true;}
   if(request.operation==='haptic.cue'){const patterns={confirm:[100],error:[90,80,30],complete:[35,60,35,60,100]};if(!Object.hasOwn(patterns,text))throw fault('Invalid','Nepoznat taktilni signal.');began=true;return scope.CLEA7SenseSDK.vibrate(patterns[text],{approved:true}).accepted;}
   if(request.operation==='speech.listen')return await new Promise((resolve,reject)=>{
    let done=false;const finish=(value,error)=>{if(done)return;done=true;controller.signal.removeEventListener('abort',aborted);listener?.abort();error?reject(error):resolve(value);},aborted=()=>finish(null,fault('Cancelled','Prepoznavanje je prekinuto.'));
    listener=scope.CLEA7SenseSDK.listener({onFinal:row=>finish((row.uncertain?'[Provjeri prepoznavanje] ':'')+row.text),onState:state=>{if(state.state==='failed')finish(null,fault('Unavailable','Prepoznavanje govora nije uspjelo.'));else if(state.state==='stopped'&&!done)finish(null,fault('Cancelled','Nije dobijen potvrđen dio transkripta.'));}});
    controller.signal.addEventListener('abort',aborted,{once:true});try{listener.start({approved:true,allowSystemService:permission.allowSystemService,preferLocal:!permission.allowSystemService,language:text});}catch(error){finish(null,error);}
   });
   throw fault('Denied','Sense operacija nije registrovana.');
  }catch(error){if(began)error.uncertain=true;throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',abort);listener?.abort();current=null;owner=null;}
 },close(){closed=true;current?.abort();}});
}
scope.CLEA7SenseBackend=Object.freeze({version:VERSION,create,profile,target,receive});
})(globalThis);
