/* Local-first communication UI over the reusable Sense SDK. */
(function(scope){'use strict';
if(typeof document==='undefined'||!scope.CLEA7SenseSDK)return;
const main=document.getElementById('main');if(!main)return;
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const panel=make('section');panel.className='panel sense-communication';panel.id='sense-communication';panel.setAttribute('aria-labelledby','sense-communication-title');
const heading=make('h2','Sense · razgovor na tvoj način');heading.id='sense-communication-title';
const intro=make('p','Piši, čitaj titlove ili izgovori poruku koju potvrdiš. Mikrofon i govor su isključeni dok ih ne pokreneš. Kvalitet prepoznavanja i dostupnost bosanskog zavise od uređaja.');
const status=make('p','Komunikacija je spremna za tekstualni rad.');status.id='sense-communication-status';status.setAttribute('role','status');
function field(label,id,kind='textarea'){const row=make('label',label),input=make(kind);input.id=id;row.htmlFor=id;if(kind==='textarea'){input.rows=4;input.maxLength=10000;}panel.append(row,input);return input;}
panel.append(heading,intro,status);
const language=field('Jezik prepoznavanja','sense-communication-language','select');for(const [id,label]of [['bs-BA','Bosanski'],['hr-HR','Hrvatski'],['sr-RS','Srpski'],['en-US','English']]){const option=make('option',label);option.value=id;language.append(option);}
const allowLabel=make('label'),allow=make('input');allow.type='checkbox';allow.id='sense-system-speech-consent';allowLabel.append(allow,document.createTextNode(' Biram sistemsku uslugu umjesto lokalnog prepoznavanja i dopuštam obradu zvuka prema pravilima preglednika; zvuk može napustiti uređaj.'));panel.append(allowLabel);
const transcript=field('Transkript — pregledaj i ispravi prepoznati tekst','sense-transcript'),interim=make('p');interim.id='sense-live-caption';interim.setAttribute('role','status');panel.append(interim);
const actions=make('div');actions.className='button-row';panel.append(actions);
function button(id,label,fn){const b=make('button',label);b.id=id;b.type='button';b.className='button secondary';b.onclick=fn;actions.append(b);return b;}
const listen=scope.CLEA7SenseSDK.listener({
 onFinal:row=>{const prefix=row.uncertain?'[Provjeri prepoznavanje] ':'',next=transcript.value+(transcript.value?'\n':'')+prefix+row.text;if(next.length>10000){listen.abort();status.textContent='Transkript je dosegao granicu. Postojeći tekst je sačuvan u polju; kopiraj ga prije nove sesije.';return;}transcript.value=next;},
 onInterim:text=>interim.textContent=text?'Privremeno, još nepotvrđeno: '+text:'',
 onState:event=>{status.textContent=({requested:'Traži se mikrofon za ovu sesiju.',listening:'Slušanje je uključeno. Tekst može biti pogrešno prepoznat.',stopped:'Slušanje je zaustavljeno. Pregledaj transkript.',failed:'Prepoznavanje nije uspjelo ('+(event.code||'greška')+'). Pisanje ostaje dostupno.'})[event.state]||event.state;start.disabled=event.state==='requested'||event.state==='listening';stop.disabled=!start.disabled;}
});
const start=button('sense-listen-start','Uključi titlove uz mikrofon',()=>{try{listen.start({approved:true,allowSystemService:allow.checked,preferLocal:!allow.checked,language:language.value});}catch(error){status.textContent=error.message;}});
const stop=button('sense-listen-stop','Zaustavi mikrofon',()=>listen.stop());stop.disabled=true;
button('sense-transcript-clear','Obriši transkript',()=>{listen.abort();transcript.value='';interim.textContent='';});
const message=field('Poruka koju želiš izgovoriti','sense-expression');message.maxLength=3000;
const phrases=make('div');phrases.className='button-row';for(const text of ['Molim vas napišite odgovor.','Treba mi pomoć.','Molim vas sačekajte.']){const b=make('button',text);b.type='button';b.className='quiet-button';b.onclick=()=>{message.value=text;message.dispatchEvent(new Event('input',{bubbles:true}));message.focus();};phrases.append(b);}panel.append(phrases);
const voice=field('Lokalni glas za izgovor','sense-expression-voice','select'),reviewLabel=make('label'),review=make('input');review.type='checkbox';review.id='sense-expression-approved';reviewLabel.append(review,document.createTextNode(' Potvrđujem tačan tekst poruke prije izgovora.'));panel.append(reviewLabel);
const expressionActions=make('div');expressionActions.className='button-row';panel.append(expressionActions);
const speaking=scope.CLEA7SenseSDK.speaker({onState:state=>{if(state==='speaking')status.textContent='Uređaj izgovara tvoju potvrđenu poruku.';}});
function voices(){const rows=speaking.voices(),old=voice.value;voice.replaceChildren();for(const row of rows){const option=make('option',row.name+' · '+row.language);option.value=row.name;voice.append(option);}if(rows.some(row=>row.name===old))voice.value=old;if(!rows.length){const option=make('option','Nema dostupnog lokalnog glasa');option.value='';voice.append(option);}refresh();}
const speak=button('sense-expression-speak','Izgovori potvrđenu poruku',async()=>{try{await speaking.speak(message.value,{approved:review.checked,voiceName:voice.value});status.textContent='Poruka je izgovorena.';}catch(error){status.textContent=error.message;}});
expressionActions.append(speak,button('sense-expression-stop','Zaustavi govor',()=>speaking.stop()));
function refresh(){speak.disabled=!review.checked||!message.value.trim()||!voice.value;}
message.addEventListener('input',()=>{review.checked=false;refresh();});review.onchange=refresh;voice.onchange=()=>{review.checked=false;refresh();};voices();
scope.speechSynthesis?.addEventListener('voiceschanged',voices);
const disclosure=make('details'),summary=make('summary','Sense · titlovi i potvrđene govorne poruke');disclosure.id='sense-communication-open';disclosure.append(summary,panel);main.append(disclosure);
const clear=()=>{listen.abort();speaking.stop();transcript.value='';interim.textContent='';message.value='';review.checked=false;allow.checked=false;refresh();};
scope.addEventListener('sense:erase',clear);scope.addEventListener('pagehide',()=>{listen.abort();speaking.stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden){listen.abort();speaking.stop();}});
})(globalThis);
