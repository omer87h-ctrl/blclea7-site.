'use strict';
/* Original CLEA semantic touch guidance. Geometry is measured, never guessed by
 * a language model. Exploring never activates a source control or reads values. */
(function(scope){
const finite=Number.isFinite,clean=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,160);
function direction(point,rect){
 if(!point||!rect||![point.x,point.y,rect.left,rect.top,rect.right,rect.bottom].every(finite)||rect.right<=rect.left||rect.bottom<=rect.top)return {available:false,text:'Položaj trenutno nije dostupan.'};
 const dx=point.x<rect.left?rect.left-point.x:point.x>rect.right?rect.right-point.x:0,dy=point.y<rect.top?rect.top-point.y:point.y>rect.bottom?rect.bottom-point.y:0,distance=Math.hypot(dx,dy),arrived=distance===0;
 const words=[];if(dy)words.push((Math.abs(dy)<90?'još malo ':'')+(dy>0?'niže':'više'));if(dx)words.push((Math.abs(dx)<90?'malo ':'')+(dx>0?'desno':'lijevo'));
 return {available:true,arrived,distance,dx,dy,zone:arrived?'target':distance<90?'near':'far',text:arrived?'Tu je odabrana kontrola.':words.join(' i ')+'.'};
}
function position(point,viewport){
 if(!point||!viewport||![point.x,point.y,viewport.width,viewport.height].every(finite)||viewport.width<=0||viewport.height<=0)return 'Položaj prsta nije dostupan.';
 const x=point.x/viewport.width,y=point.y/viewport.height;
 return 'Prst je '+(y<1/3?'u gornjem':y>2/3?'u donjem':'u srednjem')+' dijelu ekrana, '+(x<1/3?'lijevo':x>2/3?'desno':'po sredini')+'.';
}
function locate(point,items){
 const ranked=items.map((item,index)=>({index,result:direction(point,item.rect),area:(item.rect.right-item.rect.left)*(item.rect.bottom-item.rect.top)})).filter(x=>x.result.available);
 const hits=ranked.filter(x=>x.result.arrived).sort((a,b)=>a.area-b.area||b.index-a.index);
 if(hits.length)return {hit:true,index:hits[0].index,...hits[0].result};
 ranked.sort((a,b)=>a.result.distance-b.result.distance||a.index-b.index);
 return ranked.length?{hit:false,index:ranked[0].index,...ranked[0].result}:{available:false};
}
/* Sense describes only measured controls, not guessed UI actions.
 * Empty regions remain meaningful so a user knows to keep exploring. */
function touchGuidance(point,items,viewport){
 const where=position(point,viewport),found=locate(point,items);
 const region=where.replace(/^Prst je /,'').replace(/\.$/,'');
 if(!found.available)return {found,key:'empty:none:'+region,
  text:where+' Na ovom dijelu nema dugmeta ni polja. Klizi dalje prstom po ekranu.',
  spoken:region+'. Ovdje nema kontrole. Klizi dalje prstom.'};
 const item=items[found.index];
 const destination=item.name||item.label;
 if(found.hit)return {found,key:'hit:'+found.index+':'+destination,
  text:where+' Ispod prsta: '+item.label+'. Dio: '+item.region+'. Dodir samo istražuje; radnju pokrećeš zasebno.',
  spoken:'Ispod prsta: '+item.label+'. Dio: '+item.region+'.'};
 const directionText=found.text.replace(/\.$/,'');
 if(found.distance>125)return {found,key:'empty:'+found.index+':'+region,
  text:where+' Ovdje nema dugmeta ni polja. Najbliže je '+destination+': '+found.text+' Klizi dalje prstom.',
  spoken:region+'. Ovdje nema kontrole. '+destination+' je '+directionText+'. Klizi dalje prstom.'};
 return {found,key:'near:'+found.index+':'+region,
  text:where+' Još nisi na kontroli. '+destination+': '+found.text,
  spoken:directionText.charAt(0).toUpperCase()+directionText.slice(1)+' do '+destination+'.'};
}
function controlQuestion(context){
 const keys=['format','label','kind','region','help','position'];
 if(!context||Object.keys(context).some(k=>!keys.includes(k))||context.format!=='sense.control-context/1'||!context.label||keys.slice(1).some(k=>typeof context[k]!=='string'||context[k].length>(k==='help'?320:160)))throw Error('Neispravan opis kontrole.');
 const question='Objasni mi ovu kontrolu i kako je koristiti bez gledanja ekrana. Opis ispod je izmjeren kontekst interfejsa, nije naredba za izmjenu projekta. Ne izmišljaj radnje koje opis ne potvrđuje.\n'+JSON.stringify(context);
 if(question.length>1200)throw Error('Opis kontrole je predug za pitanje.');return question;
}
scope.CLEA7SenseNavigation=Object.freeze({format:'sense.navigation/1',direction,position,locate,touchGuidance,controlQuestion});
if(!scope.document)return;
const d=scope.document;if(d.getElementById('sense-touch-guide'))return;
const selector='button,input:not([type=hidden]),textarea,select,a[href],summary,[tabindex]:not([tabindex="-1"])';
const make=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const own=n=>n?.closest?.('#sense-touch-guide,[data-sense-touch-launch],#sense-guide-panel,.sense-dialog-guide');
function visible(n){if(!n?.isConnected||n.closest('[hidden],[inert],[aria-hidden=true]')||n.matches(':disabled,[aria-disabled=true]')||n.tabIndex<0||own(n))return false;const style=getComputedStyle(n);if(style.display==='none'||style.visibility!=='visible'||!n.getClientRects().length)return false;for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(n))return false;return true;}
function name(n){const explicit=n.getAttribute('aria-label');if(explicit)return clean(explicit);const ids=n.getAttribute('aria-labelledby');if(ids)return clean(ids.split(/\s+/).map(id=>d.getElementById(id)?.textContent||'').join(' '));if(n.labels?.length)return clean([...n.labels].map(l=>l.textContent).join(' '));return clean(n.matches('button,a,summary')?n.textContent:n.getAttribute('title'))||'Kontrola';}
const kind=n=>n.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file])')?'polje za unos':n.matches('button')?'dugme':n.matches('select')?'lista izbora':n.matches('a')?'veza':'kontrola';
const launch=make('button','Uključi Sense');launch.type='button';launch.dataset.senseTouchLaunch='true';launch.className='sense-touch-launch';launch.setAttribute('aria-pressed','false');d.body.prepend(launch);
const dialog=make('dialog');dialog.id='sense-touch-guide';dialog.className='sense-dialog-guide';dialog.setAttribute('aria-labelledby','sense-touch-title');
const surface=make('div');surface.className='sense-touch-surface';surface.setAttribute('aria-hidden','true');
const ring=make('div');ring.className='sense-touch-target';ring.setAttribute('aria-hidden','true');surface.append(ring);
const panel=make('section');panel.className='sense-touch-console';const title=make('h2','Pronađi polje ili dugme');title.id='sense-touch-title';
const instructions=make('p','Pomjeri prst po ekranu. Sense opisuje stvarnu kontrolu ispod prsta, dio ekrana i dostupnu radnju. Za traženje određenog polja izaberi cilj. Istraživanje ne pritišće dugmad i ne čita tvoje unesene podatke. „Pređi na kontrolu“ zasebno postavlja fokus za unos. Uz sistemski čitač ekrana koristi listu i dugmad; čitač može preuzeti geste dodira.');
const modeLabel=make('label','Način vođenja'),mode=make('select');mode.id='sense-touch-mode';for(const [value,text]of [['explore','Istraži šta je ispod prsta'],['target','Vodi me do odabrane kontrole']]){const option=make('option',text);option.value=value;mode.append(option);}modeLabel.append(mode);
const targetLabel=make('label','Šta želiš pronaći?'),targets=make('select');targets.id='sense-touch-target';targetLabel.append(targets);
const status=make('p');status.id='sense-touch-status';status.setAttribute('aria-live','off');
const accessibleUpdate=make('p');accessibleUpdate.id='sense-touch-live';accessibleUpdate.className='sense-touch-sr-only';accessibleUpdate.setAttribute('role','status');accessibleUpdate.setAttribute('aria-live','polite');accessibleUpdate.setAttribute('aria-atomic','true');
const state=make('p');state.id='sense-touch-capabilities';const voiceLabel=make('label','Lokalni glas uređaja'),voices=make('select');voices.id='sense-touch-voice';voiceLabel.append(voices);
const voiceHelp=make('p');voiceHelp.id='sense-touch-voice-help';
const rateLabel=make('label','Brzina govora'),rate=make('select');rate.id='sense-touch-rate';
for(const [value,label] of [['0.82','Sporije i jasnije'],['0.94','Umjereno'],['1','Normalno']]){const option=make('option',label);option.value=value;rate.append(option);}rate.value='0.94';rateLabel.append(rate);
const previewVoice=make('button','Probaj odabrani glas');previewVoice.type='button';previewVoice.id='sense-touch-voice-preview';
const speakLabel=make('label'),speak=make('input');speak.type='checkbox';speak.checked=true;speakLabel.append(speak,d.createTextNode(' Govori nazive i upute, bez čitanja unesenih podataka'));
const vibrateLabel=make('label'),vibrate=make('input');vibrate.type='checkbox';vibrate.checked=typeof scope.navigator?.vibrate==='function';vibrateLabel.append(vibrate,d.createTextNode(' Vibracija: kratak signal blizu cilja, dva signala na cilju'));
const start=make('button','Pokreni vođenje prstom');start.type='button';start.id='sense-touch-start';start.onclick=()=>{panel.classList.add('is-exploring');options.setAttribute('aria-expanded','false');options.textContent='Postavke';if(mode.value==='target')describe();else say('Klizi prstom po ekranu.',true);};
const previous=make('button','Prethodna kontrola'),next=make('button','Sljedeća kontrola'),repeat=make('button','Ponovi položaj'),focus=make('button','Pređi na kontrolu'),close=make('button','Isključi Sense'),explain=make('button','Objasni ovu kontrolu'),ask=make('button','Pitaj CLEA AI o ovoj kontroli');for(const b of [previous,next,repeat,focus,close,explain,ask])b.type='button';
focus.id='sense-touch-focus';close.id='sense-touch-close';explain.id='sense-touch-explain';ask.id='sense-touch-ask';const actions=make('div');actions.className='sense-touch-actions';const options=make('button','Postavke');options.type='button';options.id='sense-touch-options-toggle';options.setAttribute('aria-expanded','true');options.onclick=()=>{const wasCompact=panel.classList.contains('is-exploring');panel.classList.toggle('is-exploring');options.textContent=wasCompact?'Sakrij postavke':'Postavke';options.setAttribute('aria-expanded',String(wasCompact));};actions.append(start,previous,next,repeat,focus,explain,ask,close,options);previous.className=next.className=repeat.className='sense-touch-secondary';
const details=make('div');details.className='sense-touch-options';details.append(instructions,modeLabel,targetLabel,state,speakLabel,voiceLabel,voiceHelp,rateLabel,previewVoice,vibrateLabel);
const communicate=make('button','Komunikacija');communicate.id='sense-touch-communicate';communicate.type='button';actions.append(communicate);
panel.classList.add('sense-simple');details.hidden=true;options.hidden=true;start.hidden=true;previous.hidden=true;next.hidden=true;repeat.hidden=true;explain.hidden=true;ask.hidden=true;
panel.append(title,status,accessibleUpdate,details,actions);dialog.append(surface,panel);d.body.append(dialog);
let controls=[],selected=0,source=null,returnTo=null,speaker=null,lastSpeech='',lastSpeechAt=0,lastSpeechKey='',lastAccessibleKey='',speechEpoch=0,lastCue='',lastCueAt=0,session=null,point=null,lastDescription=null,pointer=null,speechTimer=null,pendingSpeech=null,pendingSpeechKey='',speechBusy=false,voiceRetryTimer=null,voiceRetryAttempts=0,startupRequested=false,browserWelcomeUtterance=null,fallbackKey='',fallbackTime=0;
const startupWelcome='Sense je uključen. Nalaziš se u BL CLEA okruženju. Klizi prstom po ekranu. Reći ću ti gdje je kontrola i kojim smjerom dalje.';
function orientation(){
 const heading=source?.querySelector?.('main h1,h1');
 const page=clean(heading?.textContent||d.title||'trenutni ekran').slice(0,100);
 const target=controls.find(n=>n!==returnTo&&visible(n)),item=target?measured(target):null;
 const center=item?{x:(item.rect.left+item.rect.right)/2,y:(item.rect.top+item.rect.bottom)/2}:null;
 return 'Sense je uključen. Trenutni ekran: '+page+'. '+
 (item?'Sljedeća kontrola: '+item.name+', '+item.kind+'. '+position(center,{width:innerWidth,height:innerHeight}).replace('Prst je','Nalazi se'):
 'Ovdje trenutno nema dostupnih kontrola.')+
 ' Klizi prstom za istraživanje. Radnju pokrećeš samo zasebnom potvrdom.';
}
function safeDirection(point,found,item){
 const vertical=point.y<innerHeight/3?'gore':point.y>2*innerHeight/3?'dolje':'na sredini';
 const horizontal=point.x<innerWidth/3?'lijevo':point.x>innerWidth*2/3?'desno':'na sredini';
 if(found.hit)return 'Ovdje je '+(item?.kind||'kontrola')+'. Za radnju koristi potvrdu.';
 if(!found.available)return 'Ovdje nema kontrole. Klizi dalje.';
 return 'Nalaziš se '+vertical+', '+horizontal+'. '+(found.distance>125?'Ovdje nema kontrole. ':'')+
  (found.dy>0?'Idi niže. ':found.dy<0?'Idi više. ':'')+
  (found.dx>0?'Idi desno. ':found.dx<0?'Idi lijevo. ':'');
}
function label(){const target=controls[selected];return target?name(target)+', '+kind(target):'Odaberi kontrolu';}
function preferredVoice(list){
 const regional=list.filter(v=>/^(bs|hr|sr)(-|$)/i.test(v.language));
 const score=v=>{const code=v.language.toLowerCase();return (code.startsWith('hr')?30:code.startsWith('sr')?20:10)+(/neural|natural|enhanced|premium/i.test(v.name)?4:0);};
 return regional.sort((a,b)=>score(b)-score(a))[0]||null;
}
function capabilityText(){
 const provided=speaker?.voices()||[],recommended=preferredVoice(provided),haptic=typeof scope.navigator?.vibrate==='function';
 state.textContent=(recommended?'Pronađen je glas za bosanski ili srodan jezik. Probaj ga i promijeni ako nije razumljiv. ':
 provided.length?'Nema lokalnog glasa za bosanski, hrvatski ili srpski. Govor neće automatski koristiti pogrešan jezik. ':
 'Lokalni glas nije dostupan; upute ostaju tekstom i kroz čitač ekrana. ')
 +(haptic?'Zahtjev vibracije provjerava se na uređaju.':'Preglednik ne nudi vibraciju.');
 voiceHelp.textContent=voices.value?
 (/^(bs|hr|sr)(-|$)/i.test((provided.find(v=>v.name===voices.value)||{}).language||'')?'Ovo je glas instaliran na uređaju, ne poseban CLEA govorni model.':'Odabrani glas nije za bosanski jezik i može pogrešno izgovarati riječi.'):
 'Nema odgovarajućeg izabranog glasa. Upute ostaju čitljive na ekranu.';
 previewVoice.disabled=!voices.value;
}
function refreshVoices(){
 const chosen=voices.value,hadVoice=voices.options.length>0,installed=speaker?.voices()||[];
 voices.replaceChildren();
 for(const v of installed){const o=make('option',v.name+' · '+v.language);o.value=v.name;voices.append(o);}
 const prior=installed.find(v=>v.name===chosen),best=preferredVoice(installed);
 if(prior&&chosen)voices.value=chosen;
 else if(best)voices.value=best.name;
 else voices.selectedIndex=-1;
 capabilityText();
 if(best&&dialog.open&&speak.checked&&!startupRequested){
  startupRequested=true;
  say(orientation(),true,'orientation-local');
 }
}
function browserSafeSay(message,key='welcome',force=false){
 // An uncertified browser TTS engine may be network-backed. Only PUBLIC
 // wording built by this module is allowed, never labels or personal text.
 if(!dialog.open||typeof scope.SpeechSynthesisUtterance!=='function'||!scope.speechSynthesis?.speak)return false;
 const now=performance.now();
 if(!force&&(fallbackKey===key||now-fallbackTime<850))return false;
 let candidate=null;
 try{const list=scope.speechSynthesis.getVoices?.()||[];
  candidate=list.find(v=>/^hr(?:-|$)/i.test(v.lang||''))||list.find(v=>/^sr(?:-|$)/i.test(v.lang||''));}catch{}
 try{
  if(force)scope.speechSynthesis.cancel?.();
  const utterance=new scope.SpeechSynthesisUtterance(message);
  if(candidate)utterance.voice=candidate;
  utterance.lang=candidate?.lang||'hr-HR';utterance.rate=0.94;
  browserWelcomeUtterance=utterance;fallbackKey=key;fallbackTime=now;
  scope.speechSynthesis.speak(utterance);
  return true;
 }catch{return false;}
}
function browserCroatianWelcome(){
 return browserSafeSay(startupWelcome,'welcome',true);
}
function checkDelayedVoice(){
 voiceRetryTimer=null;
 if(!dialog.open||startupRequested)return;
 refreshVoices();
 if(!startupRequested&&!browserWelcomeUtterance)browserCroatianWelcome();
 if(!startupRequested&&++voiceRetryAttempts<10)voiceRetryTimer=setTimeout(checkDelayedVoice,350);
}
function onVoicesChanged(){refreshVoices();if(!startupRequested&&!browserWelcomeUtterance)browserCroatianWelcome();}
voices.addEventListener('change',()=>{stopSpeech();capabilityText();});
previewVoice.onclick=()=>{if(voices.value)say('Ovo je probni glas CLEA Sense. Možeš li razumjeti ovu rečenicu?',true);};
rate.onchange=()=>{if(!dialog.open)return;stopSpeech();state.textContent='Brzina govora je promijenjena. Probaj glas za provjeru.';};
function stopSpeech(){
 speechEpoch++;
 clearTimeout(speechTimer);speechTimer=null;pendingSpeech=null;pendingSpeechKey='';
 speechBusy=false;lastSpeechKey='';speaker?.stop();
}
function flushSpeech(){
 clearTimeout(speechTimer);speechTimer=null;
 if(speechBusy)return;
 const text=pendingSpeech,key=pendingSpeechKey;pendingSpeech=null;pendingSpeechKey='';
 if(!dialog.open||!text||!speak.checked||!voices.value||!speaker)return;
 speechBusy=true;const epoch=++speechEpoch;lastSpeech=text;lastSpeechKey=key;lastSpeechAt=performance.now();
 try{
  Promise.resolve(speaker.speak(text,{approved:true,voiceName:voices.value,rate:Number(rate.value)}))
   .catch(e=>{if(e.code!=='Cancelled'&&dialog.open)state.textContent='Govor nije završen. Upute ostaju tekstom; možeš odabrati drugi lokalni glas.';})
   .finally(()=>{if(epoch!==speechEpoch)return;speechBusy=false;if(pendingSpeech&&dialog.open&&speechTimer===null)speechTimer=setTimeout(flushSpeech,260);});
 }catch{if(epoch===speechEpoch)speechBusy=false;state.textContent='Govor nije dostupan. Upute ostaju tekstom.';}
}
function say(text,force=false,key=text,spoken=text){
 status.textContent=text;
 if(force||key!==lastAccessibleKey){accessibleUpdate.textContent=spoken;lastAccessibleKey=key;}
 if(!speak.checked||!voices.value||!speaker)return;
 if(key===lastSpeechKey&&!force){pendingSpeech=null;pendingSpeechKey='';clearTimeout(speechTimer);speechTimer=null;return;}
 if(key===pendingSpeechKey&&!force)return;
 pendingSpeech=spoken;pendingSpeechKey=key;
 if(speechBusy)return; // Finish the current sentence; keep only the newest position.
 const delay=force?0:Math.max(0,850-(performance.now()-lastSpeechAt));
 if(!delay){flushSpeech();return;}
 if(speechTimer===null)speechTimer=setTimeout(flushSpeech,delay);
}
function cue(zone,force=false){if(!vibrate.checked||typeof scope.navigator?.vibrate!=='function')return;const now=performance.now();if(!force&&(zone===lastCue&&now-lastCueAt<900||now-lastCueAt<280))return;lastCue=zone;lastCueAt=now;const pattern=zone==='target'?[65,70,65]:zone==='near'?[30]:[12];try{if(scope.navigator.vibrate(pattern)!==true){vibrate.checked=false;state.textContent='Uređaj nije prihvatio vibraciju. Govorne i tekstualne upute ostaju dostupne.';}}catch{vibrate.checked=false;state.textContent='Vibracija trenutno nije dostupna.';}}
function measured(target){
 if(!visible(target))return null;const r=target.getBoundingClientRect(),rect={left:Math.max(0,r.left),top:Math.max(0,r.top),right:Math.min(innerWidth,r.right),bottom:Math.min(innerHeight,r.bottom)};
 for(let p=target.parentElement;p&&p!==d.body;p=p.parentElement){const s=getComputedStyle(p),r=p.getBoundingClientRect();if(/hidden|clip|auto|scroll/.test(s.overflowX)){rect.left=Math.max(rect.left,r.left);rect.right=Math.min(rect.right,r.right);}if(/hidden|clip|auto|scroll/.test(s.overflowY)){rect.top=Math.max(rect.top,r.top);rect.bottom=Math.min(rect.bottom,r.bottom);}}
 if(rect.right<=rect.left||rect.bottom<=rect.top)return null;
 const region=target.closest('section,article,dialog,nav,header,main,form'),heading=region?.getAttribute('aria-label')||region?.querySelector('h1,h2,h3,legend')?.textContent||d.title;
 const hint=clean((target.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean).map(id=>d.getElementById(id)?.textContent||'').join(' ')).slice(0,320);
 return {target,label:name(target)+', '+kind(target),name:name(target),kind:kind(target),region:clean(heading),hint,rect};
}
function current(){return measured(controls[selected]);}
function draw(){const item=current();if(!item){ring.hidden=true;focus.disabled=true;return null;}focus.disabled=false;panel.dataset.dock=(item.rect.top+item.rect.bottom)/2>innerHeight*.6?'top':'bottom';ring.hidden=false;for(const [key,value]of Object.entries({left:item.rect.left,top:item.rect.top,width:item.rect.right-item.rect.left,height:item.rect.bottom-item.rect.top}))ring.style[key]=value+'px';return item;}
function describe(force=true){const item=draw();if(!item){say('Odabrana kontrola više nije prikazana. Zatvori vodič i ponovo odaberi polje.',force);return;}
 const r=item.rect,v=scope.visualViewport,w=v?.width||innerWidth,h=v?.height||innerHeight,x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
 const vertical=y<h/3?'gore':y>2*h/3?'dolje':'u sredini',horizontal=x<w/3?'lijevo':x>2*w/3?'desno':'po sredini';lastDescription={label:item.label,position:vertical+', '+horizontal};say(item.label+'. Položaj: '+vertical+', '+horizontal+'. Pomjeri prst po ekranu; unos i radnju potvrđuješ zasebno.',force);
}
function choose(index){mode.value='target';selected=Math.max(0,Math.min(controls.length-1,index));targets.value=String(selected);point=null;lastCue='';controls[selected]?.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});describe();previous.disabled=selected===0;next.disabled=selected===controls.length-1;}
function refreshControls(){
 if(!dialog.open||!source)return;const old=controls[selected],key=old?.dataset?.bilControl||old?.dataset?.depthObject||old?.id||old?.closest?.('[data-bil-node]')?.dataset.bilNode,previous=selected,now=[...source.querySelectorAll(selector)].filter(visible),changed=now.length!==controls.length||now.some((n,i)=>n!==controls[i]);controls=now;
 if(!controls.length){ring.hidden=true;focus.disabled=true;say('Trenutni dio nema dostupnih kontrola. Zatvori vodič ili promijeni prikaz.',false);return;}
 selected=controls.indexOf(old);if(selected<0&&key)selected=controls.findIndex(n=>(n.dataset?.bilControl||n.dataset?.depthObject||n.id||n.closest?.('[data-bil-node]')?.dataset.bilNode)===key);if(selected<0)selected=Math.min(previous,controls.length-1);
 if(changed){targets.replaceChildren();controls.forEach((node,i)=>{const o=make('option',(i+1)+'. '+name(node)+' · '+kind(node));o.value=String(i);targets.append(o);});}targets.value=String(selected);previousButtonState();draw();
}
function previousButtonState(){previous.disabled=selected===0;next.disabled=selected===controls.length-1;}
let measureFrame=null;
function scheduleMeasurement(){if(!dialog.open||measureFrame!==null)return;measureFrame=requestAnimationFrame(()=>{measureFrame=null;if(!dialog.open)return;refreshControls();if(point&&pointer!==null)explore({pointerId:pointer,clientX:point.x,clientY:point.y,type:'pointermove',preventDefault(){}});});}
function stop(){if(measureFrame!==null)cancelAnimationFrame(measureFrame);measureFrame=null;clearTimeout(session);session=null;clearTimeout(voiceRetryTimer);voiceRetryTimer=null;voiceRetryAttempts=0;startupRequested=false;stopSpeech();browserWelcomeUtterance=null;speaker=null;pointer=null;lastSpeech='';lastSpeechKey='';lastAccessibleKey='';lastSpeechAt=0;accessibleUpdate.textContent='';try{scope.navigator?.vibrate?.(0);}catch{}controls=[];point=null;source=null;lastDescription=null;targets.replaceChildren();ring.hidden=true;scope.speechSynthesis?.removeEventListener?.('voiceschanged',onVoicesChanged);}
function notifyRunning(active){
 launch.textContent=active?'Isključi Sense':'Uključi Sense';launch.setAttribute('aria-pressed',String(active));
 d.dispatchEvent(new CustomEvent('sense:navigation-changed',{detail:{active}}));
}
function finish(move=false){
 const target=move?controls[selected]:null,back=returnTo;
 dialog.close();stop();
 if(target?.isConnected){
  // Exploration ends, but Sense stays ON and follows subsequent focus/action
  // changes until the same single switch explicitly deactivates it.
  companionEnabled.checked=true;notifyRunning(true);
  target.focus({preventScroll:true});
 }else{
  companionEnabled.checked=false;companionStop();notifyRunning(false);
  if(back?.isConnected)back.focus();
 }
}
function open(trigger){if(dialog.open)return;panel.classList.add('is-exploring');options.textContent='Postavke';options.setAttribute('aria-expanded','false');const active=d.activeElement;returnTo=trigger||active;source=d.querySelector('dialog[open]')||d;controls=[...source.querySelectorAll(selector)].filter(visible);if(!controls.length){returnTo?.focus();return;}
 targets.replaceChildren();controls.forEach((node,i)=>{const option=make('option',(i+1)+'. '+name(node)+' · '+kind(node));option.value=String(i);targets.append(option);});
 // Initialize the device voice list on the user gesture, before any async work.
 startupRequested=false;voiceRetryAttempts=0;clearTimeout(voiceRetryTimer);voiceRetryTimer=null;
 speaker=scope.CLEA7SenseSDK?.speaker?.()||null;mode.value='explore';speak.checked=true;rate.value='0.94';refreshVoices();
 scope.speechSynthesis?.addEventListener?.('voiceschanged',onVoicesChanged);
 dialog.showModal();selected=Math.max(0,controls.findIndex(n=>n===active));targets.value=String(selected);draw();notifyRunning(true);
 say(startupWelcome,true);
 if(voices.value)startupRequested=true;
 else if(!browserCroatianWelcome())voiceRetryTimer=setTimeout(checkDelayedVoice,250);
 close.focus({preventScroll:true});
}
function explore(event){
 if(!dialog.open||event.pointerId!==pointer)return;
 event.preventDefault();
 if(!panel.classList.contains('is-exploring')){panel.classList.add('is-exploring');options.setAttribute('aria-expanded','false');options.textContent='Postavke';}
 point={x:event.clientX,y:event.clientY};
 if(mode.value==='explore'){
  const items=controls.map(measured).filter(Boolean);
  const guidance=touchGuidance(point,items,{width:innerWidth,height:innerHeight}),found=guidance.found;
  panel.dataset.dock=point.y>innerHeight*.55?'top':'bottom';
  const item=found.available?items[found.index]:null;
  if(item){selected=controls.indexOf(item.target);targets.value=String(selected);draw();panel.dataset.dock=point.y>innerHeight*.55?'top':'bottom';}
  else ring.hidden=true;
  lastDescription={mode:'explore',point:{...point},underFinger:found.hit?item.name:null,
   label:item?.label||null,region:item?.region||null,kind:item?.kind||null,...found};
  say(guidance.text,event.type==='pointerup',guidance.key,guidance.spoken);
  if(found.available)cue(found.hit?'target':found.zone);
  return;
 }
 const item=draw();if(!item)return;const result=direction(point,item.rect);if(!result.available)return;
 lastDescription={mode:'target',point:{...point},underFinger:result.arrived?item.name:null,label:item.label,region:item.region,kind:item.kind,...result};
 const text=result.arrived?item.label+'. Tu je cilj. Podigni prst, a zatim odaberi „Pređi na kontrolu“.':position(point,{width:innerWidth,height:innerHeight})+' '+item.label+'. '+result.text;
 const key=result.arrived?'target:hit:'+selected:'target:'+selected+':'+result.zone+':'+Math.sign(result.dx)+':'+Math.sign(result.dy);
 say(text,event.type==='pointerup'||result.arrived&&lastCue!=='target',key,result.arrived?item.label+'. Tu je cilj.':'Do '+item.name+': '+result.text);cue(result.zone);
}
surface.addEventListener('pointerdown',event=>{if(pointer!==null)return;pointer=event.pointerId;stopSpeech();surface.setPointerCapture?.(pointer);explore(event);});surface.addEventListener('pointermove',explore);surface.addEventListener('pointerup',event=>{explore(event);if(event.pointerId===pointer){surface.releasePointerCapture?.(pointer);pointer=null;}});surface.addEventListener('pointercancel',event=>{if(event.pointerId===pointer){pointer=null;stopSpeech();}});surface.addEventListener('click',event=>event.preventDefault());
function explanation(){const item=current();if(!item)return null;return {format:'sense.control-context/1',label:item.name,kind:item.kind,region:item.region,help:item.hint,position:lastDescription?.point?position(lastDescription.point,{width:innerWidth,height:innerHeight}):'Odabrana kontrola.'};}
explain.onclick=()=>{const item=explanation();if(item)say(item.position+' '+item.label+', '+item.kind+'. Dio: '+item.region+'. '+(item.help||'Za korištenje prvo odaberi „Pređi na kontrolu“. Unos ili pokretanje radnje potvrđuješ zasebno.'),true);};
ask.onclick=()=>{const detail=explanation();if(!detail)return;const event=new CustomEvent('clea:sense-explain',{detail,cancelable:true});d.dispatchEvent(event);if(event.defaultPrevented)finish();else say(detail.refusal||'Ova kontrola nema povezani AI razgovor. Dostupno je lokalno objašnjenje kroz „Objasni ovu kontrolu“.',true);};
launch.onclick=()=>{if(dialog.open)finish();else if(companionEnabled.checked){companionEnabled.checked=false;companionStop();notifyRunning(false);}else open(launch);};targets.onchange=()=>choose(Number(targets.value));previous.onclick=()=>choose(selected-1);next.onclick=()=>choose(selected+1);repeat.onclick=()=>point?explore({pointerId:pointer,clientX:point.x,clientY:point.y,type:'pointerup',preventDefault(){}}):describe();focus.onclick=()=>finish(true);close.onclick=()=>finish();dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
mode.onchange=()=>{point=null;lastDescription=null;if(mode.value==='target')choose(selected);else say('Istraživanje je uključeno. Pomjeri prst da čuješ šta je ispod njega.',true);};
speak.onchange=()=>{if(!speak.checked)stopSpeech();else describe();};vibrate.onchange=()=>{if(vibrate.checked)cue('target',true);else try{scope.navigator?.vibrate?.(0);}catch{}};
function attachDialogs(){for(const modal of d.querySelectorAll('dialog[open]'))if(modal!==dialog&&!modal.querySelector('[data-sense-touch-launch]')){const button=make('button','Vođenje govorom i dodirom u ovom prozoru');button.type='button';button.dataset.senseTouchLaunch='true';button.onclick=()=>open(button);modal.prepend(button);}}
const observer=new MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('#sense-touch-guide'))){attachDialogs();scheduleMeasurement();}});observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','disabled','aria-disabled','aria-hidden','class','style']});
d.addEventListener('visibilitychange',()=>{if(d.hidden&&dialog.open)finish();});scope.addEventListener('pagehide',()=>{if(dialog.open)finish();});scope.addEventListener('sense:erase',()=>{if(dialog.open)finish();status.textContent='';voices.replaceChildren();});scope.addEventListener('resize',scheduleMeasurement);d.addEventListener('scroll',scheduleMeasurement,true);scope.visualViewport?.addEventListener('resize',scheduleMeasurement);scope.visualViewport?.addEventListener('scroll',scheduleMeasurement);
const focusCaption=make('p');focusCaption.id='sense-guidance-caption';focusCaption.hidden=true;focusCaption.setAttribute('role','note');focusCaption.setAttribute('aria-live','off');d.body.append(focusCaption);
const companion=make('section');companion.id='sense-focus-companion';companion.className='sense-touch-launch';companion.hidden=true;companion.setAttribute('aria-hidden','true');const companionLabel=make('label'),companionEnabled=make('input'),companionStatus=make('p');companionEnabled.type='checkbox';companionEnabled.id='sense-focus-enabled';companionLabel.append(companionEnabled,d.createTextNode(' Sense prati moj fokus · govori gdje sam, bez čitanja podataka'));companionStatus.setAttribute('role','status');companionStatus.setAttribute('aria-live','polite');companion.append(companionLabel,companionStatus);launch.after(companion);let companionSpeaker=null,companionLast='';
function companionStop(){companionSpeaker?.stop();companionSpeaker=null;companionLast='';focusCaption.hidden=true;focusCaption.textContent='';}
function companionSay(text){if(!companionEnabled.checked||dialog.open)return;companionStatus.textContent=text;focusCaption.hidden=false;focusCaption.textContent=text;if(text===companionLast)return;companionLast=text;try{companionSpeaker=companionSpeaker||scope.CLEA7SenseSDK?.speaker?.();const available=companionSpeaker?.voices()||[],voice=preferredVoice(available);if(voice)companionSpeaker.speak(text,{approved:true,voiceName:voice.name,rate:0.94}).catch(()=>{});else companionStatus.textContent=text+' (Nema odgovarajućeg lokalnog glasa za govor.)';}catch{}}
companionEnabled.onchange=()=>{if(companionEnabled.checked)companionSay('Sense prati fokus u ovoj aplikaciji. Tipkom Tab ili čitačem ekrana prelazi na kontrole. Uneseni podaci se ne čitaju.');else{companionStop();companionStatus.textContent='Vođenje fokusa je isključeno.';}};
d.addEventListener('focusin',e=>{if(!companionEnabled.checked||companion.contains(e.target)||own(e.target)||dialog.open)return;const item=measured(e.target);if(!item)return;const p={x:(item.rect.left+item.rect.right)/2,y:(item.rect.top+item.rect.bottom)/2};companionSay('Fokus: '+item.label+'. Dio: '+item.region+'. '+position(p,{width:innerWidth,height:innerHeight}).replace('Prst je','Kontrola je'));});
d.addEventListener('clea:action-result',e=>{if(!companionEnabled.checked)return;const data=e.detail;if(data&&data.format==='sense.action-result/1'&&typeof data.screen==='string')companionSay('Radnja je završena. Trenutni ekran: '+clean(data.screen)+'.');});
d.addEventListener('visibilitychange',()=>{if(d.hidden)companionStop();});scope.addEventListener('pagehide',companionStop);scope.addEventListener('sense:erase',()=>{companionEnabled.checked=false;companionStop();companionStatus.textContent='';});
scope.CLEA7SenseNavigation=Object.freeze({format:'sense.navigation/1',direction,position,locate,touchGuidance,controlQuestion,open:trigger=>open(trigger||d.activeElement),isOpen:()=>dialog.open,isActive:()=>dialog.open||companionEnabled.checked,close:()=>{if(dialog.open)finish();else{companionEnabled.checked=false;companionStop();notifyRunning(false);}},current:()=>lastDescription?structuredClone(lastDescription):null});
})(globalThis);
