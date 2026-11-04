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
  invalid_request:'Poruka ili historija prelazi podržane granice.',
  timeout:'Vrijeme čekanja je isteklo. Zahtjev nije automatski ponovljen.',
  cancelled:'Čekanje je zaustavljeno. Server može završiti već započetu obradu.',
  identity:'Adresa nije potvrdila ovaj BL CLEA AI server. Slanje je zaustavljeno.'};
 function fail(code){const error=new Error(errors[code]||errors.offline);error.code=code;return error;}
 function validConfig(value){
  if(!value||value.schema!=='clea7.web-ai/1'||typeof value.enabled!=='boolean'||typeof value.previewOnly!=='boolean')throw fail('not_configured');
  if(value.endpoint===null){if(value.enabled||value.previewOnly)throw fail('not_configured');return Object.freeze({...value});}
  const url=new URL(value.endpoint);
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
  const response=await fetch(url,{method:body===undefined?'GET':'POST',mode:'cors',credentials:'omit',
   redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',headers,body:body===undefined?undefined:JSON.stringify(body),signal});
  const value=await readJSON(response);
  if(!response.ok)throw fail(response.status===429?(value.code==='busy'?'busy':'rate_limit'):response.status===401?'session_required':value.code==='challenge_failed'?'challenge_failed':'offline');
  return value;
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
  function reset(){epoch++;history=[];session=null;expires=0;controller?.abort();}
  function useLocal(value){if(controller)throw fail('busy');reset();local=value===true;}
  async function target(){
   if(local)return {endpoint:'http://127.0.0.1:8765',local:true};
   const config=await configuration(),preview=config.previewOnly===true&&new URL(location.href).searchParams.get('clea-verify')===config.deploymentId;
   if(!config.enabled&&!preview)throw fail('not_configured');
   return config;
  }
  async function health(config,signal){
   const status=await request(config.endpoint+'/health',{signal});
   if(status.brand!=='BL CLEA AI'||status.apiVersion!=='clea7.public-ai/1'||status.mode!==(config.local?'local':'public')||
     !config.local&&status.deploymentId!==config.deploymentId)throw fail('identity');
   if(status.ready!==true)throw fail('offline');
   return status;
  }
  async function check(){const config=await target();return health(config,AbortSignal.timeout(5000));}
  async function ask(question){
   if(controller)throw fail('busy');
   if(typeof question!=='string'||!question.trim()||question.length>1200)throw fail('invalid_request');
   const ticket=epoch;controller=new AbortController();const signal=controller.signal;
   let timeout=false;const timer=setTimeout(()=>{timeout=true;controller?.abort();},100000);
   try{
    const config=await target();await health(config,signal);
    if(!config.local&&(!session||Date.now()>=expires)){
     onStatus('Potvrdi pristup. Pitanje se još ne šalje modelu.');
     const proof=await challenge(challengeMount,config.turnstileSiteKey,signal);
     const issued=await request(config.endpoint+'/session',{body:{challenge:proof},signal});
     if(!/^[A-Za-z0-9_-]{43}$/.test(issued.session)||!Number.isInteger(issued.expiresIn)||issued.expiresIn<1||issued.expiresIn>1800)throw fail('identity');
     session=issued.session;expires=Date.now()+issued.expiresIn*1000-5000;
    }
    onStatus(config.local?'Model odgovara na ovom uređaju…':'BL CLEA AI na HP serveru obrađuje tvoje pitanje…');
    const body={question:question.trim(),history:history.slice(-8)};
    if(new TextEncoder().encode(JSON.stringify(body)).length>16384)throw fail('invalid_request');
    const data=await request(config.endpoint+'/chat',{body,signal,token:config.local?null:session});
    if(typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>5000)throw fail('invalid_request');
    if(signal.aborted||ticket!==epoch)throw fail('cancelled');
    history.push({role:'user',content:body.question},{role:'assistant',content:data.reply.slice(0,1200)});history=history.slice(-8);
    return {reply:data.reply,sources:Array.isArray(data.sources)?data.sources.slice(0,5):[],transport:config.local?'local':'hp'};
   }catch(error){if(error.code==='session_required'){session=null;expires=0;}throw timeout?fail('timeout'):signal.aborted?fail('cancelled'):error.code?error:fail('offline');}
   finally{clearTimeout(timer);controller=null;}
  }
  return Object.freeze({ask,check,reset,useLocal,cancel:()=>controller?.abort(),get busy(){return controller!==null;}});
 }
 globalThis.CLEA7AI=Object.freeze({create,configuration});
})();
