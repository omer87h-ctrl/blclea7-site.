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
 'screen.add':'Dodaj ekran u isti projekt.',
 'sense.cv':'Kreiraj originalnu pristupačnu CV aplikaciju s praznim podacima i lokalnim Sense ugovorima.',
 'ui.add':'Dodaj radni element sa stvarnim stanjem i događajima.',
 'ui.collection':'Dodaj tipiziranu kolekciju i događaje stavki.',
 'draw.add':'Dodaj originalni vektorski objekat, igrača, vrata ili prepreku.',
 'draw.position':'Izmijeni početni položaj postojećeg objekta.',
 'draw.proximity':'Poveži postojeća vrata s igračem i provjerenom udaljenošću.',
 'bil.declaration':'Dodaj provjerenu deklaraciju, funkciju ili izvedenu vrijednost.',
 'bil.event':'Dodaj provjereni BIL događaj.',
 'bil.item':'Dodaj provjerenu BIL komponentu postojećem ekranu.'
});
function context(source){
 const c=B.compile(source),draw=scope.CLEA7Draw.model(source);
 return {format:FORMAT,tools:Object.keys(TOOLS),screens:c.ast.body.filter(n=>n.kind==='screen').map(n=>({id:n.name,title:n.label})),
  objects:draw.objects.map(({key,label,role,screen,x,y,width,height})=>({key,label,role,screen,x,y,width,height})),
  state:Object.entries(c.ir.globals).map(([id,s])=>({id,type:s.type,mutable:s.mutable})),events:Object.keys(c.ir.handlers).filter(n=>!n.startsWith('ui_'))};
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
   shape(op,['tool','screen','title']);if(next!==null||index!==0)fail('Postojeći projekt se ne zamjenjuje radnjom za novi projekt.');
   projectName=text(op.title,100);next='screen '+name(op.screen)+' '+q(text(op.title,160))+' {\n}\nstart '+op.screen+'\n';
  }else{
   if(next===null)fail('Novi Studio plan mora prvo kreirati projekt.');
   if(op.tool==='screen.add'){
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
 if(/\b(napravi|kreiraj|izradi|create|build|make)\b/.test(words)&&/\b(cv|zivotopis|resume)\b/.test(words))return {plan:{format:FORMAT,operations:[{tool:'sense.cv'}],checks:[{flow:'review',screen:'preview',expect:{}},{flow:'back',screen:'editor',expect:{name:'',experience:'',education:'',skills:''}}]},resolution:'original-Sense-program',createsProject:true};
 const first=c?.screens.find(s=>s.id===screen)?.id||c?.screens[0]?.id||'home';
 const findObject=()=>{if(selected)return c?.objects.find(o=>o.key===selected);const found=c?.objects.filter(o=>words.includes(o.label.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase())||words.includes(o.key.toLowerCase()));return found?.length===1?found[0]:null;};
 const operations=[],fresh=prefix=>{let n=1,id=prefix;while(c&&(c.state.some(s=>s.id===id||s.id.startsWith('draw7_'+id+'_'))||c.objects.some(o=>o.key==='draw7_'+id)))id=prefix+'_'+n++;return id;};
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
scope.CLEA7StudioTools=Object.freeze({FORMAT,manifest:()=>({format:FORMAT,tools:Object.entries(TOOLS).map(([id,description])=>({id,description,effects:'source-proposal-only'})),requiresReview:true}),context,emit,resolve});
})(globalThis);
