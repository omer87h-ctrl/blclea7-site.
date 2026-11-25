'use strict';
/* Model-driven authoring pipeline. Every phase is a fresh real Qwen request.
   Only the established BIL compiler, Draw composition and SHADOW Runtime
   interpret the result. No canned application, executable JS or remote grants. */
(function(scope){
const fail=m=>{throw Error(m);},q=JSON.stringify,own=(v,k)=>Object.hasOwn(v,k);
const arr=(v,min,max)=>{if(!Array.isArray(v)||v.length<min||v.length>max)fail('Očekujem '+(min===max?min:min+'–'+max)+' elemenata; dobijeno '+(Array.isArray(v)?v.length:'nije lista')+'.');return v;};
const tuple=(v,n)=>arr(v,n,n);
const name=v=>{if(typeof v!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(v)||!scope.CLEA7BIL.safe(v))fail('Neispravno BIL ime: '+JSON.stringify(v)+'. Koristi jedinstven ASCII identifikator, npr. noteText ili saveNote.');return v;};
const text=(v,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('Neispravan tekst.');return v;};
const map=v=>{if(!v||typeof v!=='object'||Array.isArray(v))fail('Očekujem JSON objekat.');return v;};
function exact(v,keys){map(v);if(Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!own(v,k)))fail('Nepotpuna ili nepoznata polja: '+keys.join(', '));return v;}
function json(raw){
 let v=String(raw).trim(),fence=v.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);if(fence)v=fence[1].trim();
 try{return JSON.parse(v);}catch{}
 // Accept only one complete, independently parseable object. Never invent
 // missing braces, values or a truncated suffix.
 const objects=[];let depth=0,start=-1,quoted=false,escaped=false;
 for(let i=0;i<v.length;i++){const c=v[i];if(depth===0){if(c==='{'){start=i;depth=1;}continue;}
 if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
 if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{objects.push(JSON.parse(v.slice(start,i+1)));}catch{}start=-1;}}
 if(depth===0&&objects.length===1)return objects[0];
 fail('Model nije završio valjan JSON.');
}
function lineRows(raw,allowed){
 const rows=[],lines=String(raw).trim().split(/\r?\n/);let ended=false;
 for(const line of lines){const trimmed=line.trim();if(/^END[.!]?$/i.test(trimmed)){ended=true;break;}
 const parts=trimmed.replace(/^(?:[-*]\s+|\d+[.)]\s+)/,'').split('|').map(x=>x.trim());parts[0]=parts[0].toUpperCase();if(!allowed.includes(parts[0]))continue;
 rows.push(parts);
 }
 if(!ended||!rows.length)fail('Nedovršen strukturirani plan (nedostaje END).');
 return rows;
}
function requestedScreens(intent){
 const m=String(intent).toLowerCase().match(/\b(\d{1,2}|jedan|dva|tri|četiri|cetiri|pet|šest|sest|sedam|osam|devet|deset|eleven|twelve|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:ekran\w*|screen\w*)/u);
 if(!m)return null;const words={jedan:1,dva:2,tri:3,četiri:4,cetiri:4,pet:5,šest:6,sest:6,sedam:7,osam:8,devet:9,deset:10,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};return words[m[1]]||Number(m[1]);
}
function unique(xs){if(new Set(xs).size!==xs.length)fail('Imena moraju biti jedinstvena.');}
// Model declaration identifiers can be safely normalized before any events or
// screens refer to them. Original labels/goals remain unchanged.
function normalizeIds(rows,prefix){const used=new Set();return rows.map((row,i)=>{let id=String(row[0]||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
 if(!/^[A-Za-z]/.test(id)||!scope.CLEA7BIL.safe(id))id=prefix+'_'+(id||String(i+1));
 if(!scope.CLEA7BIL.safe(id))id=prefix+'_'+(i+1);
 const root=id;let n=1;while(used.has(id)||!scope.CLEA7BIL.safe(id))id=root+'_'+n++;used.add(id);return [name(id),...row.slice(1)];});}
function outline(v){
 exact(v,['title','v','e','s']);
 const state=arr(v.v,0,16).map(row=>{
  const [id,type]=tuple(row,2);name(id);
  if(!['Text','Number','Boolean','List<Text>','List<Number>','List<Boolean>'].includes(type))fail('Nepodržan tip podatka: '+type);
  // This wire declares types only. Empty initial state is part of its
  // documented semantics, not a guessed correction of model-generated values.
  const value=type==='Text'?'':type==='Number'?0:type==='Boolean'?false:[];

  return {name:id,type,value};
 });
 const events=arr(v.e,1,12).map(row=>{const [id,goal]=tuple(row,2);return {name:name(id),goal:text(goal,100)};});
 const screens=arr(v.s,1,16).map(row=>{const [id,title,goal]=tuple(row,3);return {id:name(id),title:text(title,100),goal:text(goal,120)};});
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
function eventRows(raw){
 const rows=lineRows(raw,['SET','OPEN','BIL','INPUT','EXPECT']),steps=[],inputs=Object.create(null),expect=Object.create(null);
 for(const row of rows){
  const [kind,key,...rest]=row;
  if(kind==='SET'){if(rest.length!==1)fail('SET treba ime i BIL izraz.');steps.push(['set',key,rest[0]]);}
  else if(kind==='OPEN'||kind==='BIL'){tuple(row,2);steps.push([kind.toLowerCase(),key]);}
  else{
   tuple(row,3);const target=kind==='INPUT'?inputs:expect;name(key);if(own(target,key))fail('Duplikat testnog polja '+key);
   try{target[key]=JSON.parse(rest[0]);}catch{fail(kind+' '+key+' treba potpunu JSON vrijednost.');}
  }
 }
 return {steps,test:{inputs,expect}};
}
function designRows(raw){
 const rows=lineRows(raw,['THEME','H','P','I','M','T','SELECT','B','O','NAV','SHAPE','CLOCK','TREE']),themes=rows.filter(r=>r[0]==='THEME');if(themes.length!==1)fail('Potreban je jedan THEME red.');
 const [_,bg,fg,accent,layout]=tuple(themes[0],5),nodes=[];
 for(const row of rows){const [kind,...parts]=row;if(kind==='THEME')continue;
  if(kind==='TREE'){tuple(row,2);nodes.push(json(parts[0]));continue;}
  if(kind==='SELECT'){tuple(row,4);nodes.push(['select',parts[0],parts[1],JSON.parse(parts[2])]);continue;}
  if(kind==='CLOCK'){tuple(row,3);nodes.push(['clock',Number(parts[0]),parts[1]]);continue;}
  nodes.push([kind.toLowerCase(),...parts]);
 }
 return {bg,fg,accent,layout,nodes};
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
 const items=[{kind:'bil',source:scope.CLEA7StudioTools.treeSource(tree)}];
 // Standard navigation is assembled from the model's own screen plan, not a canned application.
 if(structure.screens.length>1){const home=structure.screens[0],targets=screen.id===home.id?structure.screens.slice(1):[home];const links=targets.map((target,i)=>({kind:'button',id:screen.id+'_nav'+i,label:target.title,opens:target.id}));items.push({kind:'bil',source:scope.CLEA7StudioTools.treeSource([{kind:'row',id:screen.id+'_nav',label:'Navigacija',style:{wrap:'wrap',gap:8},children:links}])});}
 return {id:screen.id,title:screen.title,items};
}
const initial=(s)=>({format:'clea7.authoring-plan/1',state:s.state,backends:[],events:[],screens:s.screens.map(x=>({id:x.id,title:x.title,items:[{kind:'heading',label:x.title}]})),start:s.screens[0].id,...(s.state.some(x=>x.type.startsWith('List<'))?{declarations:['import collections']}:{})});
function compile(plan){const result=scope.CLEA7AppAuthoring.emitPlan(plan);scope.CLEA7BIL.compile(result.source);return result.source;}
const compact=s=>({v:s.state.map(x=>[x.name,x.type]),e:s.events.map(x=>x.name),s:s.screens.map(x=>x.id)});
// A complete JSON object is an alternative wire, not a guessed END marker.
function phaseJSON(label,raw){
 const v=json(raw);
 if(label.startsWith('1a')){exact(v,['title','s']);return [['TITLE',v.title],...arr(v.s,1,16).map(r=>['PAGE',...tuple(r,3)])].map(r=>r.join('|')).join('\n')+'\nEND';}
 if(label.startsWith('1b')){exact(v,['v','e']);return [...arr(v.v,0,16).map(r=>['V',...tuple(r,2)]),...arr(v.e,1,12).map(r=>['E',...tuple(r,2)])].map(r=>r.join('|')).join('\n')+'\nEND';}
 return v;
}
const phaseFormat=label=>label.startsWith('1a')?'{"title":"App title","s":[["home","Home","purpose"]]}':label.startsWith('1b')?'{"v":[["noteText","Text"]],"e":[["saveNote","save note"]]}':label.startsWith('2')?'{"steps":[["set","variable","BIL expression"]],"test":{"inputs":{},"expect":{}}}':'{"bg":"#112233","fg":"#ffffff","accent":"#335577","layout":"column","nodes":[["h","Title"]]}';
async function generate(intent,{signal,onStatus=()=>{},ask=scope.CLEA7PublicPlan.requestText}={}){
 if(typeof intent!=='string'||!intent.trim()||intent.length>1200)fail('Opiši aplikaciju do 1200 znakova.');
 const trace=[],check=()=>{if(signal?.aborted)fail('Izrada je zaustavljena.');};
 async function stage(label,instruction,validate,initialDiagnostic='',wire='json'){
  let diagnosis=initialDiagnostic,previous='';
  for(let attempt=1;attempt<=3;attempt++){
   check();const alternative=wire==='lines'&&attempt===3;
   onStatus(label+' · pokušaj '+attempt+(alternative?' · alternativni JSON plan':''));
   const suffix=alternative?'\nUse ONLY this complete JSON object shape, NOT pipe rows or END: '+phaseFormat(label)+'. Fill it with the actual task data.':wire==='lines'?'\nReturn only the specified pipe-delimited rows, followed by END. No prose.':'\nReturn ONLY complete compact JSON. No prose.';
   const task='\nTask: '+intent;
   const repair=diagnosis?'\nRepair error: '+diagnosis:'';
   const budget=3000-instruction.length-task.length-suffix.length-repair.length;
   const prior=previous&&budget>40&&!alternative?'\nRejected output: '+previous.slice(0,budget-20):'';
   const question=instruction+task+repair+prior+suffix;
   if(question.length>3000)fail('Opis prelazi radni prozor modela.');
   let reply;
   try{const r=await ask(question,{signal,onStatus:x=>onStatus(label+' · '+x)});reply=r.reply;check();const result=await validate(alternative?phaseJSON(label,reply):wire==='lines'?reply:json(reply));trace.push({stage:label,attempt,passed:true,wire:alternative?'json':wire});return result;}
   catch(error){check();diagnosis=String(error.message).slice(0,180);previous=reply||'';trace.push({stage:label,attempt,passed:false,diagnostic:diagnosis,wire:alternative?'json':wire});if(attempt===3)throw Object.assign(Error(label+': '+diagnosis),{trace,failedProposal:reply});}
  }
 }
 const count=requestedScreens(intent);if(count!==null&&(count<1||count>16))fail('Ova verzija podržava 1–16 ekrana po aplikaciji.');
 const layout=await stage('1a · Ekrani','Plan only the app title and screens. One row TITLE|app title. Then PAGE|identifier|title|short purpose for each distinct screen. '+(count?'Exactly '+count+' PAGE rows.':'Choose 1 to 6 PAGE rows as needed.')+' ASCII identifiers, short labels, max 5 words per purpose. Last line END.',raw=>{
  const rows=lineRows(raw,['TITLE','PAGE']),titles=rows.filter(r=>r[0]==='TITLE');if(titles.length!==1)fail('Potreban je jedan naslov aplikacije.');tuple(titles[0],2);
  const screens=rows.filter(r=>r[0]==='PAGE').map(row=>{tuple(row,4);return row.slice(1);});
  arr(screens,1,16);if(count!==null&&screens.length!==count)fail('Traženo '+count+' ekrana; model dao '+screens.length+'.');const normalized=normalizeIds(screens,'page');
  return {title:text(titles[0][1],100),s:normalized};
 },'','lines');
 const structure=await stage('1b · Podaci i radnje','Plan data and actions for screens '+q(layout.s)+'. Rows V|identifier|type and E|identifier|short goal. Example V|noteText|Text and E|saveNote|save note. ASCII camelCase identifiers; no spaces, accents, BIL keywords, types or descriptions as identifiers. Types Text,Number,Boolean,List<Text>,List<Number>,List<Boolean>. Up to 16 V and 12 E. No initial values. Meaningful task actions. Last line END.',raw=>{
  const rows=lineRows(raw,['V','E']);const v=rows.filter(r=>r[0]==='V').map(r=>{tuple(r,3);return r.slice(1);}),e=rows.filter(r=>r[0]==='E').map(r=>{tuple(r,3);return r.slice(1);});return outline({...layout,v:normalizeIds(v,'data'),e:normalizeIds(e,'action')});
 },'','lines');

 const plan=initial(structure),ctx=q(compact(structure)),tests=[];
 function testFor(built){
  const nav=built.steps.filter(x=>x.op==='open').at(-1);
  return {flow:built.name,...built.test,...(nav?{screen:nav.screen}:{})};
 }
 async function eventPhase(i,diagnostic=''){
  const event=structure.events[i],context=q({prior:tests.slice(0,i).map(x=>x.expect),view:plan.screens.map(x=>x.id)});
  const built=await stage('2 · BIL '+event.name,'Write event '+event.name+': '+event.goal+'. State and screens '+ctx+'. Prior expected state '+context+'. Output rows: SET|variable|BIL expression, optional OPEN|screen, or BIL|statement. Then INPUT|variable|JSON value for each user input and EXPECT|variable|JSON value for changed output. Quoted strings in expressions. collections.append(list,value), collections.remove(list,index), collections.length(list), clear with collections.slice(list,0,0). Real test in event order. No device operations. END.',v=>{
   const value=handler(typeof v==='string'?eventRows(v):v,event,structure),events=plan.events.slice();events[i]={name:value.name,steps:value.steps};compile({...plan,events});return value;
  },diagnostic,'lines');
  plan.events[i]={name:built.name,steps:built.steps};tests[i]=testFor(built);
 }
 async function screenPhase(i,diagnostic=''){
  const screen=structure.screens[i],context=q(structure.events.map((e,j)=>[e.name,e.goal,Object.keys(tests[j]?.inputs||{})]));
  const view=await stage('3 · Draw '+screen.title,'Design screen '+screen.id+' '+screen.goal+'. Context '+ctx+'. Events and test inputs '+context+'. Output THEME|#112233|#ffffff|#335577|column (choose colors), then rows H|heading, P|text, I|variable|label, M|variable|multiline label, T|variable|toggle label, B|label|event, O|variable, NAV|label|screen, SHAPE|circle|label, CLOCK|milliseconds|event, SELECT|variable|label|JSON array options. Only declared names. Include usable controls for this screen. Navigation to home is added automatically. END.',v=>{
   const value=design(typeof v==='string'?designRows(v):v,screen,structure),screens=plan.screens.slice();screens[i]=value;compile({...plan,screens});return value;
  },diagnostic,'lines');
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
scope.CLEA7PublicStudioAgent=Object.freeze({generate,outline,handler,design,lineRows,requestedScreens,json,eventRows,designRows,phaseJSON});
})(globalThis);
