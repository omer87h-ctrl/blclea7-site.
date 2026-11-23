'use strict';
/* CLEA project resources: bounded data, never URLs, source code or device access. */
(function(scope){
const FORMAT='clea7.resources/1',REQUIREMENTS='bil.resources/1',MAX_ITEM=4*1024*1024,MAX_TOTAL=12*1024*1024,MAX_APP=20*1024*1024;
const MIME={image:['image/png','image/jpeg','image/webp'],audio:['audio/wav','audio/mpeg','audio/ogg']},KEY=/^[A-Za-z][A-Za-z0-9_]{0,47}$/;
const fail=message=>{throw Object.assign(Error(message),{code:'Resource'});},safe=x=>typeof x==='string'&&KEY.test(x)&&!['constructor','prototype','__proto__'].includes(x);
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x),keys=(x,required,optional=[])=>object(x)&&required.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>required.includes(k)||optional.includes(k));
function bytes(data){
 if(typeof data!=='string'||!data.length||data.length>Math.ceil(MAX_ITEM/3)*4||data.length%4||/[^A-Za-z0-9+/=]/.test(data)||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))fail('Resurs nema ispravan ograničen base64 sadržaj.');
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',length=data.length/4*3-(data.endsWith('==')?2:data.endsWith('=')?1:0),out=new Uint8Array(length);let at=0;
 for(let i=0;i<data.length;i+=4){const n=(alphabet.indexOf(data[i])<<18)|(alphabet.indexOf(data[i+1])<<12)|((data[i+2]==='='?0:alphabet.indexOf(data[i+2]))<<6)|(data[i+3]==='='?0:alphabet.indexOf(data[i+3]));for(const shift of [16,8,0])if(at<length)out[at++]=(n>>>shift)&255;}
 return out;
}
function encode(value){let out='';const a='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';for(let i=0;i<value.length;i+=3){const n=(value[i]<<16)|((value[i+1]||0)<<8)|(value[i+2]||0);out+=a[(n>>>18)&63]+a[(n>>>12)&63]+(i+1<value.length?a[(n>>>6)&63]:'=')+(i+2<value.length?a[n&63]:'=');}return out;}
const ascii=(b,at,n)=>String.fromCharCode(...b.slice(at,at+n));
function inspectBytes(b,mime){
 if(!(b instanceof Uint8Array)||!b.length||b.length>MAX_ITEM)fail('Jedan resurs treba 1 bajt do 4 MiB podataka.');
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);let size=null;
 if(mime==='image/png'){if(b.length<24||![137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n)||ascii(b,12,4)!=='IHDR')fail('Sadržaj nije PNG.');size={width:v.getUint32(16),height:v.getUint32(20)};}
 else if(mime==='image/jpeg'){if(b[0]!==255||b[1]!==216)fail('Sadržaj nije JPEG.');let at=2;while(at+4<b.length){if(b[at++]!==255)fail('Neispravan JPEG okvir.');while(b[at]===255)at++;const tag=b[at++];if([217,218].includes(tag))break;const n=v.getUint16(at);if(n<2||at+n>b.length)fail('Neispravan JPEG segment.');if([192,193,194].includes(tag)){if(n<8)fail('Neispravan JPEG okvir.');size={width:v.getUint16(at+5),height:v.getUint16(at+3)};break;}at+=n;}if(!size)fail('JPEG nema podržan okvir.');}
 else if(mime==='image/webp'){if(b.length<30||ascii(b,0,4)!=='RIFF'||ascii(b,8,4)!=='WEBP')fail('Sadržaj nije WebP.');const tag=ascii(b,12,4);if(tag==='VP8X')size={width:1+b[24]+b[25]*256+b[26]*65536,height:1+b[27]+b[28]*256+b[29]*65536};else if(tag==='VP8 '&&b[23]===157&&b[24]===1&&b[25]===42)size={width:v.getUint16(26,true)&16383,height:v.getUint16(28,true)&16383};else if(tag==='VP8L'&&b[20]===47)size={width:1+((b[21]|b[22]<<8)&16383),height:1+((b[22]>>6|b[23]<<2|b[24]<<10)&16383)};else fail('Nepodržan WebP okvir.');}
 else if(mime==='audio/wav'){
  if(b.length<44||ascii(b,0,4)!=='RIFF'||ascii(b,8,4)!=='WAVE')fail('Sadržaj nije WAV.');let at=12,format=null,data=null;
  while(at+8<=b.length){const id=ascii(b,at,4),n=v.getUint32(at+4,true),start=at+8;if(start+n>b.length)fail('WAV segment je skraćen.');if(id==='fmt '){if(n<16)fail('WAV nema valjan format.');format={code:v.getUint16(start,true),channels:v.getUint16(start+2,true),sampleRate:v.getUint32(start+4,true),align:v.getUint16(start+12,true),bits:v.getUint16(start+14,true)};}if(id==='data')data={offset:start,length:n};at=start+n+(n%2);}
  if(!format||!data||format.code!==1||format.bits!==16||![1,2].includes(format.channels)||format.sampleRate<8000||format.sampleRate>96000||format.align!==format.channels*2||data.length%format.align)fail('Koristi PCM16 WAV, mono/stereo,8–96kHz.');
  const duration=data.length/format.align/format.sampleRate;if(duration<=0||duration>180)fail('Zvuk treba trajati do180 sekundi.');return {...format,...data,duration};
 }else if(mime==='audio/mpeg'){if(b.length<3||!(ascii(b,0,3)==='ID3'||b[0]===255&&(b[1]&224)===224))fail('Sadržaj nije MP3.');}
 else if(mime==='audio/ogg'){if(b.length<27||ascii(b,0,4)!=='OggS')fail('Sadržaj nije Ogg.');}
 else fail('Nepodržan format resursa.');
 if(size&&(!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<1||size.height<1||size.width>4096||size.height>4096||size.width*size.height>16777216))fail('Slika prelazi4096×4096.');return size||{};
}
function requirements(value){if(!keys(value,['format','items'])||value.format!==REQUIREMENTS||!object(value.items)||Object.keys(value.items).length>16)fail('Neispravne deklaracije resursa.');for(const[id,r]of Object.entries(value.items))if(!safe(id)||!keys(r,['kind'])||!Object.hasOwn(MIME,r.kind))fail('Neispravan identitet ili vrsta resursa.');return value;}
function validate(bundle,required,{complete=false}={}){
 requirements(required);if(!keys(bundle,['format','items'])||bundle.format!==FORMAT||!Array.isArray(bundle.items)||bundle.items.length>16)fail('Neispravan paket resursa.');const ids=new Set();let total=0;
 for(const r of bundle.items){if(!keys(r,['id','kind','mime','bytes','sha256','data','credit','license'],['cues'])||!safe(r.id)||ids.has(r.id)||!required.items[r.id]||required.items[r.id].kind!==r.kind||!MIME[r.kind]?.includes(r.mime)||!Number.isInteger(r.bytes)||r.bytes<1||r.bytes>MAX_ITEM||typeof r.sha256!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256)||![r.credit,r.license].every(x=>typeof x==='string'&&x.trim()&&x.length<=400))fail('Resurs treba valjanu vrstu, porijeklo, licencu i integritet.');
  const data=bytes(r.data);if(data.length!==r.bytes||(total+=data.length)>MAX_TOTAL)fail('Veličina resursa prelazi deklarisani budžet12MiB.');const info=inspectBytes(data,r.mime);ids.add(r.id);
  if(r.cues!==undefined){if(r.kind!=='audio'||!Array.isArray(r.cues)||r.cues.length>160)fail('Titlovi pripadaju zvučnom resursu.');let previous=0;for(const cue of r.cues){if(!keys(cue,['start','end','text'])||!Number.isFinite(cue.start)||!Number.isFinite(cue.end)||cue.start<previous||cue.end<=cue.start||cue.end>180||info.duration&&cue.end>info.duration+.05||typeof cue.text!=='string'||!cue.text.trim()||cue.text.length>400)fail('Titl treba valjano vrijeme i tekst, bez preklapanja.');previous=cue.end;}}
 }
 if(complete)for(const id of Object.keys(required.items))if(!ids.has(id))fail('Nedostaje datoteka resursa: '+id+'. Odaberi je u Draw biblioteci prije izvoza.');return bundle;
}
async function digest(data){if(!scope.crypto?.subtle)fail('Host nema provjeru integriteta resursa.');return [...new Uint8Array(await scope.crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function verify(bundle,required,options){validate(bundle,required,options);for(const r of bundle.items)if(await digest(bytes(r.data))!==r.sha256)fail('Integritet resursa nije potvrđen: '+r.id);return bundle;}
async function create({id,kind,mime,data,credit,license,cues}){const value=data instanceof Uint8Array?data:new Uint8Array(data);inspectBytes(value,mime);const row={id,kind,mime,bytes:value.length,sha256:await digest(value),data:encode(value),credit,license,...(cues?{cues}:{})};validate({format:FORMAT,items:[row]},{format:REQUIREMENTS,items:{[id]:{kind}}});return row;}
function pcmEffect(notes){
 if(!Array.isArray(notes)||!notes.length||notes.length>64)fail('Efekt treba1–64 note.');const rate=22050;let length=0;
 for(const n of notes){if(!keys(n,['frequency','duration','gain'])||![n.frequency,n.duration,n.gain].every(Number.isFinite)||n.frequency<20||n.frequency>10000||n.duration<.02||n.duration>2||n.gain<0||n.gain>.8)fail('Neispravna nota efekta.');length+=Math.round(n.duration*rate);}if(length>rate*12)fail('Generisani efekt traje do12 sekundi.');
 const out=new Uint8Array(44+length*2),v=new DataView(out.buffer),text=(at,s)=>{for(let i=0;i<s.length;i++)out[at+i]=s.charCodeAt(i);};text(0,'RIFF');v.setUint32(4,out.length-8,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,length*2,true);let at=0;
 for(const n of notes){const count=Math.round(n.duration*rate);for(let i=0;i<count;i++){const envelope=Math.min(1,i/(rate*.01),(count-i)/(rate*.03)),value=Math.sin(2*Math.PI*n.frequency*i/rate)*n.gain*envelope;v.setInt16(44+(at++)*2,Math.round(Math.max(-1,Math.min(1,value))*32767),true);}}return out;
}
scope.CLEA7Resources=Object.freeze({FORMAT,REQUIREMENTS,MAX_ITEM,MAX_TOTAL,MAX_APP,MIME,safe,bytes,encode,inspectBytes,requirements,validate,verify,create,pcmEffect,digest});
})(globalThis);
