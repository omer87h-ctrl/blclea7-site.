'use strict';
/* Reusable device adapters. No permission request or device activation on load. */
(function(scope){
const fault=(code,message)=>Object.assign(Error(message),{code});
const recognitionClass=()=>scope.SpeechRecognition||scope.webkitSpeechRecognition;
const localVoices=()=>{try{return (scope.speechSynthesis?.getVoices()||[]).filter(voice=>voice.localService===true);}catch{return [];}};
function capabilities(){return {format:'sense.capabilities/1',speechInputAPI:typeof recognitionClass()==='function',localSpeechInputVerified:false,localVoiceCount:localVoices().length,haptics:typeof scope.navigator?.vibrate==='function',ocrConfigured:false,brailleDirectAdapter:false};}
function speaker({onState=()=>{}}={}){
 let active=null,timer=null,serial=0;
 const stop=()=>{serial++;if(timer)clearTimeout(timer);timer=null;try{scope.speechSynthesis?.cancel();}catch{}if(active){active.reject(fault('Cancelled','Govor je zaustavljen.'));active=null;}onState('stopped');};
 function speak(text,{approved=false,voiceName}={}){
  if(approved!==true)throw fault('Permission','Prvo potvrdi tačan sadržaj poruke.');
  if(typeof text!=='string'||!text.trim()||text.length>3000)throw fault('Input','Poruka mora imati 1–3000 znakova.');
  const voice=localVoices().find(v=>v.name===voiceName);if(!voice||typeof scope.SpeechSynthesisUtterance!=='function')throw fault('Unavailable','Odaberi dostupan lokalni glas uređaja. Poruka ostaje tekstom.');
  stop();const generation=serial,utterance=new scope.SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;
  return new Promise((resolve,reject)=>{
   active={reject};const finish=(error)=>{if(generation!==serial)return;if(timer)clearTimeout(timer);timer=null;active=null;error?reject(error):resolve({spoken:true,localVoice:true,language:voice.lang});};
   utterance.onstart=()=>{if(generation===serial)onState('speaking');};utterance.onend=()=>{if(generation===serial){onState('completed');finish();}};
   utterance.onerror=()=>{if(generation===serial){onState('failed');finish(fault('SpeechFailure','Govorni izlaz nije uspio. Poruka ostaje tekstom.'));}};
   timer=setTimeout(()=>{try{scope.speechSynthesis.cancel();}catch{}finish(fault('Timeout','Govorni izlaz je prekoračio vrijeme.'));},120000);
   onState('requested');try{scope.speechSynthesis.speak(utterance);}catch{finish(fault('SpeechFailure','Uređaj nije prihvatio govor.'));}
  });
 }
 return Object.freeze({speak,stop,voices:()=>localVoices().map(v=>({name:v.name,language:v.lang,local:true}))});
}
function listener({onFinal=()=>{},onInterim=()=>{},onState=()=>{}}={}){
 let current=null,generation=0,timer=null;
 const abort=()=>{generation++;if(timer)clearTimeout(timer);timer=null;const old=current;current=null;if(old)try{old.abort();}catch{}onState({state:'stopped'});};
 function start({approved=false,allowSystemService=false,preferLocal=true,language='bs-BA'}={}){
  if(approved!==true)throw fault('Permission','Mikrofon zahtijeva tvoje izričito pokretanje.');
  if(!['bs-BA','hr-HR','sr-RS','en-US','en-GB'].includes(language))throw fault('Language','Nepodržan izbor jezika.');
  if(current)throw fault('Busy','Slušanje je već pokrenuto.');const Constructor=recognitionClass();if(typeof Constructor!=='function')throw fault('Unavailable','Preglednik ne nudi prepoznavanje govora. Pisanje i izgovorene poruke ostaju dostupni.');
  const recognition=new Constructor(),local=preferLocal&&'processLocally' in recognition;
  if(!local&&!allowSystemService)throw fault('Permission','Lokalno prepoznavanje nije ponuđeno. Za sistemsku uslugu koja može slati zvuk izvan uređaja potrebna je zasebna potvrda.');
  if(local)recognition.processLocally=true;
  recognition.lang=language;recognition.continuous=true;recognition.interimResults=true;const own=++generation;current=recognition;
  recognition.onstart=()=>{if(own===generation)onState({state:'listening',localRequested:local,language});};
  recognition.onresult=event=>{
   if(own!==generation)return;const pending=[];
   for(let i=event.resultIndex;i<event.results.length;i++){const row=event.results[i],alternative=row[0],text=String(alternative?.transcript||'').slice(0,2000);if(!text.trim())continue;
    if(row.isFinal)onFinal({text,confidence:typeof alternative.confidence==='number'?alternative.confidence:null,uncertain:!(alternative.confidence>=.65),needsReview:true});else pending.push(text);
   }onInterim(pending.join(' ').slice(0,2000));
  };
  recognition.onerror=event=>{if(own===generation){abort();onState({state:'failed',code:String(event.error||'speech-error').slice(0,80)});}};
  recognition.onend=()=>{if(own===generation){if(timer)clearTimeout(timer);timer=null;current=null;onInterim('');onState({state:'stopped'});}};
  try{recognition.start();onState({state:'requested',localRequested:local,language});timer=setTimeout(abort,120000);}catch{current=null;throw fault('SpeechFailure','Prepoznavanje govora nije pokrenuto.');}
  return {requested:true,localRequested:local};
 }
 return Object.freeze({start,stop(){if(current)current.stop();},abort,get active(){return current!==null;}});
}
function vibrate(pattern,{approved=false}={}){
 if(approved!==true)throw fault('Permission','Taktilni signal nije odobren.');
 if(!Array.isArray(pattern)||!pattern.length||pattern.length>12||pattern.some(x=>!Number.isInteger(x)||x<0||x>1000)||pattern.reduce((a,b)=>a+b,0)>5000)throw fault('Input','Neispravan ograničeni taktilni signal.');
 if(typeof scope.navigator?.vibrate!=='function')throw fault('Unavailable','Uređaj ne nudi vibraciju.');return {accepted:scope.navigator.vibrate(pattern)===true,meaning:'event cue; not a Braille display'};
}
scope.CLEA7SenseSDK=Object.freeze({format:'sense.sdk/1',capabilities,speaker,listener,vibrate});
})(globalThis);
