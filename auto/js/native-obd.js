/* Original CLEA Auto Android transport boundary. Fixed ELM requests only.
 * Native events belong to a particular connect request, never to the next car. */
import {READ_COMMANDS} from './diagnostics.js';
const brokers=new WeakMap();
const clean=(s,max=240)=>String(s??'').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max);
const error=(message,name='Error')=>Object.assign(new Error(message),{name});
export function hasNativeOBD(scope=globalThis){return scope.location?.origin==='https://clea.auto.local'&&typeof scope.CleaAutoNative?.postMessage==='function';}
function broker(scope){
 if(brokers.has(scope))return brokers.get(scope);
 const b={pending:new Map(),owner:null,session:null,sequence:0};
 scope.__cleaAutoNativeResponse=message=>{
  try{
   const m=typeof message==='string'?JSON.parse(message):message;
   if(!m||Object.getPrototypeOf(m)!==Object.prototype||m.v!==1||JSON.stringify(m).length>32768)return;
   if(m.event){
    if(!b.owner||m.session!==b.session)return;
    if(m.event==='data'&&typeof m.text==='string'&&m.text.length<=8192)b.owner.data(m.text);
    if(m.event==='closed')b.owner.closed(error(clean(m.message)||'Android je zatvorio vezu.'));
    return;
   }
   const p=b.pending.get(m.id);if(!p)return;
   b.pending.delete(m.id);clearTimeout(p.timer);
   if(p.generation!==p.owner.generation)return p.reject(error('Ranija veza je otkazana.','AbortError'));
   if(m.ok===true)p.resolve(m);else p.reject(error(clean(m.message)||'Android nije izvršio zahtjev.',clean(m.name,60)||'Error'));
  }catch{/* Invalid native payloads cannot become adapter data. */}
 };
 brokers.set(scope,b);return b;
}
export function createNativeOBDTransport({scope=globalThis,chooserTimeoutMs=90000,writeTimeoutMs=8000}={}){
 let receive=()=>{},onClose=()=>{},generation=0,connected=false,currentSession=null;
 const b=broker(scope),host=scope.CleaAutoNative;
 const owner={get generation(){return generation;},data:text=>receive(text),closed:e=>{const was=b.owner===owner;cancel(e);if(was)onClose(e);}};
 const timeout=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||max));
 function cancel(reason=error('Android veza je otkazana.','AbortError')){
  generation++;connected=false;
  for(const [id,p]of b.pending)if(p.owner===owner){b.pending.delete(id);clearTimeout(p.timer);p.reject(reason);}
  if(b.owner===owner){b.owner=null;b.session=null;}
 }
 function send(op,command,ms){
  if(!hasNativeOBD(scope))return Promise.reject(error('Android Bluetooth Classic priključak dostupan je samo u CLEA Auto Android paketu.'));
  const id='clea-'+Date.now().toString(36)+'-'+(++b.sequence),g=generation;
  if(op==='connect'){currentSession=id;b.owner=owner;b.session=id;}
  const payload={v:1,id,op,...(command?{command}:{}),...(op!=='connect'&&currentSession?{session:currentSession}:{})};
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{if(!b.pending.has(id))return;b.pending.delete(id);reject(error('Android veza nije odgovorila unutar dozvoljenog vremena.','TimeoutError'));transport.disconnect();},ms);
   b.pending.set(id,{owner,generation:g,timer,resolve,reject});
   try{host.postMessage(JSON.stringify(payload));}catch(e){b.pending.delete(id);clearTimeout(timer);reject(e);}
  });
 }
 const transport={
  source:'obd-serial',
  subscribe(callback,closed){if(typeof callback!=='function')throw error('Nedostaje prijemnik ELM podataka.');receive=callback;onClose=typeof closed==='function'?closed:()=>{};return()=>{receive=()=>{};onClose=()=>{};};},
  async connect(){
   if(b.owner&&b.owner!==owner)throw error('Druga CLEA sesija već koristi Android adapter.');
   const result=await send('connect',null,timeout(chooserTimeoutMs,20,180000));
   if(b.owner!==owner||result.id!==currentSession)throw error('Android povezivanje je otkazano.','AbortError');
   if(result.info?.profileId!=='elm-android-spp/1')throw error('Android je vratio nepodržan ELM profil.');
   connected=true;return{name:clean(result.info.name)||'Odabrani ELM adapter',profile:'Android Bluetooth Classic SPP',profileId:'elm-android-spp/1'};
  },
  async write(text){
   if(!connected||b.owner!==owner)throw error('Android adapter nije povezan.');
   if(typeof text!=='string'||!text.endsWith('\r')||!READ_COMMANDS.includes(text.slice(0,-1)))throw error('Dozvoljene su samo fiksne ELM naredbe očitavanja.');
   await send('write',text.slice(0,-1),timeout(writeTimeoutMs,20,15000));
  },
  disconnect(){
   const session=currentSession;currentSession=null;const owns=b.owner===owner;
   cancel();
   if(owns&&hasNativeOBD(scope))try{host.postMessage(JSON.stringify({v:1,id:'stop-'+(++b.sequence),op:'disconnect',session}));}catch{}
  }
 };
 return transport;
}
