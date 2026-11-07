/* BL CLEA AI shared transport. No CV/project access, persistent history or tools.
 * Public endpoint comes only from the same-origin owner deployment file.
 * Model responses are data; callers must render them with textContent.
 */
'use strict';
(()=>{
 const source=new URL(document.currentScript.src),configURL=new URL('clea-ai-config.json',source);
 let configurationPromise,widgetPromise;
 const errors={not_configured:'Javni BL CLEA AI još nije povezan. Nema slanja poruka.',
  offline:'BL CLEA AI server trenutno nije dostupan. Pokušaj kasnije.',
  busy:'BL CLEA AI odgovara drugom korisniku. Sačekaj pa pošalji ponovo.',
  rate_limit:'Dosegnuto je ograničenje zahtjeva. Sačekaj prije novog pitanja.',
  session_required:'Sesija je istekla. Ponovo pošalji pitanje za novu potvrdu pristupa.',
  challenge_failed:'Potvrda pristupa nije uspjela. Pokušaj ponovo.',
  invitation_required:'Za ovaj razgovor otvori privatni link koji si dobio iz CLEA aplikacije.',
  invitation_used:'Privatna pozivnica je dosegnula broj probnih sesija.',
  preview_expired:'Privremena veza je završena. Lokalni CLEA razgovor na HP-u ostaje dostupan.',
  invalid_request:'Poruka ili historija prelazi podržane granice.',
  timeout:'Vrijeme čekanja je isteklo. Zahtjev nije automatski ponovljen.',
  cancelled:'Čekanje je zaustavljeno. Server može završiti već započetu obradu.',
  identity:'Adresa nije potvrdila ovaj BL CLEA AI server. Slanje je zaustavljeno.'};
 function fail(code){const error=new Error(errors[code]||errors.offline);error.code=code;return error;}
 function validConfig(value){
  if(!value||value.schema!=='clea7.web-ai/1'||typeof value.enabled!=='boolean'||typeof value.previewOnly!=='boolean')throw fail('not_configured');
  if(value.endpoint===null){if(value.enabled||value.previewOnly)throw fail('not_configured');return Object.freeze({...value});}
  const url=new URL(value.endpoint);
  if(value.authentication==='desktop-loopback'){
   if(!value.enabled||value.previewOnly||value.local!==true||url.origin!==location.origin||url.origin!==value.endpoint||
      url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password||
      !/^[a-f0-9]{32}$/.test(value.deploymentId))throw fail('not_configured');
   return Object.freeze({...value});
  }
  if(value.authentication==='owner-invite'){
   if(value.enabled||!value.previewOnly||url.origin!==location.origin||url.protocol!=='https:'||url.origin!==value.endpoint||
      !/^[a-z0-9-]+\.trycloudflare\.com$/.test(url.hostname)||!/^[a-f0-9]{32}$/.test(value.deploymentId)||
      !Number.isInteger(value.previewSecondsRemaining)||value.previewSecondsRemaining<1||value.previewSecondsRemaining>3600)throw fail('not_configured');
   return Object.freeze({...value});
  }
  if(value.authentication==='tunnel-email'){
   if(value.enabled||!value.previewOnly||url.origin!==location.origin||url.protocol!=='https:'||url.origin!==value.endpoint||
      !/^[a-z0-9-]+\.trycloudflare\.com$/.test(url.hostname)||!/^[a-f0-9]{32}$/.test(value.deploymentId)||
      !Number.isInteger(value.previewEndsAtUnix)||value.previewEndsAtUnix*1000<=Date.now())throw fail('not_configured');
   return Object.freeze({...value});
  }
  if(url.protocol!=='https:'||url.origin!==value.endpoint||url.username||url.password||url.port||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(url.hostname)||
    !/^[a-f0-9]{32}$/.test(value.deploymentId)||!/^[A-Za-z0-9_-]{10,200}$/.test(value.turnstileSiteKey)||
    value.publicHTTPSHealthVerified!==true||value.enabled&&value.phoneConversationVerified!==true)throw fail('not_configured');
  return Object.freeze({...value});
 }
 async function readJSON(response){
  if(Number(response.headers.get('Content-Length')||0)>32768)throw fail('invalid_request');
  let raw='';
  if(response.body?.getReader){
   const reader=response.body.getReader(),chunks=[];let bytes=0;
   try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>32768){await reader.cancel();throw fail('invalid_request');}chunks.push(part.value);}}
   finally{reader.releaseLock();}
   const merged=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.length;}raw=new TextDecoder('utf-8',{fatal:true}).decode(merged);
  }else{raw=await response.text();if(new TextEncoder().encode(raw).length>32768)throw fail('invalid_request');}
  try{return JSON.parse(raw);}catch{throw fail('invalid_request');}
 }
 async function request(url,{body,signal,token}={}){
  const headers={};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;
  const response=await fetch(url,{method:body===undefined?'GET':'POST',mode:'cors',credentials:new URL(url).origin===location.origin&&location.hostname.endsWith('.trycloudflare.com')?'same-origin':'omit',
   redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',headers,body:body===undefined?undefined:JSON.stringify(body),signal});
  const value=await readJSON(response);
  if(!response.ok)throw fail(response.status===429?(value.code==='busy'?'busy':'rate_limit'):response.status===401?'session_required':
   ['challenge_failed','invitation_required','invitation_used','preview_expired'].includes(value.code)?value.code:'offline');
  return value;
 }
 async function streamRequest(url,{body,signal,token,onDelta=()=>{}}){
  const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
  const response=await fetch(url,{method:'POST',mode:'cors',credentials:new URL(url).origin===location.origin&&location.hostname.endsWith('.trycloudflare.com')?'same-origin':'omit',
   redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',headers,body:JSON.stringify(body),signal});
  if(!response.ok){const value=await readJSON(response);throw fail(response.status===429?(value.code==='busy'?'busy':'rate_limit'):response.status===401?'session_required':'offline');}
  if(!response.headers.get('Content-Type')?.startsWith('text/event-stream')||!response.body?.getReader)throw fail('invalid_request');
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let buffer='',total=0,reply='',done=null;
  function frame(raw){
   let kind='',data='';for(const line of raw.split('\n')){if(line.startsWith('event:'))kind=line.slice(6).trim();else if(line.startsWith('data:'))data+=line.slice(5).trimStart();}
   if(!data)return;let value;try{value=JSON.parse(data);}catch{throw fail('invalid_request');}
   if(kind==='error')throw fail(value.code||'offline');
   if(kind==='delta'){
    if(done||typeof value.text!=='string'||reply.length+value.text.length>5000)throw fail('invalid_request');
    reply+=value.text;onDelta(value.text,reply);
   }else if(kind==='done'){
    if(done||!reply.trim()||value.reply!==reply)throw fail('invalid_request');done=value;
   }else if(!['meta','heartbeat'].includes(kind))throw fail('invalid_request');
  }
  try{
   while(!done){
    const chunk=await reader.read();if(chunk.done){buffer+=decoder.decode();break;}
    total+=chunk.value.byteLength;if(total>200000)throw fail('invalid_request');
    buffer=(buffer+decoder.decode(chunk.value,{stream:true})).replace(/\r\n/g,'\n');
    if(buffer.length>32768)throw fail('invalid_request');
    let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){frame(buffer.slice(0,boundary));buffer=buffer.slice(boundary+2);if(done)break;}
   }
   if(!done)throw fail('offline');return done;
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 }
 async function configuration(){
  if(!configurationPromise)configurationPromise=request(configURL,{signal:AbortSignal.timeout(5000)}).then(validConfig).catch(error=>{configurationPromise=null;throw error.code?error:fail('not_configured');});
  return configurationPromise;
 }
 function loadWidget(){
  if(globalThis.turnstile?.render)return Promise.resolve();
  if(!widgetPromise)widgetPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
   const timer=setTimeout(()=>{script.remove();widgetPromise=null;reject(fail('challenge_failed'));},15000);
   script.onload=()=>{clearTimeout(timer);if(globalThis.turnstile?.render)resolve();else{widgetPromise=null;reject(fail('challenge_failed'));}};
   script.onerror=()=>{clearTimeout(timer);widgetPromise=null;script.remove();reject(fail('challenge_failed'));};document.head.append(script);
  });
  return widgetPromise;
 }
 async function challenge(mount,sitekey,signal){
  if(!mount)throw fail('challenge_failed');
  await loadWidget();if(signal.aborted)throw fail('cancelled');
  return new Promise((resolve,reject)=>{
   let id,done=false;mount.hidden=false;
   function finish(error,token){if(done)return;done=true;signal.removeEventListener('abort',abort);if(id!==undefined)globalThis.turnstile.remove(id);mount.replaceChildren();mount.hidden=true;error?reject(error):resolve(token);}
   const abort=()=>finish(fail('cancelled'));signal.addEventListener('abort',abort,{once:true});
   try{id=globalThis.turnstile.render(mount,{sitekey,action:'clea_chat',theme:'auto',
    callback:token=>typeof token==='string'&&token.length<=2048?finish(null,token):finish(fail('challenge_failed')),
    'error-callback':()=>finish(fail('challenge_failed')),'expired-callback':()=>finish(fail('challenge_failed')),
    'timeout-callback':()=>finish(fail('challenge_failed'))});}
   catch{finish(fail('challenge_failed'));}
  });
 }
 function create({challengeMount,onStatus=()=>{}}={}){
  let history=[],session=null,expires=0,controller=null,local=false,epoch=0;
  let invitation=/^#invite=([A-Za-z0-9_-]{43})$/.exec(location.hash)?.[1]||null;
  function reset(){epoch++;history=[];session=null;expires=0;controller?.abort();}
  function useLocal(value){if(controller)throw fail('busy');reset();local=value===true;}
  async function target(){
   if(local)return {endpoint:'http://127.0.0.1:8765',local:true};
   const config=await configuration(),preview=config.previewOnly===true&&(config.authentication==='owner-invite'||new URL(location.href).searchParams.get('clea-verify')===config.deploymentId);
   if(!config.enabled&&!preview)throw fail('not_configured');
   return config;
  }
  async function health(config,signal){
   const status=await request(config.endpoint+'/health',{signal});
   if(status.brand!=='BL CLEA AI'||status.apiVersion!=='clea7.public-ai/1'||status.mode!==(config.local?'local':'public')||
     config.deploymentId&&status.deploymentId!==config.deploymentId)throw fail('identity');
   if(status.ready!==true)throw fail('offline');
   if(config.modelProfile?.id&&status.modelProfile?.id!==config.modelProfile.id)throw fail('identity');
   return status;
  }
  function issuedSession(issued){
   if(!/^[A-Za-z0-9_-]{43}$/.test(issued.session)||!Number.isInteger(issued.expiresIn)||issued.expiresIn<1||issued.expiresIn>1800)throw fail('identity');
   session=issued.session;expires=Date.now()+issued.expiresIn*1000-5000;
  }
  async function inviteSession(config,signal){
   if(session&&Date.now()<expires)return;
   try{issuedSession(await request(config.endpoint+'/session',{signal}));}
   catch(error){
    if(error.code!=='session_required')throw error;
    if(!invitation)throw fail('invitation_required');
    issuedSession(await request(config.endpoint+'/session',{body:{invite:invitation},signal}));
   }
   if(/^#invite=/.test(location.hash))globalThis.history.replaceState(null,'',location.pathname+location.search);
  }
  async function check(){
   const config=await target(),signal=AbortSignal.timeout(10000);
   if(config.authentication==='owner-invite')await inviteSession(config,signal);
   return health(config,signal);
  }
  async function ask(question,{onDelta=()=>{}}={}){
   if(controller)throw fail('busy');
   if(typeof question!=='string'||!question.trim()||question.length>1200)throw fail('invalid_request');
   const ticket=epoch;controller=new AbortController();const signal=controller.signal;
   let timeout=false;const timer=setTimeout(()=>{timeout=true;controller?.abort();},315000);
   try{
    const config=await target(),modelStatus=await health(config,signal);
    if(config.authentication==='owner-invite')await inviteSession(config,signal);
    else if(!config.local&&(!session||Date.now()>=expires)){
     onStatus('Potvrdi pristup. Pitanje se još ne šalje modelu.');
     const proof=config.authentication==='tunnel-email'?
      (await request(config.endpoint+'/preview-challenge',{signal})).challenge:
      await challenge(challengeMount,config.turnstileSiteKey,signal);
     const issued=await request(config.endpoint+'/session',{body:{challenge:proof},signal});
     issuedSession(issued);
    }
    onStatus(config.local?'Model odgovara na ovom uređaju…':'BL CLEA AI obrađuje tvoje pitanje…');
    const body={question:question.trim(),history:history.slice(-8)};
    if(new TextEncoder().encode(JSON.stringify(body)).length>16384)throw fail('invalid_request');
    const data=modelStatus.streaming===true?
     await streamRequest(config.endpoint+'/chat/stream',{body,signal,token:config.local?null:session,onDelta:(delta,reply)=>{if(signal.aborted||ticket!==epoch)throw fail('cancelled');onDelta(delta,reply);}}):
     await request(config.endpoint+'/chat',{body,signal,token:config.local?null:session});
    if(typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>5000)throw fail('invalid_request');
    if(signal.aborted||ticket!==epoch)throw fail('cancelled');
    history.push({role:'user',content:body.question},{role:'assistant',content:data.reply.slice(0,1200)});history=history.slice(-8);
    return {reply:data.reply,sources:Array.isArray(data.sources)?data.sources.slice(0,5):[],transport:config.local?'local':'hp'};
   }catch(error){if(error.code==='session_required'){session=null;expires=0;}throw timeout?fail('timeout'):signal.aborted?fail('cancelled'):error.code?error:fail('offline');}
   finally{clearTimeout(timer);controller=null;}
  }
  async function startPhoneShare(){
   const config=await target();
   if(config.authentication!=='desktop-loopback')throw fail('not_configured');
   const data=await request(config.endpoint+'/share',{body:{},signal:AbortSignal.timeout(120000)});
   const url=new URL(data.url);
   if(url.protocol!=='https:'||url.username||url.password||url.port||!/^[a-z0-9-]+\.trycloudflare\.com$/.test(url.hostname)||
      url.pathname!=='/razgovor/'||url.search||!/^#invite=[A-Za-z0-9_-]{43}$/.test(url.hash)||
      !Number.isInteger(data.secondsRemaining)||data.secondsRemaining<1||data.secondsRemaining>2700)throw fail('identity');
   return data;
  }
  function restoreHistory(items){
   if(controller||!Array.isArray(items)||items.length>24||items.length%2)throw fail('invalid_request');
   const checked=items.map((item,index)=>{
    if(!item||item.role!==(index%2?'assistant':'user')||typeof item.content!=='string'||!item.content.trim()||item.content.length>1200)throw fail('invalid_request');
    return {role:item.role,content:item.content};
   });
   history=checked;return history.map(x=>({...x}));
  }
  return Object.freeze({ask,check,reset,useLocal,startPhoneShare,restoreHistory,history:()=>history.map(x=>({...x})),cancel:()=>controller?.abort(),get busy(){return controller!==null;}});
 }
 function isRuntimeHost(config){return !!config&&['owner-invite','desktop-loopback','tunnel-email'].includes(config.authentication);}
 globalThis.CLEA7AI=Object.freeze({create,configuration,isRuntimeHost});
})();
