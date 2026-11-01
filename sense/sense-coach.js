/* Original Sense evidence authoring, by Brzo i Lokalno.
 * User words only. The existing application performs the real SHADOW check;
 * this adapter never creates a second analyzer or accepts a change for a user. */
(function(scope){'use strict';
const FIELD_LIMIT=1500,CV_LIMIT=30000;
const FIELDS=Object.freeze({task:'Zadatak',tool:'Alat ili vještina',context:'Kontekst ili period',result:'Rezultat'});
function buildEvidence(fields){
 if(!fields||typeof fields!=='object'||Array.isArray(fields)||Object.keys(fields).some(k=>!Object.hasOwn(FIELDS,k)))throw Error('Neispravna polja dopune.');
 const values={};
 for(const key of Object.keys(FIELDS)){
  const value=Object.hasOwn(fields,key)?fields[key]:'';
  if(typeof value!=='string'||value.length>FIELD_LIMIT||value.includes('\0'))throw Error('Svako polje mora biti tekst do 1.500 znakova, bez NUL znaka.');
  values[key]=value;
 }
 if(!values.task.trim())throw Error('Opiši šta si stvarno radio/la.');
 return Object.keys(FIELDS).filter(k=>values[k].trim()).map(k=>FIELDS[k]+': '+values[k]).join('\n');
}
function appendEvidence(cvText,fields){
 if(typeof cvText!=='string'||!cvText.trim()||cvText.includes('\0'))throw Error('Prvo unesi i analiziraj svoj CV.');
 const next=cvText+'\n\nDodatni opis iskustva:\n'+buildEvidence(fields);
 if(next.length>CV_LIMIT)throw Error('CV s dopunom prelazi 30.000 znakova. Skrati dopunu prije provjere.');
 return next;
}
scope.CLEA7SenseCoach=Object.freeze({format:'sense.evidence.authoring/1',fieldLimit:FIELD_LIMIT,cvLimit:CV_LIMIT,buildEvidence,appendEvidence});
if(typeof document==='undefined')return;
const requirements=document.getElementById('requirements'),cv=document.getElementById('cv-text'),job=document.getElementById('job-text');
if(!requirements||!cv||!job)return;
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const dialog=make('dialog');dialog.id='sense-coach-dialog';dialog.setAttribute('aria-labelledby','coach-title');
const heading=make('div',undefined,'dialog-heading'),title=make('h2','Pojasni svoj navod');title.id='coach-title';
const close=make('button','×','close-button');close.type='button';close.id='coach-close';close.setAttribute('aria-label','Zatvori pojašnjenje navoda');heading.append(title,close);
const target=make('p');target.id='coach-requirement';target.style.fontWeight='600';
const source=make('blockquote',undefined,'source-quote');source.id='coach-source';
const intro=make('p','Unesi stvaran detalj. Sense ne dodaje kvalifikacije, rezultate ili brojke umjesto tebe.','field-help');
const inputs={};
dialog.append(heading,target,source,intro);
const prompts={task:'Šta si stvarno radio/la? (obavezno)',tool:'Alat ili vještina',context:'Kontekst ili period',result:'Šta si postigao/la? (neobavezno)'};
for(const key of Object.keys(FIELDS)){
 const label=make('label',prompts[key],'setting-field');label.htmlFor='coach-'+key;label.style.cssText='display:block;margin:14px 0;';
 const input=make('textarea');input.id='coach-'+key;input.maxLength=FIELD_LIMIT;input.rows=key==='task'?3:2;if(key==='task')input.required=true;
 label.append(input);inputs[key]=input;dialog.append(label);
}
const previewTitle=make('h3','Tvoje riječi u probnoj dopuni');
const preview=make('pre');preview.id='coach-preview';preview.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;font:inherit;padding:16px;border:1px solid var(--line);border-radius:12px;';
const warning=make('p','Ovo priprema odvojenu varijantu. Izvorni CV ostaje isti dok promjenu posebno ne prihvatiš.','field-help');warning.id='coach-shadow-note';
const state=make('p','');state.id='coach-status';state.setAttribute('role','status');state.setAttribute('aria-live','polite');state.setAttribute('aria-atomic','true');
const actions=make('div',undefined,'button-row');
const run=make('button','Isprobaj ovu dopunu','button primary');run.id='coach-run-shadow';run.type='button';
const cancel=make('button','Zadrži trenutno','button secondary');cancel.id='coach-cancel';cancel.type='button';actions.append(run,cancel);
dialog.append(previewTitle,preview,warning,state,actions);document.body.append(dialog);
let opened=null,activeKey=null,opener=null,restoreFocus=true;
const values=()=>Object.fromEntries(Object.keys(FIELDS).map(k=>[k,inputs[k].value]));
function resetFields(){for(const field of Object.values(inputs))field.value='';preview.textContent='Ovdje ćeš vidjeti samo tekst koji sam/a uneseš.';state.textContent='';}
function updatePreview(){
 try{preview.textContent=buildEvidence(values());state.textContent='';}
 catch(error){preview.textContent=inputs.task.value.trim()?'Provjeri unesena polja.':'Prvo opiši stvarni zadatak.';}
}
function hasCurrentReport(){return document.getElementById('review-content')?.hidden===false&&requirements.querySelector('.requirement-card')!==null;}
function openCoach(card,button){
 if(!hasCurrentReport()||document.getElementById('analyze')?.disabled){document.getElementById('status-text').textContent='Prvo završi analizu prijave, pa pojasni navod.';return;}
 const id=card.dataset.requirementId;
 if(!id)return;
 if(activeKey!==id)resetFields();activeKey=id;opener=button;restoreFocus=true;
 opened=Object.freeze({id,cv:cv.value,job:job.value});
 const label=card.querySelector('h3')?.textContent?.trim()||'Zahtjev iz oglasa';
 target.textContent=label;source.textContent=card.querySelector('blockquote.source-quote')?.textContent||label;
 const alternative=document.getElementById('scenario-cv')?.value||'';
 warning.textContent=alternative.trim()&&alternative!==cv.value?'Ova dopuna zamjenjuje tekst trenutne probne varijante. Izvorni CV ostaje isti dok promjenu posebno ne prihvatiš.':'Dopuna ide na odvojenu provjeru. Izvorni CV ostaje isti dok promjenu posebno ne prihvatiš.';
 updatePreview();if(!dialog.open)dialog.showModal();inputs.task.focus();
}
for(const field of Object.values(inputs))field.addEventListener('input',updatePreview);
close.addEventListener('click',()=>dialog.close());cancel.addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{opened=null;if(restoreFocus&&opener?.isConnected&&opener.getClientRects().length)opener.focus();});
run.addEventListener('click',()=>{
 try{
  if(!opened||!hasCurrentReport()||cv.value!==opened.cv||job.value!==opened.job)throw Error('CV ili oglas se promijenio. Zatvori pojašnjenje, ponovo analiziraj prijavu i pregledaj dopunu.');
  const navigation=document.querySelector('#primary-nav [data-view="scenario"]'),alternative=document.getElementById('scenario-cv'),execute=document.getElementById('run-scenario');
  if(!navigation||!alternative||!execute||execute.disabled)throw Error('Odvojena provjera trenutno nije spremna. Sačekaj završetak trenutne radnje.');
  const next=appendEvidence(opened.cv,values()),before=cv.value;
  restoreFocus=false;dialog.close();navigation.click();alternative.value=next;alternative.dispatchEvent(new Event('input',{bubbles:true}));execute.click();
  if(cv.value!==before)throw Error('Izvorni CV je promijenjen tokom pripreme. Provjeri trenutnu prijavu prije prihvatanja.');
 }catch(error){state.textContent=error?.message||'Dopuna nije pripremljena.';if(!dialog.open){document.getElementById('status-text').textContent=state.textContent;}else inputs.task.focus();}
});
function decorate(){
 for(const card of requirements.querySelectorAll('.requirement-card')){
  if(card.querySelector('[data-coach-action]'))continue;
  const actions=card.querySelector('.requirement-actions');if(!actions)continue;
  const b=make('button','Pojasni ovaj navod','button secondary');b.type='button';b.dataset.coachAction='true';
  b.setAttribute('aria-label','Pojasni navod za zahtjev: '+(card.querySelector('h3')?.textContent||'Zahtjev').slice(0,300));
  b.disabled=!!document.getElementById('analyze')?.disabled;b.addEventListener('click',()=>openCoach(card,b));actions.append(b);
 }
}
const observer=new MutationObserver(decorate);observer.observe(requirements,{childList:true,subtree:true});decorate();
scope.addEventListener('sense:erase',()=>{restoreFocus=false;if(dialog.open)dialog.close();opened=null;opener=null;activeKey=null;resetFields();target.textContent='';source.textContent='';});
scope.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})(globalThis);
