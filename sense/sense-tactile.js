/* Original BL CLEA Sense tactile text experiment, by Brzo i Lokalno.
 * Morse is an established public communication convention, not a CLEA invention.
 * Unicode Pulse/1 is a simple original implementation of a fixed 21-bit scalar
 * encoding, not a claim of scientific novelty, speed or assistive effectiveness.
 * Neither mode is a medical device or a replacement for a tested Braille aid.
 * No network, storage, microphone, camera, device discovery or automatic play.
 */
(function(scope){'use strict';
const MAX_CHARACTERS=240,SESSION_MS=60000;
const MORSE=Object.freeze({A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.','.':'.-.-.-',',':'--..--','?':'..--..',"'":'.----.','!':'-.-.--','/':'-..-.','(':'-.--.',')':'-.--.-','&':'.-...',':':'---...',';':'-.-.-.','=':'-...-','+':'.-.-.','-':'-....-','_':'..--.-','"':'.-..-.','@':'.--.-.',' ':'/'});
const REVERSE=Object.freeze(Object.fromEntries(Object.entries(MORSE).map(([a,b])=>[b,a])));
const UNITS=Object.freeze({slow:100,normal:70,fast:50});
function modeCheck(mode){if(!['morse','unicode'].includes(mode))throw Error('Nepoznat taktilni kod.');}
function textCheck(text){
 if(typeof text!=='string'||!text.length)throw Error('Unesi tekst za čitanje.');
 const characters=Array.from(text);if(characters.length>MAX_CHARACTERS)throw Error('Odaberi najviše 240 znakova odjednom.');
 for(const c of characters){const n=c.codePointAt(0);if(n>=0xd800&&n<=0xdfff)throw Error('Tekst sadrži neispravan Unicode znak.');}
 return characters;
}
function encode(text,mode='unicode'){
 modeCheck(mode);return Object.freeze(textCheck(text).map(character=>{
  const key=character>='a'&&character<='z'?character.toUpperCase():character;
  if(mode==='morse'&&!Object.hasOwn(MORSE,key))throw Error('Morse način ne kodira znak '+JSON.stringify(character)+'. Izaberi Unicode Pulse da sačuvaš taj znak.');
  const code=mode==='morse'?MORSE[key]:character.codePointAt(0).toString(2).padStart(21,'0');
  return Object.freeze({character,code,label:mode==='morse'?'Morse: '+code:'Unicode: '+code.match(/.{7}/g).join(' ')});
 }));
}
function decode(codes,mode='unicode'){
 modeCheck(mode);if(!Array.isArray(codes)||codes.length===0||codes.length>MAX_CHARACTERS)throw Error('Neispravan niz kodova.');
 return codes.map(item=>{
  const code=typeof item==='string'?item:item?.code;
  if(mode==='morse'){if(typeof code!=='string'||!Object.hasOwn(REVERSE,code))throw Error('Neispravan Morse znak.');return REVERSE[code];}
  if(typeof code!=='string'||!/^[01]{21}$/.test(code))throw Error('Unicode Pulse traži tačno 21 bit po znaku.');
  const n=parseInt(code,2);if(n>0x10ffff||n>=0xd800&&n<=0xdfff)throw Error('Neispravan Unicode kod.');return String.fromCodePoint(n);
 }).join('');
}
function createPattern(code,mode='unicode',speed='normal'){
 modeCheck(mode);if(!Object.hasOwn(UNITS,speed))throw Error('Nepodržana brzina.');
 decode([code],mode);const unit=UNITS[speed];
 if(mode==='morse'&&code==='/')return Object.freeze({pattern:Object.freeze([]),duration:7*unit});
 const values=[];for(let i=0;i<code.length;i++){
  values.push((code[i]==='1'||code[i]==='-'?3:1)*unit);
  if(i<code.length-1)values.push(mode==='unicode'&&(i+1)%7===0?3*unit:unit);
 }
 const duration=values.reduce((a,b)=>a+b,0)+4*unit;
 if(duration>10000||values.length>99)throw Error('Taktilni znak prelazi ograničenje.');
 return Object.freeze({pattern:Object.freeze(values),duration});
}
scope.CLEA7SenseTactile=Object.freeze({format:'sense.tactile/1',maxCharacters:MAX_CHARACTERS,sessionLimitMs:SESSION_MS,encode,decode,createPattern});
if(typeof document==='undefined')return;
const settings=document.getElementById('settings-dialog');if(!settings)return;
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const details=make('details',undefined,'sense-tactile-reader');details.id='tactile-reader';
details.style.cssText='margin-top:24px;border-top:1px solid var(--line);padding-top:18px;';
const summary=make('summary','Taktilni čitač teksta — eksperimentalno');details.append(summary);
details.append(make('p','Naučeni kod može prenositi tekst vibracijom. Ovaj eksperiment zahtijeva učenje; brzina i razumljivost na tvom uređaju nisu potvrđene.','field-help'));
const label=make('label','Tekst za ovaj pokušaj');label.htmlFor='tactile-text';
const input=make('textarea');input.id='tactile-text';input.maxLength=480;input.rows=3;input.setAttribute('aria-describedby','tactile-limit');
const limit=make('p','Najviše 240 Unicode znakova. Tekst se ne sprema.','field-help');limit.id='tactile-limit';
const controls=make('div',undefined,'button-row');controls.style.margin='14px 0';
const copy=make('button','Uzmi označeni dio nacrta','button secondary');copy.type='button';copy.id='tactile-copy-draft';controls.append(copy);
const modeLabel=make('label','Kod '),mode=make('select');mode.id='tactile-mode';mode.setAttribute('aria-label','Taktilni kod');
for(const [value,text]of [['unicode','Unicode Pulse /1 — svi znakovi'],['morse','Morse — osnovna latinica i brojevi']]){const option=make('option',text);option.value=value;mode.append(option);}modeLabel.append(mode);
const speedLabel=make('label','Brzina '),speed=make('select');speed.id='tactile-speed';speed.setAttribute('aria-label','Brzina taktilnog čitanja');
for(const [value,text]of [['slow','Sporo'],['normal','Srednje'],['fast','Brže']]){const option=make('option',text);option.value=value;speed.append(option);}speed.value='normal';speedLabel.append(speed);
const hapticLabel=make('label'),haptic=make('input');haptic.type='checkbox';haptic.id='tactile-haptics';hapticLabel.append(haptic,document.createTextNode(' Uključi vibraciju za ovaj čitač'));
hapticLabel.style.cssText='display:flex;gap:12px;align-items:center;margin:16px 0';
const support=make('p',typeof navigator.vibrate==='function'?'Vibracija je isključena. Bez nje možeš pregledati kod i učiti vizuelno.':'Ovaj preglednik ne nudi vibraciju. Dostupan je samo vizuelni pregled koda.','field-help');support.id='tactile-support';if(typeof navigator.vibrate!=='function')haptic.disabled=true;
const state=make('p','Čitač nije pokrenut.');state.id='tactile-status';state.setAttribute('role','status');state.setAttribute('aria-live','polite');state.setAttribute('aria-atomic','true');
const symbol=make('output','—');symbol.id='tactile-symbol';symbol.setAttribute('aria-label','Trenutni znak i njegov kod');symbol.style.cssText='display:block;overflow-wrap:anywhere;border:1px solid var(--line);border-radius:12px;padding:16px;margin:14px 0;line-height:1.8;font-family:ui-monospace,monospace;font-size:16px;';
const actions=make('div',undefined,'button-row');
function button(id,text){const b=make('button',text,'button secondary');b.type='button';b.id=id;actions.append(b);return b;}
const play=button('tactile-play','Pokreni'),pause=button('tactile-pause','Pauza'),stop=button('tactile-stop','Zaustavi'),repeat=button('tactile-repeat','Ponovi trenutni znak');pause.disabled=true;stop.disabled=true;repeat.disabled=true;
const explanation=make('details'),explanationTitle=make('summary','Kako se čita kod?');explanation.append(explanationTitle,make('p','Morse: tačka je kratak impuls, crta tri puta duži; između slova je pauza. Malo i veliko ASCII slovo imaju isti Morse kod. Nepodržani znak se odbija, ne briše. Unicode Pulse /1: svaki izvorni Unicode znak ima 21 bit, podijeljen u tri grupe po sedam. 0 je kratak, 1 duži impuls; veća pauza dijeli grupe. To je spor eksperimentalni kod, a ne poznati Brajev alfabet. Nema automatskog prevođenja značenja. Poslije najviše jedne minute čitač pauzira i čeka tvoju odluku.','field-help'));
details.append(label,input,limit,controls,modeLabel,speedLabel,hapticLabel,support,state,symbol,actions,explanation);settings.append(details);
let tokens=[],position=0,running=false,timeout=null,generation=0,started=0,signature='';
function cancelVibration(){if(typeof navigator.vibrate==='function')try{navigator.vibrate(0);}catch{}}
function cancel(){generation++;if(timeout!==null)clearTimeout(timeout);timeout=null;running=false;document.body.removeAttribute('data-tactile-playing');cancelVibration();pause.disabled=true;}
function display(item,index){const name=item.character===' '?'razmak':item.character==='\n'?'novi red':item.character;symbol.textContent=name+' · '+item.label;state.textContent='Znak '+(index+1)+' od '+tokens.length+': '+name+'.';}
function fail(error){cancel();state.textContent=error?.message||'Čitanje nije uspjelo.';play.disabled=false;stop.disabled=false;repeat.disabled=!tokens.length;}
function prepare(){
 const next=input.value+'\0'+mode.value+'\0'+speed.value;
 if(next!==signature){tokens=encode(input.value,mode.value);position=0;signature=next;}return tokens;
}
function step(own,one=false){
 if(own!==generation||!running)return;
 if(document.hidden||!settings.open||!details.open){cancel();state.textContent='Čitanje je pauzirano nakon izlaska iz čitača.';play.disabled=false;return;}
 if(position>=tokens.length){cancel();position=0;state.textContent='Kodiranje cijelog odabranog teksta je završeno. Razumljivost vibracije moraš provjeriti na svom uređaju.';play.disabled=false;repeat.disabled=false;return;}
 const item=tokens[position],p=createPattern(item.code,mode.value,speed.value);
 if(performance.now()-started+p.duration>SESSION_MS){cancel();state.textContent='Dostignuta je jedna minuta. Pokreni ponovo za nastavak od trenutnog znaka.';play.disabled=false;return;}
 display(item,position);
 if(haptic.checked&&p.pattern.length){try{if(!navigator.vibrate([...p.pattern]))throw Error('Preglednik nije prihvatio vibraciju. Čitanje je pauzirano; isključi vibraciju za vizuelni pregled.');support.textContent='Zahtjev za vibraciju je prihvaćen. To ne potvrđuje da je uređaj stvarno zavibrirao.';}catch(error){fail(error);return;}}
 timeout=setTimeout(()=>{if(own!==generation)return;timeout=null;if(one){cancel();state.textContent='Trenutni znak je ponovljen. Pokreni za nastavak.';play.disabled=false;}else{position++;step(own);}},p.duration);
}
function start(one=false){try{cancel();prepare();if(position>=tokens.length)position=0;running=true;document.body.dataset.tactilePlaying='true';started=performance.now();play.disabled=true;pause.disabled=false;stop.disabled=false;repeat.disabled=false;step(generation,one);}catch(error){fail(error);}}
play.addEventListener('click',()=>start());repeat.addEventListener('click',()=>start(true));
pause.addEventListener('click',()=>{cancel();state.textContent='Pauzirano. Pokreni ponavlja trenutni znak, pa nastavlja.';play.disabled=false;});
stop.addEventListener('click',()=>{cancel();position=0;symbol.textContent='—';state.textContent='Čitanje je zaustavljeno i vraćeno na početak.';play.disabled=false;stop.disabled=true;});
copy.addEventListener('click',()=>{try{const draft=document.getElementById('draft-text');if(!draft)throw Error('Nacrt nije dostupan.');const selected=draft.value.slice(draft.selectionStart,draft.selectionEnd)||draft.value;textCheck(selected);cancel();input.value=selected;tokens=[];position=0;signature='';play.disabled=false;repeat.disabled=true;state.textContent='Preuzet je označeni dio nacrta. Nije poslan nijednom servisu.';}catch(error){fail(error);}});
for(const field of [input,mode,speed,haptic])field.addEventListener(field===input?'input':'change',()=>{cancel();tokens=[];signature='';position=0;play.disabled=false;repeat.disabled=true;state.textContent='Postavka je promijenjena. Pokreni novi pokušaj.';});
details.addEventListener('toggle',()=>{if(!details.open){cancel();play.disabled=false;}});settings.addEventListener('close',()=>{cancel();haptic.checked=false;play.disabled=false;});settings.addEventListener('cancel',()=>{cancel();haptic.checked=false;play.disabled=false;});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();play.disabled=false;state.textContent='Pauzirano nakon odlaska iz aplikacije.';}});scope.addEventListener('pagehide',cancel);scope.addEventListener('sense:erase',()=>{cancel();input.value='';tokens=[];signature='';position=0;symbol.textContent='—';haptic.checked=false;play.disabled=false;stop.disabled=true;repeat.disabled=true;state.textContent='Tekst čitača je obrisan.';});
})(globalThis);
