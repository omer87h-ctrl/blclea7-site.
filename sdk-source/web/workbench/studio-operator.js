'use strict';
/* One original Studio tool contract for visual controls, Draw and AI proposals.
 * Tools produce the same checked BIL source. They never grant device privileges. */
(function(scope){
const FORMAT='clea7.studio-tools/1',B=scope.CLEA7BIL,q=JSON.stringify;
// Exact original executable SDK Sense program; verified against its source in tests.
const SENSE_CV_SOURCE="# Original accessible CV application, authored as BIL; no model or cloud required.\nbackend assist using \"sense.local/1\"\nlet name = \"\"\nlet experience = \"\"\nlet education = \"\"\nlet skills = \"\"\nlet cv = \"\"\nlet dictated = \"\"\nlet requested = false\nlet stopped = false\nlet stopFailure: RemoteFailure? = null\nlet failure: RemoteFailure? = null\nlet status = \"Unesi samo svoje stvarne podatke.\"\non review {\n    cv = name + \"\\n\\nRadno iskustvo\\n\\n\" + experience + \"\\n\\nObrazovanje\\n\\n\" + education + \"\\n\\nVještine\\n\\n\" + skills\n    open preview\n}\non export_cv {\n    request assist.document.docx(cv) into requested catch failure then ready else failed\n}\non read_cv {\n    request assist.speech.speak(cv) into requested catch failure then ready else failed\n}\non dictate {\n    request assist.speech.listen(\"bs-BA\") into dictated catch failure then heard else failed\n}\non stop_speech {\n    request assist.speech.stop() into stopped catch stopFailure\n}\non heard(result: Text, context: RemoteCompletion) { status = \"Pregledaj prepoznati tekst. Prenos u iskustvo biraš zasebno.\" }\non append_dictation { experience = experience + \"\\n\" + dictated; dictated = \"\" }\non ready(result: Boolean, context: RemoteCompletion) { status = \"Sistemska usluga je završila zahtjev. Provjeri rezultat.\" }\non failed(problem: RemoteFailure, context: RemoteCompletion) { status = problem.code }\non back { open editor }\nscreen editor \"Moj pristupačni CV\" {\n    heading \"Tvoj CV, tvoji podaci\" key title\n    input name label \"Ime ili naziv koji želiš navesti\" key name\n    input experience label \"Radno iskustvo\" multiline key experience\n    input education label \"Obrazovanje\" multiline key education\n    input skills label \"Vještine\" multiline key skills\n    button \"Diktiraj uz dozvolu mikrofona\" runs dictate key dictate\n    show dictated key dictated\n    button \"Dodaj pregledani tekst u iskustvo\" runs append_dictation key append\n    button \"Pripremi pregled CV-a\" runs review key review\n    show status key status\n}\nscreen preview \"Pregled CV-a\" {\n    heading \"Pregledaj prije izvoza\" key preview_title\n    show cv key cv\n    button \"Preuzmi DOCX uz potvrdu\" runs export_cv key export\n    button \"Izgovori CV uz potvrdu\" runs read_cv key speak\n    button \"Zaustavi govor ili diktiranje\" runs stop_speech key stop\n    button \"Uredi podatke\" runs back key back\n    show status key preview_status\n}\nstart editor\n";

const fail=message=>{throw Object.assign(Error(message),{code:'StudioTool'});};
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function shape(x,required,optional=[]){if(!object(x)||required.some(k=>!Object.hasOwn(x,k))||Object.keys(x).some(k=>!required.includes(k)&&!optional.includes(k)))fail('Nepotpuna ili nepoznata Studio radnja.');}
function name(x){if(typeof x!=='string'||x.length>48||!B.safe(x))fail('Neispravan Studio identitet.');return x;}
function text(x,max=800){if(typeof x!=='string'||!x.trim()||x.length>max)fail('Studio tekst je prazan ili predug.');return x;}
const TOOLS=Object.freeze({
 'project.create':'Novi BIL projekt; samo pri izričitoj izradi novog projekta.',
 'object.remember':'Definiši tipizirano polje u vlastitoj gramatici BIL objekata.',
 'object.derive':'Definiši reaktivnu vezu ili potpun logički izbor polja.',
 'object.action':'Definiši imenovanu promjenu i opcionalnu korisničku radnju objekta.',
 'object.label':'Dodaj razumljiv naziv prikaza postojećeg polja objekta.',
 'screen.add':'Dodaj ekran u isti projekt.',
 'sense.cv':'Kreiraj originalnu pristupačnu CV aplikaciju s praznim podacima i lokalnim Sense ugovorima.',
 'scene.add':'Dodaj provjerenu živu 2D scenu, fiziku, kameru, vremenske tačke i kontrole u isti BIL projekt.',
 'sense.ocr':'Dodaj lokalno čitanje slike, pregled prije prijenosa i tipizirani tekst u isti projekt.',
 'ui.add':'Dodaj radni element sa stvarnim stanjem i događajima.',
 'ui.collection':'Dodaj tipiziranu kolekciju i događaje stavki.',
 'ui.compose':'Sastavi vlastitu ugniježđenu hijerarhiju rasporeda, prostora, vektora i radnih kontrola.',
 'ui.style':'Izmijeni provjerene vizuelne osobine postojeće komponente bez promjene njene logike.',
 'ui.label':'Izmijeni naziv postojeće komponente.',
 'ui.move':'Premjesti komponentu u postojeći raspored ili ekran.',
 'ui.duplicate':'Dupliciraj komponentu ili cijelu grupu s novim jedinstvenim ključevima.',
 'ui.remove':'Ukloni samo odabranu vizuelnu komponentu ili grupu.',
 'draw.add':'Dodaj originalni vektorski objekat, igrača, vrata ili prepreku.',
 'draw.position':'Izmijeni početni položaj postojećeg objekta.',
 'draw.proximity':'Poveži postojeća vrata s igračem i provjerenom udaljenošću.',
 'bil.declaration':'Dodaj provjerenu deklaraciju, funkciju ili izvedenu vrijednost.',
 'bil.event':'Dodaj provjereni BIL događaj.',
 'bil.item':'Dodaj provjerenu BIL komponentu postojećem ekranu.'
});
const NODE_KINDS=Object.freeze(['row','card','heading','text','input','toggle','select','button','show','visualize','shape','drawing','space','clock','pad']);
function treeSource(nodes){
 let count=0;const keys=new Set();
 const list=(v,min,max)=>{if(!Array.isArray(v)||v.length<min||v.length>max)fail('Neispravan broj elemenata kompozicije.');return v;};
 const label=v=>q(text(v,200));
 const scalar=v=>{if(typeof v==='number'&&Number.isFinite(v)||typeof v==='string')return q(v);if(object(v)&&Object.keys(v).join()==='bind')return name(v.bind);fail('Izgled prihvata vrijednost ili tipiziranu vezu sa stanjem.');};
 function node(n,depth){
  if(++count>128||depth>12)fail('Kompozicija prelazi128 elemenata ili12 nivoa.');
  if(!object(n)||!NODE_KINDS.includes(n.kind))fail('Nepodržana komponenta kompozicije.');
  const fields={row:['children'],card:['children'],heading:[],text:[],input:['bind','required','multiline','range'],toggle:['bind'],select:['bind','options'],button:['runs','opens','validate'],show:['bind'],visualize:['bind','range'],shape:['geometry'],drawing:['points','role','closed','fill','ink','weight'],space:['size','camera','children'],clock:['every','runs'],pad:['directions']};
  shape(n,['kind','id'],['label','style','motion','gestures',...fields[n.kind]]);name(n.id);if(keys.has(n.id))fail('Ključevi kompozicije moraju biti jedinstveni.');keys.add(n.id);
  let s;
  if(['row','card','space'].includes(n.kind)){
   s=n.kind+' '+label(n.label||n.id);
   if(n.kind==='space'){const size=list(n.size,2,2);if(size.some(x=>!Number.isFinite(x)||x<64||x>4096))fail('Prostor treba dimenzije64–4096.');s+=' size '+q(size);if(n.camera)s+=' camera ['+list(n.camera,3,3).map(name).join(', ')+']';}
   s+=' {\n'+list(n.children||[],0,128).map(child=>' '+node(child,depth+1).replaceAll('\n','\n ')).join('\n')+'\n}';
  }else if(['heading','text'].includes(n.kind))s=n.kind+' '+label(n.label);
  else if(['input','toggle','select'].includes(n.kind)){
   s=n.kind+' '+name(n.bind)+' label '+label(n.label);
   if(n.required!==undefined){if(typeof n.required!=='boolean')fail('Obaveznost treba Boolean.');if(n.required)s+=' required';}
   if(n.multiline!==undefined){if(typeof n.multiline!=='boolean')fail('Višeredni unos treba Boolean.');if(n.multiline)s+=' multiline';}
   if(n.range)s+=' range '+q(list(n.range,2,2));if(n.options)s+=' options '+q(list(n.options,1,32));
  }else if(n.kind==='button'){
   if(Boolean(n.runs)===Boolean(n.opens))fail('Dugme treba tačno jedan događaj ili odredišni ekran.');
   s='button '+label(n.label)+(n.runs?' runs '+name(n.runs):' opens '+name(n.opens));if(n.validate===true)s+=' validate';else if(n.validate!==undefined&&n.validate!==false)fail('Validacija treba Boolean.');
  }else if(['show','visualize'].includes(n.kind)){
   s=n.kind+' '+name(n.bind);if(n.kind==='visualize')s+=' using runtime';if(n.range)s+=' range '+q(list(n.range,2,2));
  }else if(n.kind==='shape')s='shape '+label(n.geometry)+' label '+label(n.label);
  else if(n.kind==='drawing'){
   const points=list(n.points,2,256);if(points.some(p=>!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x)||x<0||x>1000)))fail('Vektor treba normalizirane numeričke tačke0–1000.');
   if(n.closed!==undefined&&typeof n.closed!=='boolean')fail('Zatvorena kontura treba Boolean.');
   const weight=n.weight??2;if(!Number.isFinite(weight)||weight<1||weight>16)fail('Debljina vektora treba biti broj1–16.');
   s='drawing '+label(n.label)+' points '+q(points)+' role '+name(n.role||'object')+(n.closed===false?'':' closed')+' fill '+q(n.fill||'#ffac77')+' ink '+q(n.ink||'#e2e8f0')+' weight '+weight;
  }else if(n.kind==='clock'){if(!Number.isInteger(n.every))fail('Sat treba cjelobrojni interval.');s='clock '+label(n.label)+' every '+n.every+' runs '+name(n.runs);}
  else if(n.kind==='pad'){shape(n.directions,['left','right','up','down','release']);s='pad '+label(n.label)+' '+Object.entries(n.directions).map(([k,v])=>k+' '+name(v)).join(' ');}
  if(n.style){if(!object(n.style))fail('Izgled treba mapu osobina.');s+=' style { '+Object.entries(n.style).map(([k,v])=>{if(!Object.hasOwn(B.PRESENTATION,k))fail('Nepoznata vizuelna osobina.');return k+' '+scalar(v);}).join('; ')+' }';}
  if(n.motion){shape(n.motion,['preset','duration']);if(!B.MOTIONS.includes(n.motion.preset)||!Number.isFinite(n.motion.duration))fail('Nepodržana animacija.');s+=' motion '+n.motion.preset+' '+n.motion.duration;}
  if(n.gestures){if(!object(n.gestures))fail('Geste trebaju mapu događaja.');s+=' gestures { '+Object.entries(n.gestures).map(([g,h])=>{if(!B.GESTURES.includes(g))fail('Nepodržana gesta.');return g+' runs '+name(h);}).join('; ')+' }';}
  return s+' key '+n.id;
 }
 return list(nodes,1,128).map(n=>node(n,0)).join('\n');
}
function compose(source,{screen,parent,nodes}){
 const c=B.compile(source),page=c.ast.body.find(n=>n.kind==='screen'&&n.name===name(screen));if(!page)fail('Odaberi postojeći ekran.');
 let target=page;const walk=xs=>{for(const n of xs){if(n.key===parent||n.id===parent)target=n;if(n.children)walk(n.children);}};
 if(parent){walk(page.children);if(target===page||!['ui_row','ui_card','ui_space'].includes(target.kind))fail('Odredište treba postojeći raspored ili prostor u istom ekranu.');}
 const insertion=treeSource(nodes),at=target.childrenEnd??target.loc.end-1,next=source.slice(0,at)+'\n'+insertion+'\n'+source.slice(at);B.compile(next);return next;
}
function context(source){
 const c=B.compile(source),draw=scope.CLEA7Draw.model(source);
 const components=[];const visit=(nodes,page,parent)=>{for(const n of nodes){if(n.kind!=='screen')components.push({id:n.id,key:n.key||null,kind:n.kind.replace('ui_',''),label:n.label||'',screen:page,parent,bind:n.name||null});if(n.children)visit(n.children,page,n.id);}};for(const page of c.ast.body.filter(n=>n.kind==='screen'))visit(page.children,page.name,page.id);
 return {format:FORMAT,tools:Object.keys(TOOLS),screens:c.ast.body.filter(n=>n.kind==='screen').map(n=>({id:n.name,title:n.label})),
  objects:draw.objects.map(({key,label,role,screen,x,y,width,height})=>({key,label,role,screen,x,y,width,height})),
  ...(c.ir.objects?{grammar:'bil.objects/1',objectModel:c.ir.objects.objects}:{}),components,state:Object.entries(c.ir.globals).map(([id,s])=>({id,type:s.type,mutable:s.mutable})),events:Object.keys(c.ir.handlers).filter(n=>!n.startsWith('ui_'))};
}
async function modelContext(source){
 const value=context(source),data={format:'clea7.studio-context/1',fingerprint:await scope.CLEA7.digest(source),screens:value.screens,state:value.state.map(x=>({id:x.id,type:typeof x.type==='string'?x.type:'Structured',mutable:x.mutable})),events:value.events,components:value.components.map(x=>({...x,label:x.label.slice(0,80)})),omitted:0};
 if(value.grammar){data.grammar=value.grammar;data.objectModel=value.objectModel;}
 while(new TextEncoder().encode(q(data)).length>8000&&data.components.length){data.components.pop();data.omitted++;}
 if(new TextEncoder().encode(q(data)).length>8000)fail('Struktura projekta prelazi trenutni modelski prozor. Izvor nije poslan.');return data;
}
function emit(plan,{source=null}={}){
 shape(plan,['format','operations'],['checks']);if(plan.format!==FORMAT||!Array.isArray(plan.operations)||!plan.operations.length||plan.operations.length>32||new TextEncoder().encode(q(plan)).length>12000)fail('Nepodržan ili prevelik Studio plan.');
 if(source!==null&&(typeof source!=='string'||new TextEncoder().encode(source).length>131072))fail('Neispravan postojeći BIL izvor.');
 const operations=[];let next=source,projectName=null;
 for(const [index,op]of plan.operations.entries()){
  if(!object(op)||!Object.hasOwn(TOOLS,op.tool))fail('Studio ne dopušta ovu radnju.');
  if(op.tool==='sense.cv'){
   shape(op,['tool']);if(next!==null||index!==0)fail('Sense CV je izričito novi projekt; postojeći rad ostaje sačuvan.');next=SENSE_CV_SOURCE;projectName='Moj pristupačni CV';
  }else if(op.tool==='project.create'){
   shape(op,['tool','screen','title'],['grammar']);if(next!==null||index!==0)fail('Postojeći projekt se ne zamjenjuje radnjom za novi projekt.');
   if(op.grammar!==undefined&&!['classic','objects'].includes(op.grammar))fail('Nepoznata BIL gramatika.');
   projectName=text(op.title,100);next=op.grammar==='objects'?'BIL '+q(projectName)+'.\n':'screen '+name(op.screen)+' '+q(text(op.title,160))+' {\n}\nstart '+op.screen+'\n';
  }else{
   if(next===null)fail('Novi Studio plan mora prvo kreirati projekt.');
   const sentence=B.compile(next).ir.objects;
   if(sentence&&!op.tool.startsWith('object.')&&op.tool!=='ui.label')fail('Ovaj projekt koristi BIL rečenice. Uredi objekte alatima object.*; postojeći izvor je sačuvan.');
   if(op.tool.startsWith('object.')){
    const kind=op.tool.slice(7),fields={remember:[['object','field','type','value'],[]],derive:[['object','field','expression'],['whenTrue','whenFalse']],action:[['object','field','action','expression'],['label']],label:[['object','field','label'],[]]}[kind];
    shape(op,['tool',...fields[0]],fields[1]);const {tool,...parameters}=op;next=B.objectWrite(next,{kind,...parameters});
   }else if(op.tool==='ui.compose'){shape(op,['tool','screen','nodes'],['parent']);next=compose(next,op);}
   else if(['ui.style','ui.label','ui.move','ui.duplicate','ui.remove'].includes(op.tool)){
    const D=scope.CLEA7BILDesigner;if(!D)fail('Ovom hostu nedostaje zajednički editor izgleda.');
    if(op.tool==='ui.style'){shape(op,['tool','target','style']);if(!object(op.style)||!Object.keys(op.style).length||Object.keys(op.style).length>32)fail('Odaberi vizuelne osobine.');for(const [property,value]of Object.entries(op.style)){if(object(value)){shape(value,['bind']);name(value.bind);}else if(typeof value!=='string'&&!(typeof value==='number'&&Number.isFinite(value)))fail('Neispravna vizuelna vrijednost.');next=D.editAppearance(next,text(op.target,64),'style',property,value);}}
    else if(op.tool==='ui.label'){shape(op,['tool','target','label']);next=D.changeLabel(next,text(op.target,64),text(op.label,200));}
    else if(op.tool==='ui.move'){shape(op,['tool','target','parent']);next=D.reparent(next,text(op.target,64),text(op.parent,64));}
    else{shape(op,['tool','target']);next=D[op.tool==='ui.duplicate'?'duplicate':'remove'](next,text(op.target,64));}
   }else if(op.tool==='scene.add'){shape(op,['tool','screen','id']);next=scope.CLEA7Draw.addScene(next,{screen:name(op.screen),id:name(op.id)}).source;}else if(op.tool==='sense.ocr'){
    shape(op,['tool','screen','id'],['language','label']);name(op.id);name(op.screen);const language=op.language||'bos';if(!['bos','eng'].includes(language))fail('Nepodržan OCR jezik.');
    const c=B.compile(next),prefix=op.id;if(!c.ast.body.some(n=>n.kind==='screen'&&n.name===op.screen))fail('OCR ekran ne postoji.');
    if(Object.keys(c.ir.globals).some(k=>k===prefix+'_text'||k===prefix+'_failure')||Object.hasOwn(c.ir.handlers,prefix+'_read')||Object.hasOwn(c.ir.remote?.backends||{},prefix+'_assist'))fail('OCR identitet već pripada postojećem kodu.');
    if(!scope.CLEA7RemoteStudio)fail('Host nema zajednički autor mogućnosti.');
    next=scope.CLEA7RemoteStudio.addRequest(next,{backend:prefix+'_assist',operation:'document.ocr',value:q(language),handler:prefix+'_read',resultTarget:prefix+'_text',errorTarget:prefix+'_failure',screen:op.screen,buttonLabel:op.label?text(op.label,100):'Pročitaj sliku lokalno'});
    const page=B.parse(next).body.find(n=>n.kind==='screen'&&n.name===op.screen),at=page.childrenEnd??page.loc.end-1;
    next=next.slice(0,at)+'\ninput '+prefix+'_text label "Pregledani tekst slike" multiline key '+prefix+'_output\n'+next.slice(at);
   }else if(op.tool==='screen.add'){
    shape(op,['tool','screen','title']);name(op.screen);if(B.parse(next).body.some(n=>n.name===op.screen))fail('Ekran ili simbol već postoji.');
    next+='\nscreen '+op.screen+' '+q(text(op.title,160))+' {\n}\n';
   }else if(['ui.add','ui.collection','draw.add'].includes(op.tool)){
    shape(op,['tool','spec']);if(!object(op.spec))fail('Radnja treba tipizirane parametre.');
    const allowed=op.tool==='draw.add'?['screen','id','label','role','x','y','width','height','step','radius','points','fill','ink','closed','actor']:op.tool==='ui.add'?['screen','id','label','kind','initial','required','options','min','max','step','handler','target','amount','text']:['screen','id','label','action','collection','selection','identity','handler','columns','image'];
    if(Object.keys(op.spec).some(k=>!allowed.includes(k)))fail('Nepoznat parametar Studio alata.');
    const fn=op.tool==='draw.add'?scope.CLEA7Draw.addObject:op.tool==='ui.add'?scope.CLEA7BILElements.build:scope.CLEA7BILElements.buildCollection;
    next=fn(next,op.spec).source;
   }else if(op.tool==='draw.position'){
    shape(op,['tool','object','x','y']);next=scope.CLEA7Draw.setPosition(next,text(op.object,64),op.x,op.y);
   }else if(op.tool==='draw.proximity'){
    shape(op,['tool','object','actor','radius']);next=scope.CLEA7Draw.setProximity(next,text(op.object,64),text(op.actor,64),op.radius);
   }else{
    shape(op,op.tool==='bil.item'?['tool','screen','source']:['tool','source']);text(op.source,8000);
    if(op.tool==='bil.item'){
     const children=B.parse('screen cleaProbe "Probe" {\n'+op.source+'\n}').body;
     if(children.length!==1||children[0].kind!=='screen'||!children[0].children.length)fail('Radnja treba stvarnu BIL komponentu.');
     const page=B.parse(next).body.find(n=>n.kind==='screen'&&n.name===name(op.screen));if(!page)fail('Ekran ne postoji.');
     const at=page.childrenEnd??page.loc.end-1;next=next.slice(0,at)+'\n'+op.source+'\n'+next.slice(at);
    }else{
     const nodes=B.parse(op.source).body,allowed=op.tool==='bil.event'?['handler']:['import','declare','constant','record','function','derive'];
     if(nodes.length!==1||!allowed.includes(nodes[0].kind))fail('Radnja treba jednu odgovarajuću BIL konstrukciju.');next+='\n'+op.source+'\n';
    }
   }
  }
  B.compile(next);operations.push({tool:op.tool,completed:true});
 }
 if(new TextEncoder().encode(next).length>131072)fail('Rezultat prelazi BIL budžet. Postojeći izvor ostaje sačuvan.');
 const checks=plan.checks||[];if(!Array.isArray(checks)||checks.length>20)fail('Previše provjera ponašanja.');
 return {source:next,projectName,operations,checks,representation:'tools',modelInvoked:false};
}
function resolve(question,source,{selected=null,screen=null}={}){
 if(typeof question!=='string'||!question.trim()||question.length>1200)return null;
 const words=question.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),c=source?context(source):null;
 if(/\b(napravi|kreiraj|izradi|create|build|make)\b/.test(words)&&/\b(cv|zivotopis|resume)\b/.test(words)&&!/(ocr|skeniran|scanned)/.test(words))return {plan:{format:FORMAT,operations:[{tool:'sense.cv'}],checks:[{flow:'review',screen:'preview',expect:{}},{flow:'back',screen:'editor',expect:{name:'',experience:'',education:'',skills:''}}]},resolution:'original-Sense-program',createsProject:true};
 const first=c?.screens.find(s=>s.id===screen)?.id||c?.screens[0]?.id||'home';
 const findObject=()=>{if(selected)return c?.objects.find(o=>o.key===selected);const found=c?.objects.filter(o=>words.includes(o.label.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase())||words.includes(o.key.toLowerCase()));return found?.length===1?found[0]:null;};
 const operations=[],fresh=prefix=>{let n=1,id=prefix;while(c&&(c.state.some(s=>s.id===id||s.id.startsWith('draw7_'+id+'_'))||c.objects.some(o=>o.key==='draw7_'+id)))id=prefix+'_'+n++;return id;};
 if(/^(napravi|kreiraj|izradi|dodaj|create|build|make|add)\b/.test(words)&&/\b(scena|scenu|scene|fizik[a-z]*|physics)\b/.test(words)){
  const create=/^(napravi|kreiraj|izradi|create|build|make)\b/.test(words)||!source;if(create)operations.push({tool:'project.create',screen:'home',title:'Moj živi interaktivni svijet'});
  let id='world',n=1;while(!create&&c?.state.some(s=>s.id.startsWith(id+'_')))id='world'+n++;
  operations.push({tool:'scene.add',screen:create?'home':first,id});return {plan:{format:FORMAT,operations,checks:[{flow:id+'_moveRight',expect:{}},{flow:id+'_frameTick',expect:{[id+'_playerX']:86,[id+'_steps']:1}}]},resolution:'documented-local-rule',createsProject:create};
 }
 if(/^(napravi|kreiraj|izradi|dodaj|create|build|make|add)\b/.test(words)&&/\b(ocr|skeniran[a-z]*|scanned)\b/.test(words)){
  const create=/^(napravi|kreiraj|izradi|create|build|make)\b/.test(words)||!source;
  if(create)operations.push({tool:'project.create',screen:'home',title:'Moje lokalno čitanje slike'});
  let id='scan',n=1;while(!create&&c?.state.some(s=>s.id.startsWith(id+'_')))id='scan'+n++;
  operations.push({tool:'sense.ocr',screen:create?'home':first,id,language:/\b(englesk[a-z]*|english)\b/.test(words)?'eng':'bos'});
  return {plan:{format:FORMAT,operations},resolution:'documented-local-rule',createsProject:create};
 }
 if(/^(napravi|kreiraj|izradi|create|build|make)\b/.test(words)&&/\b(igrac[a-z]*|player)\b/.test(words)&&/\b(vrat[a-z]*|door)\b/.test(words)&&/(prid|blizi|near|approach|otvar|open)/.test(words)){
  const create=/\b(nov[aui]?|new|aplikacij[au]|game|igru)\b/.test(words)||!source;
  if(create)operations.push({tool:'project.create',screen:'home',title:'Moj interaktivni svijet'});
  const page=create?'home':first,id=create?'player':fresh('player'),door=create?'door':fresh('door');
  operations.push({tool:'draw.add',spec:{screen:page,id,label:'Igrač',role:'actor',x:80,y:160}},{tool:'draw.add',spec:{screen:page,id:door,label:'Vrata',role:'door',actor:'draw7_'+id,x:240,y:120}});
  return {plan:{format:FORMAT,operations,checks:[{flow:'draw7_'+id+'_right',expect:{['draw7_'+id+'_x']:96}},{flow:'draw7_'+id+'_right',expect:{['draw7_'+id+'_x']:112}},{flow:'draw7_'+id+'_right',expect:{['draw7_'+door+'_open']:true}},{restart:true,expect:{['draw7_'+door+'_open']:true}}]},resolution:'documented-local-rule',createsProject:create};
 }
 if(!source)return null;
 if(/\b(pomjeri|premjesti|move|postavi)\b/.test(words)){
  const numbers=words.match(/-?\d+(?:\.\d+)?/g),o=findObject();if(!o||numbers?.length!==2)return null;
  operations.push({tool:'draw.position',object:o.key,x:Number(numbers[0]),y:Number(numbers[1])});
 }else if(/\b(udaljenost|distance|radius|blizina)\b/.test(words)){
  const o=findObject(),numbers=words.match(/\d+(?:\.\d+)?/g);if(o?.role!=='door'||numbers?.length!==1)return null;
  const door=scope.CLEA7Draw.relationship(source,o.key);if(!door)return null;operations.push({tool:'draw.proximity',object:o.key,actor:door.actor,radius:Number(numbers[0])});
 }else if(/^(dodaj|add)\b/.test(words)){
  if(/\b(preprek[au]|obstacle|wall)\b/.test(words))operations.push({tool:'draw.add',spec:{screen:first,id:fresh('obstacle'),label:'Prepreka',role:'solid',x:400,y:160,width:50,height:140}});
  else{
   const kind=/\b(napredak|progress)\b/.test(words)?'progress':/\b(prekidac|toggle)\b/.test(words)?'toggle':/\b(tekstualno polje|polje za tekst|text input)\b/.test(words)?'text':/\b(kolekcij[au]|collection|kartice)\b/.test(words)?'collection':null;if(!kind)return null;
   const id=fresh(kind),label=kind==='progress'?'Napredak':kind==='toggle'?'Prekidač':kind==='text'?'Moj tekst':'Moja kolekcija';operations.push({tool:kind==='collection'?'ui.collection':'ui.add',spec:{screen:first,id,label,...(kind==='collection'?{}:{kind})}});
  }
 }else return null;
 return {plan:{format:FORMAT,operations},resolution:'documented-local-rule',createsProject:false};
}
function attachObjectComposer(api){
 const d=api.parent.ownerDocument,el=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n;},root=el('details');root.id=(api.idPrefix||'')+'object-composition';root.open=true;
 root.append(el('summary','BIL rečenice · funkcionalni objekti'),el('p','Definiši podatak, vezu ili radnju. Isti kompajler provjerava rečenicu, a Draw prikazuje stvarne kontrole objekta.'));
 const field=(label,key,tag='input')=>{const l=el('label',label),n=el(tag);n.id=(api.idPrefix||'')+'object-'+key;n.setAttribute('aria-label',label);l.append(n);root.append(l);return n;};
 const kind=field('Rečenica objekta','kind','select');for(const [value,label]of [['remember','pamti · tipizirani podatak'],['derive','izvodi · reaktivna veza'],['action','nad · promjena i radnja'],['label','prikazuje · naziv polja']]){const o=el('option',label);o.value=value;kind.append(o);}
 const owner=field('Ime funkcionalnog objekta','owner'),name=field('Ime polja objekta','field'),type=field('Tip zapamćenog polja','type','select');owner.maxLength=name.maxLength=48;
 for(const [value,label]of [['Text','tekst'],['Number','broj'],['Boolean','logiku']]){const o=el('option',label);o.value=value;type.append(o);}
 const value=field('Početna vrijednost polja','value'),flag=field('Logička početna vrijednost','flag','select');for(const [v,l]of [['false','ne'],['true','da']]){const o=el('option',l);o.value=v;flag.append(o);}
 const expression=field('Izraz u BIL rečenici','expression');expression.maxLength=800;expression.placeholder='kolicina puta cijena, zavrsen ili drugo_objekat.polje';
 const action=field('Ime radnje objekta','action'),label=field('Naziv za korisnika','label');action.maxLength=48;label.maxLength=200;
 const choice=field('Izvedi logički izbor ne / da','choice');choice.type='checkbox';const no=field('Tekst kada je ne','no'),yes=field('Tekst kada je da','yes');
 const info=el('p'),status=el('p');status.setAttribute('role','status');status.id=(api.idPrefix||'')+'object-status';
 function fields(){for(const [n,visible]of [[type,kind.value==='remember'],[value,kind.value==='remember'&&type.value!=='Boolean'],[flag,kind.value==='remember'&&type.value==='Boolean'],[expression,['derive','action'].includes(kind.value)],[action,kind.value==='action'],[label,['action','label'].includes(kind.value)],[choice,kind.value==='derive'],[no,kind.value==='derive'&&choice.checked],[yes,kind.value==='derive'&&choice.checked]])n.closest('label').hidden=!visible;value.type=type.value==='Number'?'number':'text';}
 const add=el('button','Dodaj provjerenu rečenicu');add.type='button';add.id=(api.idPrefix||'')+'object-add';
 add.onclick=()=>{try{const op={tool:'object.'+kind.value,object:owner.value.trim(),field:name.value.trim()};
  if(kind.value==='remember'){op.type=type.value;if(type.value==='Number'&&!value.value.trim())throw Error('Upiši početni broj.');op.value=type.value==='Boolean'?flag.value==='true':type.value==='Number'?Number(value.value):value.value;}
  else if(kind.value==='derive'){op.expression=expression.value;if(choice.checked){op.whenFalse=no.value;op.whenTrue=yes.value;}}
  else if(kind.value==='action'){op.action=action.value.trim();op.expression=expression.value;if(label.value.trim())op.label=label.value.trim();}
  else op.label=label.value.trim();
  const next=emit({format:FORMAT,operations:[op]},{source:api.source()});api.setSource(next.source);api.inspect();status.textContent='Rečenica je provjerena i dodana istom projektu.';
 }catch(error){status.textContent=error.message;api.error?.(error);}};
 function refresh(){try{const contract=B.compile(api.source()).ir.objects;root.hidden=!contract;add.disabled=!contract;info.textContent=contract?contract.objects.map(o=>o.name+': '+o.fields.map(f=>f.name+(f.derived?' ← izvedeno':'')).join(', ')).join(' · '):'';fields();}catch{root.hidden=true;add.disabled=true;}}
 kind.onchange=type.onchange=choice.onchange=fields;root.append(info,add,status);api.parent.prepend(root);refresh();return {refresh};
}
function attachComposer(api){
 const objects=attachObjectComposer(api);
 const d=api.parent.ownerDocument,el=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n;},root=el('details');root.id=(api.idPrefix||'')+'composition';root.className='draw-composition';root.open=true;root.append(el('summary','Sastavi svoj interfejs i prostor'));
 const field=(label,key,tag='input')=>{const l=el('label',label),n=el(tag);n.id=(api.idPrefix||'')+'compose-'+key;n.setAttribute('aria-label',label);l.append(n);root.append(l);return n;};
 const kind=field('Vrsta vlastite komponente','kind','select');const labels={row:'Raspored · red ili kolona',card:'Kartica / grupa',heading:'Naslov',text:'Tekst',input:'Povezani unos',toggle:'Prekidač',select:'Padajući izbor',button:'Dugme s događajem ili navigacijom',show:'Reaktivna vrijednost',visualize:'Runtime vizualizacija',shape:'Geometrijski oblik',drawing:'Vlastiti vektor',space:'Prostor vlastitih dimenzija',clock:'Sat / tok scene',pad:'Dodirna i tastaturna kontrola'};
 for(const id of NODE_KINDS){const o=el('option',labels[id]);o.value=id;kind.append(o);}
 const id=field('Ključ vlastite komponente','id'),label=field('Tekst ili naziv komponente','label'),parent=field('Dodaj u raspored','parent','select'),bind=field('Povezani podatak','bind','select'),runs=field('Povezani događaj','runs','select'),opens=field('Ili otvori ekran','opens','select');id.value='my_layout';id.maxLength=48;label.value='Moj prostor';
 const geometry=field('Geometrija oblika','geometry','select');for(const shape of B.SHAPES){const o=el('option',shape);o.value=shape;geometry.append(o);}
 const options=field('Izbori odvojeni znakom |','options');options.value='Prvi | Drugi';
 const points=field('Tačke vlastitog vektora · JSON','points','textarea');points.rows=3;points.value='[[0,0],[1000,300],[700,1000],[0,700]]';
 const width=field('Širina prostora','width'),height=field('Visina prostora','height');for(const [input,value]of [[width,800],[height,450]]){input.type='number';input.min='64';input.max='4096';input.value=String(value);}
 const style=field('Vizuelne osobine · JSON','style','textarea');style.rows=3;style.value='{"direction":"column","gap":16,"padding":20}';
 const extra=field('Dodatni parametri · JSON','extra','textarea');extra.rows=2;extra.value='{}';
 const advanced=el('details');advanced.append(el('summary','Napredni parametri iste komponente'));advanced.append(style.closest('label'),extra.closest('label'));root.append(advanced);
 const property=field('Vizuelna osobina','property','select');for(const key of Object.keys(B.PRESENTATION)){const o=el('option',key);o.value=key;property.append(o);}
 const propertyValue=field('Vrijednost vizuelne osobine','property-value'),enumValue=field('Izbor vizuelne osobine','property-enum','select');
 function propertyFields(){const rule=B.PRESENTATION[property.value];enumValue.replaceChildren();for(const value of rule.values||[]){const o=el('option',value);o.value=value;enumValue.append(o);}enumValue.closest('label').hidden=rule.kind!=='enum';propertyValue.closest('label').hidden=rule.kind==='enum';propertyValue.type=rule.kind==='color'?'color':['number','size'].includes(rule.kind)?'number':'text';propertyValue.value=rule.kind==='color'?'#14212e':String(rule.min??0);if(rule.min!==undefined){propertyValue.min=String(rule.min);propertyValue.max=String(rule.max);propertyValue.step='any';}}
 const setProperty=el('button','Dodaj osobinu izgledu');setProperty.type='button';setProperty.onclick=()=>{try{const rule=B.PRESENTATION[property.value],value=rule.kind==='enum'?enumValue.value:['number','size'].includes(rule.kind)?Number(propertyValue.value):propertyValue.value;style.value=q({...JSON.parse(style.value),[property.value]:value});status.textContent='Osobina je pripremljena za novu komponentu.';}catch(e){status.textContent=e.message;}};root.append(setProperty);property.onchange=propertyFields;propertyFields();
 const status=el('p');status.setAttribute('role','status');status.id=(api.idPrefix||'')+'compose-status';
 const add=el('button','Dodaj vlastitu komponentu');add.type='button';add.id=(api.idPrefix||'')+'compose-add';
 const fill=(select,values,blank)=>{const old=select.value;select.replaceChildren();const first=el('option',blank);first.value='';select.append(first);for(const [value,text]of values){const o=el('option',text);o.value=value;select.append(o);}if([...select.options].some(o=>o.value===old))select.value=old;};
 function fields(){for(const [control,visible]of [[bind,['input','toggle','select','show','visualize'].includes(kind.value)],[runs,kind.value==='button'],[opens,kind.value==='button'],[geometry,kind.value==='shape'],[options,kind.value==='select'],[points,kind.value==='drawing'],[width,kind.value==='space'],[height,kind.value==='space']])control.closest('label').hidden=!visible;}
 function refresh(){objects.refresh();try{root.hidden=!!B.compile(api.source()).ir.objects;if(root.hidden){add.disabled=true;return;}const c=context(api.source()),page=api.screen();fill(parent,c.components.filter(n=>n.screen===page&&['row','card','space'].includes(n.kind)).map(n=>[n.key,n.label||n.key]),'Na odabrani ekran');fill(bind,c.state.map(n=>[n.id,n.id+' · '+q(n.type)]),'Odaberi postojeći podatak');fill(runs,c.events.map(n=>[n,n]),'Bez događaja');fill(opens,c.screens.map(n=>[n.id,n.title]),'Bez navigacije');add.disabled=false;fields();}catch{add.disabled=true;}}
 add.onclick=()=>{try{
  const node={...JSON.parse(extra.value),kind:kind.value,id:id.value.trim(),label:label.value.trim(),style:JSON.parse(style.value)};
  if(['row','card','space'].includes(node.kind))node.children=node.children||[];
  if(['input','toggle','select','show','visualize'].includes(node.kind))node.bind=bind.value;
  if(node.kind==='button'){if(runs.value)node.runs=runs.value;if(opens.value)node.opens=opens.value;}
  if(node.kind==='shape')node.geometry=geometry.value;if(node.kind==='select')node.options=options.value.split('|').map(x=>x.trim());if(node.kind==='drawing')node.points=JSON.parse(points.value);if(node.kind==='space')node.size=[Number(width.value),Number(height.value)];
  const plan={format:FORMAT,operations:[{tool:'ui.compose',screen:api.screen(),...(parent.value?{parent:parent.value}:{}),nodes:[node]}]},next=emit(plan,{source:api.source()});api.setSource(next.source);api.inspect();status.textContent='Komponenta je dio istog BIL projekta. Pokreni i isprobaj njene događaje.';const used=new Set(context(api.source()).components.map(n=>n.key));let i=2,stem=node.id.slice(0,40);while(used.has(stem+'_'+i))i++;id.value=stem+'_'+i;refresh();
 }catch(error){status.textContent=error.message;api.error?.(error);}};
 kind.onchange=()=>{style.value=['row','card'].includes(kind.value)?'{"direction":"column","gap":16,"padding":20}':kind.value==='space'?'{}':'{"width":180,"padding":12}';fields();};
 root.append(add,status);api.parent.prepend(root);refresh();return {refresh};
}
scope.CLEA7StudioTools=Object.freeze({FORMAT,nodeKinds:NODE_KINDS,treeSource,compose,attachComposer,manifest:()=>({format:FORMAT,revision:3,nodeKinds:NODE_KINDS,visualProperties:Object.keys(B.PRESENTATION),tools:Object.entries(TOOLS).map(([id,description])=>({id,description,effects:'source-proposal-only'})),requiresReview:true}),context,modelContext,emit,resolve});
})(globalThis);
