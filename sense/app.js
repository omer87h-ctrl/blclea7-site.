/* BL CLEA Sense 7 interface — original code by Brzo i Lokalno.
 * User content is memory-only until an explicit save/export. No telemetry,
 * remote AI, sensor APIs, clipboard reads or cross-application access. */
'use strict';
(()=>{
const $=id=>document.getElementById(id), views=new Set(['workspace','review','scenario','draft']);
const PROJECT_KEY='blclea.sense.cv.project/1', PREF_KEY='blclea.sense.cv.presentation/1';
const MAX_HISTORY=18, MAX_HISTORY_BYTES=3000000;
const STATUS_LABELS={supported:'Potkrijepljeno',unconfirmed:'Za tvoju potvrdu',notfound:'Nije pronađen navod',contradicted:'Potrebna pažnja',needsclarification:'Potrebno pojašnjenje'};
const PRIORITY_LABELS={mandatory:'Obavezno',preferred:'Poželjno',unclear:'Provjeri zahtjev'};
const state={cvText:'',jobText:'',confirmations:{},report:null,draftText:'',generatedDraftText:'',draftClaims:[],draftWarnings:[],draftEdited:false,draftStale:false};
let engine=null,busy=false,sequence=0,controller=null,shadowResult=null,pendingChange=null,guidedIndex=0;
let undoStack=[],redoStack=[],editTimer=null,currentView='workspace',scanTimer=null,scanIndex=-1;
let sourceReturn=null,sourceReturnButton=null;
const dialogReturns=new Map();
let preferences={fontScale:1,highContrast:false,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,guided:true,scanInterval:2000};
const demoCV='OPIS ISKUSTVA — ORIGINALNI TESTNI PRIMJER\n\nOd februara 2023. do juna 2025. radio sam u lokalnoj radionici. Vodio sam evidenciju dijelova i zaliha u Excelu, odgovarao na upite kupaca i pripremao sedmične preglede.\n\nZavršena srednja škola. Engleski jezik koristim pri čitanju uputstava i pisanju kratkih poruka. Nisam radio u Salesforceu.\n\nNa vlastitom projektu organizovao sam raspored zadataka i pripremio jednostavnu uputu za nove članove tima.';
const demoJob='ORIGINALNI TESTNI OGLAS — saradnik za korisničku podršku\n\nObavezno je poznavanje Excela i iskustvo u komunikaciji s kupcima. Traži se završena srednja škola. Potrebno je poznavanje engleskog jezika.\n\nPoželjno je iskustvo u Salesforceu i vođenje evidencije zaliha.\n\nPrijava treba sadržavati CV i motivaciono pismo. Rok i način slanja treba provjeriti u izvornom oglasu.';

function element(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=String(text);return e;}
function button(text,className,handler){const b=element('button',className,text);b.type='button';b.addEventListener('click',()=>Promise.resolve().then(handler).catch(fail));return b;}
function senseSignal(kind){window.dispatchEvent(new CustomEvent('sense:feedback',{detail:{kind}}));}
function status(message,kind='ready'){$('status-text').textContent=String(message);$('status').dataset.kind=kind;if(kind==='error')senseSignal('error');}
function fail(error){if(error?.code==='Cancelled'||error?.name==='AbortError'){status('Provjera je zaustavljena. Posljednji prihvaćeni sadržaj je sačuvan u ovom prozoru.');return;}status(String(error?.message||'Radnja nije uspjela. Tvoj prethodni sadržaj nije obrisan.').slice(0,500),'error');}
function bind(id,event,handler){$(id).addEventListener(event,e=>{try{const result=handler(e);if(result?.catch)result.catch(fail);}catch(error){fail(error);}});}
function requireEngine(){if(!engine)throw new Error('Sense izvršni modul nije učitan. Ponovo otvori stranicu. Uneseni tekst možeš sačuvati u svojim datotekama prije ponovnog otvaranja.');return engine;}
function close(id){if($(id).open)$(id).close();}
function focusableHere(node){return !!node?.isConnected&&!node.disabled&&!node.closest('[hidden],[inert]')&&node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden';}
function requirementHeading(id){return id?document.querySelector('[data-requirement-id="'+CSS.escape(id)+'"] h3'):null;}
function focusRequirement(id){const h=requirementHeading(id)||$('requirements').querySelector('h3');if(focusableHere(h)){h.focus();return;}const fallback=$('view-'+currentView)?.querySelector('h2');if(fallback){fallback.tabIndex=-1;fallback.focus();}}
function open(id){if(!$(id).open){const node=document.activeElement;dialogReturns.set(id,{node,requirementId:node?.closest?.('[data-requirement-id]')?.dataset.requirementId||null});$(id).showModal();}}
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>{
 const previous=dialogReturns.get(dialog.id);dialogReturns.delete(dialog.id);if(!previous||document.querySelector('dialog[open]'))return;
 if(focusableHere(previous.node)){previous.node.focus();return;}
 if(previous.requirementId&&currentView==='review'){focusRequirement(previous.requirementId);return;}
 if(document.activeElement===document.body||dialog.contains(document.activeElement))focusRequirement(null);
});
function fieldError(id,message=''){
 const input=$(id),error=$(({'cv-text':'cv-error','job-text':'job-error','scenario-cv':'scenario-error','draft-text':'draft-error'})[id]);
 if(!input)return;if(message)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
 if(error){error.textContent=message;error.hidden=!message;}
}
function clearFieldErrors(){for(const id of ['cv-text','job-text','scenario-cv','draft-text'])fieldError(id);}
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>close(b.dataset.close));

$('settings-open').setAttribute('aria-label','Prikaz i kontrole');
function setView(view,{focus=false}={}){
 const name=views.has(view)?view:'workspace';if(currentView!==name)stopScan();currentView=name;
 for(const v of views)$('view-'+v).hidden=v!==name;
 for(const b of document.querySelectorAll('#primary-nav [data-view]')){if(b.dataset.view===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 history.replaceState(null,'','#'+name);document.body.dataset.senseView=name;if(sourceReturnButton)sourceReturnButton.hidden=name!=='workspace'||!sourceReturn;
 if(focus){const h=$('view-'+name).querySelector('h2');h.tabIndex=-1;h.focus();}
}
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view,{focus:true}));
window.addEventListener('hashchange',()=>setView(location.hash.slice(1)));

function capture(){return {...state,confirmations:{...state.confirmations},draftClaims:[...state.draftClaims],draftWarnings:[...state.draftWarnings]};}
function snapshotBytes(x){try{return JSON.stringify(x).length;}catch{return MAX_HISTORY_BYTES;}}
function remember(){
 undoStack.push(capture());redoStack=[];let bytes=undoStack.reduce((n,x)=>n+snapshotBytes(x),0);
 while(undoStack.length>MAX_HISTORY||bytes>MAX_HISTORY_BYTES&&undoStack.length>1)bytes-=snapshotBytes(undoStack.shift());
 updateHistory();
}
function endEditBatch(){if(editTimer)clearTimeout(editTimer);editTimer=null;}
function typingCheckpoint(){if(!editTimer)remember();else clearTimeout(editTimer);editTimer=setTimeout(()=>{editTimer=null;},850);}
function restore(snapshot){stop();clearFieldErrors();Object.assign(state,snapshot);state.confirmations={...snapshot.confirmations};state.draftClaims=[...snapshot.draftClaims];state.draftWarnings=[...snapshot.draftWarnings];$('cv-text').value=state.cvText;$('job-text').value=state.jobText;$('draft-text').value=state.draftText;$('scenario-cv').value=state.cvText;shadowResult=null;pendingChange=null;renderAll();markDirty();}
function updateHistory(){$('undo').disabled=busy||undoStack.length===0;$('redo').disabled=busy||redoStack.length===0;}
function markDirty(){$('save-state').textContent='Samo u ovom prozoru';}
function markDraftStale(){if(!state.draftText.trim())return;state.draftStale=true;state.draftClaims=[];state.draftWarnings=['Izvor ili potvrde su promijenjeni. Nacrt je sačuvan, ali ga treba ponovo pripremiti ili ručno provjeriti.'];}
function invalidateReport(){sourceReturn=null;if(sourceReturnButton)sourceReturnButton.hidden=true;markDraftStale();renderDraft();state.report=null;state.confirmations={};shadowResult=null;pendingChange=null;renderReport();renderScenario();renderDiagnostics();$('input-change-note').textContent='Promijenjen je unos. Pokreni novu analizu da nalazi odgovaraju trenutnom tekstu.';}
function counts(){for(const [key,id]of [['cvText','cv-count'],['jobText','job-count'],['draftText','draft-count']])$(id).textContent=state[key].length.toLocaleString('bs-BA')+' znakova';}
function updateBusy(){
 $('stop').disabled=!busy;
 for(const id of ['requirements','scenario-deltas','analyze','run-scenario'])$(id).setAttribute('aria-busy',String(busy));
 for(const id of ['analyze','demo','cv-text','job-text','run-scenario','reset-scenario','apply-scenario','build-draft','save-local','load-local','export-project','import-project-button','clear-cv','clear-job','confirm-change'])$(id).disabled=busy;
 for(const b of document.querySelectorAll('.requirement-actions button'))b.disabled=busy;
 updateHistory();
}
async function perform(action){
 if(busy)throw new Error('Provjera je već u toku. Prvo je zaustavi ili sačekaj rezultat.');
 const own=++sequence;busy=true;controller=new AbortController();updateBusy();
 try{const result=await action(controller.signal);if(own!==sequence)throw new DOMException('Zaustavljeno','AbortError');return result;}
 finally{if(own===sequence){busy=false;controller=null;updateBusy();}}
}
function stop(){++sequence;controller?.abort();controller=null;busy=false;stopScan();updateBusy();}
bind('stop','click',()=>{stop();status('Zatražen je prekid provjere. Zakašnjeli rezultat neće promijeniti tvoju prijavu.');});
bind('undo','click',()=>{endEditBatch();if(!undoStack.length)return;const target=undoStack.pop();redoStack.push(capture());restore(target);updateHistory();status('Prethodna promjena je poništena.');});
bind('redo','click',()=>{endEditBatch();if(!redoStack.length)return;const target=redoStack.pop();undoStack.push(capture());restore(target);updateHistory();status('Promjena je ponovljena.');});
for(const [id,key]of [['cv-text','cvText'],['job-text','jobText']])bind(id,'input',()=>{fieldError(id);typingCheckpoint();state[key]=$(id).value;invalidateReport();counts();markDirty();});
for(const [id,key,input]of [['clear-cv','cvText','cv-text'],['clear-job','jobText','job-text']])bind(id,'click',()=>{fieldError(input);endEditBatch();remember();state[key]='';$(input).value='';invalidateReport();counts();markDirty();status('Tekst je uklonjen iz trenutne prijave. Možeš poništiti ovu promjenu.');});
bind('demo','click',()=>{clearFieldErrors();endEditBatch();remember();state.cvText=demoCV;state.jobText=demoJob;$('cv-text').value=demoCV;$('job-text').value=demoJob;invalidateReport();counts();markDirty();status('Učitan je originalni testni primjer. To nisu stvarna osoba ni stvarni oglas. Pokreni analizu da vidiš izvršene nalaze.');});

async function analyze(){
 requireEngine();clearFieldErrors();const missing=[];
 for(const [id,key,message]of [['cv-text','cvText','Unesi CV ili opis stvarnog iskustva prije analize.'],['job-text','jobText','Dodaj tekst jednog oglasa prije analize.']])if(!state[key].trim()){fieldError(id,message);missing.push(id);}
 if(missing.length){setView('workspace');$(missing[0]).focus();throw new Error('Unesi opis iskustva i jedan oglas prije analize.');}
 endEditBatch();status('Sense provjerava zahtjeve i moguće navode na ovom uređaju…','busy');
 const report=await perform(signal=>engine.analyze({cvText:state.cvText,jobText:state.jobText,confirmations:state.confirmations,signal}));
 remember();state.report=report;state.confirmations={...(report.confirmations||{})};shadowResult=null;pendingChange=null;guidedIndex=0;$('scenario-cv').value=state.cvText;renderAll();markDirty();setView('review',{focus:true});
 senseSignal('review');status('Analiza je izvršena lokalno. Pregledaj izvorne navode i potvrdi samo ono što je tačno.');
}
bind('analyze','click',analyze);
function filteredRequirements(){const list=state.report?.requirements||[],filter=$('finding-filter').value;return list.filter(r=>filter==='all'||filter==='open'&&r.status!=='supported'||filter==='mandatory'&&r.priority==='mandatory'||filter==='supported'&&r.status==='supported');}
function summaryCard(label,value,note,primary=false){const div=element('div','summary-card'+(primary?' primary':''));div.append(element('small','',label));const strong=element('strong');if(Array.isArray(value)){strong.append(document.createTextNode(value[0]+' '),element('span','',value[1]));}else strong.textContent=String(value);div.append(strong,element('p','',note));return div;}
function renderSummary(){
 const c=state.report?.counts||{},total=c.total??state.report?.requirements.length??0,supported=c.supported||0;
 $('summary').replaceChildren(summaryCard('Potvrđeni navodi i koraci',[supported,'/ '+total],'Prema tvojoj potvrdi i izvršenoj provjeri',true),summaryCard('Obavezno za provjeru',c.mandatoryOpen||0,'Otvoreni obavezni zahtjevi'),summaryCard('Za tvoju potvrdu',c.unconfirmed||0,'Moguće veze s iskustvom'));
}
function sourceButton(label,source,type){const b=button(label,'quiet-button',()=>showSource(source,type,b.closest('[data-requirement-id]')?.dataset.requirementId));b.setAttribute('aria-label',label+(type==='job'?' u oglasu':' u CV-u'));return b;}
function showSource(source,type,requirementId){
 if(!source||!Number.isInteger(source.start)||!Number.isInteger(source.end))throw new Error('Izvorni raspon nije dostupan. Pogledaj originalni tekst.');
 sourceReturn=requirementId||null;setView('workspace');const input=$(type==='job'?'job-text':'cv-text');input.focus();input.setSelectionRange(Math.max(0,source.start),Math.min(input.value.length,source.end));
 const line=input.value.slice(0,source.start).split('\n').length;input.scrollTop=Math.max(0,(line-3)*parseFloat(getComputedStyle(input).lineHeight));status(type==='job'?'Označen je izvorni dio oglasa.':'Označen je izvorni navod u CV-u.');
}
function requirementCard(r){
 const card=element('article','requirement-card');card.dataset.status=r.status;card.dataset.requirementId=r.id;
 // Requirement IDs originate in the checked engine. Encoding code points also
 // keeps DOM identities collision-free if a future format extends their alphabet.
 const identity='sense-requirement-'+Array.from(String(r.id)).map(c=>c.codePointAt(0).toString(16)).join('-');
 const top=element('div','requirement-top'),priority=element('span','priority-tag '+r.priority,PRIORITY_LABELS[r.priority]||'Zahtjev'),statusTag=element('span','status-tag '+r.status,STATUS_LABELS[r.status]||'Za pregled');statusTag.id=identity+'-status';top.append(priority,statusTag);card.append(top);
 const h=element('h3','',r.label);h.id=identity+'-title';h.tabIndex=-1;const reason=element('p','reason',r.reason||'Pregledaj zahtjev i izvorne navode.');reason.id=identity+'-reason';card.setAttribute('aria-labelledby',h.id);card.setAttribute('aria-describedby',statusTag.id+' '+reason.id);h.setAttribute('aria-describedby',statusTag.id+' '+reason.id);card.append(h,reason);
 card.append(element('div','quote-label','IZ OGLASA'),element('blockquote','source-quote',r.source?.text||r.label),sourceButton('Pokaži dio oglasa',r.source,'job'));
 const facts=(r.matches||[]).map(id=>state.report.facts.find(f=>f.id===id)).filter(Boolean);
 if(facts.length){
  const details=element('details','matched-facts'),summary=element('summary','quote-label','MOGUĆI NAVODI IZ CV-a · '+facts.length);details.append(summary);if(facts.length===1)details.open=true;
  for(const fact of facts){details.append(element('blockquote','source-quote',fact.text||fact.source?.text||''),sourceButton('Pokaži izvorni navod',fact.source,'cv'));}
  card.append(details);
 }
 if(r.suggestion)card.append(element('p','suggestion',r.suggestion));
 const actions=element('div','requirement-actions');actions.setAttribute('role','group');actions.setAttribute('aria-labelledby',h.id);actions.setAttribute('aria-describedby',statusTag.id+' '+reason.id);
 const canConfirm=r.action===true||(r.found===true&&!r.negated&&!r.mismatch&&!r.ambiguous);
 if(canConfirm&&r.status!=='supported')actions.append(button(r.action?'Provjerio/la sam ovaj korak':'Potvrdi povezani navod','button',()=>previewConfirmation(r,'confirmed')));
 if(r.status==='supported')actions.append(button('Vrati na provjeru','button secondary',()=>previewConfirmation(r,'uncertain')));
 if((r.action||facts.length)&&r.status!=='contradicted')actions.append(button(r.action?'Ovaj korak nije završen':'Ovaj navod to ne potvrđuje','quiet-button',()=>previewConfirmation(r,'denied')));
 if(!r.action&&!canConfirm)actions.append(button('Dopuni ili pojasni svoj opis','button secondary',()=>{setView('workspace');$('cv-text').focus();status('Dodaj istinit detalj ili ispravi nejasan navod, pa ponovo analiziraj prijavu. Sense neće sam dodati kvalifikaciju.');}));
 card.append(actions);for(const control of card.querySelectorAll('button,summary'))control.setAttribute('aria-describedby',h.id+' '+statusTag.id);return card;
}
function renderSourceReview(report){
 let panel=$('source-review');if(!panel){panel=element('details','panel source-review');panel.id='source-review';$('report-warnings').after(panel);}
 panel.replaceChildren();panel.hidden=!report;if(!report)return;
 const entries=report.sourceReview||[],unknown=entries.filter(s=>s.kind==='unclassified');panel.append(element('summary','',unknown.length+' odlomaka za tvoj pregled · cijeli izvor oglasa'));
 panel.append(element('p','field-help','Prepoznati nalazi nisu procjena cijele prijave. Ovdje su i dijelovi koje pravila nisu protumačila.'));
 if(report.sourceReviewComplete===false)panel.append(element('p','field-help','Prikazano '+entries.length+' od '+report.sourceReviewTotal+' odlomaka. Razdvoji oglas za potpuniji pregled.'));
 for(const [index,entry] of entries.entries()){const row=element('article','source-review-entry'),sourceLabel=element('h4','quote-label','Odlomak oglasa '+(index+1));sourceLabel.id='sense-source-review-'+index;row.setAttribute('aria-labelledby',sourceLabel.id);row.append(sourceLabel);row.append(element('strong','',({classified:'Povezano s nalazima',unclassified:'Nije protumačeno — pregledaj',section:'Naslov odjeljka',excluded:'Izričito nije obavezno'})[entry.kind]||'Pregledaj izvor'),element('blockquote','source-quote',entry.source.text),sourceButton('Pokaži dio oglasa',entry.source,'job'));row.querySelector('button').setAttribute('aria-describedby',sourceLabel.id);panel.append(row);}
}
function renderReport(){
 const previousFocus=document.activeElement,previousRequirement=previousFocus?.closest?.('#requirements [data-requirement-id]')?.dataset.requirementId;
 const report=state.report;renderSourceReview(report);$('review-empty').hidden=!!report;$('review-content').hidden=!report;$('nav-review-count').textContent=report?String(report.counts?.total??report.requirements.length).padStart(2,'0'):'02';
 if(!report){$('requirements').replaceChildren();$('summary').replaceChildren();if(previousRequirement&&currentView==='review'&&!document.querySelector('dialog[open]'))focusRequirement(null);return;}
 renderSummary();const list=filteredRequirements();guidedIndex=Math.max(0,Math.min(guidedIndex,list.length-1));const shown=preferences.guided?list.slice(guidedIndex,guidedIndex+1):list;
 $('requirements').replaceChildren(...shown.map(requirementCard));if(!list.length)$('requirements').append(element('p','field-help','Nema zahtjeva za odabrani prikaz. Promijeni filter da vidiš ostale nalaze.'));
 $('finding-count').textContent=list.length+' od '+report.requirements.length+' zahtjeva';$('guided-controls').hidden=!preferences.guided||!list.length;$('guided-prev').disabled=guidedIndex<=0;$('guided-next').disabled=guidedIndex>=list.length-1;$('guided-progress').textContent='Zahtjev '+(guidedIndex+1)+' od '+list.length;
 const next=report.requirements.find(r=>r.priority==='mandatory'&&r.status!=='supported')||report.requirements.find(r=>r.status!=='supported');
 $('next-action-title').textContent=next?'Počni od otvorenog zahtjeva.':'Potvrđeni navodi su spremni.';$('next-action-text').textContent=next?next.label:'Možeš pripremiti nacrt. Još jednom provjeri sadržaj i zahtjeve izvornog oglasa.';
 $('report-warnings').replaceChildren(...(report.warnings||[]).map(w=>element('p','',typeof w==='string'?w:w.message||'Pregledaj izvorne podatke.')));updateBusy();
 if(previousRequirement&&!previousFocus.isConnected&&currentView==='review'&&!document.querySelector('dialog[open]'))focusRequirement(previousRequirement);
}
bind('finding-filter','change',()=>{guidedIndex=0;renderReport();});
function guidedMove(delta){guidedIndex+=delta;renderReport();$('requirements').querySelector('h3')?.focus();}
bind('guided-prev','click',()=>guidedMove(-1));bind('guided-next','click',()=>guidedMove(1));

function describeChanges(result,target){
 const list=result?.changes||[];target.replaceChildren();if(!list.length){target.append(element('p','','Statusi zahtjeva nisu se promijenili. Pregledaj i sam sadržaj izmjene.'));return;}
 for(const item of list){const r=result.report.requirements.find(x=>x.id===item.id)||state.report?.requirements.find(x=>x.id===item.id);target.append(element('p','',(r?.label||'Zahtjev')+'\n'+(STATUS_LABELS[item.before]||item.before)+' → '+(STATUS_LABELS[item.after]||item.after)));}
}
async function previewConfirmation(requirement,value){
 if(!state.report)throw new Error('Prvo analiziraj prijavu.');const trigger=document.activeElement;status('Provjera potvrde na odvojenoj kopiji…','busy');
 const sourceReport=state.report,next={...state.confirmations,[requirement.id]:value};
 const result=await perform(signal=>engine.shadow(sourceReport,{confirmations:next,signal}));
 if(result.liveUnchanged!==true)throw new Error('Odvojena provjera nije potvrdila očuvanje trenutne prijave. Promjena nije primijenjena.');
 pendingChange={result,sourceReport,requirementId:requirement.id};$('change-description').textContent=(value==='confirmed'?'Potvrđuješ da postojeći navod potkrepljuje zahtjev: ':value==='denied'?'Označavaš da povezani navod ne potkrepljuje zahtjev: ':'Vraćaš zahtjev na provjeru: ')+requirement.label;
 describeChanges(result,$('change-list'));open('change-dialog');dialogReturns.set('change-dialog',{node:trigger,requirementId:requirement.id});status('Pregled potvrde je spreman. Trenutni nalaz još nije promijenjen.');
}
function adopt(result,original){
 if(!result||result.liveUnchanged!==true||state.report!==original)throw new Error('Prijava se promijenila nakon pregleda. Ponovo provjeri izmjenu.');
 endEditBatch();remember();markDraftStale();state.report=result.report;state.cvText=result.report.cvText;state.jobText=result.report.jobText;state.confirmations={...(result.report.confirmations||{})};$('cv-text').value=state.cvText;$('job-text').value=state.jobText;$('scenario-cv').value=state.cvText;shadowResult=null;pendingChange=null;renderAll();markDirty();senseSignal('confirm');status('Pregledana promjena je prihvaćena. Ranije pripremljen nacrt provjeri ili ga ponovo pripremi.');
}
bind('confirm-change','click',()=>{if(!pendingChange)throw new Error('Nema promjene za potvrdu.');const p=pendingChange;adopt(p.result,p.sourceReport);close('change-dialog');if(currentView==='review')focusRequirement(p.requirementId);});
bind('reset-scenario','click',()=>{if(!state.report)throw new Error('Prvo analiziraj CV i oglas.');$('scenario-cv').value=state.cvText;shadowResult=null;renderScenario();status('Alternativni opis vraćen je na trenutni CV.');});
bind('scenario-cv','input',()=>{fieldError('scenario-cv');shadowResult=null;renderScenario();});
bind('run-scenario','click',async()=>{
 if(!state.report)throw new Error('Prvo analiziraj CV i oglas.');const cvText=$('scenario-cv').value;fieldError('scenario-cv');if(!cvText.trim()){fieldError('scenario-cv','Unesi istinit alternativni opis prije provjere.');$('scenario-cv').focus();throw new Error('Alternativni opis je prazan.');}
 status('Izvršavanje alternativne analize na odvojenoj kopiji…','busy');const original=state.report,result=await perform(signal=>engine.shadow(original,{cvText,confirmations:state.confirmations,signal}));
 if(result.liveUnchanged!==true)throw new Error('Nije potvrđeno očuvanje originala. Promjena nije prihvaćena.');shadowResult={result,original};renderScenario();renderTrace(result.report);status('Alternativna analiza je izvršena. Originalni CV i nalazi nisu promijenjeni.');
});
function renderScenario(){
 $('scenario-apply-row').hidden=!shadowResult;$('scenario-deltas').replaceChildren();$('scenario-changes').replaceChildren();
 if(!shadowResult){$('scenario-result-title').textContent='Promjena prvo dobija pregled.';$('scenario-result-description').textContent='Ovdje će se prikazati razlike iz stvarno izvršene alternativne analize.';return;}
 const r=shadowResult.result;$('scenario-result-title').textContent='Alternativa je provjerena.';$('scenario-result-description').textContent='Trenutna prijava je ostala nepromijenjena. Ovi brojevi opisuju nalaze; nisu prognoza zaposlenja.';
 for(const [label,key]of [['Potkrijepljeno','supported'],['Obavezno otvoreno','mandatoryOpen']]){const div=element('div','delta-item');div.append(element('small','',label),element('strong','',(r.countsBefore?.[key]||0)+' → '+(r.countsAfter?.[key]||0)));$('scenario-deltas').append(div);}describeChanges(r,$('scenario-changes'));
}
bind('apply-scenario','click',()=>{if(!shadowResult)throw new Error('Prvo provjeri alternativu.');adopt(shadowResult.result,shadowResult.original);setView('review',{focus:true});});
bind('discard-scenario','click',()=>{shadowResult=null;$('scenario-cv').value=state.cvText;renderScenario();renderDiagnostics();$('scenario-cv').focus();status('Alternativa je odbačena. Trenutna prijava nije promijenjena.');});

function renderDraft(){
 $('draft-text').value=state.draftText;$('draft-claims').replaceChildren();
 if(!state.draftClaims.length)$('draft-claims').append(element('p','field-help','Nakon pripreme ovdje ćeš vidjeti izvorne navode.'));
 for(const claim of state.draftClaims){const div=element('div','draft-claim');div.append(element('small','','IZVORNI NAVOD'),element('p','',claim.text||claim.source?.text||''));if(claim.source)div.append(sourceButton('Pokaži u originalnom CV-u',claim.source,'cv'));$('draft-claims').append(div);}
 $('draft-note').textContent=state.draftStale?'Izvor ili potvrde su promijenjeni. Nacrt je zadržan za tvoj pregled; ranija povezanost više nije potvrđena.':state.draftEdited?'Nacrt je ručno uređivan. Ručne izmjene nisu automatski potvrđene izvornim navodima.':state.generatedDraftText?'Pripremljeno iz potvrđenih navoda. Provjeri tekst prije korištenja.':'Nacrt još nije pripremljen. Prvo pregledaj i potvrdi povezane navode.';
 $('draft-warnings').replaceChildren(...state.draftWarnings.map(w=>element('p','field-help',typeof w==='string'?w:w.message||'Provjeri nacrt.')));counts();
}
bind('build-draft','click',async()=>{
 if(!state.report)throw new Error('Prvo analiziraj prijavu i potvrdi povezane navode.');requireEngine();const draft=await engine.createDraft(state.report);
 if(!draft||typeof draft.text!=='string')throw new Error('Sense nije vratio ispravan nacrt.');
 endEditBatch();remember();fieldError('draft-text');state.draftText=draft.text;state.generatedDraftText=draft.text;state.draftClaims=Array.isArray(draft.claims)?draft.claims:[];state.draftWarnings=Array.isArray(draft.warnings)?draft.warnings:[];state.draftEdited=false;state.draftStale=false;renderDraft();markDirty();if(draft.text.trim()&&currentView==='draft')$('draft-text').focus();
 if(!draft.text.trim())status('Još nema potvrđenih navoda za nacrt. Pregledaj zahtjeve i potvrdi samo tačne veze.','error');else status('Nacrt je pripremljen iz potvrđenih navoda. Možeš ga pregledati, urediti i preuzeti.');
});
bind('draft-text','input',()=>{fieldError('draft-text');typingCheckpoint();state.draftText=$('draft-text').value;state.draftEdited=state.draftText!==state.generatedDraftText;$('draft-note').textContent=state.draftStale?'Izvor ili potvrde su promijenjeni. Nacrt je zadržan za tvoj pregled; ranija povezanost više nije potvrđena.':state.draftEdited?'Nacrt je ručno uređivan. Ručne izmjene nisu automatski potvrđene izvornim navodima.':'Pripremljeno iz potvrđenih navoda. Provjeri tekst prije korištenja.';counts();markDirty();});
function download(name,text,type='text/plain;charset=utf-8'){
 if(typeof text!=='string'||text.length>1500000)throw new Error('Sadržaj nije podržan za preuzimanje.');const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function requireDraft(){fieldError('draft-text');if(!state.draftText.trim()){fieldError('draft-text','Nacrt je prazan. Pripremi ga iz potvrđenih navoda ili unesi svoj tekst.');$('draft-text').focus();throw new Error('Nacrt je prazan.');}}
bind('download-draft','click',()=>{requireDraft();download('BL-CLEA-Sense-CV-nacrt.txt','BL CLEA Sense 7 · TESTNA VERZIJA\nKorisnički nacrt — provjeri podatke prije slanja.\n\n'+state.draftText);status('Pripremljen je TXT nacrt za preuzimanje. Datoteka može sadržavati tvoje privatne podatke.');});
bind('print-draft','click',()=>{requireDraft();$('print-text').textContent=state.draftText;window.print();});
bind('select-draft','click',()=>{requireDraft();$('draft-text').focus();$('draft-text').select();status('Tekst nacrta je odabran. Možeš koristiti sistemsku naredbu za kopiranje.');});

function sanitizedTrace(report){
 const allowed=['kind','id','instruction','code','passed','ms','route','status','registry','format','version','count','supported','mandatoryOpen','aiUsed'];
 return (report?.trace||[]).slice(-180).map(x=>{const e={};for(const k of allowed)if(['string','boolean','number'].includes(typeof x[k]))e[k]=x[k];for(const k of ['reads','writes'])if(Array.isArray(x[k]))e[k]=x[k].filter(v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,70}$/.test(v)).slice(0,50);if(x.location)e.location=Object.fromEntries(['line','column','start','end'].filter(k=>Number.isFinite(x.location[k])).map(k=>[k,x.location[k]]));return e;});
}
function renderTrace(report){
 if(!report){$('trace').textContent='Nema zabilježene analize.';$('runtime-summary').textContent='Još nema izvršene analize. Sense koristi BIL pravila i provjerene lokalne operacije.';return;}
 const m=report.metrics||{};$('runtime-summary').textContent='Izvršeno BIL instrukcija: '+(Number.isFinite(m.instructions)?m.instructions.toLocaleString('bs-BA'):'nije prijavljeno')+'. Vrijeme lokalne obrade: '+(Number.isFinite(m.elapsedMs)?Math.round(m.elapsedMs)+' ms':'nije prijavljeno')+'.';
 $('trace').textContent=JSON.stringify({format:report.format,metrics:{instructions:m.instructions,elapsedMs:m.elapsedMs},trace:sanitizedTrace(report)},null,2);
}
function renderDiagnostics(){renderTrace(state.report);}
bind('download-report','click',()=>{if(!state.report)throw new Error('Prvo izvrši analizu.');download('BL-CLEA-Sense-izvjestaj.json',JSON.stringify(state.report,null,2),'application/json');status('Pripremljen je izvještaj koji sadrži CV, oglas i nalaze. Čuvaj ga kao privatnu datoteku.');});

function projectInput(){return {cvText:state.cvText,jobText:state.jobText,confirmations:{...state.confirmations}};}
function serializeWorkspace(){
 const core=requireEngine().exportProject(state.report||projectInput());const project=typeof core==='string'?JSON.parse(core):core;
 return JSON.stringify({format:'blclea.sense.workspace/1',project,draftText:state.draftText},null,2);
}
function parseWorkspace(text){
 if(typeof text!=='string'||text.length>400000)throw new Error('Projekt je prevelik. Najveća veličina je 400 KB.');
 let raw;try{raw=JSON.parse(text);}catch{throw new Error('Projekt nije ispravan JSON.');}
 let draftText='',coreText=text;
 if(raw?.format==='blclea.sense.workspace/1'){
  if(Object.getPrototypeOf(raw)!==Object.prototype||Object.keys(raw).sort().join('|')!=='draftText|format|project'||typeof raw.draftText!=='string'||raw.draftText.length>40000)throw new Error('Kopija radnog prostora nije podržana.');
  draftText=raw.draftText;coreText=JSON.stringify(raw.project);
 }
 const instance=requireEngine(),detail=typeof instance.importProjectDetailed==='function'?instance.importProjectDetailed(coreText):{project:instance.importProject(coreText),warnings:[]},project=detail.project;
 if(!project||typeof project.cvText!=='string'||typeof project.jobText!=='string')throw new Error('Projekt nema podržane izvore.');
 return {...project,draftText,importWarnings:Array.isArray(detail.warnings)?detail.warnings:[]};
}
async function loadWorkspace(text,rememberChange=true){
 const loaded=parseWorkspace(text);stop();clearFieldErrors();endEditBatch();if(rememberChange)remember();state.cvText=loaded.cvText;state.jobText=loaded.jobText;state.confirmations={...(loaded.confirmations||{})};state.report=null;state.draftText=loaded.draftText;state.generatedDraftText='';state.draftClaims=[];state.draftWarnings=[];state.draftEdited=!!loaded.draftText;state.draftStale=false;$('cv-text').value=state.cvText;$('job-text').value=state.jobText;$('scenario-cv').value=state.cvText;shadowResult=null;pendingChange=null;renderAll();setView('workspace',{focus:true});markDirty();status('Projekt je otvoren. Pokreni novu analizu da dobiješ provjeren izvještaj za ovu sesiju.'+(loaded.importWarnings.length?' '+loaded.importWarnings.join(' '):''));
}
bind('save-local','click',()=>{const body=serializeWorkspace();try{localStorage.setItem(PROJECT_KEY,body);}catch{throw new Error('Lokalno čuvanje nije uspjelo. Prethodna sačuvana kopija nije obrisana; preuzmi projekt u datoteku.');}$('save-state').textContent='Sačuvano na ovom uređaju';status('CV, oglas, potvrde i nacrt sačuvani su u ovom pregledniku. Na dijeljenom uređaju obriši ih nakon rada.');});
bind('load-local','click',async()=>{let text;try{text=localStorage.getItem(PROJECT_KEY);}catch{throw new Error('Lokalno čuvanje ovdje nije dostupno. Možeš uvesti preuzeti projekt.');}if(!text)throw new Error('Na ovom uređaju nema sačuvanog Sense projekta.');await loadWorkspace(text);$('save-state').textContent='Otvorena lokalna kopija';});
bind('export-project','click',()=>{download('BL-CLEA-Sense-projekt.json',serializeWorkspace(),'application/json');status('Projekt je pripremljen za preuzimanje. Sadrži tvoj CV, oglas, potvrde i nacrt.');});
bind('import-project-button','click',()=>$('import-project').click());
bind('import-project','change',async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;if(file.size>400000)throw new Error('Projekt je prevelik. Najveća veličina je 400 KB.');await loadWorkspace(await file.text());});

function applyPreferences(){
 document.documentElement.style.setProperty('--scale',String(preferences.fontScale));document.body.classList.toggle('large-text',preferences.fontScale>1.3);document.body.classList.toggle('high-contrast',preferences.highContrast);document.body.classList.toggle('reduced-motion',preferences.reducedMotion);
 $('font-scale').value=String(preferences.fontScale);$('font-value').value=Math.round(preferences.fontScale*100)+'%';$('font-scale').setAttribute('aria-valuetext',$('font-value').value);$('high-contrast').checked=preferences.highContrast;$('reduced-motion').checked=preferences.reducedMotion;$('guided-mode').checked=preferences.guided;$('guided-settings').checked=preferences.guided;$('scan-speed').value=String(preferences.scanInterval);$('scan-value').value=(preferences.scanInterval/1000).toLocaleString('bs-BA')+' s';$('scan-speed').setAttribute('aria-valuetext',(preferences.scanInterval/1000).toLocaleString('bs-BA')+' sekundi');renderReport();
}
function savePreferences(){try{localStorage.setItem(PREF_KEY,JSON.stringify(preferences));$('preference-status').textContent='Postavke prikaza su sačuvane. CV i oglas nisu dio tih postavki.';}catch{$('preference-status').textContent='Postavke prikaza rade u ovom prozoru, ali trajno čuvanje nije dostupno.';}}
function validatePreferences(p){if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join('|')!=='fontScale|guided|highContrast|reducedMotion|scanInterval'||typeof p.fontScale!=='number'||!Number.isFinite(p.fontScale)||p.fontScale<1||p.fontScale>2||['guided','highContrast','reducedMotion'].some(k=>typeof p[k]!=='boolean')||!Number.isInteger(p.scanInterval)||p.scanInterval<1000||p.scanInterval>5000)throw Error('Postavke');return p;}
try{const stored=localStorage.getItem(PREF_KEY);if(stored&&stored.length<2000)preferences=validatePreferences(JSON.parse(stored));}catch{}
bind('settings-open','click',()=>open('settings-dialog'));
bind('font-scale','input',()=>{preferences.fontScale=Number($('font-scale').value);applyPreferences();savePreferences();});
for(const [id,key]of [['high-contrast','highContrast'],['reduced-motion','reducedMotion'],['guided-settings','guided'],['guided-mode','guided']])bind(id,'change',()=>{preferences[key]=$(id).checked;guidedIndex=0;applyPreferences();savePreferences();});
bind('scan-speed','input',()=>{preferences.scanInterval=Number($('scan-speed').value);$('scan-value').value=(preferences.scanInterval/1000).toLocaleString('bs-BA')+' s';$('scan-speed').setAttribute('aria-valuetext',(preferences.scanInterval/1000).toLocaleString('bs-BA')+' sekundi');savePreferences();if(scanTimer)startScan();});
function stopScan(){if(scanTimer)clearInterval(scanTimer);scanTimer=null;scanIndex=-1;for(const n of document.querySelectorAll('.scan-active'))n.classList.remove('scan-active');$('scan-start').disabled=false;$('scan-stop').disabled=true;$('scan-status').textContent='Obilazak nije pokrenut.';}
function scanActions(){return [...document.querySelectorAll('#primary-nav button,#view-'+currentView+' button')].filter(b=>!b.disabled&&!b.closest('[hidden]')&&b.getClientRects().length>0&&getComputedStyle(b).visibility!=='hidden'&&!b.closest('[inert]')).slice(0,80);}
function startScan(){
 stopScan();close('settings-dialog');let buttons=scanActions();if(!buttons.length)throw new Error('Nema dostupnih akcija za obilazak.');
 const next=()=>{for(const n of document.querySelectorAll('.scan-active'))n.classList.remove('scan-active');buttons=scanActions();if(!buttons.length){stopScan();return;}scanIndex=(scanIndex+1)%buttons.length;buttons[scanIndex].classList.add('scan-active');$('scan-status').textContent='Označeno: '+buttons[scanIndex].textContent.trim().replace(/\s+/g,' ')+'. Space ili Enter bira akciju.';window.dispatchEvent(new CustomEvent('sense:scan',{detail:{label:buttons[scanIndex].textContent.trim().replace(/\s+/g,' '),index:scanIndex+1,total:buttons.length}}));};
 next();scanTimer=setInterval(next,preferences.scanInterval);$('scan-start').disabled=true;$('scan-stop').disabled=false;status('Obilazak glavnih akcija je uključen. Space ili Enter bira označeno; Escape zaustavlja.');
}
bind('scan-start','click',startScan);bind('scan-stop','click',stopScan);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){stopScan();if(busy)stop();return;}
 if(!scanTimer||![' ','Enter'].includes(event.key)||event.repeat||event.target.matches('input,textarea,select')||event.target.isContentEditable||document.querySelector('dialog[open]'))return;
 event.preventDefault();event.stopPropagation();const target=document.querySelector('.scan-active');stopScan();target?.click();
},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopScan();if(busy){stop();status('Provjera je prekinuta nakon odlaska iz radnog prostora. Sadržaj ostaje u ovom prozoru.');}}});

for(const id of ['privacy-open','help-open','about-test'])bind(id,'click',()=>open('help-dialog'));
bind('erase','click',()=>open('erase-dialog'));
bind('erase-confirm','click',()=>{
 stop();clearFieldErrors();endEditBatch();let erased=true;try{localStorage.removeItem(PROJECT_KEY);}catch{erased=false;}
 Object.assign(state,{cvText:'',jobText:'',confirmations:{},report:null,draftText:'',generatedDraftText:'',draftClaims:[],draftWarnings:[],draftEdited:false,draftStale:false});undoStack=[];redoStack=[];pendingChange=null;shadowResult=null;$('cv-text').value='';$('job-text').value='';$('scenario-cv').value='';$('print-text').textContent='';renderAll();close('erase-dialog');setView('workspace',{focus:true});markDirty();
 window.dispatchEvent(new Event('sense:erase'));
 status(erased?'Tvoj sadržaj i lokalno sačuvan projekt su obrisani iz ovog radnog prostora. Preuzete datoteke ostaju u tvojim datotekama.':'Sadržaj je uklonjen iz ovog prozora, ali brisanje lokalne kopije nije potvrđeno. Obriši podatke ove stranice kroz postavke preglednika.',erased?'ready':'error');
});
function renderAll(){counts();renderReport();renderScenario();renderDraft();renderDiagnostics();updateBusy();}
try{if(!globalThis.CLEA7Sense?.SenseEngine)throw Error('Sense izvršni modul nije učitan. Ponovo otvori stranicu.');engine=new CLEA7Sense.SenseEngine();}catch(error){fail(error);$('analyze').disabled=true;}
sourceReturnButton=button('Vrati se na nalaz','button secondary',()=>{const id=sourceReturn;if(!state.report||!id)throw Error('Nalaz više nije dostupan. Pokreni provjeru.');const index=filteredRequirements().findIndex(r=>r.id===id);if(index>=0)guidedIndex=index;renderReport();setView('review',{focus:true});document.querySelector('[data-requirement-id="'+CSS.escape(id)+'"] h3')?.focus();});sourceReturnButton.id='sense-return-source';sourceReturnButton.hidden=true;$('status').after(sourceReturnButton);
applyPreferences();renderAll();setView(location.hash.slice(1));
if(!engine){$('analyze').disabled=true;$('run-scenario').disabled=true;$('build-draft').disabled=true;}
})();
