'use strict';
/* Original Studio conversation panel. All conversation data uses text nodes. */
(function(scope){
const root=document.getElementById('clea-chat');if(!root)return;
root.innerHTML='<div class="clea-chat-shell"><section class="clea-chat-room"><header class="clea-chat-heading"><div><p class="eyebrow">BL CLEA AI · BRZO I LOKALNO</p><h1>Razgovaraj s CLEA</h1><p>Jedan razgovor, provjereni CLEA alati i opcionalna veza s HP serverom.</p></div><span id="chat-ready" role="status">Model nije učitan</span></header><div id="chat-log" role="log" aria-label="Razgovor s CLEA" aria-live="polite" aria-relevant="additions"><article class="chat-welcome"><h2>Jedan razgovor. Sedam stvarnih odgovornosti.</h2><p>Pitaj kako rade BIL, Runtime, Studio, SDK ili sedam stubova. Model ima početno znanje o CLEA platformi; za druga područja jasno kaže da nema provjeren odgovor.</p><div class="chat-examples"><button type="button" data-chat-question="Objasni sedam stubova.">Kako radi sedam stubova?</button><button type="button" data-chat-question="Šta je BIL?">Objasni BIL</button><button type="button" data-chat-question="Kako radi CACI?">Šta pamti cache?</button><button type="button" data-chat-question="Koliko je 23 * 4?">Provjereni proračun</button></div></article></div><form id="chat-form"><label for="chat-question">Tvoje pitanje</label><textarea id="chat-question" maxlength="1200" rows="3" placeholder="Šta CLEA Runtime stvarno radi?"></textarea><div class="chat-composer-actions"><label for="chat-language">Jezik odgovora<select id="chat-language"><option value="bs">Bosanski</option><option value="en">English</option></select></label><button id="chat-send" type="submit" class="primary">Pošalji</button><button id="chat-stop" type="button" disabled>Zaustavi</button></div><p id="chat-status" role="status" aria-live="polite">Razgovor ostaje u ovoj sesiji. Nema automatskog treniranja na tvojim porukama.</p></form></section><aside class="clea-chat-inspector"><div class="chat-model-card"><p class="eyebrow">CLEA RUNTIME · 7</p><h2>Sedam stubova</h2><div id="chat-pillars"></div></div><div class="chat-model-card"><h2>Lokalni probni model · 20 CLEA tema</h2><p id="chat-model-info">Model je dio aplikacije. Ne biraš niti ručno instaliraš tuđe težine.</p><p class="chat-scope">Početno znanje: 20 CLEA tema. Ovo nije opći model s internetskim znanjem.</p><button id="chat-retry" type="button">Učitaj / provjeri model</button><label class="chat-cache-option"><input id="chat-cache" type="checkbox" checked> Ponovo koristi provjerene odgovore</label><button id="chat-clear-cache" type="button">Očisti razgovorni cache</button><button id="chat-clear" type="button">Obriši ovaj razgovor</button><details><summary>Stvarno izvršavanje i privatnost</summary><p>U lokalnom probnom načinu tekst poruke ne ide serveru za obradu. Ako uključiš HP servis, nove poruke i historija te sesije šalju se njemu. Datoteke lokalnog modela učitavaju se s ove stranice. Odgovor modela provjerava se prema podržanoj temi; rezervni odgovor je posebno označen. Historija je u RAM-u ove sesije. Zadržava se najnovijih 12 razmjena; ništa se ne čuva trajno.</p><p id="chat-memory"></p><ol id="chat-events"></ol></details></div></aside></div>';
const $=id=>document.getElementById(id),node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
let busy=false,loaded=false,loading=false,disposed=false,turn=0;
const status=text=>{$('chat-status').textContent=text;};
const names=scope.CLEA7.PILLARS.map(x=>x[0]),cards=new Map();
for(const [index,name]of names.entries()){const card=node('div');card.className='chat-pillar';card.append(node('span',String(index+1)),node('strong',name),node('small','Spremno za stvarni zadatak'));$('chat-pillars').append(card);cards.set(name,card);}
function controls(){for(const id of ['chat-send','chat-question','chat-language','chat-clear-cache'])$(id).disabled=busy||loading;$('chat-stop').disabled=!busy&&!loading;$('chat-retry').disabled=busy||loading;}
function event(item){if(item.pillar==='Holo Interaction'&&item.state==='committed')$('chat-ready').textContent='Vlastiti model je provjeren · lokalno';const card=cards.get(item.pillar);if(card){card.dataset.state=item.state;card.querySelector('small').textContent=item.detail;}const li=node('li');li.append(node('strong',item.pillar),node('span',item.detail));if(Object.keys(item.metrics||{}).length)li.append(node('code',JSON.stringify(item.metrics)));$('chat-events').prepend(li);while($('chat-events').children.length>40)$('chat-events').lastChild.remove();}
const runtime=scope.CLEA7Chat.create({onEvent:event,onLoading:progress=>{$('chat-ready').textContent='Učitavanje vlastitog modela: '+Math.round(progress.bytes/1024)+' / '+Math.round(progress.total/1024)+' KiB';}});scope.CLEA7ChatWorkspace=runtime;
function memory(){const stats=runtime.cacheStats;$('chat-memory').textContent='Obračunati RAM cache: '+stats.memoryRetainedBytes+' / '+stats.memoryBudgetBytes+' bajtova. To nije ukupna RAM potrošnja modela ili preglednika. Trajno čuvanje razgovora je isključeno.';}
async function initialize(){
 if(loaded||loading||disposed)return;loading=true;controls();
 try{
  let hostConfig=null;try{hostConfig=await scope.CLEA7AI?.configuration();}catch{}
  if(scope.CLEA7AI?.isRuntimeHost(hostConfig)){
   loaded=true;$('chat-ready').textContent='Provjeravam CLEA servis…';
   $('chat-model-info').textContent=hostConfig.executionHost==='disposable-hosted-test'?'Jezički model radi na privremenom testnom Windows serveru. Razgovor se ne izvršava na telefonu.':'Jezički model se izvršava na povezanom računaru. Razgovor se ne izvršava lokalnim modelom za 20 CLEA tema.';
   if(typeof hostConfig.modelProfile?.name==='string')$('chat-model-info').append(document.createTextNode(' '+hostConfig.modelProfile.name+' · lokalna jezička komponenta.'));
   const card=$('chat-model-info').closest('.chat-model-card');card.querySelector('h2').textContent='Razgovorni model';card.querySelector('.chat-scope').textContent='Opći razgovor i CLEA dokumentacija kada pitaš za projekat. Model može pogriješiti; provjeri važne činjenice.';
   $('chat-question').placeholder='Postavi pitanje ili nastavi razgovor…';
   const examples=[['Zašto nastaju dan i noć?','Zašto se na Zemlji smjenjuju dan i noć?'],['Ideja za ručak','Predloži jednostavan ručak s rižom i povrćem.'],['Pomoć s pisanjem','Pomozi mi napisati kratku, ljubaznu poruku zahvalnosti.'],['Objasni BIL','Objasni BIL u BL CLEA.']];
   [...root.querySelectorAll('.chat-welcome .chat-examples button[data-chat-question]')].slice(0,4).forEach((button,index)=>{button.textContent=examples[index][0];button.dataset.chatQuestion=examples[index][1];});
   $('chat-cache').closest('label').hidden=true;$('chat-clear-cache').hidden=true;$('chat-retry').hidden=true;
   return;
  }
  const info=await runtime.initialize();if(disposed)return;loaded=true;$('chat-ready').textContent='Vlastiti model je provjeren · lokalno';
  $('chat-model-info').textContent=info.parameterCount.toLocaleString('bs-BA')+' naučenih parametara · '+Math.round(info.weightBytes/1024)+' KiB težina · CPU izvršavanje u radniku. Bez tuđih težina i bez inference servera.';
  status('Model je spreman. Postavi pitanje o CLEA platformi.');memory();
 }catch(error){$('chat-ready').textContent='Model nije pokrenut';status(error.message);}
 finally{loading=false;controls();}
}
function localVoices(){return typeof scope.SpeechSynthesisUtterance==='function'?(scope.speechSynthesis?.getVoices?.()||[]).filter(v=>v.localService===true):[];}
const voiceButtons=new Map();
function pickVoice(language){return localVoices().find(v=>language==='bs'?/^(bs|hr|sr)/i.test(v.lang):/^en/i.test(v.lang));}
function refreshVoices(){for(const [button,language]of voiceButtons){if(!button.isConnected){voiceButtons.delete(button);continue;}const voice=pickVoice(language);button.disabled=!voice;button.title=voice?'Govorni izlaz koristi lokalni glas uređaja.':'Na ovom uređaju nije pronađen lokalni glas za izabrani jezik.';}}
scope.speechSynthesis?.addEventListener?.('voiceschanged',refreshVoices);
function trimLog(){const rows=[...$('chat-log').querySelectorAll('.chat-message')];for(const row of rows.slice(0,Math.max(0,rows.length-24)))row.remove();refreshVoices();}
const labels={neural:'Generisao vlastiti model',bil:'Izvršio BIL Core',cache:'Ponovo korišten provjeren odgovor','grounded-fallback':'Provjerena baza · rezervni postupak',abstained:'Nema podržanog znanja','runtime-contract':'Stvarni ugovor sedam stubova'};
function answer(result,language){
 const article=node('article');article.className='chat-message assistant';article.dataset.mode=result.mode;article.append(node('p','CLEA · '+labels[result.mode]),node('div',result.text));
 const actions=node('div');actions.className='chat-response-actions';const speak=node('button','Pročitaj lokalnim glasom');speak.type='button';voiceButtons.set(speak,language);speak.onclick=()=>{const available=pickVoice(language);if(!available){status('Lokalni glas trenutno nije dostupan. Odgovor ostaje prikazan tekstom.');refreshVoices();return;}scope.speechSynthesis.cancel();const utterance=new scope.SpeechSynthesisUtterance(result.text);utterance.voice=available;utterance.lang=available.lang;utterance.onerror=()=>status('Govorni izlaz nije završen. Tekst odgovora je dostupan.');scope.speechSynthesis.speak(utterance);};actions.append(speak);
 const detail=node('details');detail.append(node('summary','Kako je dobijen ovaj odgovor'),node('p',labels[result.mode]+'. '+(result.modelUsed?'Neuralno generisanje je stvarno izvršeno.':'Ovaj odgovor ne tvrdi da je upravo generisan modelom.')));if(result.sources?.length)detail.append(node('p','Provjereni vlasnički izvori: '+result.sources.join(', ')));detail.append(node('pre',JSON.stringify({topic:result.topic,modelFingerprint:result.modelFingerprint,validation:result.validation,metrics:result.metrics},null,2)));actions.append(detail);article.append(actions);$('chat-log').append(article);trimLog();article.scrollIntoView({block:'nearest',behavior:'instant'});return article;
}
$('chat-form').onsubmit=async e=>{e.preventDefault();if(busy||loading||disposed)return;const question=$('chat-question').value.trim();if(!question)return;const ticket=++turn,language=$('chat-language').value;busy=true;controls();const user=node('article');user.className='chat-message user';user.append(node('p','Ti'),node('div',question));$('chat-log').append(user);trimLog();$('chat-question').value='';status('BIL provjera i lokalna obrada…');
 try{const result=await runtime.ask(question,{language,cacheEnabled:$('chat-cache').checked,onToken:step=>{if(ticket===turn)status('Vlastiti model generiše: '+(step.index+1)+' tokena. Sadržaj se provjerava prije prikaza.');}});if(disposed||ticket!==turn)return;answer(result,language);status(labels[result.mode]+'. Odgovor je završen.');memory();}
 catch(error){if(ticket===turn){const failed=node('article',error.name==='AbortError'?'Zadatak je zaustavljen. Prethodni razgovor je sačuvan.':error.message);failed.className='chat-message chat-error';$('chat-log').append(failed);trimLog();status(failed.textContent);}}
 finally{if(ticket===turn){busy=false;controls();$('chat-question').focus();}}
};
$('chat-question').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chat-form').requestSubmit();}};
$('chat-stop').onclick=()=>{runtime.cancel();scope.speechSynthesis?.cancel?.();$('chat-ready').textContent='Generisanje je zaustavljeno';};
$('chat-clear').onclick=async()=>{turn++;runtime.cancel();scope.speechSynthesis?.cancel?.();await runtime.clear();$('chat-log').replaceChildren();$('chat-events').replaceChildren();busy=false;controls();memory();status('Razgovor i njegov cache su obrisani. Studio projekti su sačuvani.');};
$('chat-clear-cache').onclick=async()=>{if(busy)return;await runtime.clearCache();memory();status('Razgovorni cache je očišćen. Razgovor i Studio projekti ostaju.');};
$('chat-retry').onclick=()=>initialize();
for(const b of root.querySelectorAll('[data-chat-question]'))b.onclick=()=>{$('chat-question').value=b.dataset.chatQuestion;$('chat-question').focus();};
document.querySelector('[data-panel="clea-chat"]')?.addEventListener('click',()=>initialize());
scope.addEventListener('beforeunload',()=>{disposed=true;runtime.close();scope.speechSynthesis?.cancel?.();scope.speechSynthesis?.removeEventListener?.('voiceschanged',refreshVoices);voiceButtons.clear();},{once:true});
})(globalThis);

/* CLEA AI: one conversation entry, shared original CLEA tools.
 * Historical Studio AI modules remain intact; no external service is invoked.
 * This routes only explicitly supported app requests, never arbitrary source.
 */
(function(){
 const $=id=>document.getElementById(id),nav=document.querySelector('[data-panel="clea-chat"]');
 if(!nav||!$('chat-form'))return;
 nav.textContent='CLEA AI';
 for(const name of ['clea-ai','assistant']){
  const button=document.querySelector('[data-panel="'+name+'"]');
  if(button){button.hidden=true;button.setAttribute('aria-hidden','true');button.tabIndex=-1;}
 }
 const heading=document.querySelector('#clea-chat .clea-chat-heading h1');
 if(heading)heading.textContent='CLEA AI';
 const hint=document.querySelector('#clea-chat .chat-welcome p');
 if(hint)hint.textContent='Jedan ulaz za razgovor i provjerenu izradu aplikacija. Trenutni neuronski model ima ograničeno znanje o CLEA platformi. Generator aplikacija je zaseban alat unutar istog CLEA sistema.';
 const label=document.querySelector('label[for="chat-question"]');
 if(label)label.textContent='Pitaj CLEA ili opiši aplikaciju';
 const input=$('chat-question');
 input.placeholder='Napravi aplikaciju za zalihe i radne naloge.';
 const examples=document.querySelector('#clea-chat .chat-examples');
 if(examples){
  const sample=document.createElement('button');
  sample.type='button';sample.textContent='Napravi aplikaciju za zalihe';
  sample.onclick=()=>{input.value='Napravi aplikaciju za zalihe i radne naloge.';input.focus();};
  examples.prepend(sample);
 }
 const form=$('chat-form'),log=$('chat-log');
 const specs=[
  ['stock',/^(zalihe|zaliha|zalih\w*|skladist\w*|magacin\w*|stock|inventory|warehouse)$/],
  ['orders',/^(nalog\w*|naloz\w*|order\w*|radne|radnih)$/],
  ['clients',/^(klijent\w*|kupac|kupc\w*|client\w*|customer\w*)$/],
  ['expenses',/^(trosk\w*|rashod\w*|expense\w*|cost\w*)$/],
  ['offers',/^(ponud\w*|predracun\w*|offer\w*|quote\w*)$/]
 ];
 const filler=new Set(['mi','aplikaciju','aplikacija','aplikacije','app','aplikaciju','za','sa','s','i','te','jednostavnu','jednostavnu','jednostavnu','lokalnu','lokalna','poslovnu','poslovna','evidenciju','evidencije','evidencija','radnih','radne','moju','moj','my','an','a','the','and','for','with','local','simple','business','application']);
 const normalize=x=>String(x).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'dj').toLowerCase();
 function parse(value){
  const valueNormalized=normalize(value),words=valueNormalized.match(/[a-z0-9]+/g)||[];
  const verb=words[0]||'';
  if(!/^(napravi|kreiraj|izradi|create|build|make|generate|dodaj|add)$/.test(verb))return null;
  const calc=words.some(w=>/^(kalkulator\w*|calculator\w*)$/.test(w));
  const moduleIds=[...new Set(words.flatMap(w=>specs.filter(([id,re])=>id!=='orders'||!/^radn/.test(w)||words.some(q=>/^nalog|^naloz|^order/.test(q))).filter(([,re])=>re.test(w)).map(([id])=>id)))];
  if(!calc&&!moduleIds.length)return null;
  const unknown=words.slice(1).filter(w=>!filler.has(w)&&!specs.some(([,re])=>re.test(w))&&!/^(kalkulator\w*|calculator\w*)$/.test(w));
  if(unknown.length||calc&&moduleIds.length)return {kind:'unsupported',reason:'Zahtjev sadrži dodatne ili nepodržane funkcije: '+(unknown.join(', ')||'kombinacija kalkulatora i evidencija')+'. CLEA neće tiho preskočiti dio zahtjeva.'};
  if(verb==='dodaj'||verb==='add')return {kind:'unsupported',reason:'Izmjena postojećeg projekta kroz razgovor još nije podržana. Trenutni projekt neće biti zamijenjen.'};
  return calc?{kind:'calculator'}:{kind:'business',modules:moduleIds};
 }
 function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
 function message(author,content){
  const article=node('article');article.className='chat-message '+(author==='Ti'?'user':'assistant');
  article.append(node('p',author),node('div',content));log.append(article);
  for(const row of [...log.querySelectorAll('.chat-message')].slice(0,-24))row.remove();
  article.scrollIntoView({block:'nearest',behavior:'instant'});return article;
 }
 let toolBusy=false;
 const status=x=>{$('chat-status').textContent=x;};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 function trace(label,detail){
  const list=$('chat-events');if(!list)return;
  const li=node('li');li.append(node('strong',label),node('span',detail));list.prepend(li);
  while(list.children.length>40)list.lastElementChild.remove();
 }
 function saveJSON(project){
  const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=node('a');
  a.href=url;a.download='clea-projekt.clea7';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 async function calculator(output){
  if(!globalThis.CLEA7LocalAIWorkspace)throw Error('BIL provjereni generator nije učitan.');
  const prompt=$('clea-ai-request');
  prompt.value='Create a simple calculator application.';
  prompt.dispatchEvent(new Event('input',{bubbles:true}));
  $('clea-ai-generate').click();
  for(let i=0;i<180;i++){
   await sleep(100);
   const w=globalThis.CLEA7LocalAIWorkspace;
   if(!w.busy){
    const proposal=w.proposal;
    if(!proposal?.validation?.passed)throw Error($('clea-ai-status').textContent||'BIL prijedlog nije potvrđen.');
    trace('Expansion Q','BIL izvor je generisan i provjeren kroz izvorni kompajler i Runtime.');
    const note=node('p','BIL kalkulator je stvarno provjeren. Pregledaj izvor prije primjene.');
    const details=node('details');details.append(node('summary','Izvor aplikacije'),node('pre',proposal.source));
    const button=node('button','Pregledao sam — primijeni u Studiju');button.type='button';
    button.onclick=async()=>{
     if(!confirm('Primijeniti ovaj provjereni BIL prijedlog na trenutni Studio projekt?'))return;
     const checked=$('clea-ai-reviewed');checked.checked=true;checked.dispatchEvent(new Event('change',{bubbles:true}));
     if($('clea-ai-apply').disabled){status('Prijedlog više nije spreman; ponovi zahtjev.');return;}
     $('clea-ai-apply').click();button.disabled=true;
     for(let n=0;n<180&&globalThis.CLEA7LocalAIWorkspace.busy;n++)await sleep(100);
     status($('clea-ai-status').textContent);
    };
    output.append(note,details,button);status('BIL prijedlog spreman za pregled.');return;
   }
  }
  throw Error('BIL provjera nije završena u ograničenom vremenu.');
 }
 async function business(output,ids){
  const API=globalThis.CLEA7Business,F=globalThis.CLEA7Format,studio=globalThis.CLEA7Workbench;
  if(!API?.modules||!API?.create||!F?.validate||!studio)throw Error('CLEA Studio ili poslovni generator nisu učitani.');
  const defs=API.modules(),selected=ids.map(id=>defs.find(m=>m.id===id));
  if(selected.some(x=>!x))throw Error('Nedostaje provjereni CLEA modul.');
  trace('Link Bridge Elite','Zahtjev je povezan s izvornim CLEA poslovnim modulima.');
  const app=F.validate(API.create({name:'Moja CLEA aplikacija',company:'Moja CLEA aplikacija',modules:selected}));
  trace('Expansion Q','Generator je napravio '+app.screens.length+' ekrana i '+Object.keys(app.flows).length+' izvršnih tokova.');
  trace('Adaptive Recovery','CLEA Format je potvrdio projektnu strukturu.');
  const summary=node('p','Prijedlog: '+selected.map(m=>m.title).join(', ')+'. '+app.screens.length+' ekrana; lokalni podaci. Projekt još nije promijenjen.');
  const details=node('details');details.append(node('summary','Pregled strukture aplikacije'),node('pre',JSON.stringify({screens:app.screens.map(s=>({id:s.id,name:s.name})),tables:app.tables,flows:Object.keys(app.flows)},null,2)));
  const download=node('button','Preuzmi prijedlog');download.type='button';download.onclick=()=>saveJSON(app);
  const apply=node('button','Otvori u Studiju i testiraj');apply.type='button';
  apply.onclick=async()=>{
   if(!confirm('Ovo zamjenjuje trenutni projekt u Studiju. Ako imaš nespremljen rad, prvo ga sačuvaj ili preuzmi kopiju. Nastaviti?'))return;
   try{
    const checked=F.validate(app);
    studio.open(checked);
    apply.disabled=true;
    const test=document.querySelector('[data-panel="test"]');test?.click();
    await studio.run();
    trace('Holo Interaction','Stvarni CLEA Runtime pokrenuo je pregled aplikacije.');
    status('Aplikacija je pokrenuta. U kartici „Pokreni i testiraj“ probaj evidencije.');
   }catch(error){status('Runtime nije završio pokretanje: '+error.message);}
  };
  output.append(summary,details,download,apply);
  status('Aplikacija je pripremljena. Pregledaj prije primjene.');
 }
 form.addEventListener('submit',async event=>{
  if(document.getElementById('clea-public-model-opt-in')?.checked||document.getElementById('clea-local-model-opt-in')?.checked)return;
  const question=input.value.trim(),intent=parse(question);
  if(!intent||toolBusy)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!question)return;
  message('Ti',question);input.value='';
  const answer=message('CLEA · provjereni alat','Pripremam provjereni prijedlog.');
  const content=answer.querySelector('div');
  toolBusy=true;$('chat-send').disabled=true;status('CLEA AI provjerava zahtjev lokalno…');
  try{
   trace('Core AI Manager','Prepoznat je podržan zadatak, izvan slobodnog razgovora.');
   content.textContent='';
   if(intent.kind==='unsupported'){
    content.textContent=intent.reason;trace('Fallback Executor','Nepodržan zahtjev je odbijen bez promjene projekta.');status(intent.reason);
   }else if(intent.kind==='calculator'){await calculator(content);}
   else await business(content,intent.modules);
  }catch(error){content.textContent=error.message;trace('Fallback Executor','Zadatak nije primijenjen: '+error.message);status(error.message);}
  finally{toolBusy=false;$('chat-send').disabled=false;}
 },true);
})();


/* One BL CLEA AI conversation: shared HP transport and an explicit local option.
 * Existing typed CLEA tools above keep their review/validation path.
 */
(function(){
 const root=document.getElementById('clea-chat'),form=document.getElementById('chat-form');
 if(!root||!form||!globalThis.CLEA7AI)return;
 const input=document.getElementById('chat-question'),submit=document.getElementById('chat-send');
 const status=document.getElementById('chat-status'),log=document.getElementById('chat-log');
 const controls=document.createElement('div');controls.className='chat-local-model-controls';
 const publicLabel=document.createElement('label'),publicCheck=document.createElement('input');publicCheck.type='checkbox';publicCheck.id='clea-public-model-opt-in';publicCheck.disabled=true;
 publicLabel.append(publicCheck,document.createTextNode(' Razgovaraj s BL CLEA AI na HP serveru'));
 const note=document.createElement('p');note.textContent='U ovom načinu šalju se samo tvoje nove poruke i do četiri prethodne razmjene iz iste sesije. Projekt i CV se ne šalju. Nema automatskog pamćenja ili treniranja.';
 const advanced=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Napredno: vlastiti lokalni servis';
 const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.id='clea-local-model-opt-in';
 label.append(check,document.createTextNode(' Koristi servis na ovom uređaju (127.0.0.1)'));advanced.append(summary,label);
 const notice=document.createElement('a');notice.href=new URL('model-licence.html',new URL('../../../',document.currentScript.src)).href;notice.textContent='Porijeklo jezičke komponente i licence';notice.target='_blank';notice.rel='noopener noreferrer';
 const feedback=document.createElement('p');feedback.id='clea-local-model-status';feedback.setAttribute('role','status');feedback.textContent='Provjeravam konfiguraciju javnog povezivanja…';
 const mount=document.createElement('div');mount.className='clea-access-challenge';mount.hidden=true;
 controls.append(publicLabel,note,advanced,notice,feedback,mount);form.append(controls);
 const client=CLEA7AI.create({challengeMount:mount,onStatus:text=>{feedback.textContent=text;status.textContent=text;}});
 const persistenceLabel=document.createElement('label'),persistence=document.createElement('input');persistence.type='checkbox';persistence.id='clea-save-conversation';
 persistenceLabel.append(persistence,document.createTextNode(' Sačuvaj historiju na ovom uređaju'));
 const persistenceNote=document.createElement('small');persistenceNote.textContent='Opcionalno: posljednje četiri razmjene ostaju u pregledniku do brisanja. Nisu šifrirane; izbjegavaj zajednički računar.';
 controls.append(persistenceLabel,persistenceNote);
 const webLabel=document.createElement('label'),webCheck=document.createElement('input');webCheck.type='checkbox';webCheck.id='clea-public-sources';webCheck.disabled=true;
 webLabel.append(webCheck,document.createTextNode(' Koristi internetske izvore za ovo pitanje'));
 const webQuery=document.createElement('input');webQuery.id='clea-web-query';webQuery.maxLength=250;webQuery.hidden=true;webQuery.setAttribute('aria-label','Pojam koji se šalje javnoj pretrazi');
 const webNote=document.createElement('small');webNote.textContent='Izbor šalje samo prikazani pojam službenom Wikipedia API-ju. Historija, CV i projekt ostaju izvan upita. Rezultat dobija link izvora.';
 webCheck.addEventListener('change',()=>{webQuery.hidden=!webCheck.checked;if(webCheck.checked){webQuery.value=input.value.trim().slice(0,250);webQuery.focus();}});
 controls.append(webLabel,webQuery,webNote);
 const projects=document.createElement('nav');projects.setAttribute('aria-label','CLEA projekti na istom servisu');
 for(const [href,title] of [['/studio/workbench/?workspace=clea-chat','Studio'],['/sense/','Sense'],['/studio/launcher/','Runtime']]){
  const a=document.createElement('a');a.href=href;a.textContent=title;projects.append(a,document.createTextNode(' · '));
 }
 controls.append(projects);
 function decorateReply(body,text){
  body.replaceChildren();let at=0;const pattern=/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  function prose(value){for(const piece of value.split(/(\*\*[^*]+\*\*)/g)){if(piece.startsWith('**')&&piece.endsWith('**')){const strong=document.createElement('strong');strong.textContent=piece.slice(2,-2);body.append(strong);}else body.append(document.createTextNode(piece));}}
  for(const match of text.matchAll(pattern)){
   prose(text.slice(at,match.index));const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=match[2];pre.append(code);body.append(pre);at=match.index+match[0].length;
   if(match[1].toLowerCase()==='bil'&&globalThis.CLEA7Core){
    const check=document.createElement('button');check.type='button';check.textContent='Provjeri BIL prijedlog';
    const result=document.createElement('p');result.setAttribute('role','status');body.append(check,result);
    check.onclick=async()=>{
     try{
      const verified=await CLEA7Intelligence.verifyBIL(match[2],{metadata:{id:'ai_proposal_'+Date.now(),name:'Moj CLEA prijedlog'},modelAvailable:true});
      result.textContent='Sedam stubova provjerilo je BIL, tipove i pokretanje u izolovanom Runtimeu. Ostale tokove treba testirati prije izvoza.';check.disabled=true;
      const download=document.createElement('button');download.type='button';download.textContent='Preuzmi provjereni .bil';
      download.onclick=()=>{const url=URL.createObjectURL(new Blob([match[2]],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='clea-ai-prijedlog.bil';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};body.append(download);
      if(globalThis.CLEA7Workbench){const open=document.createElement('button');open.type='button';open.textContent='Otvori prijedlog u Studiju';open.onclick=()=>{if(!confirm('Otvoriti pregledani prijedlog kao novi trenutni projekt? Prethodno sačuvaj nespremljen rad.'))return;CLEA7Workbench.open(verified.application);result.textContent='Prijedlog je otvoren. Pokreni ga kroz Studio kada budeš spreman.';};body.append(open);}
     }catch(error){result.textContent='BIL prijedlog nije prošao kompajler: '+error.message;}
    };
   }
  }
  prose(text.slice(at));
 }
 function ownerKnowledgeControls(){
  const details=document.createElement('details'),title=document.createElement('summary');title.textContent='Odobreno CLEA znanje na ovom računaru';
  const note=document.createElement('textarea');note.maxLength=500;note.rows=3;note.setAttribute('aria-label','Javna projektna činjenica za odobravanje');
  const warning=document.createElement('p');warning.textContent='Dodaj samo provjerenu javnu CLEA činjenicu koju smiju koristiti svi povezani CLEA klijenti. Ne unosi CV, privatne podatke ili ključeve. Ovo ne trenira neuronske težine.';
  const button=document.createElement('button');button.type='button';button.textContent='Odobri i sačuvaj projektnu činjenicu';
  const result=document.createElement('p');result.setAttribute('role','status');
  button.onclick=async()=>{button.disabled=true;try{const saved=await client.approveProjectNote(note.value);result.textContent='Sačuvano '+saved.notes.length+' odobrenih projektnih napomena. Težine modela nisu mijenjane.';note.value='';}catch(error){result.textContent=error.message;}finally{button.disabled=false;}};
  details.append(title,warning,note,button,result);controls.append(details);
  const sourceLabel=document.createElement('label'),source=document.createElement('input');source.type='url';source.maxLength=1000;sourceLabel.append(document.createTextNode('URL odobrenog izvora koji želiš ukloniti'),source);
  const remove=document.createElement('button');remove.type='button';remove.textContent='Ukloni ovaj izvor iz CLEA memorije';
  remove.onclick=async()=>{if(!source.value.trim()||!confirm('Ukloniti ovaj odobreni izvor iz lokalne CLEA baze?'))return;remove.disabled=true;try{const value=await client.removePublicSource(source.value.trim());result.textContent=value.removed?'Izvor je uklonjen iz pretrage. Težine modela nisu promijenjene.':'Ovaj URL nije bio u odobrenoj bazi.';}catch(error){result.textContent=error.message;}finally{remove.disabled=false;}};
  details.append(sourceLabel,remove);
 }
 const historyKey='clea-ai-owner-history-v1';
 function persist(){
  try{if(persistence.checked)localStorage.setItem(historyKey,JSON.stringify({schema:'clea7.browser-history/1',messages:client.history()}));else localStorage.removeItem(historyKey);}
  catch{persistence.checked=false;feedback.textContent='Preglednik nije sačuvao historiju; razgovor ostaje u ovoj sesiji.';}
 }
 function restoreSaved(){
  try{
   const raw=localStorage.getItem(historyKey);if(!raw)return;
   if(raw.length>40000)throw Error('Invalid history');const value=JSON.parse(raw);
   if(value.schema!=='clea7.browser-history/1')throw Error('Invalid history');
   const items=client.restoreHistory(value.messages);persistence.checked=true;
   if(!log.querySelector('.chat-message[data-restored]'))for(const item of items){const body=message(item.role==='user'?'Ti':'BL CLEA AI',item.content);body.parentElement.dataset.restored='true';}
  }catch{try{localStorage.removeItem(historyKey);}catch{}persistence.checked=false;}
 }
 persistence.addEventListener('change',persist);
 let active=false,loading=false,publicAvailable=false,previewMode=false,runtimeAuthentication=null;
 CLEA7AI.configuration().then(config=>{
  runtimeAuthentication=config.authentication;
  const host=CLEA7AI.isRuntimeHost(config);
  const preview=config.previewOnly&&(host||new URL(location.href).searchParams.get('clea-verify')===config.deploymentId);
  publicAvailable=Boolean(config.enabled||preview);publicCheck.disabled=!publicAvailable;
  if(host){
   previewMode=true;publicCheck.checked=true;
   if(config.executionHost==='disposable-hosted-test')publicLabel.lastChild.textContent=' Razgovaraj s BL CLEA AI';
   note.textContent=config.authentication==='desktop-loopback'?'Model radi na ovom HP-u. Ne trebaš vanjski račun, e-mail ili kôd. Zatvaranje pokretača zaustavlja servis.':config.authentication==='owner-invite'?'Privatni probni pristup. Nema vanjske prijave. Pristup koristi privremeni sigurnosni kolačić; razgovor ostaje u RAM-u.':'Zaštićena privremena proba na HP-u.';
   const badge=document.createElement('p');badge.setAttribute('role','status');badge.textContent=config.authentication==='desktop-loopback'?'MODEL NA OVOM HP-u':'PRIVATNA VREMENSKI OGRANIČENA PROBA';controls.prepend(badge);
   const scope=document.getElementById('conversation-scope');if(scope)scope.textContent=config.executionHost==='disposable-hosted-test'?'BL CLEA AI · privatna proba na testnom Windows serveru. Model se ne preuzima na tvoj telefon.':'BL CLEA AI · razgovor s modelom na povezanom računaru.';
   const intro=document.querySelector('.chat-welcome p');if(intro)intro.textContent='Pitaj o temi koja te zanima. CLEA dokumentacija se koristi za pitanja o projektu. Internetski upit uključuješ zasebno i vidiš pojam koji se šalje. Provjeri važne činjenice.';
   if(config.authentication==='desktop-loopback'){phoneShareControls();ownerKnowledgeControls();}
   activate(publicCheck);
  }
  feedback.textContent=publicCheck.disabled?'Javni HP server još nije povezan. Lokalni mali model ispod ima samo 20 CLEA tema.':preview?'Provjera javne veze · još nije potvrđena dostupnost za sve korisnike.':'HP veza je podešena. Uključi je za razgovor; ne instaliraš model.';
 }).catch(()=>{feedback.textContent='Konfiguracija HP veze nije dostupna. Nema slanja poruka serveru.';});
 async function activate(selected){
  if(loading)return;
  active=false;client.reset();
  if(!selected.checked){feedback.textContent='Slanje modelu na serveru je isključeno; njegova historija ove sesije je obrisana.';return;}
  const other=selected===check?publicCheck:check;other.checked=false;
  loading=true;submit.disabled=true;check.disabled=true;if(selected===publicCheck)publicCheck.disabled=true;
  feedback.textContent='Provjeravam BL CLEA AI servis…';
  try{client.useLocal(selected===check);await client.check();active=true;restoreSaved();webCheck.disabled=client.capabilities.publicSourceLookup!==true;document.getElementById('chat-ready').textContent='CLEA servis je spreman';feedback.textContent=['desktop-loopback','owner-invite'].includes(runtimeAuthentication)?'BL CLEA AI je spreman. Možeš razgovarati.':selected===check?'BL CLEA AI lokalni servis uključen. Šalju se samo nove poruke.':'BL CLEA AI HP servis uključen. Potvrda pristupa slijedi prije prvog pitanja.';}
  catch(error){selected.checked=false;feedback.textContent=error.message+' Poruka nije poslana modelu.';}
  finally{loading=false;submit.disabled=false;check.disabled=false;if(selected===publicCheck)publicCheck.disabled=false;}
 }
 check.addEventListener('change',()=>activate(check));publicCheck.addEventListener('change',()=>activate(publicCheck));
 function phoneShareControls(){
  const button=document.createElement('button');button.type='button';button.textContent='Otvori i na telefonu';
  const result=document.createElement('div');controls.append(button,result);
  button.addEventListener('click',async()=>{
   button.disabled=true;result.textContent='Pripremam privatni probni link. Lokalni razgovor ostaje dostupan…';
   try{
    const data=await client.startPhoneShare();result.textContent='Privatni link za telefon · privremena proba, do 45 minuta. Ne objavljuj ga javno.';
    const field=document.createElement('input');field.type='url';field.readOnly=true;field.value=data.url;field.setAttribute('aria-label','Privatni pozivni link');
    const copy=document.createElement('button');copy.type='button';copy.textContent='Kopiraj link za telefon';
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(data.url);copy.textContent='Link je kopiran';}catch{field.focus();field.select();copy.textContent='Označen link — odaberi Kopiraj';}};
    result.append(field,copy);setTimeout(()=>{copy.disabled=true;field.value='';result.append(document.createTextNode(' Proba je završena; ponovo odaberi Otvori i na telefonu za novu probu.'));},data.secondsRemaining*1000);
   }catch(error){result.textContent='Telefonska veza trenutno nije dostupna. Lokalni razgovor nastavlja raditi.';}
   finally{button.disabled=false;}
  });
 }
 function message(author,content){
  const article=document.createElement('article');article.className='chat-message '+(author==='Ti'?'user':'assistant');article.dataset.mode=check.checked?'local':'hp';
  const title=document.createElement('p');title.textContent=author;const body=document.createElement('div');body.textContent=content;article.append(title,body);log.append(article);
  for(const row of [...log.querySelectorAll('.chat-message')].slice(0,-24))row.remove();article.scrollIntoView({block:'nearest'});return body;
 }
 form.addEventListener('submit',async event=>{
  if(!active&&!loading&&!previewMode)return;
  event.preventDefault();event.stopImmediatePropagation();if(loading)return;if(previewMode&&!active){feedback.textContent='Privremena HP veza nije spremna. Odgovor nije zamijenjen lokalnim probnim modelom.';return;}
  const question=input.value.trim();if(!question)return;
  if(question.length>1200){feedback.textContent='Poruka prelazi 1200 znakova.';return;}
  loading=true;submit.disabled=true;check.disabled=true;publicCheck.disabled=true;
  document.getElementById('chat-stop').disabled=false;
  message('Ti',question);input.value='';const body=message('BL CLEA AI','Obrađujem poruku…');
  try{
   const options={onDelta:(_delta,reply)=>{body.textContent=reply;},language:document.getElementById('chat-language').value};
   if(webCheck.checked)options.webQuery=webQuery.value.trim();
   const data=await client.ask(question,options);decorateReply(body,data.reply);persist();
   if(data.sources.length){const citation=document.createElement('small');citation.textContent='Odobreni izvori: '+data.sources.map(x=>typeof x.path==='string'?x.path:'').filter(Boolean).join(', ');body.append(document.createElement('br'),citation);}
   if(data.webSources.length){
    const sources=document.createElement('div');sources.className='chat-web-sources';sources.append(document.createTextNode('Internetski izvori: '));
    for(const source of data.webSources){try{const url=new URL(source.url);if(url.protocol!=='https:'||!['en.wikipedia.org','bs.wikipedia.org'].includes(url.hostname)||url.username||url.password||url.port)continue;const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=String(source.title||'Izvor');sources.append(link,document.createTextNode(' '));
      if(runtimeAuthentication==='desktop-loopback'){const approve=document.createElement('button');approve.type='button';approve.textContent='Odobri izvor za trajno CLEA znanje';approve.onclick=async()=>{approve.disabled=true;try{await client.approvePublicSource(url.href);approve.textContent='Izvor je sačuvan na SSD-u s porijeklom';}catch(error){approve.textContent=error.message;approve.disabled=false;}};sources.append(approve);}
    }catch{}}
    body.append(sources);
   }
   if(data.internet.requested&&data.internet.status!=='retrieved'){const missing=document.createElement('small');missing.textContent=data.internet.status==='no_results'?'Javni upit nije našao odgovarajući izvor.':'Internetski izvor trenutno nije dostupan; pretraga nije uspjela.';body.append(document.createElement('br'),missing);}
   if(data.learnedSources.length){const saved=document.createElement('small');saved.textContent='Korišteno odobreno znanje na SSD-u: '+data.learnedSources.map(x=>x.title).join(', ');body.append(document.createElement('br'),saved);}
   feedback.textContent=data.transport==='hp'?'Odgovor BL CLEA AI servisa. Provjeri važne tvrdnje.':'Odgovor lokalnog servisa. Provjeri važne tvrdnje.';status.textContent=feedback.textContent;
  }catch(error){body.textContent=error.message;feedback.textContent='Nema automatskog ponavljanja niti zamjene odgovora drugim modelom.';}
  finally{submit.disabled=false;loading=false;check.disabled=false;publicCheck.disabled=!publicAvailable;document.getElementById('chat-stop').disabled=true;}
 },true);
 document.getElementById('chat-stop').addEventListener('click',()=>client.cancel());
 document.getElementById('chat-clear').addEventListener('click',()=>{client.reset();persist();});
 window.addEventListener('pagehide',()=>client.reset());
})();
