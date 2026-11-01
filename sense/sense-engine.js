/* BL CLEA Sense — local evidence graph and controlled BIL policy execution.
 * Original code by Brzo i Lokalno. No network, telemetry, model or device API.
 * Matching hints are not proof of skill, truth, employability or hiring outcome.
 * User content is data, never BIL source or executable JavaScript. */
(function(scope){
'use strict';
const POLICY_SOURCE="# BL CLEA Sense — typed evidence policy, original code by Brzo i Lokalno.\n# No private source text, model inference, network operation or hiring probability.\nimport collections\nimport text\nrecord Requirement {\n id: Text,\n kind: Text,\n mandatory: Boolean,\n found: Boolean,\n negated: Boolean,\n ambiguous: Boolean,\n mismatch: Boolean,\n action: Boolean,\n confirmed: Boolean,\n denied: Boolean,\n uncertain: Boolean\n}\nrecord Finding { id: Text, status: Text, reason: Text }\nconst allowedKinds = [\"skills\", \"education\", \"certificates\", \"language\", \"experience\", \"deadlines\", \"attachments\", \"other\"]\nlet requirements: List<Requirement> = []\nconst noFindings: List<Finding> = []\nlet findings: List<Finding> = []\nlet total = 0\nlet supported = 0\nlet unconfirmed = 0\nlet notfound = 0\nlet contradicted = 0\nlet needsclarification = 0\nlet mandatory = 0\nlet mandatoryOpen = 0\n\nfn classify(item: Requirement) -> Finding {\n if item.denied {\n  return new Finding { id: item.id, status: \"contradicted\", reason: \"user_denied\" }\n }\n if item.uncertain {\n  return new Finding { id: item.id, status: \"needsclarification\", reason: \"user_uncertain\" }\n }\n if item.action {\n  if item.confirmed {\n   return new Finding { id: item.id, status: \"supported\", reason: \"action_confirmed\" }\n  } else {\n   return new Finding { id: item.id, status: \"needsclarification\", reason: \"action_requires_review\" }\n  }\n }\n if item.negated {\n  return new Finding { id: item.id, status: \"contradicted\", reason: \"explicit_negative_source\" }\n }\n if item.mismatch {\n  return new Finding { id: item.id, status: \"contradicted\", reason: \"explicit_level_or_duration_gap\" }\n }\n if item.ambiguous {\n  return new Finding { id: item.id, status: \"needsclarification\", reason: \"qualified_or_unclear_source\" }\n }\n if item.found {\n  if item.confirmed {\n   return new Finding { id: item.id, status: \"supported\", reason: \"source_and_user_confirmation\" }\n  } else {\n   return new Finding { id: item.id, status: \"unconfirmed\", reason: \"source_requires_confirmation\" }\n  }\n } else {\n  return new Finding { id: item.id, status: \"notfound\", reason: \"not_found_in_provided_cv\" }\n }\n}\n\non assess {\n guard collections.length(requirements) <= 64 else raise \"SenseBudget\", \"Sense accepts at most 64 requirements.\"\n findings = noFindings\n total = 0\n supported = 0\n unconfirmed = 0\n notfound = 0\n contradicted = 0\n needsclarification = 0\n mandatory = 0\n mandatoryOpen = 0\n for item in requirements {\n  guard collections.contains(allowedKinds, item.kind) else raise \"SenseKind\", \"Unknown requirement kind.\"\n  guard text.trim(item.id) != \"\" else raise \"SenseIdentity\", \"Requirement identity is required.\"\n  guard not item.confirmed or item.action or item.found else raise \"SenseEvidence\", \"Confirmation requires a source fact.\"\n  let finding = classify(item)\n  findings = collections.append(findings, finding)\n  total = total + 1\n  if finding.status == \"supported\" { supported = supported + 1 }\n  if finding.status == \"unconfirmed\" { unconfirmed = unconfirmed + 1 }\n  if finding.status == \"notfound\" { notfound = notfound + 1 }\n  if finding.status == \"contradicted\" { contradicted = contradicted + 1 }\n  if finding.status == \"needsclarification\" { needsclarification = needsclarification + 1 }\n  if item.mandatory {\n   mandatory = mandatory + 1\n   if finding.status != \"supported\" { mandatoryOpen = mandatoryOpen + 1 }\n  }\n }\n}\n";
const FORMAT='sense.report/1',PROJECT='blclea.sense.project/1';
const INTERNAL=new WeakMap();
const LIMITS=Object.freeze({cv:48000,job:24000,requirements:64,facts:256,project:180000});
const STATUSES=Object.freeze(['supported','unconfirmed','notfound','contradicted','needsclarification']);
const UNSAFE=new Set(['__proto__','prototype','constructor']);
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const fold=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'dj').replace(/Đ/g,'Dj').toLowerCase();
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
function error(code,message){const e=new Error(message);e.name='SenseError';e.code=code;return e;}
function record(x,label){if(!plain(x))throw error('Input',label+' mora biti običan zapis.');for(const k of Reflect.ownKeys(x)){const d=Object.getOwnPropertyDescriptor(x,k);if(typeof k!=='string'||UNSAFE.has(k)||!d||!('value'in d)||!d.enumerable)throw error('Input','Nedozvoljeno polje u podacima.');}return x;}
function text(x,max,label,empty=false){if(typeof x!=='string'||x.length>max||!empty&&!x.trim()||x.includes('\u0000'))throw error('Input',label+' mora sadržavati tekst do '+max.toLocaleString('bs-BA')+' znakova.');return x.replace(/\r\n?/g,'\n');}
function location(source,start,end){const before=source.slice(0,start),line=(before.match(/\n/g)||[]).length+1,column=start-(before.lastIndexOf('\n')+1)+1;return {start,end,line,column,text:source.slice(start,end)};}
function segments(source){
 const out=[];let start=0;const boundary=/[;\n]+|[.!?]\s+(?=[A-ZČĆĐŠŽ])|\s+(?:ali|but|međutim)\s+/gu;
 const add=end=>{const raw=source.slice(start,end),offset=raw.search(/\S/);if(offset>=0){const a=start+offset,b=end-raw.match(/\s*$/)[0].length;if(b>a)out.push(location(source,a,b));}};
 let m;while((m=boundary.exec(source))){add(m.index+(/^[.!?;]/.test(m[0])?1:0));start=m.index+m[0].length;}add(source.length);return out;
}
function contains(haystack,needle){return new RegExp('(^|[^\\p{L}\\p{N}])'+escape(fold(needle))+'(?=$|[^\\p{L}\\p{N}])','u').test(fold(haystack));}
function hasEntry(value,entry){return entry.aliases.some(alias=>contains(value,alias));}
const NEGATIVE=/\b(?:nemam|nisam|ne znam|ne poznajem|ne govorim|ne posjedujem|bez iskustva|bez znanja|no experience|no knowledge|do not know|do not have|not certified|not fluent|without experience|not experienced)\b/u;
const UNCERTAIN=/\b(?:osnove|osnovno|pocetn(?:ik|o)|ucim|ucenja|basic|beginner|learning|some knowledge|familiarity|u toku|in progress)\b/u;
const OPTIONAL=/\b(?:pozelj\w*|prednost|prednost je|nije obavezno|nije obavezan|nije potrebna|nije potreban|optional|preferred|desirable|not required|nice to have)\b/u;
const MANDATORY=/\b(?:obavez(?:an|na|no|ni|ne|nu)|obavezn[aoie]?|obavezno|uslov|uvjet|potreb(?:an|na|no|ni|ne|nu)|zahtijeva|zahtjeva|required|must|minimum|at least|mandatory|essential|najmanje|minimalno)\b/u;
const LEVELS=Object.freeze({A1:1,A2:2,B1:3,B2:4,C1:5,C2:6});
function level(value){const m=String(value).match(/\b(A1|A2|B1|B2|C1|C2)\b/i);return m?m[1].toUpperCase():null;}
function months(value){const f=fold(value);if(/(?:^|[^\d])[-−]\s*\d+\s*(?:godin|year|mjesec|month)/u.test(f))return null;const range=f.match(/\b(\d{1,2})\s*(?:-|–|do|to)\s*(\d{1,2})\s*(godin\w*|years?|mjesec\w*|months?)\b/u),m=range||f.match(/\b(\d{1,2}(?:[.,]\d)?)\s*(godin\w*|years?|mjesec\w*|months?)\b/u);if(!m)return null;const unit=range?m[3]:m[2],n=Number(m[1].replace(',','.'));return /^(godin|year)/.test(unit)?n*12:n;}
function priority(value){const f=fold(value);return OPTIONAL.test(f)?'preferred':MANDATORY.test(f)?'mandatory':'unclear';}
function sourceKey(r){return r.kind+'|'+r.key+'|'+(r.level||'')+'|'+(r.minimumMonths??'');}
const PREFERRED=/\b(?:pozelj\w*|prednost|preferred|desirable|nice to have|optional)\b/u;
const NOT_REQUIRED=/\b(?:nije obavez(?:an|na|no|ni|ne|nu)|nije potreb\w*|not required|not necessary|no requirement)\b/u;
function heading(value){const f=fold(value).replace(/[:.\s]+$/u,'').trim();if(/^(?:obavezni (?:uslovi|uvjeti)|obavezno|uslovi|uvjeti|requirements|essential requirements|minimum qualifications|required qualifications)$/u.test(f))return 'mandatory';if(/^(?:pozeljno|pozeljni (?:uslovi|uvjeti)|prednost|preferred|preferred qualifications|nice to have)$/u.test(f))return 'preferred';return null;}
function entrySpan(value,entry){const f=fold(value);let best=null;for(const alias of entry.aliases){const re=new RegExp('(^|[^\\p{L}\\p{N}])'+escape(fold(alias))+'(?=$|[^\\p{L}\\p{N}])','u'),m=re.exec(f);if(m){const start=m.index+m[1].length,end=start+fold(alias).length;if(!best||start<best.start||start===best.start&&end>best.end)best={start,end};}}return best;}
function entryContext(value,entry){const f=fold(value),span=entrySpan(value,entry);if(!span)return {before:'',after:'',all:f};const spans=scope.CLEA7SenseLexicon.entries.map(e=>entrySpan(value,e)).filter(Boolean),next=spans.filter(x=>x.start>span.start).sort((a,b)=>a.start-b.start)[0];return {before:f.slice(0,span.start),after:f.slice(span.end,next?.start??f.length),all:f};}
function entryLevel(value,entry){const c=entryContext(value,entry);return level(c.after)||(!scope.CLEA7SenseLexicon.entries.some(e=>e.id!==entry.id&&e.kind==='language'&&hasEntry(value,e))?level(c.before):null);}
function entryMonths(value,entry){const c=entryContext(value,entry);return months(c.after)??(!scope.CLEA7SenseLexicon.entries.some(e=>e.id!==entry.id&&e.kind==='skills'&&hasEntry(value,e))?months(c.before):null);}
function entryNegative(value,entry){const c=entryContext(value,entry);if(/\b(?:no|without)\s*$/u.test(c.before))return true;const negative=[...c.before.matchAll(new RegExp(NEGATIVE.source,'gu'))].pop();if(negative){const rest=c.before.slice(negative.index+negative[0].length);if(!/\b(?:koristim|znam|poznajem|imam|posjedujem|govorim|use|using|know|have|speak)\b/u.test(rest))return true;}return new RegExp('^\\s*(?:[-:]\\s*)?(?:'+NEGATIVE.source+')','u').test(c.after);}
function parseCV(cvText){return segments(cvText).slice(0,LIMITS.facts).map((source,i)=>({id:'fact_'+(i+1),text:source.text,source,negated:NEGATIVE.test(fold(source.text)),ambiguous:UNCERTAIN.test(fold(source.text)),level:level(source.text),months:months(source.text)}));}
function parseJob(jobText){
 const lex=scope.CLEA7SenseLexicon;if(!lex?.entries)throw error('Lexicon','Sense rječnik nije učitan.');
 const list=[],seen=new Map(),parts=segments(jobText),warnings=[];let sectionPriority='unclear',excluded=0,unclassified=0;
 const add=(source,fields)=>{const local=priority(source.text),item={id:'',label:fields.label,kind:fields.kind,key:fields.key,priority:local==='unclear'?sectionPriority:local,source,sources:[source],level:fields.level||null,minimumMonths:fields.minimumMonths??null,action:fields.action===true,...(fields.alternatives?{alternatives:fields.alternatives}: {})};const k=sourceKey(item);if(seen.has(k)){const old=seen.get(k);old.sources.push(source);if(item.priority==='mandatory'||old.priority==='unclear'&&item.priority==='preferred'){if(old.priority!==item.priority)old.source=source;old.priority=item.priority;}return;}if(list.length>=LIMITS.requirements)throw error('Budget','Oglas ima više od 64 prepoznata zahtjeva. Podijeli ga na manje dijelove.');item.id='req_'+(list.length+1);seen.set(k,item);list.push(item);};
 for(const source of parts){const f=fold(source.text),section=heading(source.text);if(section){sectionPriority=section;continue;}
  if(NOT_REQUIRED.test(f)&&!PREFERRED.test(f)){excluded++;continue;}
  let recognized=false;const entries=lex.entries.filter(e=>hasEntry(source.text,e));
  if(/\b(?:ili|or)\b/u.test(f)&&entries.length){
   const pair=entries.map(e=>({entry:e,span:entrySpan(source.text,e)})).sort((a,b)=>a.span.start-b.span.start),between=pair.length===2?f.slice(pair[0].span.end,pair[1].span.start):'';
   if(pair.length===2&&pair.every(x=>x.entry.kind==='skills')&&/^(?:\s|,)*(?:ili|or)(?:\s|,)*$/u.test(between)){
    const alternatives=pair.map(x=>x.entry.id).sort();add(source,{key:'alternative_'+alternatives.join('_'),label:pair.map(x=>x.entry.label).join(' ili '),kind:'skills',alternatives,minimumMonths:months(source.text)});
   }else{add(source,{key:'manual_alternative_'+source.start,label:'Alternativni uslov za ručnu provjeru',kind:'other',action:true});warnings.push('Alternativni ili složeni uslov sa „ili/or“ sačuvan je za tvoju provjeru; ne tumači se kao više obaveznih nedostataka.');}
   recognized=true;
  }else for(const e of entries){add(source,{key:e.id,label:e.label,kind:e.kind,level:e.kind==='language'?entryLevel(source.text,e):null,minimumMonths:e.kind==='skills'?entryMonths(source.text,e):null});recognized=true;}
  if(/\b(?:iskustv\w*|experience)\b/u.test(f)&&months(source.text)!==null&&!entries.some(e=>e.kind==='skills')){add(source,{key:'experience_months',label:'Trajanje iskustva',kind:'experience',minimumMonths:months(source.text)});recognized=true;}
  if(/\b(?:rok|do datuma|prijave do|deadline|closing date|apply by|applications close)\b/u.test(f)){add(source,{key:'deadline',label:'Rok prijave — provjeri izvorni datum',kind:'deadlines',action:true});recognized=true;}
  if(/\b(?:priloziti|prilozi|prilozena|dostaviti|dokumentacij\w*|attachments?|attach|cover letter|motivacijsko pismo|motivaciono pismo)\b/u.test(f)){add(source,{key:'attachments',label:'Traženi prilozi i način prijave',kind:'attachments',action:true});recognized=true;}
  if(!recognized&&(sectionPriority!=='unclear'||MANDATORY.test(f)||OPTIONAL.test(f)||/\b(?:kvalifikacij\w*|qualifications?|requirements?|certifikat\w*|licenc\w*|diplom\w*)\b/u.test(f))){add(source,{key:'manual_'+source.start,label:'Zahtjev za ručnu provjeru',kind:'other',action:true});recognized=true;}
  if(!recognized)unclassified++;
 }
 if(!list.length)warnings.push('Nije prepoznat pouzdan zahtjev. Dodaj konkretne uslove oglasa; Sense ne izmišlja uslove.');
 if(excluded)warnings.push('Izričito neobavezne stavke nisu tretirane kao obavezni nedostaci: '+excluded+'. Provjeri izvorni kontekst.');
 if(unclassified)warnings.push('Odlomci bez dovoljno jasnog zahtjeva nisu samostalno protumačeni: '+unclassified+'. Pregledaj cijeli oglas.');
 if(parts.some(s=>s.text.length>3000))warnings.push('Dugi odlomci mogu spojiti više uslova. Za precizniji pregled razdvoji uslove po redovima.');
 warnings.push('Rječnik i pravila pokrivaju ograničen skup bs/hr/en izraza. Neprepoznati ili dvosmisleni uslovi zahtijevaju ručnu provjeru.');
 const sourceReview=parts.slice(0,256).map((source,i)=>{const requirementIds=list.filter(r=>r.sources.some(s=>s.start===source.start&&s.end===source.end)).map(r=>r.id);const kind=heading(source.text)?'section':requirementIds.length?'classified':NOT_REQUIRED.test(fold(source.text))&&!PREFERRED.test(fold(source.text))?'excluded':'unclassified';return {id:'segment_'+(i+1),source,kind,requirementIds};});
 if(parts.length>256)warnings.push('Pregled izvora prikazuje prvih 256 odlomaka od '+parts.length+'. Podijeli oglas za potpuni pregled izvora.');
 return {requirements:list,warnings,sourceReview,sourceReviewTotal:parts.length,sourceReviewComplete:parts.length<=256};
}
const REASONS=Object.freeze({
 user_denied:'Korisnik je označio da uslov nije ispunjen.',user_uncertain:'Korisnik je označio da je potrebno pojašnjenje.',
 action_confirmed:'Korisnik je potvrdio da je ovaj korak provjerio ili pripremio.',action_requires_review:'Ovaj uslov zahtijeva tvoju provjeru izvora ili pripremu dokumenta.',
 explicit_negative_source:'U dostavljenom CV-u pronađen je izričito negativan navod. Provjeri njegov kontekst.',
 explicit_level_or_duration_gap:'Izričito navedeni nivo ili trajanje je niže od prepoznatog zahtjeva. Provjeri izvor i pravilo.',
 qualified_or_unclear_source:'Navod je ograničen, dvosmislen ili nema traženi nivo/trajanje. Potrebno je pojašnjenje.',
 source_and_user_confirmation:'Pronađen je povezani navod u CV-u i korisnik ga je potvrdio. Ovo nije nezavisna provjera kvalifikacije.',
 source_requires_confirmation:'Pronađen je mogući povezani navod. Potvrdi da tačno odgovara ovom zahtjevu.',
 not_found_in_provided_cv:'Nije pronađen odgovarajući navod u dostavljenom CV-u. To ne znači da nemaš ovu vještinu.'
});
const SUGGESTIONS=Object.freeze({supported:'Provjeri da je navod tačan i da konačni CV čuva njegov smisao.',unconfirmed:'Pregledaj označeni dio CV-a i potvrdi ili pojasni vezu.',notfound:'Ako zaista imaš ovo iskustvo, dodaj konkretan istinit navod u CV, pa ponovi provjeru.',contradicted:'Provjeri neslaganje. Nemoj dodavati kvalifikaciju ili trajanje koje nemaš.',needsclarification:'Provjeri izvorni zahtjev i dodaj pojašnjenje ili potvrdi završenu pripremu.'});
function matching(requirement,facts){
 if(requirement.action)return {matches:[],found:false,negated:false,ambiguous:false,mismatch:false};
 if(requirement.alternatives){
  const alternatives=requirement.alternatives.map(key=>matching({...requirement,key,alternatives:null},facts)),positive=alternatives.filter(x=>x.found&&!x.negated),clean=positive.filter(x=>!x.ambiguous&&!x.mismatch),pool=clean.length?clean:positive;
  if(pool.length)return {matches:[...new Set(pool.flatMap(x=>x.matches))],found:true,negated:false,ambiguous:!clean.length&&!pool.every(x=>x.mismatch),mismatch:!clean.length&&pool.every(x=>x.mismatch)};
  return {matches:[...new Set(alternatives.flatMap(x=>x.matches))],found:alternatives.every(x=>x.found),negated:alternatives.every(x=>x.negated),ambiguous:false,mismatch:false};
 }
 const e=scope.CLEA7SenseLexicon.entries.find(e=>e.id===requirement.key);let candidates=[];
 if(e)candidates=facts.filter(f=>hasEntry(f.text,e)).map(f=>({...f,negated:entryNegative(f.text,e),level:entryLevel(f.text,e),months:entryMonths(f.text,e)}));
 else if(requirement.kind==='experience')candidates=facts.filter(f=>/\b(?:iskustv\w*|rada|radnog|worked|working|experience)\b/u.test(fold(f.text))&&f.months!==null);
 const positive=candidates.filter(f=>!f.negated),pool=positive.length?positive:candidates;
 let ambiguous=pool.length>0&&pool.every(f=>f.ambiguous),mismatch=false;
 if(requirement.level&&pool.length){const explicit=pool.filter(f=>f.level);if(!explicit.length)ambiguous=true;else mismatch=explicit.every(f=>LEVELS[f.level]<LEVELS[requirement.level]);}
 if(requirement.minimumMonths!==null&&pool.length){const explicit=pool.filter(f=>f.months!==null);if(!explicit.length)ambiguous=true;else mismatch=mismatch||explicit.every(f=>f.months<requirement.minimumMonths);}
 return {matches:pool.map(f=>f.id),found:pool.length>0,negated:candidates.length>0&&!positive.length,ambiguous,mismatch};
}
function confirmations(value,requirements){record(value,'Potvrde');if(Object.keys(value).length>LIMITS.requirements)throw error('Input','Previše potvrda.');const ids=new Set(requirements.map(r=>r.id)),out={};for(const [id,v]of Object.entries(value)){if(!ids.has(id)||!['confirmed','denied','uncertain'].includes(v))throw error('Input','Potvrda ne odgovara zahtjevu ovog oglasa.');out[id]=v;}return out;}
function sanitizeTrace(trace){return trace.map(e=>{const x={kind:e.kind};for(const k of ['id','instruction','code','passed','ms'])if(['string','number','boolean'].includes(typeof e[k]))x[k]=e[k];for(const k of ['reads','writes'])if(Array.isArray(e[k]))x[k]=e[k].slice(0,32);if(e.location)x.location={line:e.location.line,column:e.location.column,start:e.location.start,end:e.location.end};return x;});}
function safeProject(value){record(value,'Projekt');const keys=Object.keys(value),required=['confirmations','cvText','format','jobText'];if(required.some(k=>!own(value,k))||keys.some(k=>!required.includes(k)&&!['lexicon','policy'].includes(k))||value.format!==PROJECT||own(value,'lexicon')!==own(value,'policy')||own(value,'lexicon')&&(typeof value.lexicon!=='string'||value.lexicon.length>80||typeof value.policy!=='string'||value.policy.length>80))throw error('Project','Ovo nije podržan Sense projekt.');const cvText=text(value.cvText,LIMITS.cv,'CV',true),jobText=text(value.jobText,LIMITS.job,'Oglas',true),parsed=parseJob(jobText),c=confirmations(value.confirmations,parsed.requirements),current=value.lexicon===scope.CLEA7SenseLexicon.version&&value.policy==='sense.evidence/1';return {cvText,jobText,confirmations:current?c:{}};}
class SenseEngine{
 constructor(){const B=scope.CLEA7BIL,R=scope.CLEA7BILRuntime;if(!B?.compile||!R?.execute)throw error('Runtime','BIL kompajler i Runtime nisu učitani.');INTERNAL.set(this,{compiled:freeze(B.compile(POLICY_SOURCE,{id:'sense_evidence_policy',name:'BL CLEA Sense dokazna pravila'})),reports:new WeakMap(),sequence:0});}
 async analyze(input={}){return this._analyze(input,'LIVE');}
 async _analyze(input,reality){
  record(input,'Ulaz');for(const k of Object.keys(input))if(!['cvText','jobText','confirmations','signal'].includes(k))throw error('Input','Nepoznato polje u Sense ulazu.');
  const cvText=text(input.cvText,LIMITS.cv,'CV',true),jobText=text(input.jobText,LIMITS.job,'Oglas'),signal=input.signal;
  if(signal!==undefined&&(!signal||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'))throw error('Input','Neispravan signal prekida.');
  const check=()=>{if(signal?.aborted)throw error('Cancelled','Provjera je zaustavljena.');};check();
  const start=scope.performance?.now?.()??Date.now(),facts=parseCV(cvText),parsed=parseJob(jobText),c=confirmations(input.confirmations===undefined?{}:input.confirmations,parsed.requirements),reqs=parsed.requirements.map(r=>({...r,...matching(r,facts)}));
  for(const r of reqs)if(c[r.id]==='confirmed'&&!r.action&&!r.found)throw error('Confirmation','Prvo dodaj konkretan navod u CV. Potvrda bez izvornog navoda ne stvara iskustvo.');
  const typed=reqs.map(r=>({id:r.id,kind:r.kind,mandatory:r.priority==='mandatory',found:r.found,negated:r.negated,ambiguous:r.ambiguous,mismatch:r.mismatch,action:r.action,confirmed:c[r.id]==='confirmed',denied:c[r.id]==='denied',uncertain:c[r.id]==='uncertain'}));
  const options={reality,closed:()=>signal?.aborted===true,ai:null,consent:false,timeLimit:5000,stepLimit:10000,capabilities:{renderers:['text'],motion:false,reducedMotion:true}};
  const R=scope.CLEA7BILRuntime;let init,run;try{init=await R.execute(INTERNAL.get(this).compiled.ir,'main',INTERNAL.get(this).compiled.application.state,options);check();const state=clone(init.state);state.bilValues.requirements=typed;R.validateState(INTERNAL.get(this).compiled.ir,state);run=await R.execute(INTERNAL.get(this).compiled.ir,'assess',state,options);}catch(e){check();throw e;}check();const values=run.state.bilValues;
  const results=new Map(values.findings.map(f=>[f.id,f]));
  const requirements=reqs.map(r=>{const finding=results.get(r.id);if(!finding||!STATUSES.includes(finding.status)||!own(REASONS,finding.reason))throw error('Policy','BIL je vratio nepoznat nalaz.');return {...r,status:finding.status,reasonCode:finding.reason,reason:REASONS[finding.reason],suggestion:SUGGESTIONS[finding.status],confirmation:c[r.id]||null};});
  const counts={};for(const k of ['total','supported','unconfirmed','notfound','contradicted','needsclarification','mandatory','mandatoryOpen'])counts[k]=values[k];
  if(counts.total!==requirements.length||STATUSES.reduce((n,k)=>n+counts[k],0)!==counts.total)throw error('Policy','Brojevi nalaza nisu usklađeni.');
  const trace=sanitizeTrace([...init.trace,...run.trace]);trace.push({kind:'sense-policy',reality,policy:'sense.evidence/1',requirements:requirements.length,aiUsed:false});
  const report=freeze({format:FORMAT,id:'sense_'+(++INTERNAL.get(this).sequence),cvText,jobText,requirements,facts,counts,sourceReview:parsed.sourceReview,sourceReviewTotal:parsed.sourceReviewTotal,sourceReviewComplete:parsed.sourceReviewComplete,coverage:{supported:counts.supported,total:counts.total},confirmations:c,trace,metrics:{instructions:init.instructions+run.instructions,elapsedMs:Math.max(0,(scope.performance?.now?.()??Date.now())-start)},warnings:[...parsed.warnings,...(segments(cvText).length>LIMITS.facts?['CV ima više od 256 odlomaka; podijeli ga za potpunu provjeru.']:[])],policy:'sense.evidence/1',lexicon:scope.CLEA7SenseLexicon.version,reality});
  INTERNAL.get(this).reports.set(report,{input:{cvText,jobText,confirmations:clone(c)}});return report;
 }
 async shadow(report,changes={}){
  const saved=INTERNAL.get(this).reports.get(report);if(!saved)throw error('Report','Alternativa zahtijeva izvorni izvještaj ovog Enginea.');record(changes,'Alternativa');for(const k of Object.keys(changes))if(!['cvText','confirmations','signal'].includes(k))throw error('Input','Alternativa smije mijenjati CV ili potvrde.');
  const before=JSON.stringify(report),input={...clone(saved.input),...changes};
  if(changes.cvText!==undefined&&changes.cvText!==saved.input.cvText){const nextFacts=parseCV(text(changes.cvText,LIMITS.cv,'CV',true)),nextRequirements=parseJob(saved.input.jobText).requirements,nextConfirmations={...input.confirmations};for(const r of report.requirements){if(r.action)continue;const next=nextRequirements.find(q=>q.id===r.id),match=next?matching(next,nextFacts):null;const previousTexts=r.matches.map(id=>report.facts.find(f=>f.id===id)?.text).sort(),nextTexts=(match?.matches||[]).map(id=>nextFacts.find(f=>f.id===id)?.text).sort();if(JSON.stringify(previousTexts)!==JSON.stringify(nextTexts))delete nextConfirmations[r.id];}input.confirmations=nextConfirmations;}
  const alternative=await this._analyze(input,'SHADOW');
  const old=new Map(report.requirements.map(r=>[r.id,r])),delta=alternative.requirements.filter(r=>old.get(r.id)?.status!==r.status).map(r=>({id:r.id,before:old.get(r.id)?.status||'unknown',after:r.status}));
  if(JSON.stringify(report)!==before)throw error('Isolation','Živi izvještaj je promijenjen.');return freeze({report:alternative,liveUnchanged:true,changes:delta,countsBefore:clone(report.counts),countsAfter:clone(alternative.counts)});
 }
 createDraft(report){
  if(!INTERNAL.get(this).reports.has(report))throw error('Report','Nacrt zahtijeva izvorni izvještaj ovog Enginea.');const selected=new Set(report.requirements.filter(r=>r.status==='supported'&&!r.action).flatMap(r=>r.matches)),facts=report.facts.filter(f=>selected.has(f.id)&&!f.negated);
  return freeze({format:'sense.draft/1',text:facts.map(f=>f.text).join('\n\n'),claims:facts.map(f=>({factId:f.id,text:f.text,source:clone(f.source)})),warnings:['Ovo je izbor potvrđenih izvornih navoda, ne kompletan CV niti nezavisna provjera njihove istinitosti. Dodaj svoj pregled prije slanja.']});
 }
 exportProject(value){let input;if(INTERNAL.get(this).reports.has(value))input={cvText:value.cvText,jobText:value.jobText,confirmations:value.confirmations};else{record(value,'Nacrt projekta');for(const k of Object.keys(value))if(!['cvText','jobText','confirmations'].includes(k))throw error('Project','Nacrt projekta ima nepoznato polje.');input={cvText:value.cvText,jobText:value.jobText,confirmations:value.confirmations||{}};}const stamp={lexicon:scope.CLEA7SenseLexicon.version,policy:'sense.evidence/1'},checked=safeProject({format:PROJECT,...stamp,...input});return JSON.stringify({format:PROJECT,...stamp,...checked},null,2);}
 importProjectDetailed(serialized){if(typeof serialized!=='string'||serialized.length>LIMITS.project)throw error('Project','Projekt je prevelik ili nije tekst.');let p;try{p=JSON.parse(serialized);}catch{throw error('Project','Projekt nije ispravan JSON.');}const project=safeProject(p),reset=Object.keys(p.confirmations).length>0&&Object.keys(project.confirmations).length===0;return freeze({project,warnings:reset?['Potvrde su vraćene na provjeru jer kopija nema trenutnu verziju Sense pravila i rječnika. Ponovo pregledaj povezane navode.']:[]});}
 importProject(serialized){return this.importProjectDetailed(serialized).project;}
}
scope.CLEA7Sense=Object.freeze({SenseEngine,POLICY_SOURCE,LIMITS,STATUSES,parseCV,parseJob,validateProject:safeProject,format:FORMAT});
})(globalThis);
