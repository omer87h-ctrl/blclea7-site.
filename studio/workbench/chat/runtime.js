'use strict';
/* Original CLEA conversation host. Existing Kernel + BIL Core remain in charge.
 * Neural generation, factual fallback and cache reuse have distinct results.
 */
(function(scope){
const FORMAT='clea7.chat/1',VERSION='0.20.0-test',A=scope.CLEA7ChatAssets;
const scriptBase=typeof document!=='undefined'&&document.currentScript?new URL('.',document.currentScript.src).href:null;
const clone=x=>JSON.parse(JSON.stringify(x)),clock=()=>performance.now(),normal=text=>text.normalize('NFKC').toLowerCase();
const words=text=>normal(text).match(/[\p{L}\p{N}_]+/gu)||[];
const canonical=text=>normal(text).match(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]/gu)?.join(' ')||'';
const STOP=new Set('a an the i you is are can what how does do me my please tell about it and to in on for of with will why who this that explain mi me li je su se sta šta što kako koji koja koje o u na za sa i ili da od to ovaj tome molim reci objasni može moze možeš mozes'.split(' '));
const POLICY='let promptChars = 0\nlet turns = 0\nlet outputLimit = 48\nlet approved = false\non check {\n if promptChars < 1 { raise "ChatInput", "Pitanje je prazno." }\n if promptChars > 1200 { raise "ChatBudget", "Pitanje prelazi 1200 znakova." }\n if turns > 12 { raise "ChatBudget", "Previše aktivnog konteksta." }\n if outputLimit > 48 { raise "ChatBudget", "Odgovor prelazi budžet." }\n approved = true\n}\n';
function abortError(){const e=new Error('Razgovorni zadatak je otkazan.');e.name='AbortError';return e;}
function fault(code,text){return A.fault(code,text);}
function checkedKnowledge(value){
 if(value?.format!=='clea.conversation.knowledge-contract/1'||value.heldoutPromptsIncluded!==false||!Array.isArray(value.topics)||value.topics.length<1||value.topics.length>64)throw fault('Knowledge','Nepodržana verzija provjerene baze.');
 const ids=new Set();for(const topic of value.topics){if(typeof topic.id!=='string'||!/^[a-z][a-z0-9_]{0,60}$/.test(topic.id)||ids.has(topic.id)||!['bs','en'].every(lang=>typeof topic.answers?.[lang]==='string'&&topic.answers[lang].length>0&&topic.answers[lang].length<1200)||!Array.isArray(topic.aliases)||topic.aliases.length>64||!Array.isArray(topic.routingExamples)||topic.routingExamples.length>64||!Array.isArray(topic.sources)||topic.sources.some(x=>typeof x!=='string'||x.length>180||x.includes('..')||!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(md|js|py)$/.test(x)))throw fault('Knowledge','Neispravni podaci provjerene teme.');ids.add(topic.id);}
 return value;
}
function routeIndex(contract){
 const rows=contract.topics.map(topic=>{const terms=new Set(words(topic.aliases.join(' ')+' '+topic.routingExamples.map(e=>e.text).join(' ')).filter(w=>!STOP.has(w)));return {topic,terms};}),frequency=new Map();
 for(const row of rows)for(const word of row.terms)frequency.set(word,(frequency.get(word)||0)+1);
 return {rows,weight:word=>Math.log(1+rows.length/(frequency.get(word)||rows.length)),known:new Set(frequency.keys())};
}
function route(text,index,lastTopic){
 const query=normal(text),queryWords=' '+words(text).join(' ')+' ',tokens=[...new Set(words(text).filter(w=>!STOP.has(w)))];
 if(/^(?:please\s+)?(?:write|create|make|build|generate|execute|run|delete|napravi|kreiraj|izradi|izvrši|pokreni|obriši)\b/u.test(query)||/\b(?:can|could|would) you (?:write|create|make|build|execute|run)\b/u.test(query))return null;
 if(/^(više|vise|nastavi|dalje|more|continue|tell me more)[.!? ]*$/.test(query)&&lastTopic){const old=index.rows.find(r=>r.topic.id===lastTopic);const next=old?.topic.related?.[0];const chosen=index.rows.find(r=>r.topic.id===next);if(chosen)return {topic:chosen.topic,contextUsed:true,effectiveQuestion:chosen.topic.routingExamples.find(x=>x.language==='bs')?.text||chosen.topic.aliases[0],reason:'explicit-related-follow-up'};}
 if(!tokens.length)return null;
 const ranked=index.rows.map(row=>{let score=0,overlap=0;for(const word of tokens)if(row.terms.has(word)){score+=index.weight(word);overlap++;}const aliases=row.topic.aliases.filter(alias=>queryWords.includes(' '+words(alias).join(' ')+' ')).sort((a,b)=>b.length-a.length);if(aliases[0])score+=2+words(aliases[0]).length;return {row,score,overlap,anchor:aliases[0]||null};}).sort((a,b)=>b.score-a.score||a.row.topic.id.localeCompare(b.row.topic.id));
 const top=ranked[0],known=tokens.filter(w=>index.known.has(w)).length;if(!top||top.overlap===0||known/tokens.length<.34||top.score<1.5||!top.anchor&&ranked[1]&&top.score-ranked[1].score<.25)return null;
 return {topic:top.row.topic,contextUsed:false,effectiveQuestion:text,reason:top.anchor?'documented-topic-alias':'training-only-term-index',score:top.score};
}
function workerTransport(base,onLoad){
 let worker=null,sequence=0,pending=null,description=null;
 const stop=()=>{worker?.terminate();worker=null;description=null;const task=pending;pending=null;if(task){clearTimeout(task.timer);task.reject(abortError());}};
 function send(type,data,onToken){return new Promise((resolve,reject)=>{
  if(pending){reject(fault('Busy','Model već obrađuje pitanje.'));return;}
  if(!worker){if(typeof Worker!=='function'){reject(fault('WorkerUnavailable','Ovaj preglednik nema podržan radnik za model.'));return;}worker=new Worker(A.local('worker.js',base));worker.onmessage=event=>{const r=event.data;if(r?.format!=='clea7.chat.worker/1')return;if(r.type==='loading'){try{onLoad?.({bytes:r.bytes,total:r.total});}catch{}return;}const task=pending;if(!task||r.id!==task.id)return;if(r.type==='token'){if(Number.isInteger(r.index)&&r.index>=0&&r.index<48)task.onToken?.({index:r.index,finished:r.finished===true});return;}clearTimeout(task.timer);pending=null;if(r.type==='ready'){description=r.description;task.resolve(description);}else if(r.type==='result')task.resolve(r.result);else task.reject(fault(String(r.code||'Worker'),String(r.message||'Model nije završio odgovor.')));};worker.onerror=event=>{event.preventDefault?.();const task=pending;pending=null;worker?.terminate();worker=null;description=null;if(task){clearTimeout(task.timer);task.reject(fault('WorkerFailure','Radnik modela je zaustavljen; razgovor nije promijenjen.'));}};}
  const id='chat_'+(++sequence);const timer=setTimeout(()=>{const task=pending;if(task?.id===id){pending=null;worker?.terminate();worker=null;description=null;task.reject(fault('Timeout','Model je prešao 20 sekundi; prethodni razgovor je sačuvan.'));}},20000);pending={id,timer,resolve,reject,onToken};worker.postMessage({format:'clea7.chat.worker/1',id,type,...data});
 });}
 return {initialize:()=>description?Promise.resolve(description):send('initialize',{}),generate:async(question,options)=>{await (description?Promise.resolve():send('initialize',{}));return send('generate',{question,language:options.language},options.onToken);},cancel:stop,close:stop};
}
function create(options={}){
 if(!scope.CLEA7||!scope.CLEA7Core||!scope.CLEA7CACI)throw fault('CoreUnavailable','CLEA Runtime, BIL Core i CACI moraju biti učitani.');
 const scopeId='chat_'+(scope.crypto?.randomUUID?.()||String(Date.now())),kernel=new scope.CLEA7.Runtime({vault:new scope.CLEA7.MemoryVault(),budget:0,workers:1}),cache=scope.CLEA7CACI.create({scope:scopeId,memoryBytes:65536,persistentBytes:0,storage:false});
 const policy=scope.CLEA7Core.compile(POLICY,{id:'clea_chat_policy',name:'CLEA razgovorni ugovor'}),base=options.assetBase||scriptBase;
 let manifest=null,knowledge=null,index=null,description=null,initializing=null,initController=null,initEpoch=0,history=[],lastTopic=null,active=null,generation=0,closed=false;
 const transport=options.transport||workerTransport(base,progress=>options.onLoading?.(progress));
 const notify=(pillar,state,detail,metrics={})=>{kernel.event(active?.id||'',pillar,detail);const event={pillar,state,detail,metrics,time:clock()};try{options.onEvent?.(clone(event));}catch{}return event;};
 const cancelled=token=>{if(closed||token!==generation||active?.cancelled)throw abortError();};
 async function initialize(){
  if(closed)throw fault('Closed','Razgovorni Runtime je zatvoren.');if(description)return description;if(initializing)return initializing;
  const epoch=initEpoch,controller=new AbortController();initController=controller;let timedOut=false;
  const timer=setTimeout(()=>{if(epoch===initEpoch&&!description){timedOut=true;controller.abort();transport.cancel?.();}},20000);
  const work=(async()=>{manifest=A.manifest(options.manifest||(await A.read(A.local('manifest.json',base),16384,null,null,{signal:controller.signal})).value);knowledge=checkedKnowledge(options.knowledge||(await A.read(A.local(manifest.knowledge.path,base),131072,manifest.knowledge,null,{signal:controller.signal})).value);index=routeIndex(knowledge);const info=await transport.initialize();if(closed||epoch!==initEpoch||controller.signal.aborted)throw abortError();if(info?.format!=='clea7.neural-chat/1'||info.modelFingerprint!==manifest.modelFingerprint||info.parameterCount!==manifest.training.parameterCount||info.architecture!==manifest.architecture||!Number.isInteger(info.dimensions?.vocabulary)||info.dimensions.vocabulary<8||info.dimensions.vocabulary>2048||!Number.isInteger(info.dimensions?.embedding)||info.dimensions.embedding<8||info.dimensions.embedding>64||!Number.isInteger(info.dimensions?.hidden)||info.dimensions.hidden<8||info.dimensions.hidden>192||info.weightBytes!==info.parameterCount*4)throw fault('ModelContract','Model ne odgovara objavljenom CLEA ugovoru.');description=clone(info);notify('Expansion Q','ready','Registrovan vlastiti verzionisani neuralni dekoder; provjereni model i baza.',{parameterCount:info.parameterCount,weightBytes:info.weightBytes});return clone(info);})();
  const interrupted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(abortError()),{once:true}));
  const shared=Promise.race([work,interrupted]);initializing=shared;
  try{return await shared;}catch(error){if(timedOut)throw fault('InitializationTimeout','Model nije učitan i provjeren u 20 sekundi. Pokušaj ponovo.');throw error;}
  finally{clearTimeout(timer);if(initializing===shared){initializing=null;initController=null;}}
 }
 async function policyCheck(prompt){let state=(await scope.CLEA7Core.execute(policy.ir,'main',policy.application.state)).state;state.bilValues.promptChars=prompt.length;state.bilValues.turns=Math.min(12,history.length/2);state.bilValues.outputLimit=48;const checked=await scope.CLEA7Core.execute(policy.ir,'check',state);if(checked.state.bilValues.approved!==true)throw fault('Policy','BIL ugovor nije odobrio zahtjev.');return checked.instructions;}
 async function calculate(prompt,language){
  const match=normal(prompt).match(/^(?:(?:koliko je|izracunaj|izračunaj|calculate|what is)\s+)?([+-]?\d{1,9}(?:\.\d{1,6})?)\s*([+*/-])\s*([+-]?\d{1,9}(?:\.\d{1,6})?)\s*[?=]?$/);if(!match)return null;
  const source='let result = '+match[1]+' '+match[2]+' '+match[3]+'\nshow result\n',program=scope.CLEA7Core.compile(source,{id:'chat_arithmetic',name:'CLEA razgovorni proračun'});const executed=await scope.CLEA7Core.execute(program.ir,'main',program.application.state);const result=executed.state.bilValues.result;
  if(!Number.isFinite(result))throw fault('Arithmetic','Proračun nije dao konačan broj.');return {text:language==='en'?'The result is '+result+'.':'Rezultat je '+result+'.',value:result,instructions:executed.instructions};
 }
 async function produce(question,language,token,onToken,useCache){
  const started=clock();await initialize();cancelled(token);const instructions=await policyCheck(question);cancelled(token);notify('Core AI Manager','checked','Stvarni BIL ugovor provjerio je ulaz i granice zadatka.',{instructions});
  if(/\b(sedam|seven|7)\b/u.test(normal(question))&&/stub|pillar/u.test(normal(question))){
   const entries=scope.CLEA7.PILLARS.map(([name,purpose],i)=>(i+1)+'. '+name+' — '+purpose);
   notify('Link Bridge Elite','introspected','Pročitan je stvarni registar sedam Runtime odgovornosti.');
   return {format:FORMAT,text:(language==='en'?'The seven Runtime responsibilities: ':'Sedam Runtime odgovornosti: ')+entries.join('; ')+'.',mode:'runtime-contract',modelUsed:false,topic:null,sources:['web/runtime.js'],metrics:{elapsedMs:clock()-started,tokens:0,instructions},traceReason:'actual-runtime-pillar-registry'};
  }
  const math=await calculate(question,language);cancelled(token);if(math){notify('Link Bridge Elite','completed','Proračun je prošao stvarni BIL kompajler i Core.',{instructions:math.instructions});return {format:FORMAT,text:math.text,mode:'bil',modelUsed:false,topic:null,metrics:{elapsedMs:clock()-started,instructions:math.instructions,tokens:0},sources:[],traceReason:'typed-bil-calculation'};}
  const routed=route(question,index,lastTopic);notify('Link Bridge Elite','routed','Tipizirani zahtjev povezan je s provjerenom temom ili označen kao nepodržan.',{topic:routed?.topic.id||null,contextUsed:routed?.contextUsed||false});
  if(!routed){notify('Fallback Executor','abstained','Nema dovoljno podržanog znanja; model ne dobija pravo da izmisli odgovor.');return {format:FORMAT,text:language==='en'?'I do not have verified knowledge for that question. This early CLEA model currently covers CLEA platform topics.':'Za ovo pitanje nemam provjereno znanje. Ovaj rani CLEA model trenutno obrađuje teme o CLEA platformi.',mode:'abstained',modelUsed:false,topic:null,sources:[],metrics:{elapsedMs:clock()-started,tokens:0},traceReason:'outside-verified-domain'};}
  const key={version:VERSION,model:manifest.modelFingerprint,knowledge:manifest.knowledge.sha256,question:routed.effectiveQuestion,language,lastTopic:routed.contextUsed?lastTopic:null},topic=routed.topic,expected=topic.answers[language];
  if(useCache){const retained=await cache.get('verified-answer',key);cancelled(token);if(retained.hit&&retained.value?.topic===topic.id&&retained.value.modelFingerprint===manifest.modelFingerprint&&['neural','grounded-fallback'].includes(retained.value.mode)&&canonical(retained.value.text)===canonical(expected)){notify('Vision Q','cache-hit','Ponovo korišten isti provjereni odgovor za model, bazu i kontekst.',{cacheHit:true});return {...clone(retained.value),mode:'cache',originalMode:retained.value.mode,modelUsed:false,metrics:{elapsedMs:clock()-started,tokens:0,cacheHit:true},traceReason:'exact-verified-result-reuse'};}}
  notify('Expansion Q','running','Pokrenut je vlastiti autoregresivni dekoder u odvojenom radniku.');
  const generated=await transport.generate(routed.effectiveQuestion,{language,onToken:step=>{cancelled(token);try{onToken?.(step);}catch{}}});cancelled(token);
  const dims=description.dimensions,steps=generated?.tokens?.length,metrics=generated?.metrics;
  const expectedCost=dims.embedding*dims.hidden+steps*(2*dims.embedding*dims.hidden+dims.hidden*dims.hidden+dims.hidden*dims.vocabulary);
  if(typeof generated?.text!=='string'||generated.text.length>3000||!Array.isArray(generated.tokens)||steps<1||steps>48||generated.tokens.some((id,at)=>!Number.isInteger(id)||id<2||id>=dims.vocabulary||[3,4,5].includes(id)||id===2&&at!==steps-1)||typeof generated.finished!=='boolean'||generated.finished!== (generated.tokens[steps-1]===2)||!generated.finished&&steps!==48||generated.modelFingerprint!==manifest.modelFingerprint||!Number.isInteger(metrics?.steps)||metrics.steps!==steps||!Number.isInteger(metrics?.multiplyAdds)||metrics.multiplyAdds!==expectedCost||!Number.isFinite(metrics?.elapsedMs)||metrics.elapsedMs<0||metrics.elapsedMs>20000||!Number.isFinite(metrics?.meanLogProbability)||metrics.meanLogProbability>1e-9||metrics.meanLogProbability < -1000||!Number.isInteger(metrics?.inputTokens)||metrics.inputTokens<1||metrics.inputTokens>48||!Number.isInteger(metrics?.unknownTokens)||metrics.unknownTokens<0||metrics.unknownTokens>metrics.inputTokens)throw fault('Bridge','Odgovor radnika ne zadovoljava tipizirani ugovor.');
  const verified=generated.finished===true&&canonical(generated.text)===canonical(expected);let text,mode;
  if(verified){text=generated.text.replace(/(^|[.!?]\s+)([\p{L}])/gu,(_,prefix,letter)=>prefix+letter.toUpperCase()).replace(/\bclea\b/gi,'CLEA').replace(/\bbil\b/gi,'BIL').replace(/\bcaci\b/gi,'CACI').replace(/\bsdk\b/gi,'SDK').replace(/\bram\b/gi,'RAM').replace(/\bcore ai manager\b/gi,'Core AI Manager').replace(/\blink bridge elite\b/gi,'Link Bridge Elite').replace(/\bexpansion q\b/gi,'Expansion Q').replace(/\badaptive recovery\b/gi,'Adaptive Recovery').replace(/\bholo interaction\b/gi,'Holo Interaction').replace(/\bfallback executor\b/gi,'Fallback Executor').replace(/\bvision q\b/gi,'Vision Q');mode='neural';notify('Adaptive Recovery','verified','Generisani odgovor odgovara provjerenoj činjenici odabrane teme.');}
  else{text=expected;mode='grounded-fallback';notify('Adaptive Recovery','rejected','Neuralni kandidat nije prošao provjeru sadržaja; nije potvrđen kao tačan.');notify('Fallback Executor','completed','Prikazan je odvojeno označen odgovor iz vlasnikove provjerene baze.');}
  const result={format:FORMAT,text,mode,modelUsed:true,modelFingerprint:manifest.modelFingerprint,topic:topic.id,sources:clone(topic.sources),related:clone(topic.related||[]),metrics:{...clone(generated.metrics),elapsedMs:clock()-started,cacheHit:false},validation:{neuralAnswerAccepted:verified,finished:generated.finished},traceReason:routed.reason};
  if(useCache)await cache.put('verified-answer',key,result);cancelled(token);notify('Vision Q','completed','Zabilježeni su stvarni neuralni koraci, trošak i način dobijanja konačnog odgovora.',{tokens:generated.tokens.length,multiplyAdds:generated.metrics.multiplyAdds,mode});return result;
 }
 kernel.attachAI({chat:async()=>{const job=active;if(!job)throw fault('Task','Razgovorni zadatak nije pripremljen.');const result=await produce(job.question,job.language,job.token,job.onToken,job.cacheEnabled);job.result=result;return result.text;}});
 async function ask(question,{language='bs',onToken,cacheEnabled=true}={}){
  if(closed)throw fault('Closed','Razgovorni Runtime je zatvoren.');if(active)throw fault('Busy','Sačekaj odgovor ili zaustavi trenutni zadatak.');if(typeof question!=='string'||!question.trim()||question.length>1200||!['bs','en'].includes(language))throw fault('Input','Pitanje treba imati 1–1200 znakova i podržan izlazni jezik.');
  const token=++generation,job={id:'turn_'+token,question:question.trim(),language,onToken,token,cacheEnabled};active=job;
  try{await kernel.runAI(scopeId,job.question);cancelled(token);const result=job.result;history.push({role:'user',content:job.question},{role:'assistant',content:result.text,mode:result.mode,topic:result.topic});history=history.slice(-24);if(result.topic)lastTopic=result.topic;notify('Holo Interaction','committed','Potpun odgovor potvrđen je u lokalnom razgovoru; nema automatskog slanja ni trajnog spremanja.');return clone(result);}
  catch(error){notify('Adaptive Recovery',error.name==='AbortError'?'cancelled':'failed','Zadatak nije upisan u historiju; prethodni razgovor ostaje sačuvan.');throw error;}
  finally{if(active===job)active=null;}
 }
 function cancel(){if(!active&&!initializing)return;if(active)active.cancelled=true;generation++;if(initializing&&!description){initEpoch++;initController?.abort();}transport.cancel?.();notify('Core AI Manager','cancelled','Zaustavljeno je stvarno generisanje u radniku.');}
 async function clear(){cancel();history=[];lastTopic=null;kernel.tasks=[];kernel.events=[];await cache.clear();notify('Adaptive Recovery','cleared','Uklonjeni su razgovor i njegov RAM cache; Studio projekti nisu dirani.');}
 function close(){if(closed)return;cancel();closed=true;transport.close?.();cache.close();kernel.close();history=[];lastTopic=null;}
 return Object.freeze({FORMAT,VERSION,initialize,ask,cancel,clear,clearCache:()=>cache.clear(),close,get history(){return clone(history);},get busy(){return !!active;},get description(){return description?clone(description):null;},get cacheStats(){return cache.stats();},get events(){return clone(kernel.events);},get tasks(){return kernel.tasks.map(x=>({id:x.id,name:x.name,state:x.state,duration:x.duration}));}});
}
scope.CLEA7Chat=Object.freeze({FORMAT,VERSION,POLICY,create,checkedKnowledge,routeIndex,route,canonical});
})(globalThis);
