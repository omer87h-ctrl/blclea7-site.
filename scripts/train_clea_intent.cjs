'use strict';
/* Original small intent-classifier training implementation, by Brzo i Lokalno.
 * No model download, network, private training data or external ML dependency.
 * This learns a narrow classifier. It does not train a language/code model.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),CORPUS=path.join(ROOT,'sdk/examples/clea-ai/intent-corpus.json');
const LABELS=Object.freeze(['calculator.create','calculator.reset','unsupported']);
const CONFIG=Object.freeze({seed:71019,epochs:700,learningRate:1.8,l2:.0005,maxFeatures:512,maxCharacters:1200,maxTokens:96,confidence:.78,margin:.28,coverage:.45});
function normalize(text){return text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'dj').replace(/Đ/g,'dj').toLowerCase();}
function tokens(text){return normalize(text).match(/[a-z0-9]+/g)||[];}
function keys(words){const result=new Set();for(let i=0;i<words.length;i++){result.add('w:'+words[i]);if(i)result.add('b:'+words[i-1]+' '+words[i]);}return [...result];}
function softmax(scores){const max=Math.max(...scores),exps=scores.map(value=>Math.exp(value-max)),sum=exps.reduce((a,b)=>a+b,0);return exps.map(value=>value/sum);}
function vector(words,index){const found=[];for(const key of keys(words))if(index.has(key))found.push(index.get(key));found.sort((a,b)=>a-b);return {indices:found,scale:found.length?1/Math.sqrt(found.length):0};}
function probabilities(weights,feature){return softmax(weights.map(row=>{let score=row[0];for(const index of feature.indices)score+=row[index+1]*feature.scale;return score;}));}
function select(values){let best=0;for(let i=1;i<values.length;i++)if(values[i]>values[best])best=i;return best;}
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}';return JSON.stringify(value);}
function digest(value){return crypto.createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');}
function corpusCheck(corpus){
 if(!corpus||corpus.format!=='clea.intent.corpus/1'||!Array.isArray(corpus.examples)||corpus.examples.length<30||corpus.examples.length>1000)throw Error('Invalid bounded original corpus.');
 const seen=new Set(),counts={train:[0,0,0],heldout:[0,0,0]};
 for(const row of corpus.examples){if(!row||!LABELS.includes(row.label)||!['train','heldout'].includes(row.split)||typeof row.text!=='string'||row.text.length<3||row.text.length>CONFIG.maxCharacters||tokens(row.text).length>CONFIG.maxTokens)throw Error('Invalid corpus example.');const normalized=normalize(row.text).trim();if(seen.has(normalized))throw Error('Duplicate corpus example.');seen.add(normalized);counts[row.split][LABELS.indexOf(row.label)]++;}
 if(Object.values(counts).some(values=>values.some(count=>count<5)))throw Error('Each fixed split requires all labels.');return counts;
}
function evaluate(weights,examples){let correct=0,loss=0;const confusion=LABELS.map(()=>LABELS.map(()=>0));for(const example of examples){const p=probabilities(weights,example.feature),predicted=select(p);correct+=predicted===example.target;loss-=Math.log(Math.max(1e-15,p[example.target]));confusion[example.target][predicted]++;}return {examples:examples.length,correct,accuracy:correct/examples.length,crossEntropy:loss/examples.length,confusion};}
function train(corpus){
 const counts=corpusCheck(corpus),frequencies=new Map();
 for(const row of corpus.examples.filter(row=>row.split==='train'))for(const key of keys(tokens(row.text)))frequencies.set(key,(frequencies.get(key)||0)+1);
 const vocabulary=[...frequencies].filter(([key,count])=>key.startsWith('w:')||count>=2).sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0)).slice(0,CONFIG.maxFeatures).map(([key])=>key),index=new Map(vocabulary.map((key,i)=>[key,i]));
 const examples=corpus.examples.map(row=>({...row,target:LABELS.indexOf(row.label),feature:vector(tokens(row.text),index)})),training=examples.filter(row=>row.split==='train'),heldout=examples.filter(row=>row.split==='heldout');
 let state=CONFIG.seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const weights=LABELS.map(()=>Array.from({length:vocabulary.length+1},()=>((random()-.5)*.01))),initial=weights.map(row=>row.slice()),before={train:evaluate(weights,training),heldout:evaluate(weights,heldout)};
 for(let epoch=0;epoch<CONFIG.epochs;epoch++){
  const gradient=weights.map(row=>row.map(()=>0));
  for(const example of training){const p=probabilities(weights,example.feature);for(let c=0;c<LABELS.length;c++){const error=(p[c]-(c===example.target?1:0))/training.length;gradient[c][0]+=error;for(const f of example.feature.indices)gradient[c][f+1]+=error*example.feature.scale;}}
  const rate=CONFIG.learningRate/(1+.5*epoch/CONFIG.epochs);for(let c=0;c<LABELS.length;c++)for(let i=0;i<weights[c].length;i++)weights[c][i]-=rate*(gradient[c][i]+(i?CONFIG.l2*weights[c][i]:0));
 }
 const quantized=weights.map(row=>row.map(value=>Number(value.toFixed(7)))),after={train:evaluate(quantized,training),heldout:evaluate(quantized,heldout)},parameterDelta=weights.reduce((sum,row,c)=>sum+row.reduce((n,value,i)=>n+Math.abs(value-initial[c][i]),0),0);
 const model={format:'clea.intent.linear/1',version:'0.1.0',labels:LABELS.slice(),vocabulary,weights:quantized,configuration:{...CONFIG},corpusSha256:digest(corpus),training:{algorithm:'full-batch softmax cross-entropy gradient descent with L2',originalSyntheticCorpus:true,splitPolicy:corpus.splitPolicy,counts,initial:before,trained:after,parameterDelta:Number(parameterDelta.toFixed(7)),sampleGradientEvaluations:training.length*CONFIG.epochs,parameterUpdates:LABELS.length*(vocabulary.length+1)*CONFIG.epochs}};
 model.modelFingerprint=digest(model);return model;
}
function createPredictor(model){
 const labels=model.labels.slice(),index=new Map(model.vocabulary.map((key,i)=>[key,i])),known=new Set(model.vocabulary.filter(key=>key.startsWith('w:')).map(key=>key.slice(2))),config=model.configuration;
 const serializedModelBytes=typeof TextEncoder==='function'?new TextEncoder().encode(JSON.stringify(model)).length:JSON.stringify(model).length;
 const clock=()=>typeof performance==='object'&&typeof performance.now==='function'?performance.now():Date.now();
 const rounded=value=>Number(value.toFixed(7));
 function predict(text){
  if(typeof text!=='string'){const error=new TypeError('Intent input must be Text.');error.code='IntentInput';throw error;}
  const started=clock(),metric={inputCharacters:text.length,processedCharacters:0,tokenCount:0,activeFeatures:0,multiplyAdds:0,serializedModelBytes};
  const result=(reason,rawLabel='unsupported',p=null,coverage=0)=>Object.freeze({format:'clea.intent.prediction/1',label:reason?'unsupported':rawLabel,suggestedLabel:rawLabel,confidence:p?rounded(Math.max(...p)):0,coverage:rounded(coverage),abstain:!!reason,reason:reason||'trained-supported-intent',version:model.version,modelFingerprint:model.modelFingerprint,probabilities:Object.freeze(Object.fromEntries(labels.map((label,i)=>[label,p?rounded(p[i]):0]))),metrics:Object.freeze({...metric,elapsedMs:Math.max(0,clock()-started)})});
  if(!text.trim())return result('empty-input');if(text.length>config.maxCharacters)return result('input-limit');
  const words=tokens(text);metric.processedCharacters=text.length;metric.tokenCount=words.length;if(words.length>config.maxTokens)return result('token-limit');if(!words.length)return result('no-supported-text');
  const unique=[...new Set(words)],coverage=unique.filter(word=>known.has(word)).length/unique.length,feature=vector(words,index);metric.activeFeatures=feature.indices.length;metric.multiplyAdds=feature.indices.length*labels.length;
  const p=probabilities(model.weights,feature),winner=select(p),label=labels[winner],ordered=p.slice().sort((a,b)=>b-a),normal=normalize(text);
  // Policy gates are explicit non-learned limits on this tiny classifier's
  // supported task domain. They are not an authorization or security sandbox.
  const negation=/(?:\bdo not|\bdon't|\bnever|\bnemoj|\bne)\s+(?:create|build|make|add|reset|dodaj|dodavati|kreiraj|kreirati|napravi|napraviti)/.test(normal);
  const forbidden=new Set(['shell','terminal','secrets','password','passwords','lozinka','lozinke','racune','accounts','bluetooth','video','videos','integral','integrals','integrale','scientific','naucni','trigonometry','currency','valuta','valute','matrices','matrix']);
  const unsafe=words.some(word=>forbidden.has(word))||words.some(word=>['delete','deleting','obrisi','brisati'].includes(word))&&words.some(word=>['files','datoteke','projects','projekte'].includes(word));
  const networkAction=words.some(word=>['upload','uploads','send','posalji','slanje','povezi','connect'].includes(word))&&words.some(word=>['server','cloud','api','internet'].includes(word));
  if(negation||unsafe||networkAction)return result('outside-supported-task',label,p,coverage);
  if(label==='unsupported')return result('unsupported-intent',label,p,coverage);
  if(coverage<config.coverage)return result('low-vocabulary-coverage',label,p,coverage);
  if(ordered[0]<config.confidence||ordered[0]-ordered[1]<config.margin)return result('uncertain-intent',label,p,coverage);
  const arithmetic=words.some(word=>/^(calculator|kalkulator|arithmeti|aritmeti|math|matemati|racunan|sabir|oduzim|mnoz|dijel|adding|subtract)/.test(word));
  const reset=words.some(word=>/^(reset|restart|clear|ponist|ocist|cisc|nulu|nula)/.test(word)),object=words.some(word=>/^(calculator|kalkulator|button|dugm|taster|input|field|polj|value|vrijednost|broj|unos|screen|ekran|control|kontrol)/.test(word));
  if(label==='calculator.create'&&!arithmetic||label==='calculator.reset'&&(!reset||!object))return result('missing-task-evidence',label,p,coverage);
  return result(null,label,p,coverage);
 }
 const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
 const information=freeze({format:'clea.intent.model-info/1',name:'CLEA Intent Micro',version:model.version,modelFingerprint:model.modelFingerprint,kind:'learned bounded intent classifier; not a language or code-generation model',labels:labels.slice(),parameterCount:model.weights.reduce((n,row)=>n+row.length,0),featureCount:model.vocabulary.length,serializedModelBytes,limits:{maxCharacters:config.maxCharacters,maxTokens:config.maxTokens,minimumConfidence:config.confidence,minimumCoverage:config.coverage},training:JSON.parse(JSON.stringify(model.training)),corpusSha256:model.corpusSha256,privacy:{network:false,externalWeights:false,onlineLearning:false,userInputsUsedForTraining:false},memoryAccounting:'Serialized model bytes only; not OS or JavaScript heap measurement.',evaluationScope:'Fixed small original synthetic corpus; not a real-world accuracy or security guarantee.'});
 return Object.freeze({version:model.version,modelFingerprint:model.modelFingerprint,predict,describe:()=>information});
}
function build(corpus){
 const model=train(corpus),runtimeFunctions=[normalize,tokens,keys,softmax,vector,probabilities,select,createPredictor].map(fn=>fn.toString()).join('\n');
 const source="'use strict';\n/* CLEA Intent Micro — original local trained classifier, by Brzo i Lokalno.\n * Generated reproducibly by scripts/train_clea_intent.cjs from the original\n * synthetic corpus. No external weights, network or automatic online learning.\n * Closed supported intents only; never an executor or a general LLM. */\n(function(scope){\nconst model="+JSON.stringify(model)+";\n"+runtimeFunctions+"\nscope.CLEA7LocalIntentModel=createPredictor(model);\n})(globalThis);\n";
 return {model,source};
}
function main(){
 const args=process.argv.slice(2),corpus=JSON.parse(fs.readFileSync(CORPUS,'utf8')),started=performance.now(),result=build(corpus),report={format:'clea.intent.training-report/1',version:result.model.version,modelFingerprint:result.model.modelFingerprint,corpusSha256:result.model.corpusSha256,training:result.model.training,moduleBytes:Buffer.byteLength(result.source),elapsedMs:performance.now()-started};
 const output=args.indexOf('--output');if(output>=0){const destination=path.resolve(args[output+1]||'');if(fs.existsSync(destination)&&!args.includes('--replace'))throw Error('Output exists; use --replace for an explicit regenerated model.');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,result.source);report.output=destination;}
 if(args.includes('--check')){const destination=path.join(ROOT,'web/workbench/clea-intent-model.js');if(fs.readFileSync(destination,'utf8')!==result.source)throw Error('Bundled model differs from deterministic original-corpus training.');report.reproducible=true;}
 console.log(JSON.stringify(report,null,2));
}
module.exports={LABELS,CONFIG,normalize,tokens,keys,vector,probabilities,train,createPredictor,build,corpusCheck};
if(require.main===module)try{main();}catch(error){console.error(error.message);process.exitCode=1;}
