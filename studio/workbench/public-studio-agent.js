'use strict';
/* Model-driven authoring pipeline. Every phase is a fresh real Qwen request.
   Only the established BIL compiler, Draw composition and SHADOW Runtime
   interpret the result. No canned application, executable JS or remote grants. */
(function(scope){
const fail=m=>{throw Error(m);},q=JSON.stringify,own=(v,k)=>Object.hasOwn(v,k);
const arr=(v,min,max)=>{if(!Array.isArray(v)||v.length<min||v.length>max)fail('Neispravan broj elemenata.');return v;};
const tuple=(v,n)=>arr(v,n,n);
const name=v=>{if(typeof v!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(v)||!scope.CLEA7BIL.safe(v))fail('Neispravno BIL ime.');return v;};
const text=(v,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('Neispravan tekst.');return v;};
const map=v=>{if(!v||typeof v!=='object'||Array.isArray(v))fail('Očekujem JSON objekat.');return v;};
function exact(v,keys){map(v);if(Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!own(v,k)))fail('Nepotpuna ili nepoznata polja: '+keys.join(', '));return v;}
function json(raw){
 let v=String(raw).trim();
 const fence=v.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);if(fence)v=fence[1].trim();
 try{return JSON.parse(v);}catch{fail('Model nije završio valjan JSON.');}
}
function unique(xs){if(new Set(xs).size!==xs.length)fail('Imena moraju biti jedinstvena.');}
function outline(v){
 exact(v,['title','v','e','s']);
 const state=arr(v.v,0,16).map(row=>{
  const [id,type,value]=tuple(row,3);name(id);
  if(!['Text','Number','Boolean','List<Text>','List<Number>','List<Boolean>'].includes(type))fail('Nepodržan tip podatka: '+type);
  const matches=(val,t)=>t==='Text'?typeof val==='string'&&val.length<=400:t==='Number'?typeof val==='number'&&Number.isFinite(val):typeof val==='boolean';
  if(type.startsWith('List<')){if(!Array.isArray(value)||value.length>16||value.some(x=>!matches(x,type.slice(5,-1))))fail('Neispravna lista.');}else if(!matches(value,type))fail('Pogrešna početna vrijednost.');
  return {name:id,type,value};
 });
 const events=arr(v.e,1,6).map(row=>{const [id,goal]=tuple(row,2);return {name:name(id),goal:text(goal,100)};});
 const screens=arr(v.s,1,4).map(row=>{const [id,title,goal]=tuple(row,3);return {id:name(id),title:text(title,100),goal:text(goal,120)};});
 unique(state.map(x=>x.name));unique(events.map(x=>x.name));unique(screens.map(x=>x.id));
 return {title:text(v.title,100),state,events,screens};
}
function handler(v,event,structure){
 exact(v,['steps','test']);const states=new Set(structure.state.map(x=>x.name)),screens=new Set(structure.screens.map(x=>x.id));
 const steps=arr(v.steps,1,12).map(row=>{
  if(!Array.isArray(row))fail('Nedostaje radnja.');
  if(row[0]==='set'){tuple(row,3);if(!states.has(name(row[1])))fail('Nepoznat podatak '+row[1]);return {op:'set',target:row[1],expression:text(row[2],400)};}
  if(row[0]==='open'){tuple(row,2);if(!screens.has(name(row[1])))fail('Nepoznat ekran.');return {op:'open',screen:row[1]};}
  if(row[0]==='bil'){tuple(row,2);return {op:'bil',source:text(row[1],400)};}
  fail('Nepoznata radnja.');
 });
 const test=exact(v.test,['inputs','expect']);map(test.inputs);map(test.expect);
 for(const [k,val]of Object.entries({...test.inputs,...test.expect})){if(!states.has(name(k)))fail('Test koristi nedeklarisan podatak.');if(val!==null&&typeof val==='object'&&!Array.isArray(val))fail('Test očekuje tipiziranu vrijednost.');}
 if(!Object.keys(test.expect).length&&!steps.some(x=>x.op==='open'))fail('Radnja treba provjerljivo očekivanje.');
 return {name:event.name,steps,test};
}
const palettes=v=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))fail('Boja mora biti heksadecimalna.');return v;};
function design(v,screen,structure){
 exact(v,['bg','fg','accent','layout','nodes']);const bg=palettes(v.bg),fg=palettes(v.fg),accent=palettes(v.accent);
 if(!['column','row'].includes(v.layout))fail('Raspored treba row ili column.');
 const states=new Map(structure.state.map(x=>[x.name,x.type])),events=new Set(structure.events.map(x=>x.name)),screens=new Set(structure.screens.map(x=>x.id));let count=0;
 const state=id=>{if(!states.has(name(id)))fail('Nepoznat podatak '+id);return id;};
 const event=id=>{if(!events.has(name(id)))fail('Nepoznat događaj '+id);return id;};
 const page=id=>{if(!screens.has(name(id)))fail('Nepoznat ekran '+id);return id;};
 function node(row,depth){
  if(depth>4||++count>40||!Array.isArray(row))fail('Previše Draw elemenata.');const id=screen.id+'_n'+count,kind=row[0];
  if(kind==='i'||kind==='m'){tuple(row,3);return {kind:'input',id,bind:state(row[1]),label:text(row[2]),...(kind==='m'?{multiline:true}:{})};}
  if(kind==='t'){tuple(row,3);return {kind:'toggle',id,bind:state(row[1]),label:text(row[2])};}
  if(kind==='select'){tuple(row,4);return {kind:'select',id,bind:state(row[1]),label:text(row[2]),options:arr(row[3],1,16).map(x=>text(x,80))};}
  if(kind==='b'||kind==='nav'){tuple(row,3);return {kind:'button',id,label:text(row[1]),...(kind==='b'?{runs:event(row[2])}:{opens:page(row[2])}),style:{background:accent,color:fg,padding:12,radius:8}};}
  if(kind==='o'){tuple(row,2);return {kind:'show',id,bind:state(row[1])};}
  if(kind==='h'||kind==='p'){tuple(row,2);return {kind:kind==='h'?'heading':'text',id,label:text(row[1]),style:{color:fg,...(kind==='h'?{fontSize:24,fontWeight:700}:{})}};}
  if(kind==='card'||kind==='row'){tuple(row,3);return {kind,id,label:text(row[1]),children:arr(row[2],1,16).map(x=>node(x,depth+1)),style:{direction:kind==='row'?'row':'column',gap:12,padding:12,radius:10,wrap:'wrap'}};}
  if(kind==='shape'){tuple(row,3);if(!scope.CLEA7BIL.SHAPES.includes(row[1]))fail('Nepoznat oblik.');return {kind:'shape',id,geometry:row[1],label:text(row[2]),style:{background:accent}};}
  if(kind==='clock'){tuple(row,3);if(!Number.isInteger(row[1]))fail('Interval treba cijeli broj.');return {kind:'clock',id,label:'Vrijeme',every:row[1],runs:event(row[2])};}
  fail('Nepodržani Draw element: '+kind);
 }
 const nodes=arr(v.nodes,1,24).map(x=>node(x,0));
 const tree=[{kind:'card',id:screen.id+'_layout',label:screen.title,style:{background:bg,color:fg,direction:v.layout,gap:12,padding:16,radius:14,wrap:'wrap'},children:nodes}];
 return {id:screen.id,title:screen.title,items:[{kind:'bil',source:scope.CLEA7StudioTools.treeSource(tree)}]};
}
const initial=(s)=>({format:'clea7.authoring-plan/1',state:s.state,backends:[],events:[],screens:s.screens.map(x=>({id:x.id,title:x.title,items:[{kind:'heading',label:x.title}]})),start:s.screens[0].id,...(s.state.some(x=>x.type.startsWith('List<'))?{declarations:['import collections']}:{})});
function compile(plan){const result=scope.CLEA7AppAuthoring.emitPlan(plan);scope.CLEA7BIL.compile(result.source);return result.source;}
const compact=s=>({v:s.state.map(x=>[x.name,x.type,x.value]),e:s.events.map(x=>x.name),s:s.screens.map(x=>x.id)});
async function generate(intent,{signal,onStatus=()=>{},ask=scope.CLEA7PublicPlan.requestText}={}){
 if(typeof intent!=='string'||!intent.trim()||intent.length>1200)fail('Opiši aplikaciju do 1200 znakova.');
 const trace=[],check=()=>{if(signal?.aborted)fail('Izrada je zaustavljena.');};
 async function stage(label,instruction,validate,initialDiagnostic=''){
  let diagnosis=initialDiagnostic,previous='';
  for(let attempt=1;attempt<=2;attempt++){
   check();onStatus(label+' · pokušaj '+attempt);const question=instruction+'\nTask: '+intent+(diagnosis?'\nRepair previous error: '+diagnosis+(previous?'\nRejected JSON: '+previous.slice(0,Math.max(0,2200-instruction.length-intent.length)):''):'')+'\nReturn ONLY complete compact JSON. No prose.';
   if(question.length>3000)fail('Opis prelazi radni prozor modela.');
   let reply;
   try{const r=await ask(question,{signal,onStatus:x=>onStatus(label+' · '+x)});reply=r.reply;check();const result=await validate(json(reply));trace.push({stage:label,attempt,passed:true});return result;}
   catch(error){check();diagnosis=String(error.message).slice(0,300);previous=reply||'';trace.push({stage:label,attempt,passed:false,diagnostic:diagnosis});if(attempt===2)throw Object.assign(Error(label+': '+diagnosis),{trace,failedProposal:reply});}
  }
 }
 const structure=await stage('1 · Struktura','Plan app. JSON object {"title":"name","v":[["variable","Text",""]],"e":[["event","short goal"]],"s":[["home","title","purpose"]]}. v types Text,Number,Boolean,List<Text>,List<Number>,List<Boolean>. Up to 16 vars,6 events,4 screens. Use initial empty user fields. Each event has distinct goal. No network. Keep under 220 tokens.',outline);
 const plan=initial(structure),ctx=q(compact(structure)),tests=[];
 function testFor(built){
  const nav=built.steps.filter(x=>x.op==='open').at(-1);
  return {flow:built.name,...built.test,...(nav?{screen:nav.screen}:{})};
 }
 async function eventPhase(i,diagnostic=''){
  const event=structure.events[i],context=q({prior:tests.slice(0,i).map(x=>x.expect),view:plan.screens.map(x=>x.id)});
  const built=await stage('2 · BIL '+event.name,'Write event '+event.name+': '+event.goal+'. Context '+ctx+'. Previous test expectations '+context+'. JSON {"steps":[["set","variable","BIL expression"]],"test":{"inputs":{"var":"sample"},"expect":{"var":"result"}}}. Steps set, open (["open","screen"]), or ["bil","if ... { ... }"]. Strings use escaped quotes; BIL + joins text; collections.append(list,value), collections.remove(list,index), collections.length(list). Test a meaningful change with sample editable inputs; tests run in event order. No device operations. Under 180 tokens.',v=>{
   const value=handler(v,event,structure),events=plan.events.slice();events[i]={name:value.name,steps:value.steps};compile({...plan,events});return value;
  },diagnostic);
  plan.events[i]={name:built.name,steps:built.steps};tests[i]=testFor(built);
 }
 async function screenPhase(i,diagnostic=''){
  const screen=structure.screens[i],context=q(structure.events.map((e,j)=>[e.name,e.goal,Object.keys(tests[j]?.inputs||{})]));
  const view=await stage('3 · Draw '+screen.title,'Design screen '+screen.id+' '+screen.goal+'. Context '+ctx+'. Events and required test inputs '+context+'. JSON {"bg":"#112233","fg":"#ffffff","accent":"#335577","layout":"column","nodes":[["h","Title"],["i","variable","Label"],["b","Button","event"],["o","variable"]]}. Other nodes ["m",var,label] multiline, ["t",var,label] toggle, ["nav",label,screen], ["card",label,[nodes]], ["row",label,[nodes]], ["shape",circle|square|diamond|triangle|ring,label], ["clock",milliseconds,event]. Use only declared names. Provide visible inputs and real event controls, links to other screens. Design accessible controls. Under 250 tokens.',v=>{
   const value=design(v,screen,structure),screens=plan.screens.slice();screens[i]=value;compile({...plan,screens});return value;
  },diagnostic);
  plan.screens[i]=view;
 }
 for(let i=0;i<structure.events.length;i++)await eventPhase(i);
 for(let i=0;i<structure.screens.length;i++)await screenPhase(i);
 // Independently compile and execute generated tests in a throwaway vault.
 // If an actual test fails, repair the relevant event or Draw screen, not
 // a fabricated success response. Re-run all prior checks before acceptance.
 let source=compile(plan),verification=null;
 for(let pass=0;pass<2;pass++){
  check();onStatus('4 · Kompajler i Runtime · provjera '+(pass+1));
  try{
   verification=await scope.CLEA7Intelligence.verifyBIL(source,{metadata:{id:scope.CLEA7Format.newId('qa'),name:structure.title},checks:tests,signal,modelAvailable:true});
   trace.push({stage:'Runtime',attempt:pass+1,passed:true});break;
  }catch(error){
   check();trace.push({stage:'Runtime',attempt:pass+1,passed:false,diagnostic:error.message});
   if(pass===1)throw Object.assign(Error('Runtime nije prihvatio aplikaciju: '+error.message),{trace});
   let failed=0;
   for(let i=0;i<tests.length;i++){try{await scope.CLEA7Intelligence.verifyBIL(source,{metadata:{id:scope.CLEA7Format.newId('qa'),name:structure.title},checks:tests.slice(0,i+1),signal,modelAvailable:true});}catch(e){failed=i;break;}}
   onStatus('5 · Automatska popravka · '+structure.events[failed].name);
   const diagnosis=String(error.message).slice(0,300);
   if(/reachable|visible input|control|navigation/i.test(diagnosis)){
    for(let i=0;i<structure.screens.length;i++)await screenPhase(i,diagnosis+'; ensure reachable controls for '+structure.events[failed].name+' and inputs '+q(tests[failed].inputs));
   }else{
    await eventPhase(failed,diagnosis+'; actual test '+q(tests[failed]).slice(0,200));
   }
   source=compile(plan);
  }
 }
 if(!verification)fail('Runtime nije završio provjeru.');
 return {reply:q(plan),modelProfile:'qwen3.5-9b-q4_k_m',title:structure.title,trace,checks:tests,source};
}
scope.CLEA7PublicStudioAgent=Object.freeze({generate,outline,handler,design});
})(globalThis);
