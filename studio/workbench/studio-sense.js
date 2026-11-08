'use strict';
/* Accessible semantic navigation and source-preserving edits in the real Studio. */
(function(scope){
if(typeof document==='undefined')return;
async function attach(){
 for(let i=0;i<100&&!scope.CLEA7Workbench;i++)await new Promise(resolve=>setTimeout(resolve,100));
 const root=document.getElementById('sense-studio-body'),api=scope.CLEA7Workbench;if(!root||!api||!scope.CLEA7Intelligence)return;
 const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;},button=(label,id,fn)=>{const n=make('button',label);n.type='button';n.id=id;n.onclick=fn;root.append(n);return n;};
 root.append(make('h1','Sense · pristupačni razvoj'),make('p','Pregledaj stvarne simbole i ekrane, otvori izvor, pripremi ciljanu izmjenu i provjeri je kroz sedam stubova. Nije potreban rad mišem ili čitanje platna.'));
 const status=make('p','Otvori projekt pa osvježi strukturu.');status.id='sense-studio-status';status.setAttribute('role','status');root.append(status);
 const symbolLabel=make('label','Simboli i ekrani projekta'),symbols=make('select');symbols.id='sense-studio-symbols';symbols.size=8;symbolLabel.htmlFor=symbols.id;root.append(symbolLabel,symbols);let entries=[],pending=null,previous=null;
 function refresh(){
  symbols.replaceChildren();const project=api.project;entries=[];
  if(project.bil){const compiled=scope.CLEA7Core.compile(project.bil.source);entries=compiled.ast.body.filter(n=>n.name&&n.loc).map(n=>({id:n.name,kind:n.kind,loc:n.loc}));}
  else entries=project.screens.map(screen=>({id:screen.id,kind:'screen'}));
  for(const [index,entry]of entries.entries()){const option=make('option',entry.kind+' · '+entry.id+(entry.loc?' · red '+entry.loc.line:''));option.value=String(index);symbols.append(option);}
  const screens=project.bil?.ir?.ui?.screens||project.screens;screenSelect.replaceChildren();for(const screen of screens){const option=make('option',screen.label||screen.name||screen.id);option.value=screen.id;screenSelect.append(option);}
  handlerSelect.replaceChildren();for(const name of Object.keys(project.bil?.ir.handlers||{}).filter(name=>!name.startsWith('ui_'))){const option=make('option',name);option.value=name;handlerSelect.append(option);}
  status.textContent=project.name+': '+screens.length+' ekrana, '+entries.length+' imenovanih simbola. Izbor ne mijenja projekt.';
 }
 button('Osvježi stvarnu strukturu','sense-studio-refresh',()=>{try{refresh();}catch(error){status.textContent=error.message;}});
 button('Otvori odabrani simbol u BIL izvoru','sense-studio-open-symbol',async()=>{
  try{const entry=entries[Number(symbols.value)],project=api.project;if(!entry?.loc||!project.bil)throw Error('Odaberi simbol BIL projekta.');document.querySelector('[data-panel="bil"]').click();await new Promise(resolve=>setTimeout(resolve,0));const area=document.getElementById('bil-source');if(area.value!==project.bil.source)throw Error('Urednik sadrži drugačiju skicu. Sačuvaj je ili provjeri prije navigacije.');area.focus();area.setSelectionRange(entry.loc.start,entry.loc.end);document.getElementById('bil-status').textContent='Sense: '+entry.kind+' '+entry.id+', red '+entry.loc.line+', kolona '+entry.loc.column+'.';}catch(error){status.textContent=error.message;}
 });
 button('Gdje sam u Studiju?','sense-studio-where',()=>{const active=document.querySelector('[data-panel][aria-pressed="true"]');status.textContent='Radni prostor: '+(active?.textContent||'Studio')+'. Projekt: '+api.project.name+'. Dostupni su struktura, BIL izvor, provjera, pokretanje i izvoz.';});
 const screenLabel=make('label','Ekran za novo dugme'),screenSelect=make('select');screenSelect.id='sense-studio-screen';screenLabel.htmlFor=screenSelect.id;root.append(screenLabel,screenSelect);
 const label=make('label','Tekst novog dugmeta'),caption=make('input');caption.id='sense-studio-caption';caption.maxLength=120;label.htmlFor=caption.id;root.append(label,caption);
 const handlerLabel=make('label','Postojeći događaj koji dugme pokreće'),handlerSelect=make('select');handlerSelect.id='sense-studio-handler';handlerLabel.htmlFor=handlerSelect.id;root.append(handlerLabel,handlerSelect);
 const preview=make('pre');preview.id='sense-studio-change-preview';root.append(preview);
 const reviewLabel=make('label'),review=make('input');review.id='sense-studio-reviewed';review.type='checkbox';reviewLabel.append(review,document.createTextNode(' Pregledao/la sam opis i potvrđujem ovu izmjenu.'));root.append(reviewLabel);
 const prepare=button('Pripremi i provjeri ciljanu izmjenu','sense-studio-prepare',async()=>{
  pending=null;apply.disabled=true;review.checked=false;prepare.disabled=true;
  try{
   const base=scope.CLEA7.clone(api.project),source=base.bil?.source;if(!source)throw Error('Otvori BIL projekt.');
   if(!caption.value.trim()||caption.value.length>120||!handlerSelect.value)throw Error('Unesi naziv dugmeta i odaberi postojeći događaj.');
   const explicit=base.bil.ir.ui?.screens,page=(explicit||base.screens).find(screen=>screen.id===screenSelect.value);if(!page||(explicit&&source[page.loc.end-1]!=='}'))throw Error('Ekran nema potvrđenu izvornu lokaciju.');
   const at=explicit?page.loc.end-1:source.length,insertion='\n'+(explicit?'    ':'')+'button '+JSON.stringify(caption.value.trim())+' runs '+handlerSelect.value+'\n',next=source.slice(0,at)+insertion+source.slice(at);
   const checked=await scope.CLEA7Intelligence.verifyBIL(next,{metadata:{id:base.id,name:base.name,package:base.package,version:base.version,licenses:base.licenses||[]}});
   const impact=scope.CLEA7Intelligence.impact(await scope.CLEA7Intelligence.dependencyGraph(base),checked.graph);
   pending={base:scope.CLEA7.stable(base),before:base,application:checked.application};
   preview.textContent='Ekran: '+(page.label||page.id)+'\nDodaje se: '+insertion.trim()+'\nZadržani nepogođeni moduli: '+impact.retained.length+'\nPogođeni moduli: '+impact.affected.join(', ')+'\nProvjera: BIL tipovi i izolovano pokretanje su prošli. Testovi poslovnog ponašanja još nisu dodani.';
   status.textContent='Pripremljena je jedna dopuna izvora. Postojeći projekt nije promijenjen; pregledaj i potvrdi.';
  }catch(error){status.textContent='Izmjena nije primijenjena: '+error.message;}finally{prepare.disabled=false;}
 });
 const apply=button('Primijeni pregledanu izmjenu','sense-studio-apply',()=>{
  try{if(!pending||!review.checked)throw Error('Prvo pregledaj i potvrdi izmjenu.');if(scope.CLEA7.stable(api.project)!==pending.base)throw Error('Projekt je promijenjen. Ponovo pripremi izmjenu.');previous={project:pending.before,applied:scope.CLEA7.stable(pending.application)};api.open(scope.CLEA7.clone(pending.application));pending=null;review.checked=false;apply.disabled=true;status.textContent='Ciljana izmjena je primijenjena. Sačuvaj projekt ili je poništi ovdje.';refresh();}catch(error){status.textContent=error.message;}
 });apply.disabled=true;review.onchange=()=>apply.disabled=!pending||!review.checked;
 button('Poništi posljednju Sense izmjenu','sense-studio-undo',()=>{if(!previous){status.textContent='Nema Sense izmjene za poništavanje.';return;}if(scope.CLEA7.stable(api.project)!==previous.applied){status.textContent='Projekt se naknadno promijenio; sačuvaj ga prije ručnog vraćanja.';return;}api.open(scope.CLEA7.clone(previous.project));previous=null;refresh();status.textContent='Vraćen je tačan prethodni projekt.';});
 button('Pokreni aplikaciju kroz Runtime','sense-studio-run',()=>document.querySelector('[data-panel="test"]').click());
 button('Preuzmi stvarni CLEA7 projekt','sense-studio-export',()=>document.getElementById('export-project').click());
 const cv=make('a','Otvori Sense CV i komunikaciju');cv.href=location.pathname.includes('/studio/')?'../../sense/':'../sense/';root.append(cv);
 document.querySelector('[data-panel="sense-studio"]')?.addEventListener('click',()=>{refresh();symbols.focus();});refresh();
}
attach().catch(error=>{const status=document.getElementById('status');if(status)status.textContent='Sense u Studiju nije pokrenut: '+error.message;});
})(globalThis);
