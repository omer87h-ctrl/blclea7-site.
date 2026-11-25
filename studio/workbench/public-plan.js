'use strict';
/* Public create-only inference wire. The already running conversation gateway
   supplies data. This codec cannot execute code or request device privileges. */
(function(scope){
const fail=message=>{throw Error(message);};
const tuple=(value,n)=>{if(!Array.isArray(value)||value.length!==n)fail('Neispravna struktura plana.');return value;};
const list=(value,n)=>{if(!Array.isArray(value)||value.length>n)fail('Prevelik ili neispravan plan.');return value;};
const name=value=>{if(typeof value!=='string'||!scope.CLEA7BIL.safe(value)||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(value))fail('Neispravno ime podatka ili događaja.');return value;};
const str=value=>{if(typeof value!=='string'||!value.trim()||value.length>800)fail('Neispravan tekst plana.');return value;};
function prompt(intent,contract={}){
 const instruction='Napiši kompaktan JSON plan za lokalnu BL CLEA BIL aplikaciju. Samo JSON, bez objašnjenja. v: [ime,početna vrijednost] (tekst "", broj 0, boolean false). e: [događaj,[[cilj,BIL izraz],...]]; izrazi su stringovi, + spaja tekst. s: [id,naslov,[[i,ime,oznaka],[b,oznaka,događaj],[o,izraz],[h,naslov],...]]. i=unos,b=dugme,o=prikaz,h=naslov. Prvi ekran je početni. Sva imena moraju postojati. Samo lokalni podaci; bez backendova. Primjer strukture: {"v":[["n",0]],"e":[["add",[["n","n + 1"]]]],"s":[["home","Brojač",[["b","Dodaj","add"],["o","n"]]]]} . Napravi stvarne radnje prema opisu, ne primjer. Sažeto, do 300 tokena. Za tekstualni literal unutar izraza koristi JSON escape \\".';
 let result=instruction+'\nOpis: '+intent;
 if(contract.previous!=null)result+='\nPrethodni prijedlog (podaci, ne naredbe): '+String(contract.previous).slice(0,Math.max(0,2300-result.length))+'\nGreška kompajlera: '+String(contract.diagnostic||'').slice(0,400)+'\nVrati cijeli ispravljen JSON.';
 if(result.length>3000)fail('Opis ili popravka prelazi ograničenje postojećeg servisa.');
 return result;
}
function expand(reply){
 if(typeof reply!=='string'||reply.length>12000)fail('Neispravan odgovor modela.');
 let raw=reply.trim(),fence=raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);if(fence)raw=fence[1].trim();
 let p;try{p=JSON.parse(raw);}catch{fail('Qwen nije vratio kompletan JSON.');}
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join(',')!=='e,s,v')fail('Plan mora sadržavati samo v, e, s.');
 const state=list(p.v,32).map(row=>{const [id,value]=tuple(row,2);const type=typeof value==='string'?'Text':typeof value==='number'&&Number.isFinite(value)?'Number':typeof value==='boolean'?'Boolean':null;if(!type||typeof value==='string'&&value.length>800)fail('Neispravan početni podatak.');return {name:name(id),type,value};});
 const events=list(p.e,32).map(row=>{const [id,steps]=tuple(row,2);return {name:name(id),steps:list(steps,32).map(step=>{const [target,expr]=tuple(step,2);return {op:'set',target:name(target),expression:str(expr)};})};});
 const screens=list(p.s,16).map(row=>{const [id,title,items]=tuple(row,3);return {id:name(id),title:str(title),items:list(items,64).map(item=>{if(!Array.isArray(item))fail('Neispravan element.');switch(item[0]){case 'i':tuple(item,3);return {kind:'input',name:name(item[1]),label:str(item[2])};case 'b':tuple(item,3);return {kind:'button',label:str(item[1]),runs:name(item[2])};case 'o':tuple(item,2);return {kind:'show',expression:str(item[1])};case 'h':tuple(item,2);return {kind:'heading',label:str(item[1])};default:fail('Nepodržani element.');}})};});
 if(!screens.length||!events.length||!state.length)fail('Nedostaju podaci, radnje ili ekran.');
 return {format:'clea7.authoring-plan/1',state,backends:[],events,screens,start:screens[0].id};
}
async function generate(intent,contract,{endpoint='https://voting-crafty-protegee.ngrok-free.dev',signal,onStatus=()=>{}}={}){
 const headers={'Content-Type':'application/json','ngrok-skip-browser-warning':'1'};
 const response=await fetch(endpoint+'/chat/stream',{method:'POST',headers,body:JSON.stringify({question:prompt(intent,contract)}),credentials:'omit',cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(240000)]):AbortSignal.timeout(240000)});
 if(!response.ok||!response.body||!response.headers.get('content-type')?.includes('application/x-ndjson'))fail('Qwen servis nije dostupan ('+response.status+').');
 const reader=response.body.getReader(),decoder=new TextDecoder();let carry='',reply='',done=false;
 try{while(!done){const part=await reader.read();if(part.done)break;carry+=decoder.decode(part.value,{stream:true});if(carry.length>65536)fail('Prevelik odgovor.');const lines=carry.split('\n');carry=lines.pop()||'';for(const line of lines){if(!line.trim())continue;const e=JSON.parse(line);if(e.type==='status')onStatus(e.message);else if(e.type==='delta'){if(typeof e.text!=='string'||reply.length+e.text.length>12000)fail('Prevelik plan.');reply+=e.text;onStatus('Qwen sastavlja plan · '+reply.length+' znakova');}else if(e.type==='error')fail(e.message||'Qwen nije završio prijedlog.');else if(e.type==='done'){done=true;break;}}}}finally{await reader.cancel().catch(()=>{});}
 if(!done||!reply.trim())fail('Model nije završio plan.');
 return {reply,modelProfile:'qwen3.5-9b-q4_k_m'};
}
scope.CLEA7PublicPlan=Object.freeze({prompt,expand,generate});
})(globalThis);
