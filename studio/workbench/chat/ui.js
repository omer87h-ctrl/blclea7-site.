'use strict';
/* Original Studio conversation panel. All conversation data uses text nodes. */
(function(scope){
const root=document.getElementById('clea-chat');if(!root)return;
root.innerHTML='<div class="clea-chat-shell"><section class="clea-chat-room"><header class="clea-chat-heading"><div><p class="eyebrow">BRZO I LOKALNO · VLASTITI MODEL</p><h1>Razgovaraj s CLEA</h1><p>Testni razgovorni model za CLEA teme. Generisanje se izvršava na tvom uređaju.</p></div><span id="chat-ready" role="status">Model nije učitan</span></header><div id="chat-log" role="log" aria-label="Razgovor s CLEA" aria-live="polite" aria-relevant="additions"><article class="chat-welcome"><h2>Jedan razgovor. Sedam stvarnih odgovornosti.</h2><p>Pitaj kako rade BIL, Runtime, Studio, SDK ili sedam stubova. Model ima početno znanje o CLEA platformi; za druga područja jasno kaže da nema provjeren odgovor.</p><div class="chat-examples"><button type="button" data-chat-question="Objasni sedam stubova.">Kako radi sedam stubova?</button><button type="button" data-chat-question="Šta je BIL?">Objasni BIL</button><button type="button" data-chat-question="Kako radi CACI?">Šta pamti cache?</button><button type="button" data-chat-question="Koliko je 23 * 4?">Provjereni proračun</button></div></article></div><form id="chat-form"><label for="chat-question">Tvoje pitanje</label><textarea id="chat-question" maxlength="1200" rows="3" placeholder="Šta CLEA Runtime stvarno radi?"></textarea><div class="chat-composer-actions"><label for="chat-language">Jezik odgovora<select id="chat-language"><option value="bs">Bosanski</option><option value="en">English</option></select></label><button id="chat-send" type="submit" class="primary">Pošalji</button><button id="chat-stop" type="button" disabled>Zaustavi</button></div><p id="chat-status" role="status" aria-live="polite">Razgovor ostaje u ovoj sesiji. Nema AI API-ja ni automatskog treniranja na tvojim porukama.</p></form></section><aside class="clea-chat-inspector"><div class="chat-model-card"><p class="eyebrow">CLEA RUNTIME · 7</p><h2>Sedam stubova</h2><div id="chat-pillars"></div></div><div class="chat-model-card"><h2>Vlastito jezgro razgovora</h2><p id="chat-model-info">Model je dio aplikacije. Ne biraš niti ručno instaliraš tuđe težine.</p><p class="chat-scope">Početno znanje: 20 CLEA tema. Ovo nije opći model s internetskim znanjem.</p><button id="chat-retry" type="button">Učitaj / provjeri model</button><label class="chat-cache-option"><input id="chat-cache" type="checkbox" checked> Ponovo koristi provjerene odgovore</label><button id="chat-clear-cache" type="button">Očisti razgovorni cache</button><button id="chat-clear" type="button">Obriši ovaj razgovor</button><details><summary>Stvarno izvršavanje i privatnost</summary><p>Tekst poruke ne ide serveru za obradu. Datoteke vlastitog modela učitavaju se s ove stranice. Odgovor modela provjerava se prema podržanoj temi; rezervni odgovor je posebno označen. Historija je u RAM-u ove sesije. Zadržava se najnovijih 12 razmjena; ništa se ne čuva trajno.</p><p id="chat-memory"></p><ol id="chat-events"></ol></details></div></aside></div>';
const $=id=>document.getElementById(id),node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
let busy=false,loaded=false,loading=false,disposed=false,turn=0;
const status=text=>{$('chat-status').textContent=text;};
const names=scope.CLEA7.PILLARS.map(x=>x[0]),cards=new Map();
for(const [index,name]of names.entries()){const card=node('div');card.className='chat-pillar';card.append(node('span',String(index+1)),node('strong',name),node('small','Spremno za stvarni zadatak'));$('chat-pillars').append(card);cards.set(name,card);}
function controls(){for(const id of ['chat-send','chat-question','chat-language','chat-clear-cache'])$(id).disabled=busy||loading;$('chat-stop').disabled=!busy&&!loading;$('chat-retry').disabled=busy||loading;}
function event(item){if(item.pillar==='Holo Interaction'&&item.state==='committed')$('chat-ready').textContent='Vlastiti model je provjeren · lokalno';const card=cards.get(item.pillar);if(card){card.dataset.state=item.state;card.querySelector('small').textContent=item.detail;}const li=node('li');li.append(node('strong',item.pillar),node('span',item.detail));if(Object.keys(item.metrics||{}).length)li.append(node('code',JSON.stringify(item.metrics)));$('chat-events').prepend(li);while($('chat-events').children.length>40)$('chat-events').lastChild.remove();}
const runtime=scope.CLEA7Chat.create({onEvent:event,onLoading:progress=>{$('chat-ready').textContent='Učitavanje vlastitog modela: '+Math.round(progress.bytes/1024)+' / '+Math.round(progress.total/1024)+' KiB';}});scope.CLEA7ChatWorkspace=runtime;
function memory(){const stats=runtime.cacheStats;$('chat-memory').textContent='Obračunati RAM cache: '+stats.memoryRetainedBytes+' / '+stats.memoryBudgetBytes+' bajtova. To nije ukupna RAM potrošnja modela ili preglednika. Trajno čuvanje razgovora je isključeno.';}
async function initialize(){if(loaded||loading||disposed)return;loading=true;controls();try{const info=await runtime.initialize();if(disposed)return;loaded=true;$('chat-ready').textContent='Vlastiti model je provjeren · lokalno';$('chat-model-info').textContent=info.parameterCount.toLocaleString('bs-BA')+' naučenih parametara · '+Math.round(info.weightBytes/1024)+' KiB težina · CPU izvršavanje u radniku. Bez tuđih težina i bez inference servera.';status('Model je spreman. Postavi pitanje o CLEA platformi.');memory();}catch(error){$('chat-ready').textContent='Model nije pokrenut';status(error.message);}finally{loading=false;controls();}}
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
    const button=node('button','Pregledao sam — primijeni u Studiom');button.type='button';
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
  const apply=node('button','Otvori u Studiom i testiraj');apply.type='button';
  apply.onclick=async()=>{
   if(!confirm('Ovo zamjenjuje trenutni projekt u Studiom. Ako imaš nespremljen rad, prvo ga sačuvaj ili preuzmi kopiju. Nastaviti?'))return;
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


/* BL CLEA AI: opt-in locally served Apache-2.0 language component.
 * It is not a separate assistant, does not auto-send older chats, and never
 * transmits CV data or projects. Only opted-in messages go to 127.0.0.1.
 */
(function(){
 const root=document.getElementById('clea-chat'),form=document.getElementById('chat-form');
 if(!root||!form)return;
 const input=document.getElementById('chat-question'),submit=document.getElementById('chat-send');
 const status=document.getElementById('chat-status'),log=document.getElementById('chat-log');
 const controls=document.createElement('div');controls.className='chat-local-model-controls';
 const label=document.createElement('label');
 const check=document.createElement('input');check.type='checkbox';check.id='clea-local-model-opt-in';
 label.append(check,document.createTextNode(' Koristi lokalni jezički model BL CLEA AI (samo ovaj uređaj)'));
 const note=document.createElement('p');
 note.textContent='Opcionalno: razgovor s lokalnim Qwen3.5-0.8B modelom (Apache 2.0). Tek nakon uključivanja šalju se tvoje nove poruke lokalnom CLEA servisu; bez cloud API-ja. BIL i alati ostaju CLEA. Na telefonu nije dostupan ako model radi na HP-u.';
 const notice=document.createElement('a');notice.href='../../model-licence.html';notice.textContent='Porijeklo modela i obaveze licence';notice.target='_blank';notice.rel='noopener noreferrer';
 const feedback=document.createElement('p');feedback.id='clea-local-model-status';feedback.setAttribute('role','status');feedback.textContent='Podrazumijevano: izvorni mali CLEA model, bez lokalnog Qwen servisa.';
 controls.append(label,note,notice,feedback);form.append(controls);
 const endpoint='http://127.0.0.1:8765';
 let active=false,loading=false,history=[];
 check.addEventListener('change',async()=>{
  active=false;history=[];
  if(!check.checked){feedback.textContent='Izvorni CLEA model je aktivan. Lokalna istorija Qwen razgovora je odbačena.';return;}
  feedback.textContent='Provjeravam lokalni CLEA servis na ovom uređaju…';
  try{
   const reply=await fetch(endpoint+'/health',{cache:'no-store',signal:AbortSignal.timeout(4000)});
   if(!reply.ok)throw Error('Lokalni servis nije dostupan.');
   const data=await reply.json();
   if(data.brand!=='BL CLEA AI'||data.ready!==true)throw Error('Lokalna baza znanja još nije spremna.');
   active=true;feedback.textContent='BL CLEA AI lokalni jezički model uključen. Poruke se šalju samo lokalnom servisu.';
  }catch(error){check.checked=false;feedback.textContent='Lokalni CLEA servis nije pokrenut na ovom uređaju. Izvorni model ostaje dostupan.';}
 });
 function message(author,content){
  const article=document.createElement('article');
  article.className='chat-message '+(author==='Ti'?'user':'assistant');
  article.dataset.mode='local';
  const title=document.createElement('p');title.textContent=author;
  const body=document.createElement('div');body.textContent=content;
  article.append(title,body);log.append(article);
  article.scrollIntoView({block:'nearest'});return body;
 }
 form.addEventListener('submit',async event=>{
  if(!active||loading)return;
  const question=input.value.trim();
  if(!question)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(question.length>1200){feedback.textContent='Poruka prelazi 1200 znakova.';return;}
  loading=true;submit.disabled=true;
  message('Ti',question);input.value='';
  const body=message('BL CLEA AI · lokalni model','Obrađujem poruku…');
  feedback.textContent='Lokalni model odgovara; razgovor nije poslan na cloud.';
  try{
   const response=await fetch(endpoint+'/chat',{
    method:'POST',mode:'cors',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({question,history:history.slice(-8)}),
    signal:AbortSignal.timeout(100000)
   });
   const data=await response.json();
   if(!response.ok||typeof data.reply!=='string')throw Error(data.error||'Lokalni model nije vratio odgovor.');
   body.textContent=data.reply;
   if(Array.isArray(data.sources)&&data.sources.length){
    const citation=document.createElement('small');
    citation.textContent='Lokalni izvori: '+data.sources.map(x=>x.path).join(', ');
    body.append(document.createElement('br'),citation);
   }
   history.push({role:'user',content:question},{role:'assistant',content:data.reply.slice(0,1200)});
   history=history.slice(-8);
   feedback.textContent='Odgovor iz lokalnog modela uz CLEA bazu i ograničenja sedam stubova.';
  }catch(error){body.textContent='Lokalni model nije odgovorio: '+error.message;feedback.textContent='Zahtjev nije uspio; ništa nije pohranjeno u istoriju.';}
  finally{submit.disabled=false;loading=false;}
 },true);
})();
