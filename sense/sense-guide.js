/* Original BL CLEA Sense active guide, by Brzo i Lokalno.
 * One semantic description supplies visible captions and optional device speech.
 * No microphone, cloud voice, content upload, persistent data or AI claims. */
(function(scope){'use strict';
const words=value=>typeof value==='string'?value.replace(/[↶↷⌄■◇✓]/g,'').replace(/\s+/g,' ').trim().slice(0,240):'';
const statusNames=Object.freeze({supported:'potkrijepljeno tvojom potvrdom',unconfirmed:'potrebna je tvoja potvrda',notfound:'nije pronađen dovoljan navod',contradicted:'potrebna je pažnja zbog neslaganja',needsclarification:'potrebno je pojašnjenje'});
function describe(snapshot={}){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))snapshot={};
 const view=['workspace','review','scenario','draft'].includes(snapshot.view)?snapshot.view:'workspace';
 const names={workspace:'Unos CV-a i oglasa',review:'Provjera zahtjeva i dokaza',scenario:'Odvojeno isprobavanje promjene',draft:'Priprema tvoje prijave'};
 let location=names[view],instruction='',target='',action='';
 if(view==='workspace'){
  if(!snapshot.cvPresent){instruction='Prvi korak: unesi ili zalijepi svoj CV. Ime i kontakt nisu potrebni za analizu.';target='cv-text';action='Unesi svoj CV.';}
  else if(!snapshot.jobPresent){instruction='CV je unesen. Drugi korak: dodaj tekst jednog oglasa koji te zanima.';target='job-text';action='Dodaj oglas za posao.';}
  else{instruction='CV i oglas su uneseni. Pokreni lokalnu analizu, pa provjeri pronađene veze.';target='analyze';action='Pokreni lokalnu analizu.';}
 }else if(view==='review'){
  if(!snapshot.hasReport){instruction='Analiza još nije pokrenuta. Prvo poveži svoj CV i jedan oglas.';target='nav-workspace';action='Vrati se na unos.';}
  else if(snapshot.requirement){
   const requirement=snapshot.requirement,progress=words(snapshot.progress);if(progress)location+=' — '+progress.toLocaleLowerCase('bs');
   instruction='Zahtjev: '+words(requirement.label)+'. Status: '+(Object.hasOwn(statusNames,requirement.status)?statusNames[requirement.status]:'za pregled')+'. ';
   if(requirement.status==='supported'){instruction+='Možeš nastaviti na sljedeći zahtjev.';target=snapshot.canAdvance?'guided-next':'nav-draft';action=snapshot.canAdvance?'Otvori sljedeći zahtjev.':'Otvori pripremu nacrta.';}
   else{instruction+='Pročitaj povezani navod i sam odluči šta je tačno. Potvrda se ne izvršava automatski.';target='requirement-action';action='Pregledaj dostupnu radnju ovog zahtjeva.';}
  }else{instruction='Za ovaj filter nema prikazanih zahtjeva. Promijeni prikaz nalaza.';target='finding-filter';action='Izaberi prikaz zahtjeva.';}
 }else if(view==='scenario'){
  if(!snapshot.hasReport){instruction='Za poređenje je potrebna početna analiza CV-a i oglasa.';target='nav-workspace';action='Vrati se na unos.';}
  else if(snapshot.scenarioReady){instruction='Alternativa je provjerena na odvojenoj kopiji. Original se mijenja samo ako sam prihvatiš promjenu.';target='apply-scenario';action='Pregledaj odluku o prihvatanju alternative.';}
  else{instruction='Ovdje možeš isprobati istinit, precizniji opis iskustva. Početni CV ostaje sačuvan dok ne prihvatiš izmjenu.';target='scenario-cv';action='Uredi alternativni opis, zatim ga provjeri.';}
 }else{
  if(snapshot.hasDraft){instruction='Tvoj nacrt je otvoren za uređivanje. Pregledaj sadržaj prije preuzimanja ili štampe.';target='draft-text';action='Pregledaj i uredi svoj nacrt.';}
  else{instruction='Pripremi nacrt iz potvrđenih navoda ili preuzmi cijeli izvorni CV u urednik. Sense ne dopisuje iskustvo.';target='build-draft';action='Označi pripremu nacrta.';}
 }
 if(snapshot.busy){instruction='Provjera je u toku. Možeš sačekati ili je zaustaviti.';target='stop';action='Zaustavi trenutnu provjeru ako želiš.';}
 if(snapshot.scanLabel&&!snapshot.dialog){location+=' — obilazak akcija';instruction='Označena akcija: '+words(snapshot.scanLabel)+'. '+(Number.isInteger(snapshot.scanIndex)&&Number.isInteger(snapshot.scanTotal)?'Akcija '+snapshot.scanIndex+' od '+snapshot.scanTotal+'. ':'')+'Pritisni Space ili Enter za odabir. Escape zaustavlja obilazak.';target='scan-active-action';action='Izaberi označenu akciju tipkom Space ili Enter.';}
 if(snapshot.dialog){location='Otvoren prozor: '+words(snapshot.dialog);instruction=({'settings-dialog':'Ovdje biraš veličinu teksta, kontrast, kretanje i alternativne kontrole.','change-dialog':'Ovo je pregled promjene na odvojenoj kopiji. Prihvatanje biraš sam; original još nije promijenjen.','erase-dialog':'Ovdje odlučuješ o brisanju privatnog sadržaja. Već preuzete datoteke ostaju u tvojim datotekama.','sense-coach-dialog':'Ovdje pojašnjavaš vlastiti stvarni zadatak i iskustvo. Provjera se priprema kao odvojena alternativa.','help-dialog':'Ovdje su objašnjenja provjere, privatnosti i granica testne verzije.'})[snapshot.dialogId]||'Trenutno radiš u ovom prozoru. Pregledaj njegove opcije; važne radnje biraš sam.';target='dialog-action';action='Pregledaj radnje otvorenog prozora.';}
 const focus=!snapshot.scanLabel&&words(snapshot.focusedLabel)?'Označeno: '+words(snapshot.focusedLabel)+(snapshot.focusedType?' — '+words(snapshot.focusedType):'')+'.':'';
 // Position comes from a measured DOM rectangle in the browser's visible
 // viewport. It never claims access to a screen reader's virtual cursor.
 const position=typeof snapshot.position?.sentence==='string'?snapshot.position.sentence.replace(/\s+/g,' ').trim().slice(0,700):'';
 return Object.freeze({view,location,instruction,focus,position,caption:('Sada si na: '+location+'. '+focus+' '+position+' '+instruction).replace(/\s+/g,' ').trim(),action,target});
}
scope.CLEA7SenseGuide=Object.freeze({format:'sense.guide/1',describe});
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
if(!$('primary-nav')||$('sense-guide-launch'))return;
const css=make('style');css.textContent=`
.sense-guide-launch{position:fixed;right:20px;bottom:22px;z-index:85;display:flex;align-items:center;gap:9px;min-height:50px;padding:12px 20px;border-radius:30px;border:1px solid #8bd8ca;background:#143f46;color:#edf9f7;font:600 1rem/1.35 system-ui;box-shadow:0 6px 35px #0008;max-width:calc(100vw - 32px)}
.sense-guide-panel{position:fixed;right:20px;bottom:84px;z-index:85;width:420px;max-width:calc(100vw - 32px);max-height:calc(100svh - 150px);overflow:auto;overflow-wrap:anywhere;background:#0f2531f7;color:#edf7f5;border:1px solid #8bd8ca99;border-radius:22px;padding:20px;box-shadow:0 18px 70px #0009;font:1rem/1.6 system-ui;backdrop-filter:blur(16px)}
.sense-guide-panel[hidden]{display:none}.sense-guide-panel h2{font:650 1.3125rem/1.3 system-ui;margin:0}.sense-guide-header{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}.sense-guide-panel button{min-height:44px;font-size:.875rem;white-space:normal;overflow-wrap:anywhere}.sense-guide-header button{background:none;color:inherit;border:1px solid #8bd8ca55;border-radius:10px;padding:8px 10px}.sense-guide-caption{margin:0 0 12px;line-height:1.7;font-size:1rem}.sense-guide-action{color:#a4e3d5;margin:0 0 14px;font-size:.9375rem}.sense-guide-buttons{display:flex;gap:8px;flex-wrap:wrap}.sense-guide-buttons button{flex:1;padding:10px 12px;border-radius:12px;border:1px solid #58737b;background:#1c414e;color:#f0faf8}.sense-guide-settings{margin-top:16px;border-top:1px solid #45616d;padding-top:14px}.sense-guide-settings summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:600}.sense-guide-settings label{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}.sense-guide-settings select{max-width:100%;min-width:0;font-size:1rem}.sense-guide-settings p{font-size:.875rem;margin:10px 0;color:#c3d3d9}.sense-guide-panel :focus-visible,.sense-guide-launch:focus-visible{outline:3px solid #f2c27d;outline-offset:4px}.sense-guide-target{outline:3px solid #efb36c!important;outline-offset:5px!important;scroll-margin:180px 20px!important}.sense-guide-target:after{animation:none!important}.sense-guide-panel[data-compact=true] .sense-guide-settings,.sense-guide-panel[data-compact=true] #sense-guide-options,.sense-guide-panel[data-compact=true] #sense-guide-stop{display:none}.sense-guide-panel[data-compact=true]{max-height:42svh}.sense-guide-panel[data-compact=true] .sense-guide-caption{font-size:.9375rem}
body.high-contrast .sense-guide-panel,body.high-contrast .sense-guide-launch{background:#000;border:2px solid #fff;color:#fff}body.large-text .sense-guide-panel{font-size:1rem;width:600px}body.large-text .sense-guide-caption{font-size:1rem}.sense-guide-target-label{font-size:.875rem;color:#f2c27d}
@media(max-width:760px){.sense-guide-launch{right:12px;bottom:12px;font-size:.9375rem;min-height:48px}.sense-guide-panel{right:12px;bottom:72px;max-width:calc(100vw - 24px);padding:16px;max-height:calc(100svh - 140px)}body.sense-guide-active main{padding-bottom:160px}}
.sense-guide-panel>label{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0 10px}.sense-guide-panel>#sense-guide-voice-status{font-size:.875rem;margin:0 0 10px;color:#c3d3d9}.sense-guide-evidence{white-space:pre-wrap;border-left:3px solid #8bd8ca;padding:12px 14px;background:#07182066;border-radius:0 10px 10px 0;margin:14px 0;line-height:1.7;overflow-wrap:anywhere;font-size:1rem}.sense-guide-evidence[hidden]{display:none}body.sense-guide-active{padding-bottom:80px}
@media screen and (min-width:1101px){body.sense-guide-active .shell{margin-right:460px;min-width:0}.sense-guide-panel,body.large-text .sense-guide-panel{right:20px;bottom:84px;width:420px;max-width:420px;max-height:calc(100svh - 150px)}body.sense-guide-active:not(.sense-entered):not(.sense-flat):not(.large-text) .primary-nav{left:calc((100vw - 460px)/2);width:min(680px,calc(100vw - 508px))}}
@media screen and (max-width:1100px){.sense-guide-panel,body.large-text .sense-guide-panel{position:relative;inset:auto;width:calc(100% - 24px);max-width:none;max-height:none;margin:12px auto;padding:16px;box-shadow:0 8px 24px #0005}.sense-guide-panel[data-compact=true]{max-height:none}body.sense-guide-active .shell{margin-right:0}body.sense-guide-active main{padding-bottom:80px}}
@media print{.sense-guide-panel,.sense-guide-launch{display:none!important}.sense-guide-target{outline:none!important}body.sense-guide-active .shell{margin-right:0}body.sense-guide-active{padding-bottom:0}}
body,body.sense-guide-active{padding-bottom:var(--sense-launcher-space,110px)}
html{scroll-padding-bottom:var(--sense-launcher-space,110px)}
@media screen and (min-width:1101px){.sense-guide-panel,body.large-text .sense-guide-panel{bottom:var(--sense-launcher-space,110px)}}
@media print{body,body.sense-guide-active{padding-bottom:0}html{scroll-padding-bottom:0}}
`;document.head.append(css);
const launcher=make('button','Pokreni Sense vodiča','sense-guide-launch');launcher.id='sense-guide-launch';launcher.type='button';launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-controls','sense-guide-panel');
const panel=make('section',undefined,'sense-guide-panel');panel.id='sense-guide-panel';panel.hidden=true;panel.setAttribute('aria-label','Sense vodič kroz trenutni zadatak');
const header=make('div',undefined,'sense-guide-header'),title=make('h2','Sense vodič'),close=make('button','Isključi');close.type='button';close.id='sense-guide-close';header.append(title,close);
const caption=make('p','', 'sense-guide-caption');caption.id='sense-guide-caption';caption.setAttribute('role','status');caption.setAttribute('aria-live','polite');caption.setAttribute('aria-atomic','true');
const actionText=make('p','', 'sense-guide-action');actionText.id='sense-guide-action';
const lastAction=make('p','', 'sense-guide-last-action');lastAction.id='sense-guide-last-action';lastAction.setAttribute('role','note');
const row=make('div',undefined,'sense-guide-buttons');
function control(id,text,fn){const b=make('button',text);b.id=id;b.type='button';b.addEventListener('click',fn);row.append(b);return b;}
const next=control('sense-guide-next','Sljedeći korak',()=>moveNext());
const repeat=control('sense-guide-repeat','Ponovi uputu',()=>{refresh();speakCurrent(true);});
const options=control('sense-guide-options','Šta mogu ovdje?',()=>{refresh();const extra='Sljedeće: '+currentDescription.action+' Možeš koristiti Tab za izbor kontrole, Enter za dugme i Escape za prekid govora.';caption.textContent=currentDescription.caption+' '+extra;speak(caption.textContent,true);});
const stop=control('sense-guide-stop','Zaustavi govor',()=>cancelSpeech('Govor je zaustavljen. Tekstualni vodič ostaje dostupan.'));
const readEvidence=control('sense-guide-read-evidence','Prikaži / pročitaj trenutni nalaz',()=>readCurrentEvidence());readEvidence.disabled=true;const evidence=make('p',undefined,'sense-guide-evidence');evidence.id='sense-guide-evidence';evidence.hidden=true;evidence.setAttribute('role','note');
const settings=make('details',undefined,'sense-guide-settings');settings.open=false;settings.id='sense-guide-settings';settings.append(make('summary','Govor i način vođenja'));
const speechLabel=make('label'),speech=make('input');speech.type='checkbox';speech.id='sense-guide-speech';speechLabel.append(speech,document.createTextNode(' Izgovaraj gdje sam i šta mogu uraditi'));
const voiceLabel=make('label','Lokalni glas uređaja'),voicesSelect=make('select');voicesSelect.id='sense-guide-voice';voicesSelect.setAttribute('aria-label','Lokalni glas za Sense vodiča');voiceLabel.append(voicesSelect);
const rateLabel=make('label','Brzina govora'),rate=make('input');rate.type='range';rate.id='sense-guide-rate';rate.min='0.7';rate.max='1.3';rate.step='0.1';rate.value='1';rateLabel.append(rate);
const voiceStatus=make('p','Govor je isključen. Upute su uvijek dostupne i tekstom.');voiceStatus.id='sense-guide-voice-status';voiceStatus.setAttribute('role','status');
const refreshVoices=make('button','Ponovo provjeri lokalne glasove');refreshVoices.type='button';refreshVoices.id='sense-guide-voices-refresh';refreshVoices.className='button secondary';
const compactLabel=make('label'),compact=make('input');compact.type='checkbox';compact.id='sense-guide-compact';compactLabel.append(compact,document.createTextNode(' Sažeti vodič tokom rada'));
settings.append(voiceLabel,rateLabel,refreshVoices,compactLabel);
const accessHelp=make('details',undefined,'sense-guide-settings');accessHelp.id='sense-guide-access';accessHelp.append(make('summary','Kretanje bez gledanja ili bez zvuka'));
const simple=make('button','Otvori jednostavan radni prikaz');simple.id='sense-guide-simple';simple.type='button';simple.className='button secondary';
const nativeReader=make('button','Koristim sistemski čitač ekrana');nativeReader.id='sense-guide-reader';nativeReader.type='button';nativeReader.className='button secondary';
accessHelp.append(make('p','Sve upute, potvrde i greške ostaju prikazane tekstom. Zvuk nije potreban. Mapa ekrana bira i fokusira stvarnu kontrolu; ne izvršava njenu radnju.'),simple,nativeReader,make('p','Uz TalkBack ili drugi sistemski čitač koristi njegove uobičajene geste za istraživanje elemenata. Sense izlaže nazive, svrhu i stanje kontrola. Ugrađeni govor možeš ostaviti isključen da ne govori istovremeno s čitačem.'));
panel.append(header,caption,actionText,lastAction,row,evidence,speechLabel,voiceStatus,settings,accessHelp);const banner=document.querySelector('.test-banner');if(banner)banner.after(panel);else document.body.append(panel);const skip=document.querySelector('.skip-link');if(skip)skip.after(launcher);else document.body.prepend(launcher);
// Reserve the launcher's actual height, including enlarged text. Controls at
// the end of a mobile page must be scrollable clear of this fixed button.
function reserveLauncher(){const box=launcher.getBoundingClientRect(),bottom=parseFloat(getComputedStyle(launcher).bottom)||20,value=Math.ceil(box.height+bottom+28)+'px';if(document.documentElement.style.getPropertyValue('--sense-launcher-space')!==value)document.documentElement.style.setProperty('--sense-launcher-space',value);}
if(typeof ResizeObserver==='function')new ResizeObserver(reserveLauncher).observe(launcher);else scope.addEventListener('resize',reserveLauncher);reserveLauncher();
let scanState=null,dialogContext=null,contextOwner=null;const previousDescriptions=new WeakMap();
let evidenceCard=null;
let active=false,currentDescription=describe(),lastFocused=null,targetNode=null,updateTimer=null,speechTimer=null,utterance=null,voiceList=[],spokenKey='',speechGeneration=0;
const voiceAvailable=()=>typeof scope.speechSynthesis==='object'&&typeof scope.SpeechSynthesisUtterance==='function';
function visible(node){return !!node&&node.isConnected&&!node.closest('[hidden]')&&getComputedStyle(node).display!=='none'&&node.getClientRects().length>0;}
function focusedName(node){
 if(!node)return '';const explicit=node.getAttribute('aria-label');if(explicit)return words(explicit);
 const labelled=node.getAttribute('aria-labelledby');if(labelled)return words(labelled.split(/\s+/).map(id=>$(id)?.textContent||'').join(' '));
 if(node.labels?.length)return words([...node.labels].map(l=>l.textContent).join(' '));
 if(node.matches('button,summary,a,h1,h2,h3,h4,h5,h6'))return words(node.textContent);
 return ({'cv-text':'CV ili opis tvog iskustva','job-text':'Tekst oglasa za posao','scenario-cv':'Alternativni CV za odvojenu provjeru','draft-text':'Radni nacrt CV-a'})[node.id]||'';
}
function typeName(node){if(!node)return '';if(node.matches('h1,h2,h3,h4,h5,h6'))return 'naslov odjeljka';if(node.matches('textarea,input:not([type=checkbox]):not([type=range])'))return 'polje za unos';if(node.matches('input[type=checkbox]'))return 'prekidač';if(node.matches('select'))return 'izbor opcije';if(node.matches('input[type=range]'))return 'podesiva vrijednost';if(node.matches('summary'))return 'otvori ili zatvori detalje';if(node.matches('a'))return 'poveznica';return 'dugme';}
function getSnapshot(){
 const scanned=document.querySelector('.scan-active'),scanActive=visible(scanned);
 const view=document.body.dataset.senseView||'workspace',cards=[...document.querySelectorAll('#requirements .requirement-card')],focusCard=lastFocused?.closest?.('.requirement-card'),card=focusCard?.isConnected?focusCard:cards[0];
 const guided=visible($('guided-controls'));let progress=guided?words($('guided-progress')?.textContent):card?'Zahtjev '+(cards.indexOf(card)+1)+' od '+cards.length+' prikazana':'';
 const dialog=document.querySelector('dialog[open]'),dialogName=dialog?words($(dialog.getAttribute('aria-labelledby'))?.textContent):'';
 return {view,cvPresent:!!$('cv-text')?.value.trim(),jobPresent:!!$('job-text')?.value.trim(),hasReport:!!$('summary')?.children.length,hasDraft:!!$('draft-text')?.value.trim(),scenarioReady:visible($('scenario-apply-row')),canAdvance:visible($('guided-next'))&&!$('guided-next').disabled,busy:$('status')?.dataset.kind==='busy',dialog:dialogName,dialogId:dialog?.id||'',scanLabel:scanActive?words(scanned.textContent):'',scanIndex:scanActive&&scanState?scanState.index:null,scanTotal:scanActive&&scanState?scanState.total:null,progress,requirement:card?{label:words(card.querySelector('h3')?.textContent),status:card.dataset.status}:null,focusedLabel:visible(lastFocused)?focusedName(lastFocused):'',focusedType:visible(lastFocused)?typeName(lastFocused):'',position:scope.CLEA7SensePosition?.current?.()||null};
}
function activeRequirement(){if(document.body.dataset.senseView!=='review')return null;const focused=lastFocused?.closest?.('.requirement-card');if(visible(focused))return focused;return [...document.querySelectorAll('#requirements .requirement-card')].find(visible)||null;}
function readCurrentEvidence(){const card=activeRequirement();if(!card){evidence.hidden=false;evidence.textContent='Otvori nalaze analize i izaberi zahtjev za pregled izvora.';return;}const quotes=[...card.querySelectorAll('.source-quote')].map(n=>n.textContent.trim()).filter(Boolean);let text='Zahtjev: '+(card.querySelector('h3')?.textContent.trim()||'Za pregled')+'. Status: '+(card.querySelector('.status-tag')?.textContent.trim()||'Za pregled')+'.';if(quotes.length){text+='\nIz oglasa: '+quotes[0];for(let i=1;i<quotes.length;i++)text+='\nNavod iz CV-a '+i+': '+quotes[i];}else text+='\nIzvorni navodi nisu dostupni u ovom prikazu.';const chars=Array.from(text);if(chars.length>900)text=chars.slice(0,820).join('')+' … Skraćeno. Otvori izvorni navod za puni tekst.';evidenceCard=card;evidence.textContent=text;evidence.hidden=false;speak(text,true);}
function resolveTarget(description){
 if(description.target==='scan-active-action')return document.querySelector('.scan-active');
 if(description.target==='nav-workspace')return document.querySelector('#primary-nav [data-view="workspace"]');
 if(description.target==='nav-draft')return document.querySelector('#primary-nav [data-view="draft"]');
 if(description.target==='dialog-action')return document.querySelector('dialog[open] .button.primary,dialog[open] button');
 if(description.target==='requirement-action'){const cards=[...document.querySelectorAll('#requirements .requirement-card')],card=lastFocused?.closest?.('.requirement-card');return (card?.isConnected?card:cards[0])?.querySelector('.requirement-actions button');}
 return $(description.target);
}
function markTarget(node){if(targetNode)targetNode.classList.remove('sense-guide-target');targetNode=visible(node)?node:null;targetNode?.classList.add('sense-guide-target');}
function cancelSpeech(message){speechGeneration++;if(speechTimer)clearTimeout(speechTimer);speechTimer=null;utterance=null;try{scope.speechSynthesis?.cancel();}catch{}if(message)voiceStatus.textContent=message;}
function selectedVoice(){return voiceList.find(v=>v.voiceURI===voicesSelect.value&&v.localService===true)||null;}
function updateVoices(){
 const previous=voicesSelect.value;voiceList=[];
 if(voiceAvailable()){try{voiceList=scope.speechSynthesis.getVoices().filter(v=>v.localService===true).slice(0,80).sort((a,b)=>Number(/^(bs|hr|sr)(-|$)/i.test(b.lang))-Number(/^(bs|hr|sr)(-|$)/i.test(a.lang))||a.name.localeCompare(b.name));}catch{}}
 voicesSelect.replaceChildren();
 for(const v of voiceList){const option=make('option',v.name+' ('+v.lang+')');option.value=v.voiceURI;voicesSelect.append(option);}
 if(voiceList.some(v=>v.voiceURI===previous))voicesSelect.value=previous;
 speech.disabled=!voiceList.length;voicesSelect.disabled=!voiceList.length;rate.disabled=!voiceList.length;
 if(!voiceList.length){speech.checked=false;cancelSpeech();voiceStatus.textContent=voiceAvailable()?'Nema dostupnog glasa označenog kao lokalni. Govor je isključen; upute su dostupne tekstom i kroz sistemski čitač ekrana.':'Ovaj preglednik ne nudi govorni izlaz. Koristi tekstualni vodič ili sistemski čitač ekrana.';}
 else if(!speech.checked)voiceStatus.textContent='Dostupno lokalnih glasova: '+voiceList.length+'. Izaberi glas i uključi izgovaranje. Ne preuzimamo glasove niti koristimo cloud govor.';
}
function speak(text,explicit=false){
 if(!active||!speech.checked||document.hidden)return;
 const voice=selectedVoice();if(!voice){speech.checked=false;cancelSpeech('Odabrani lokalni glas nije dostupan. Tekstualni vodič i dalje radi.');return;}
 const safe=String(text).slice(0,1100);if(!explicit&&safe===spokenKey)return;spokenKey=safe;cancelSpeech();const own=speechGeneration;
 try{utterance=new scope.SpeechSynthesisUtterance(safe);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=Math.max(.7,Math.min(1.3,Number(rate.value)||1));utterance.volume=1;utterance.onstart=()=>{if(own===speechGeneration)voiceStatus.textContent='Glas uređaja izgovara istu uputu koja je prikazana tekstom.';};utterance.onend=()=>{if(own!==speechGeneration)return;if(speechTimer)clearTimeout(speechTimer);speechTimer=null;utterance=null;voiceStatus.textContent='Izgovaranje je završeno. Uputu možeš ponoviti.';};utterance.onerror=event=>{if(own!==speechGeneration||event.error==='interrupted'||event.error==='canceled')return;speech.checked=false;cancelSpeech('Govorni izlaz nije uspio. Uputa ostaje prikazana tekstom; provjeri glas uređaja.');};voiceStatus.textContent='Zatraženo je izgovaranje lokalnim glasom uređaja.';scope.speechSynthesis.speak(utterance);speechTimer=setTimeout(()=>{if(own===speechGeneration)cancelSpeech('Izgovaranje je zaustavljeno nakon vremenskog ograničenja. Možeš ponoviti uputu.');},45000);}catch{speech.checked=false;cancelSpeech('Govorni izlaz nije dostupan. Uputa ostaje prikazana tekstom.');}
}
function speakCurrent(explicit=false){speak(currentDescription.caption+' Sljedeće: '+currentDescription.action,explicit);}
function clearDialogContext(){if(dialogContext)dialogContext.remove();dialogContext=null;if(contextOwner){const original=previousDescriptions.get(contextOwner);if(original===null)contextOwner.removeAttribute('aria-describedby');else if(typeof original==='string')contextOwner.setAttribute('aria-describedby',original);}contextOwner=null;}
function syncDialogContext(){const dialog=document.querySelector('dialog[open]');if(!active||!dialog){clearDialogContext();return;}if(contextOwner!==dialog){clearDialogContext();contextOwner=dialog;previousDescriptions.set(dialog,dialog.getAttribute('aria-describedby'));dialogContext=make('p',undefined,'sense-dialog-guide');dialogContext.id='sense-guide-dialog-caption';dialogContext.setAttribute('role','note');dialogContext.style.cssText='border-left:3px solid #8bd8ca;padding:12px 14px;margin:12px 0 20px;line-height:1.6;font-size:1rem;overflow-wrap:anywhere;';const heading=dialog.querySelector('.dialog-heading');if(heading)heading.after(dialogContext);else dialog.prepend(dialogContext);const ids=(dialog.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);if(!ids.includes(dialogContext.id))ids.push(dialogContext.id);dialog.setAttribute('aria-describedby',ids.join(' '));}const text=currentDescription.caption+' Sljedeće: '+currentDescription.action;if(dialogContext.textContent!==text)dialogContext.textContent=text;}
function refresh({announce=false}={}){currentDescription=describe(getSnapshot());if(!active)return;if(caption.textContent!==currentDescription.caption)caption.textContent=currentDescription.caption;if(actionText.textContent!=='Sljedeće: '+currentDescription.action)actionText.textContent='Sljedeće: '+currentDescription.action;const last=$('status-text')?.textContent?.trim()||'';const lastText=last?'Zadnja poruka: '+last:'';if(lastAction.textContent!==lastText)lastAction.textContent=lastText;lastAction.hidden=!last;syncDialogContext();const shown=activeRequirement();readEvidence.disabled=!shown;if(evidenceCard!==shown){evidenceCard=null;evidence.textContent='';evidence.hidden=true;}const target=resolveTarget(currentDescription);next.disabled=!target||target.disabled;markTarget(target);if(announce)speakCurrent();}
function schedule(){if(!active)return;if(updateTimer)clearTimeout(updateTimer);updateTimer=setTimeout(()=>{updateTimer=null;refresh({announce:true});},160);}
function moveNext(){
 refresh();const target=resolveTarget(currentDescription);if(!target||target.disabled){caption.textContent+=' Trenutno nema dostupne naredne radnje.';return;}
 document.body.classList.add('sense-entered');
 if(target.matches('#primary-nav button')||target.id==='guided-next')target.click();
 else{target.focus();target.scrollIntoView({block:'center',behavior:'instant'});}
 if(target.id==='cv-text'||target.id==='job-text'||target.id==='draft-text'||target.id==='scenario-cv')lastFocused=target;
 refresh({announce:true});scope.dispatchEvent(new CustomEvent('sense:feedback',{detail:{kind:'select'}}));
}
function setActive(value){active=!!value;panel.hidden=!active;launcher.setAttribute('aria-expanded',String(active));launcher.textContent=active?'Sense vodič je uključen':'Pokreni Sense vodiča';document.body.classList.toggle('sense-guide-active',active);if(active){updateVoices();refresh();}else{cancelSpeech('Vodič je isključen.');speech.checked=false;evidenceCard=null;evidence.textContent='';evidence.hidden=true;clearDialogContext();markTarget(null);if(updateTimer)clearTimeout(updateTimer);updateTimer=null;}}
function simpleWorkspace(){
 document.body.classList.add('sense-entered');
 const flat=$('spatial-mode');if(flat?.getAttribute('aria-pressed')==='false')flat.click();
 const reduced=$('reduced-motion');if(reduced&&!reduced.checked){reduced.checked=true;reduced.dispatchEvent(new Event('change',{bubbles:true}));}
 refresh();
}
simple.addEventListener('click',()=>{simpleWorkspace();moveNext();});
nativeReader.addEventListener('click',()=>{speech.checked=false;cancelSpeech('Ugrađeni govor je isključen. Nastavi sistemskim čitačem ekrana; sve upute ostaju tekstom.');simpleWorkspace();moveNext();});
scope.addEventListener('sense:position',event=>{if(active)refresh({announce:event.detail?.explicit===true});});
launcher.addEventListener('click',()=>setActive(!active));close.addEventListener('click',()=>{setActive(false);launcher.focus();});
speech.addEventListener('change',()=>{if(!speech.checked){cancelSpeech('Govor je isključen. Tekstualne upute ostaju dostupne.');return;}refresh();speakCurrent(true);});
voicesSelect.addEventListener('change',()=>{cancelSpeech();spokenKey='';if(speech.checked)speakCurrent(true);});rate.addEventListener('change',()=>{if(speech.checked)speakCurrent(true);});
refreshVoices.addEventListener('click',updateVoices);compact.addEventListener('change',()=>{panel.dataset.compact=String(compact.checked);});
document.addEventListener('focusin',event=>{if(!active||panel.contains(event.target)||event.target===launcher)return;if(event.target.matches('button,input,textarea,select,summary,a,h1,h2,h3,h4,h5,h6,[tabindex]')){lastFocused=event.target;schedule();}});
document.addEventListener('input',event=>{if(['cv-text','job-text','draft-text','scenario-cv'].includes(event.target.id))schedule();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active)cancelSpeech('Govor je zaustavljen tipkom Escape. Tekstualni vodič ostaje dostupan.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelSpeech('Govor je pauziran nakon odlaska iz aplikacije.');});scope.addEventListener('pagehide',()=>cancelSpeech());
scope.addEventListener('sense:feedback',schedule);scope.addEventListener('sense:scan',event=>{const d=event.detail;scanState=d&&Number.isInteger(d.index)&&Number.isInteger(d.total)&&d.index>0&&d.total>=d.index&&d.total<=80?{index:d.index,total:d.total}:null;schedule();});document.addEventListener('close',event=>{if(event.target.matches?.('dialog')){cancelSpeech();clearDialogContext();schedule();}},true);scope.addEventListener('sense:erase',()=>{lastFocused=null;scanState=null;evidenceCard=null;evidence.textContent='';evidence.hidden=true;spokenKey='';cancelSpeech();clearDialogContext();refresh();});
if(voiceAvailable())try{scope.speechSynthesis.addEventListener('voiceschanged',()=>{if(active)updateVoices();});}catch{}
const observer=new MutationObserver(schedule);observer.observe(document.body,{attributes:true,attributeFilter:['data-sense-view']});
for(const id of ['requirements','summary','guided-progress','scenario-apply-row','scan-status','status-text'])if($(id))observer.observe($(id),{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});
scope.CLEA7SenseGuide=Object.freeze({format:'sense.guide/1',describe,current:()=>{const snapshot=getSnapshot();return Object.freeze({...snapshot,description:describe(snapshot),active,speechEnabled:speech.checked,localVoiceCount:voiceList.length});},refresh:()=>refresh(),stop:()=>cancelSpeech('Govor je zaustavljen. Tekstualni vodič ostaje dostupan.')});
})(globalThis);
