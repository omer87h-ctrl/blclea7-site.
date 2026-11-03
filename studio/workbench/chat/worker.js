'use strict';
// Fixed owner-authored decoder only. Incoming text never selects a script/URL.
importScripts('assets.js','neural.js');
let model=null,manifest=null,loading=null,active=null;
const A=CLEA7ChatAssets,base=new URL('.',self.location.href).href;
async function load(){
 if(model)return model;if(loading)return loading;
 loading=(async()=>{manifest=A.manifest((await A.read(A.local('manifest.json',base),16384)).value);const data=await A.read(A.local(manifest.model.path,base),2097152,manifest.model,count=>postMessage({format:'clea7.chat.worker/1',type:'loading',bytes:count,total:manifest.model.bytes}));const next=CLEA7NeuralChat.create(data.value);await next.verify();if(next.describe().modelFingerprint!==manifest.modelFingerprint)throw A.fault('Integrity','Model ne odgovara manifestu.');model=next;return model;})();
 try{return await loading;}finally{loading=null;}
}
self.onmessage=async event=>{
 const request=event.data;if(request?.format!=='clea7.chat.worker/1'||typeof request.id!=='string'||request.id.length>80||!['initialize','generate'].includes(request.type))return;
 const id=request.id;if(active){postMessage({format:'clea7.chat.worker/1',id,type:'error',code:'Busy',message:'Radnik već izvršava zadatak.'});return;}active=id;
 try{
  const current=await load();
  if(request.type==='initialize'){postMessage({format:'clea7.chat.worker/1',id,type:'ready',description:current.describe()});return;}
  if(typeof request.question!=='string'||request.question.length<1||request.question.length>1200||!['bs','en'].includes(request.language))throw A.fault('Input','Neispravan ulaz razgovora.');
  const result=await current.generate(request.question,{maxTokens:48,language:request.language,onToken:token=>postMessage({format:'clea7.chat.worker/1',id,type:'token',index:token.index,finished:token.finished})});
  postMessage({format:'clea7.chat.worker/1',id,type:'result',result});
 }catch(error){postMessage({format:'clea7.chat.worker/1',id,type:'error',code:String(error.code||'Generation'),message:String(error.message||'Model nije završio odgovor.').slice(0,300)});}
 finally{active=null;}
};
