/* Local-first communication UI over the reusable Sense SDK. */
(function(scope){'use strict';
if(typeof document==='undefined'||!scope.CLEA7SenseSDK)return;
const main=document.getElementById('main');if(!main)return;
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const panel=make('section');panel.className='panel sense-communication';panel.id='sense-communication';panel.setAttribute('aria-labelledby','sense-communication-title');
const heading=make('h2','Sense · razgovor na tvoj način');heading.id='sense-communication-title';
const intro=make('p','Titlovi, velika poruka za drugu osobu ili izgovor potvrđenog teksta. Mikrofon se uključuje samo kad to zatražiš.');
const status=make('p','Komunikacija je spremna za tekstualni rad.');status.id='sense-communication-status';status.setAttribute('role','status');
function field(label,id,kind='textarea'){const row=make('label',label),input=make(kind);input.id=id;row.htmlFor=id;if(kind==='textarea'){input.rows=4;input.maxLength=10000;}panel.append(row,input);return input;}
panel.append(heading,intro,status);
const language=field('Jezik prepoznavanja','sense-communication-language','select');for(const [id,label]of [['hr-HR','Hrvatski'],['sr-RS','Srpski'],['bs-BA','Bosanski'],['en-US','English']]){const option=make('option',label);option.value=id;language.append(option);}language.value='hr-HR';
const allowLabel=make('label'),allow=make('input');allowLabel.hidden=true;allow.type='checkbox';allow.id='sense-system-speech-consent';allowLabel.append(allow,document.createTextNode(' Biram sistemsku uslugu umjesto lokalnog prepoznavanja i dopuštam obradu zvuka prema pravilima preglednika; zvuk može napustiti uređaj.'));panel.append(allowLabel);
const transcript=field('Titlovi — prepoznati govor','sense-transcript'),interim=make('p');interim.id='sense-live-caption';interim.setAttribute('role','status');
interim.setAttribute('aria-live','polite');panel.append(interim);
const actions=make('div');actions.className='button-row';panel.append(actions);
function button(id,label,fn){const b=make('button',label);b.id=id;b.type='button';b.className='button secondary';b.onclick=fn;actions.append(b);return b;}
const listen=scope.CLEA7SenseSDK.listener({
 onFinal:row=>{const prefix=row.uncertain?'[Provjeri prepoznavanje] ':'',next=transcript.value+(transcript.value?'\n':'')+prefix+row.text;if(next.length>10000){listen.abort();status.textContent='Transkript je dosegao granicu. Postojeći tekst je sačuvan u polju; kopiraj ga prije nove sesije.';return;}transcript.value=next;},
 onInterim:text=>interim.textContent=text?'Privremeno, još nepotvrđeno: '+text:'',
 onState:event=>{status.textContent=({requested:'Traži se mikrofon za ovu sesiju.',listening:'Titlovi su uključeni. Govor se prikazuje velikim tekstom.',stopped:'Titlovi su zaustavljeni. Prepoznati tekst ostaje.',failed:'Prepoznavanje nije uspjelo ('+(event.code||'greška')+'). Možeš pisati ili odabrati sistemsku uslugu.'})[event.state]||event.state;start.disabled=event.state==='requested'||event.state==='listening';stop.disabled=!start.disabled;if(event.state==='failed')systemConsent.hidden=false;}
});
const start=button('sense-listen-start','Uključi titlove',()=>{try{listen.start({approved:true,allowSystemService:false,preferLocal:true,language:language.value});}catch(error){status.textContent=error.message+' Možeš odabrati sistemsku uslugu uz posebnu potvrdu.';systemConsent.hidden=false;}});
const systemConsent=button('sense-listen-system','Dozvoli sistemske titlove',()=>{
 // Separate gesture/consent: browser speech recognition may process audio
 // on a remote service. Never start this on the main Sense switch.
 allow.checked=true;
 try{listen.start({approved:true,allowSystemService:true,preferLocal:false,language:language.value});
  status.textContent='Sistemski titlovi su zatraženi. Zvuk može napustiti uređaj.';}
 catch(error){status.textContent=error.message;}
});systemConsent.hidden=true;
const safety=make('p','Titlovi prvo pokušavaju lokalno prepoznavanje. Ako ga uređaj nema, sistemski servis traži zasebnu potvrdu i može slati zvuk izvan uređaja.');safety.id='sense-caption-privacy';panel.append(safety);
const stop=button('sense-listen-stop','Zaustavi mikrofon',()=>listen.stop());stop.disabled=true;
button('sense-transcript-clear','Obriši transkript',()=>{listen.abort();transcript.value='';interim.textContent='';});
const message=field('Poruka koju želiš izgovoriti','sense-expression');message.maxLength=3000;
const phrases=make('div');phrases.className='button-row';for(const text of ['Molim vas napišite odgovor.','Treba mi pomoć.','Molim vas sačekajte.']){const b=make('button',text);b.type='button';b.className='quiet-button';b.onclick=()=>{message.value=text;message.dispatchEvent(new Event('input',{bubbles:true}));message.focus();};phrases.append(b);}panel.append(phrases);
const voice=field('Lokalni glas za izgovor','sense-expression-voice','select'),reviewLabel=make('label'),review=make('input');review.type='checkbox';review.id='sense-expression-approved';reviewLabel.append(review,document.createTextNode(' Potvrđujem tačan tekst poruke prije izgovora.'));panel.append(reviewLabel);
const expressionActions=make('div');expressionActions.className='button-row';panel.append(expressionActions);
const messageDialog=make('dialog');messageDialog.id='sense-show-message';messageDialog.className='sense-show-message';messageDialog.setAttribute('aria-label','Poruka na ekranu');
const messageText=make('p');messageText.id='sense-show-message-text';
const closeMessage=make('button','Zatvori poruku');closeMessage.type='button';closeMessage.className='button primary';closeMessage.onclick=()=>messageDialog.close();
messageDialog.append(messageText,closeMessage);document.body.append(messageDialog);
const showMessage=make('button','Pokaži veliku poruku');showMessage.type='button';showMessage.id='sense-expression-show';showMessage.className='button primary';
showMessage.onclick=()=>{const value=message.value.trim();if(!value){status.textContent='Prvo upiši ili odaberi poruku.';message.focus();return;}
 messageText.textContent=value;messageDialog.showModal();closeMessage.focus();};
expressionActions.append(showMessage);
const speaking=scope.CLEA7SenseSDK.speaker({onState:state=>{if(state==='speaking')status.textContent='Uređaj izgovara tvoju potvrđenu poruku.';}});
function voices(){const rows=speaking.voices(),old=voice.value;voice.replaceChildren();for(const row of rows){const option=make('option',row.name+' · '+row.language);option.value=row.name;voice.append(option);}
 if(rows.some(row=>row.name===old))voice.value=old;
 else{const best=rows.find(v=>/^hr(?:-|$)/i.test(v.language))||rows.find(v=>/^sr(?:-|$)/i.test(v.language))||rows.find(v=>/^bs(?:-|$)/i.test(v.language));if(best)voice.value=best.name;}
 if(!rows.length){const option=make('option','Nema dostupnog lokalnog glasa');option.value='';voice.append(option);}
 refresh();}
const speak=button('sense-expression-speak','Izgovori potvrđenu poruku',async()=>{try{await speaking.speak(message.value,{approved:review.checked,voiceName:voice.value});status.textContent='Poruka je izgovorena.';}catch(error){status.textContent=error.message;}});
expressionActions.append(speak,button('sense-expression-stop','Zaustavi govor',()=>speaking.stop()));
function refresh(){speak.disabled=!review.checked||!message.value.trim()||!voice.value;}
message.addEventListener('input',()=>{review.checked=false;refresh();});review.onchange=refresh;voice.onchange=()=>{review.checked=false;refresh();};voices();
scope.speechSynthesis?.addEventListener('voiceschanged',voices);
const disclosure=make('details'),summary=make('summary','Sense · titlovi i potvrđene govorne poruke');disclosure.id='sense-communication-open';disclosure.append(summary,panel);main.append(disclosure);
const clear=()=>{listen.abort();speaking.stop();transcript.value='';interim.textContent='';message.value='';review.checked=false;allow.checked=false;refresh();};
scope.addEventListener('sense:erase',()=>{clear();messageText.textContent='';if(messageDialog.open)messageDialog.close();});scope.addEventListener('pagehide',()=>{listen.abort();speaking.stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden){listen.abort();speaking.stop();}});
})(globalThis);
