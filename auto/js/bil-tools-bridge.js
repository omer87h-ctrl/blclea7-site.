/* Original local boundary to the existing Brzo i Lokalno BIL compiler/runtime.
 * Application source is compiled by BIL, never evaluated as JavaScript. */
export const BIL_TOOL_RESULT_FORMAT='blclea.bil-tool-result/1';
const MAX_SOURCE_BYTES=32768,MAX_RESULT_BYTES=1048576;
const FORBIDDEN=new Set(['__proto__','constructor','prototype']);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const copy=x=>JSON.parse(JSON.stringify(x));
function fault(code,message,location=null){const e=new Error(message);e.name='BILToolsError';e.code=code;e.location=location;return e;}
function assert(ok,message,code='BIL_TOOLS_INPUT'){if(!ok)throw fault(code,message);}
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));}
function inspect(value){
 const stack=[{value,depth:0}],seen=new Set();let nodes=0;
 while(stack.length){const {value:v,depth}=stack.pop();assert(++nodes<=2000&&depth<=16,'BIL ulaz premašuje dozvoljenu složenost.');
  if(v===null||typeof v==='boolean')continue;
  if(typeof v==='string'){assert(new TextEncoder().encode(v).length<=MAX_SOURCE_BYTES,'BIL tekst premašuje 32 KiB.');continue;}
  if(typeof v==='number'){assert(Number.isFinite(v)&&Math.abs(v)<=1e15,'BIL zahtijeva konačan broj unutar ±10^15.');continue;}
  assert(Array.isArray(v)||plain(v),'BIL granica prihvata samo obične podatke.');assert(!seen.has(v),'Ciklični ili dijeljeni izvršni objekti nisu dozvoljeni.');seen.add(v);
  const keys=Reflect.ownKeys(v);assert(keys.length<=65,'Previše BIL ulaznih polja.');
  for(const key of keys){if(Array.isArray(v)&&key==='length')continue;assert(typeof key==='string'&&!FORBIDDEN.has(key),'Nedozvoljeno BIL ime polja.');const d=Object.getOwnPropertyDescriptor(v,key);assert(d&&'value'in d&&d.enumerable,'Pristupnici i skrivena polja nisu dozvoljeni.');stack.push({value:d.value,depth:depth+1});}
 }
}
export function validateBILToolInput(payload){
 inspect(payload);assert(plain(payload),'Potreban je BIL radni zahtjev.');
 for(const k of Object.keys(payload))assert(['source','inputs','event','mode'].includes(k),'Nepodržano polje BIL radnog zahtjeva.');
 assert(typeof payload.source==='string'&&payload.source.trim().length>0&&new TextEncoder().encode(payload.source).length<=MAX_SOURCE_BYTES,'BIL izvor mora imati od 1 do 32 KiB.');
 const inputs=payload.inputs??{};assert(plain(inputs)&&Object.keys(inputs).length<=16,'Dozvoljeno je najviše 16 izričitih ulaza.');
 for(const name of Object.keys(inputs))assert(/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name)&&!FORBIDDEN.has(name),'Neispravno ime BIL ulaza.');
 const event=payload.event??null;assert(event===null||typeof event==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(event)&&!FORBIDDEN.has(event)&&event!=='main','Neispravno ime BIL događaja.');
 assert(event!==null||Object.keys(inputs).length===0,'Mjerni ulazi zahtijevaju izričit BIL događaj koji obrađuje ulaze.');
 const mode=payload.mode??'LIVE';assert(mode==='LIVE'||mode==='SHADOW','Dozvoljeni režimi su LIVE i SHADOW.');
 return {source:payload.source,inputs:copy(inputs),event,mode};
}
function validateCompiled(compiled){
 const ir=compiled.ir;
 assert(ir.format==='bil.ir/1'&&!ir.remote&&!ir.events&&!ir.ui,'Ovaj mjerni laboratorij podržava BIL Core i namjere prikaza; udaljeni/native zahtjevi, pretplate i cijeli aplikacijski ekrani zahtijevaju puni Studio.', 'BIL_TOOLS_CAPABILITY');
 assert(!ir.controls.length,'Aplikacijske tipke uređuju se u punom Studiju; laboratorij izvršava izričito odabrani događaj.','BIL_TOOLS_CAPABILITY');
 assert(ir.imports.every(x=>['math','text','collections'].includes(x)),'Modul nije dozvoljen u lokalnom mjernom laboratoriju.','BIL_TOOLS_CAPABILITY');
 const pending=[ir.main,...Object.values(ir.handlers),...Object.values(ir.functions).map(f=>f.body)];let nodes=0;
 while(pending.length){const list=pending.pop();for(const n of list){assert(++nodes<=8000,'BIL postupak je previše složen.','BIL_TOOLS_CAPABILITY');assert(!['REQUEST','WATCH','UNWATCH','UI_EVENT','NAVIGATE'].includes(n.op),'Ova BIL operacija nije dozvoljena u mjernom laboratoriju.','BIL_TOOLS_CAPABILITY');for(const key of ['body','then','otherwise','recover'])if(n[key])pending.push(n[key]);}}
 return ir;
}
/** Pure executable boundary. The trusted original compiler/runtime must already
 * be loaded in this realm. Each call owns a fresh state; no prior state is read. */
export async function executeBILTool(payload,{compiler=globalThis.CLEA7BIL,runtime=globalThis.CLEA7BILRuntime}={}){
 const input=validateBILToolInput(payload);
 assert(compiler?.compile&&runtime?.execute,'Izvorni BIL kompajler i Runtime nisu učitani.','BIL_TOOLS_UNAVAILABLE');
 const compiled=compiler.compile(input.source),ir=validateCompiled(compiled);
 if(input.event!==null)assert(own(ir.handlers,input.event),'Događaj nije definisan u BIL izvoru.','BIL_TOOLS_EVENT');
 for(const [name,value]of Object.entries(input.inputs)){
  assert(own(ir.globals,name)&&ir.globals[name].mutable,'Ulaz mora biti izričito deklarisana promjenjiva BIL vrijednost: '+name+'.','BIL_TOOLS_TYPE');
  runtime.bounded(value);assert(runtime.isType(value,ir.globals[name].type),'Tip mjernog ulaza ne odgovara BIL deklaraciji: '+name+'.','BIL_TOOLS_TYPE');
 }
 const options={ai:null,consent:false,reality:input.mode,stepLimit:10000,timeLimit:2000,capabilities:{renderers:['counter','text','status','progress'],motion:false,reducedMotion:true}};
 const initial=await runtime.execute(ir,'main',compiled.application.state,options);
 const state=copy(initial.state);
 for(const [name,value]of Object.entries(input.inputs))state.bilValues[name]=copy(value);
 const final=input.event===null?initial:await runtime.execute(ir,input.event,state,options);
 runtime.validateState(ir,final.state);
 const trace=[...initial.trace.map(x=>({...x,phase:'main'})),...(input.event===null?[]:final.trace.map(x=>({...x,phase:input.event})))];
 const values=copy(final.state.bilValues),views=final.state.bilViews.filter(v=>!v.hidden).map(v=>({id:v.id,name:v.target,kind:v.renderer,value:copy(values[v.target]),range:copy(v.range),motion:v.motion===true}));
 const out={format:BIL_TOOL_RESULT_FORMAT,mode:input.mode,values,views,trace,decisions:trace.filter(x=>x.kind==='decision'),metrics:{instructions:initial.instructions+(input.event===null?0:final.instructions),ms:initial.ms+(input.event===null?0:final.ms),initialInstructions:initial.instructions},sourceMap:copy(compiled.sourceMap)};
 assert(new TextEncoder().encode(JSON.stringify(out)).length<=MAX_RESULT_BYTES,'Rezultat BIL postupka premašuje 1 MiB.','BIL_TOOLS_BUDGET');
 return out;
}
/** One trusted Worker per explicit operation. Timeout/Stop terminates that worker;
 * it is defense in depth for the restricted interpreter, not a JS-code sandbox. */
export class BILToolsBridge{
 constructor({workerFactory=url=>new Worker(url),timeoutMs=6000}={}){this.workerFactory=workerFactory;this.timeoutMs=Math.max(50,Math.min(10000,Number(timeoutMs)||6000));this.active=null;}
 cancel(){this.active?.cancel();}
 dispose(){this.cancel();}
 run(payload,{signal}={}){
  let input;try{input=validateBILToolInput(payload);}catch(error){return Promise.reject(error);}
  this.cancel();if(signal?.aborted)return Promise.reject(fault('BIL_TOOLS_ABORT','BIL postupak je zaustavljen.'));
  return new Promise((resolve,reject)=>{
   let worker,done=false,timer;const operation={cancel:()=>finish(reject,fault('BIL_TOOLS_ABORT','BIL postupak je zaustavljen.'))};
   const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',operation.cancel);try{worker?.terminate();}catch{}if(this.active===operation)this.active=null;fn(value);};
   this.active=operation;signal?.addEventListener('abort',operation.cancel,{once:true});
   try{
    worker=this.workerFactory(new URL('./bil-tools-worker.js',import.meta.url));
    worker.onmessage=event=>{const data=event.data;if(!data||data.protocol!=='blclea.bil-worker/1')return finish(reject,fault('BIL_TOOLS_PROTOCOL','Neispravan odgovor BIL radnika.'));
     if(data.ok){if(data.result?.format!==BIL_TOOL_RESULT_FORMAT)return finish(reject,fault('BIL_TOOLS_PROTOCOL','Nepodržana verzija BIL rezultata.'));finish(resolve,data.result);}
     else{const e=fault(data.error?.code||'BIL_TOOLS_RUNTIME',data.error?.message||'BIL postupak nije uspio.',data.error?.location??null);if(Array.isArray(data.error?.bilTrace))e.bilTrace=data.error.bilTrace;finish(reject,e);}
    };
    worker.onerror=event=>{event.preventDefault?.();finish(reject,fault('BIL_TOOLS_WORKER','BIL radnik se nije mogao izvršiti.'));};
    worker.onmessageerror=()=>finish(reject,fault('BIL_TOOLS_PROTOCOL','BIL odgovor nije moguće pročitati.'));
    timer=setTimeout(()=>finish(reject,fault('BIL_TOOLS_TIMEOUT','BIL postupak je prekoračio dozvoljeno vrijeme.')),this.timeoutMs);
    worker.postMessage({protocol:'blclea.bil-worker/1',payload:input});
   }catch(error){finish(reject,error);}
  });
 }
}
