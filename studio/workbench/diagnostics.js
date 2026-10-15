'use strict';
(function(scope){
const F=scope.CLEA7Format,own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
function validateSuite(raw,project){
 if(!raw||JSON.stringify(raw).length>262144)throw Error('Skup testova prelazi 256 KiB.');
 const suite=F.clone(raw);if(suite.format!=='clea7.tests/1'||suite.application!==project.id||suite.version!==project.version||!Array.isArray(suite.cases)||!suite.cases.length||suite.cases.length>20)throw Error('Testovi trebaju odgovarati identitetu i verziji projekta; dozvoljeno je 1–20 scenarija.');
 const fields=(value,allowed)=>{for(const key of Object.keys(value))if(!allowed.includes(key))throw Error('Nepoznato svojstvo testa '+key);};fields(suite,['format','application','version','cases']);
 let steps=0;const ids=new Set();
 for(const test of suite.cases){
  if(!test||typeof test.name!=='string'||!test.name.trim()||test.name.length>100||ids.has(test.name)||!Array.isArray(test.steps)||!test.steps.length||test.steps.length>10)throw Error('Scenarij treba jedinstven naziv i 1–10 koraka.');ids.add(test.name);
  fields(test,['name','steps']);for(const step of test.steps){
   if(++steps>100||!step||!own(project.flows,step.flow)||!step.expect||typeof step.expect!=='object'||Array.isArray(step.expect))throw Error('Test ima nepoznat tok ili nema očekivanje; ukupno najviše 100 koraka.');
   fields(step,['flow','inputs','event','expect']);
   for(const field of ['inputs','event'])if(step[field]!==undefined&&(!step[field]||typeof step[field]!=='object'||Array.isArray(step[field])))throw Error('Ulazi testa trebaju biti objekti.');
   for(const [key,value]of Object.entries(step.inputs||{}))if(!own(project.state,key)||typeof value!==typeof project.state[key]||Array.isArray(value)!==Array.isArray(project.state[key]))throw Error('Testni unos ne odgovara podatku '+key);
   const expected=step.expect;if(expected.state!==undefined&&(!expected.state||typeof expected.state!=='object'||Array.isArray(expected.state)))throw Error('Očekivano stanje treba biti objekat.');
   for(const key of Object.keys(expected.state||{}))if(!own(project.state,key))throw Error('Očekivanje koristi nepoznat podatak '+key);
   if(expected.screen!==undefined&&!project.screens.some(s=>s.id===expected.screen))throw Error('Očekivani ekran ne postoji.');
   if(expected.error!==undefined&&(typeof expected.error!=='string'||!expected.error.length||expected.error.length>200))throw Error('Očekivana greška treba biti tekst do 200 znakova.');
   if(!Object.keys(expected.state||{}).length&&expected.screen===undefined&&expected.error===undefined)throw Error('Svaki korak treba provjeriti stanje, ekran ili grešku.');
   for(const key of Object.keys(expected))if(!['state','screen','error'].includes(key))throw Error('Nepoznato očekivanje '+key);
  }
 }
 return suite;
}
async function runSuite(raw,project,{mode='standard',signal=null}={}){
 const app=F.validate(project),suite=validateSuite(raw,app),started=performance.now(),cases=[];
 if(!['standard','light'].includes(mode))throw Error('Test koristi standardnu ili laganu politiku.');
 const check=()=>{if(signal?.aborted)throw Error('Testiranje je zaustavljeno.');if(performance.now()-started>30000)throw Error('Testiranje prelazi 30 sekundi.');};
 for(const test of suite.cases){
  check();const engine=new CLEA7Engine.Engine(app,{vault:new CLEA7.MemoryVault(),modules:null,reality:'SHADOW',mode}),results=[];
  try{await engine.open();for(const step of test.steps){
   check();for(const [key,value]of Object.entries(step.inputs||{}))await engine.input(key,value);
   let failure=null;try{await engine.dispatch(step.flow,step.event||{});}catch(error){failure=error.message;}check();
   const assertions=[],expected=step.expect;
   assertions.push({kind:'error',passed:expected.error!==undefined?failure!==null&&failure.includes(expected.error):failure===null,expected:expected.error??null,actual:failure});
   for(const [key,value]of Object.entries(expected.state||{})){const actual=engine.state[key],text=JSON.stringify(actual);assertions.push({kind:'state',key,expected:value,actual:text.length<=32768?F.clone(actual):{truncated:true,jsonCharacters:text.length},passed:CLEA7.stable(value)===CLEA7.stable(actual)});}
   if(expected.screen!==undefined)assertions.push({kind:'screen',expected:expected.screen,actual:engine.screen,passed:engine.screen===expected.screen});
   const trace=engine.events[0];results.push({flow:step.flow,passed:assertions.every(a=>a.passed),assertions,trace:trace?{state:trace.state,steps:trace.steps,conditions:trace.conditions?.slice(0,64),trace:trace.trace?.slice(0,64),truncated:(trace.trace?.length||0)>64}:null});
   if(!results[results.length-1].passed)break;
  }}finally{engine.close();}
  cases.push({name:test.name,passed:results.length===test.steps.length&&results.every(x=>x.passed),steps:results});
  if(JSON.stringify(cases).length>2*1024*1024)throw Error('Izvještaj prelazi 2 MiB; smanji skup testova.');
 }
 return {format:'clea7.test-report/1',application:app.id,version:app.version,mode,reality:'SHADOW',storage:'fresh in-memory vault per case; native adapters blocked',passed:cases.every(x=>x.passed),ms:performance.now()-started,cases};
}
function laboratory(root,{project,vault}){
 const node=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;},label=(text,control)=>{const n=node('label',text);n.append(control);return n;};
 const title=node('h1','Laboratorij aplikacije'),intro=node('p','Sastavi provjeru: zadaj ulaz, pokreni tok i uporedi rezultat. Svaki scenarij radi u zasebnoj memoriji od početnog stanja projekta. LIVE podaci i hardverski adapteri nisu dostupni.'),name=node('input'),flow=node('select'),inputKey=node('select'),inputValue=node('input'),expectKey=node('select'),expectValue=node('input'),mode=node('select'),status=node('p'),list=node('div'),report=node('pre'),advanced=node('details'),editor=node('textarea'),actions=node('div');
 list.id='lab-cases';name.id='lab-name';name.value='Moja provjera';flow.id='lab-flow';inputKey.id='lab-input-key';inputValue.id='lab-input-value';expectKey.id='lab-expect-key';expectValue.id='lab-expect-value';mode.id='lab-mode';status.id='lab-status';status.setAttribute('role','status');report.id='lab-report';editor.id='lab-source';editor.rows=12;editor.spellcheck=false;actions.className='actions';
 for(const [value,text]of [['standard','Standardna politika'],['light','Lagana politika']]){const option=node('option',text);option.value=value;mode.append(option);}
 let suite=null,result=null,identity='',fieldKeys='',busy=false,abort=null,saved=null,edited=false,saveTail=Promise.resolve();const drafts=new Map();
 addEventListener('beforeunload',event=>{if(edited){event.preventDefault();event.returnValue='';}});
 const fresh=()=>({format:'clea7.tests/1',application:project().id,version:project().version,cases:[]});
 const typed=(key,value)=>{const initial=project().state[key];if(typeof initial==='string')return value;const parsed=JSON.parse(value);if(typeof parsed!==typeof initial||Array.isArray(parsed)!==Array.isArray(initial))throw Error('Vrijednost treba odgovarati tipu podatka.');return parsed;};
 const showValue=(select,input)=>{const value=project().state[select.value];input.value=value===undefined?'':typeof value==='string'?value:JSON.stringify(value);};
 const show=()=>{list.replaceChildren();for(const [index,test]of suite.cases.entries()){const row=node('div');row.className='lab-case';row.append(node('strong',test.name),node('span',test.steps.length+' korak(a)'),button('Ukloni '+test.name,()=>{suite.cases.splice(index,1);edited=true;result=null;show();}));list.append(row);}editor.value=JSON.stringify(suite,null,2);report.textContent=result?JSON.stringify(result,null,2):'Još nema rezultata ovog skupa.';};
 const action=async fn=>{try{await fn();}catch(error){status.textContent=error.message;}};
 function button(text,fn,id){const b=node('button',text);b.type='button';if(id)b.id=id;b.onclick=()=>action(fn);return b;}
 const download=(filename,value)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const add=button('Dodaj provjeru',()=>{const step={flow:flow.value,inputs:{},expect:{state:{[expectKey.value]:typed(expectKey.value,expectValue.value)}}};if(inputKey.value)step.inputs[inputKey.value]=typed(inputKey.value,inputValue.value);const candidate=F.clone(suite);candidate.cases.push({name:name.value.trim(),steps:[step]});suite=validateSuite(candidate,project());edited=true;result=null;show();status.textContent='Provjera je dodana. Sačuvaj ili preuzmi skup prije zatvaranja.';},'lab-add');
 const run=button('Pokreni sve provjere',async()=>{if(busy)return;const app=F.clone(project()),tests=validateSuite(suite,app);busy=true;run.disabled=true;abort=new AbortController();status.textContent='Izvršavanje izolovanih provjera…';try{const checked=await runSuite(tests,app,{mode:mode.value,signal:abort.signal});if(CLEA7.stable(app)!==CLEA7.stable(project())||CLEA7.stable(tests)!==CLEA7.stable(suite))throw Error('Projekt ili testovi su se promijenili; rezultat stare verzije nije prikazan.');result=checked;show();status.textContent=checked.passed?'Sve zadane provjere su prošle.':'Postoji nepodudaranje; pregledaj očekivanu i stvarnu vrijednost.';}finally{busy=false;run.disabled=false;}},'lab-run');
 const stop=button('Zaustavi provjere',()=>abort?.abort(),'lab-stop');
 const save=button('Sačuvaj testove lokalno',async()=>{const snapshot=validateSuite(suite,project()),key='tests1:'+snapshot.application,expected=F.clone(saved);saveTail=saveTail.catch(()=>{}).then(()=>vault.batchConditional(key,expected,[[key,snapshot]]));await saveTail;if(identity===snapshot.application+':'+snapshot.version){saved=snapshot;edited=CLEA7.stable(suite)!==CLEA7.stable(snapshot);}status.textContent=vault.persistent?'Testovi su sačuvani lokalno.':'Testovi su samo u memoriji; preuzmi datoteku.';},'lab-save');
 const load=node('input');load.type='file';load.accept='.json';load.hidden=true;load.id='lab-import';load.onchange=()=>action(async()=>{try{const file=load.files[0];if(!file)return;if(file.size>262144)throw Error('Testovi prelaze 256 KiB.');suite=validateSuite(JSON.parse(await file.text()),project());edited=true;result=null;show();status.textContent='Uvezen je provjeren skup testova.';}finally{load.value='';}});
 advanced.append(node('summary','Više koraka, očekivane greške i JSON ugovor'),label('Izvor testova',editor),button('Primijeni izvor testova',()=>{suite=validateSuite(JSON.parse(editor.value),project());edited=true;result=null;show();status.textContent='Primijenjen je provjeren izvor testova.';},'lab-apply'));
 actions.append(add,run,stop,save,button('Preuzmi testove',()=>download(project().id+'-tests.json',validateSuite(suite,project())),'lab-download'),button('Uvezi testove',()=>load.click(),'lab-open'),button('Preuzmi izvještaj',()=>{if(!result)throw Error('Prvo izvrši testove.');download(project().id+'-test-report.json',result);},'lab-download-report'));
 root.append(title,intro,label('Naziv provjere',name),label('Tok za provjeru',flow),label('Ulazni podatak',inputKey),label('Ulazna vrijednost',inputValue),label('Provjeri podatak',expectKey),label('Očekivana vrijednost',expectValue),label('Politika izvršavanja testova',mode),actions,status,list,advanced,report,load,node('p','Skup i izvještaj mogu sadržavati unesene vrijednosti. Čuvaju se samo lokalno; nema slanja na server. Ovo provjerava logiku; GUI, baterija i fizički uređaji zahtijevaju zasebne testove.'));
 inputKey.onchange=()=>showValue(inputKey,inputValue);expectKey.onchange=()=>showValue(expectKey,expectValue);
 function populateFields(app,preserve=false){
  const oldInput=inputKey.value,oldExpected=expectKey.value;fieldKeys=CLEA7.stable(Object.keys(app.state));
  inputKey.replaceChildren(node('option','Bez ulaza'));inputKey.options[0].value='';expectKey.replaceChildren();
  for(const key of Object.keys(app.state))for(const control of [inputKey,expectKey]){const option=node('option',key);option.value=key;control.append(option);}
  if(preserve&&own(app.state,oldInput))inputKey.value=oldInput;else showValue(inputKey,inputValue);
  if(preserve&&own(app.state,oldExpected))expectKey.value=oldExpected;else showValue(expectKey,expectValue);
 }
 async function refresh(){
  const app=project(),key=app.id+':'+app.version;
  if(identity===key){const selected=flow.value;flow.replaceChildren(...Object.keys(app.flows).map(value=>{const o=node('option',value);o.value=value;return o;}));if(own(app.flows,selected))flow.value=selected;if(fieldKeys!==CLEA7.stable(Object.keys(app.state)))populateFields(app,true);return;}abort?.abort();if(identity)drafts.set(identity,{suite,saved,edited,result});
  identity=key;suite=fresh();saved=null;edited=false;result=null;
  flow.replaceChildren(...Object.keys(app.flows).map(value=>{const o=node('option',value);o.value=value;return o;}));
  populateFields(app);show();
  if(drafts.has(key)){({suite,saved,edited,result}=drafts.get(key));show();status.textContent='Vraćen je skup iz ove sesije.';return;}
  const stored=await vault.get('tests1:'+app.id);if(identity!==key)return;saved=stored;if(edited||busy)return;if(stored){try{suite=validateSuite(stored,app);show();status.textContent='Učitani su sačuvani testovi za ovu verziju.';}catch{status.textContent='Sačuvani testovi pripadaju drugom ugovoru ili verziji. Nisu prepisani.';}}
 }
 return {refresh};
}
scope.CLEA7Testing={validate:validateSuite,run:runSuite,laboratory};
function attach(root,{engine:current,project}){
 const node=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const title=node('h2','Living Runtime · inspektor događaja'),description=node('p','Ispitaj stvarni događaj ili izolovanu alternativu. Ovdje se ne mijenjaju LIVE podaci.');
 const label=(text,control)=>{const n=node('label',text);n.append(control);return n;};
 const select=node('select'),flow=node('select'),event=node('textarea'),alternative=node('textarea'),status=node('p'),output=node('pre'),details=node('details'),summary=node('summary','Alternativna logika i ulaz'),actions=node('div');
 select.id='diagnostic-event';flow.id='diagnostic-flow';event.id='diagnostic-input';alternative.id='diagnostic-alternative';status.id='diagnostic-status';output.id='diagnostic-result';
 event.value='{}';event.rows=3;alternative.rows=9;event.spellcheck=false;alternative.spellcheck=false;status.setAttribute('role','status');status.setAttribute('aria-live','polite');actions.className='actions';
 const button=(text,id,run)=>{const b=node('button',text);b.type='button';b.id=id;b.onclick=run;return b;};
 let selected=null,busy=false,lastEngine=null;
 const get=()=>{const e=current();if(!e||e.project.id!==project().id||e.closed)throw Error('Prvo pokreni trenutnu aplikaciju.');return e;};
 const parse=(input,kind)=>{if(new TextEncoder().encode(input.value).length>262144)throw Error('Dijagnostički ulaz prelazi 256 KiB.');const value=JSON.parse(input.value);if(kind==='array'?!Array.isArray(value):!value||typeof value!=='object'||Array.isArray(value))throw Error(kind==='array'?'Alternativa treba biti lista CLEA7 blokova.':'Ulaz događaja treba biti JSON objekat.');return value;};
 async function execute(run){if(busy)return;busy=true;refresh();status.textContent='Stvarno izvršavanje dijagnostike…';try{const e=get(),result=await run(e);if(e!==current()||e.closed){status.textContent='Runtime je promijenjen; rezultat stare sesije nije prikazan.';output.textContent='';return;}output.textContent=JSON.stringify(result,null,2);status.textContent=result.mode==='REPLAY'?(result.match?'REPLAY: isti rezultat je potvrđen.':'REPLAY: rezultat se razlikuje; pregledaj zapis.'):(result.liveUnchanged?'SHADOW: LIVE podaci su ostali isti.':'SHADOW: LIVE podaci su se promijenili tokom provjere; pregledaj sesiju.');}catch(error){status.textContent=error.message;output.textContent='';}finally{busy=false;refresh();}}
 const replay=button('Ponovi odabrani događaj','diagnostic-replay',()=>execute(e=>{const index=e.events.indexOf(selected);if(index<0)throw Error('Odabrani događaj više nije u tragu.');return e.replay(index);}));
 const shadow=button('Ispitaj izolovanu alternativu','diagnostic-shadow',()=>execute(e=>e.shadow(flow.value,parse(event,'object'),{},parse(alternative,'array'))));
 const inspect=button('Prikaži stvarni trag','diagnostic-inspect',()=>{try{get();if(!selected)throw Error('Nema odabranog događaja.');output.textContent=JSON.stringify(selected,null,2);status.textContent='Prikazan je zabilježeni događaj, bez novog izvršavanja.';}catch(error){status.textContent=error.message;}});
 const copy=button('Preuzmi logiku toka u polje','diagnostic-copy-flow',()=>{try{const e=get();if(!Object.prototype.hasOwnProperty.call(e.project.flows,flow.value))throw Error('Tok ne postoji.');alternative.value=JSON.stringify(e.project.flows[flow.value],null,2);status.textContent='Logika je kopirana u polje. Izmjene ovdje ne mijenjaju projekt.';}catch(error){status.textContent=error.message;}});
 const exportTrace=button('Preuzmi odabrani zapis','diagnostic-download',()=>{try{get();if(!selected)throw Error('Nema odabranog događaja.');const url=URL.createObjectURL(new Blob([JSON.stringify({format:'clea7.trace/1',application:project().id,event:selected},null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download=project().id+'-event.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Zapis je pripremljen za lokalno preuzimanje.';}catch(error){status.textContent=error.message;}});
 actions.append(inspect,replay,exportTrace);details.append(summary,label('Tok za izolovanu provjeru',flow),copy,label('Ulaz događaja (JSON objekat)',event),label('Alternativni CLEA7 blokovi (JSON lista)',alternative),shadow,node('p','Izvršava se provjerena deklarativna logika nad kopijom stanja i tabela. Native efekti su blokirani; ovo nije JavaScript editor.'));
 root.append(title,description,label('Zabilježeni događaj',select),actions,details,status,output,node('p','Lokalni dijagnostički zapis može sadržavati unesene podatke i model aplikacije. Preuzimanjem ga čuvaš na svom uređaju.'));
 select.onchange=()=>{const e=current();selected=e?.events[Number(select.value)]||null;refresh(false);};
 function refresh(rebuild=true){const e=current(),usable=e&&!e.closed&&e.project.id===project().id;
  if(e!==lastEngine){selected=null;output.textContent='';status.textContent='';lastEngine=e;}
  if(rebuild){select.textContent='';const events=usable?e.events:[];if(!events.includes(selected))selected=events[0]||null;events.forEach((row,index)=>{const option=node('option',(index+1)+'. '+(row.flow||row.state)+' · '+row.state+' · '+(row.mode||'LIVE'));option.value=String(index);option.selected=row===selected;select.append(option);});if(!events.length){const option=node('option',usable?'Nema izvršenih događaja':'Prvo pokreni aplikaciju');select.append(option);}const old=flow.value;flow.textContent='';for(const name of Object.keys(usable?e.project.flows:project().flows)){const option=node('option',name);option.value=name;flow.append(option);}if([...flow.options].some(o=>o.value===old))flow.value=old;}
  select.disabled=busy||!selected;inspect.disabled=busy||!selected;exportTrace.disabled=busy||!selected;replay.disabled=busy||!selected?.replayable;replay.title=selected?.replayable?'Ponovi zabilježeni čisti tok':selected?.replayReason||'Odaberi podržani zabilježeni događaj.';shadow.disabled=busy||!usable||!flow.value;copy.disabled=busy||!usable||!flow.value;
 }
 refresh();return {refresh};
}
scope.CLEA7Diagnostics={attach};
})(globalThis);
