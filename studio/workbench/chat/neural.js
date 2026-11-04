'use strict';
/* Original CLEA conditional autoregressive neural decoder, by Brzo i Lokalno.
 * Uses the project's own small trained parameters. No framework, model/API
 * download, eval, network, DOM, host permission or external script execution.
 * Domain/factual policy belongs to the separately enforced CLEA Runtime.
 */
(function(scope){
const FORMAT='clea7.neural-chat/1',ARCH='conditional-tanh-rnn/1';
const RESERVED=['<pad>','<bos>','<eos>','<unk>','<bs>','<en>'];
const clock=()=>scope.performance?.now?.()??Date.now();
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function stopped(signal){if(signal?.aborted){const error=new Error('Neural generation cancelled.');error.name='AbortError';throw error;}}
function tokenize(text){return text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]/gu)||[];}
function detokenize(words){return words.join(' ').replace(/\s+([.,!?;:%)])/g,'$1').replace(/([(])\s+/g,'$1');}
function stable(value,depth=0){
 if(depth>24)fail('ModelLimit','Model metadata exceeds nesting limit.');
 if(value===null||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))fail('ModelData','Model requires finite numbers.');return JSON.stringify(value);}
 if(typeof value==='string')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(v=>stable(v,depth+1)).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k],depth+1)).join(',')+'}';
 fail('ModelData','Model accepts plain JSON data only.');
}
async function digest(bytes){if(!scope.crypto?.subtle?.digest)fail('Unavailable','Model verification requires Web Crypto.');const result=await scope.crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(result),n=>n.toString(16).padStart(2,'0')).join('');}
function base64(text,expected){
 if(typeof text!=='string'||text.length!==4*Math.ceil(expected/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))fail('ModelWeights','Invalid bounded weight encoding.');
 const binary=scope.atob(text);if(binary.length!==expected)fail('ModelWeights','Wrong weight byte length.');
 const bytes=new Uint8Array(expected);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;
}
function create(source){
 if(!source||source.format!==FORMAT||source.architecture!==ARCH||source.version!=='0.1.0')fail('ModelVersion','Unsupported original neural model format.');
 const dims=source.dimensions,V=dims?.vocabulary,D=dims?.embedding,H=dims?.hidden;
 if(!Number.isSafeInteger(V)||V<8||V>2048||!Number.isSafeInteger(D)||D<8||D>64||!Number.isSafeInteger(H)||H<8||H>192)fail('ModelLimit','Model dimensions exceed supported bounds.');
 const vocabulary=source.tokenizer?.vocabulary?.slice();
 if(source.tokenizer?.kind!=='nfkc-lower-unicode-words-punctuation/1'||!Array.isArray(vocabulary)||vocabulary.length!==V||new Set(vocabulary).size!==V||vocabulary.some(t=>typeof t!=='string'||!t.length||t.length>100)||RESERVED.some((t,i)=>vocabulary[i]!==t))fail('ModelTokenizer','Invalid trained vocabulary.');
 if(source.tokenizer.pad!==0||source.tokenizer.bos!==1||source.tokenizer.eos!==2||source.tokenizer.unk!==3||source.tokenizer.languages?.bs!==4||source.tokenizer.languages?.en!==5)fail('ModelTokenizer','Invalid special-token contract.');
 if(source.limits?.inputCharacters!==1200||source.limits?.questionTokens!==48||source.limits?.outputTokens!==48)fail('ModelLimit','Unrecognized model resource policy.');
 if(!/^[a-f0-9]{64}$/.test(source.modelFingerprint))fail('ModelIntegrity','Missing model fingerprint.');
 const shapes={Q:[V,D],E:[V,D],Wq:[D,H],bq:[H],Wx:[D,H],Wh:[H,H],Wc:[D,H],bh:[H],Wo:[H,V],bo:[V]};
 if(Object.keys(source.weights||{}).sort().join('|')!==Object.keys(shapes).sort().join('|'))fail('ModelWeights','Unexpected model parameter names.');
 const weights={},raw=[],digests=[];let parameterCount=0,weightBytes=0;
 for(const [name,shape]of Object.entries(shapes)){
  const entry=source.weights[name],count=shape.reduce((a,b)=>a*b,1);
  if(entry.encoding!=='base64-f32le'||stable(entry.shape)!==stable(shape)||!/^[a-f0-9]{64}$/.test(entry.sha256))fail('ModelWeights','Invalid parameter schema: '+name);
  const bytes=base64(entry.data,count*4),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),value=new Float32Array(count);
  for(let i=0;i<count;i++){value[i]=view.getFloat32(i*4,true);if(!Number.isFinite(value[i])||Math.abs(value[i])>100)fail('ModelWeights','Invalid finite parameter: '+name);}
  weights[name]=value;raw.push(bytes);digests.push(entry.sha256);parameterCount+=count;weightBytes+=bytes.length;
 }
 if(parameterCount>500000||source.training?.parameterCount!==parameterCount||source.training?.externalWeights!==false||source.training?.network!==false||source.training?.vocabularyUsesHeldout!==false||source.training?.weightUpdatesUseHeldout!==false)fail('ModelProvenance','Invalid declared original-training contract.');
 const fingerprint=source.modelFingerprint,index=new Map(vocabulary.map((w,i)=>[w,i]));
 let canonical=stable(Object.fromEntries(Object.entries(source).filter(([key])=>key!=='modelFingerprint')));
 if(canonical.length>4*1048576)fail('ModelLimit','Model exceeds its metadata/weight budget.');
 const description=Object.freeze({format:FORMAT,version:'0.1.0',name:String(source.name),architecture:ARCH,modelFingerprint:fingerprint,
  dimensions:Object.freeze({vocabulary:V,embedding:D,hidden:H}),parameterCount,weightBytes,
  training:Object.freeze(JSON.parse(JSON.stringify(source.training))),privacy:Object.freeze({network:false,externalWeights:false,automaticLearning:false}),
  scope:'Small original CLEA domain language model; not a general or frontier model.'});
 let verification=null;
 function verify(){if(!verification)verification=(async()=>{for(let i=0;i<raw.length;i++)if(await digest(raw[i])!==digests[i])fail('ModelIntegrity','Parameter hash verification failed.');if(await digest(new TextEncoder().encode(canonical))!==fingerprint)fail('ModelIntegrity','Original model fingerprint differs.');raw.length=0;digests.length=0;canonical=null;return true;})();return verification;}
 function prepare(question,language='bs'){
  if(typeof question!=='string'||!question.trim()||question.length>1200)fail('Input','Question requires 1–1200 characters.');
  if(!['bs','en'].includes(language))fail('InputLanguage','Choose supported explicit output language.');
  const words=tokenize(question);if(words.length>47)fail('InputLimit','Question exceeds 47 content tokens.');
  const ids=[language==='bs'?4:5,...words.map(word=>index.get(word)??3)],context=new Float64Array(D);
  let unknown=0;for(const id of ids){if(id===3)unknown++;for(let d=0;d<D;d++)context[d]+=weights.Q[id*D+d]/ids.length;}
  const hidden=new Float64Array(H);for(let h=0;h<H;h++){let value=weights.bq[h];for(let d=0;d<D;d++)value+=context[d]*weights.Wq[d*H+h];hidden[h]=Math.tanh(value);}
  return {ids,context,hidden,unknown};
 }
 function step(context,hidden,previous){
  if(!Number.isInteger(previous)||previous<0||previous>=V||context.length!==D||hidden.length!==H)fail('ModelState','Invalid bounded decoder state.');
  const next=new Float64Array(H),logits=new Float64Array(V);
  for(let h=0;h<H;h++){let value=weights.bh[h];for(let d=0;d<D;d++)value+=weights.E[previous*D+d]*weights.Wx[d*H+h]+context[d]*weights.Wc[d*H+h];for(let j=0;j<H;j++)value+=hidden[j]*weights.Wh[j*H+h];next[h]=Math.tanh(value);}
  for(let v=0;v<V;v++){let value=weights.bo[v];for(let h=0;h<H;h++)value+=next[h]*weights.Wo[h*V+v];logits[v]=value;}
  return {hidden:next,logits};
 }
 async function generate(question,options={}){
  const started=clock();stopped(options.signal);await verify();stopped(options.signal);
  const maximum=options.maxTokens===undefined?48:options.maxTokens;
  if(!Number.isInteger(maximum)||maximum<1||maximum>48)fail('OutputLimit','Output requires 1–48 tokens.');
  const initial=prepare(question,options.language||'bs'),result=[];let hidden=initial.hidden,previous=1,finished=false,logp=0;
  for(let t=0;t<maximum;t++){
   stopped(options.signal);const state=step(initial.context,hidden,previous);hidden=state.hidden;
   for(const id of [0,1,3,4,5])state.logits[id]=-1e9;
   let best=0;for(let v=1;v<V;v++)if(state.logits[v]>state.logits[best])best=v;
   let total=0;for(let v=0;v<V;v++)total+=Math.exp(state.logits[v]-state.logits[best]);logp-=Math.log(total);
   previous=best;result.push(best);finished=best===2;
   if(typeof options.onToken==='function')options.onToken(Object.freeze({id:best,token:vocabulary[best],index:t,finished}));
   if(finished)break;
   // Cooperative cancellation on a worker/CPU host; not a claim of an OS sandbox.
   if(t%4===3)await new Promise(resolve=>setTimeout(resolve,0));
  }
  const count=result.length;
  return {text:detokenize(result.filter(id=>id!==2).map(id=>vocabulary[id])),tokens:result,finished,modelFingerprint:fingerprint,
   metrics:{steps:count,inputTokens:initial.ids.length,unknownTokens:initial.unknown,multiplyAdds:D*H+count*(2*D*H+H*H+H*V),
    elapsedMs:Math.max(0,clock()-started),meanLogProbability:logp/Math.max(1,count)}};
 }
 // These bounded numeric snapshots support independent forward parity tests.
 function inspect(question,{language='bs',previous=1}={}){const initial=prepare(question,language),next=step(initial.context,initial.hidden,previous);return {questionIds:initial.ids,context:Array.from(initial.context),initialHidden:Array.from(initial.hidden),nextHidden:Array.from(next.hidden),logits:Array.from(next.logits)};}
 return Object.freeze({generate,verify,describe:()=>description,inspect});
}
scope.CLEA7NeuralChat=Object.freeze({FORMAT,ARCH,create,tokenize,detokenize});
})(globalThis);
