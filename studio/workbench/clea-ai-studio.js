'use strict';
/* Original CLEA AI Studio integration, by Brzo i Lokalno.
 * Proposals are local data. Only explicit reviewed application changes reach
 * the existing Studio adapter; this module never evaluates source or calls a
 * network/model service. CACI is separate from project/user-data storage.
 */
(function(scope){
const FORMAT='clea7.ai.studio/1';
const plain=value=>JSON.parse(JSON.stringify(value));
const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
const time=()=>performance.now();
const heap=()=>{const value=scope.performance?.memory?.usedJSHeapSize;return Number.isFinite(value)?value:null;};
const json=value=>JSON.stringify(value,null,2);
function attach(api){
 const d=api.root?.ownerDocument||document,$=id=>d.getElementById(id),root=api.root||$('clea-ai');
 if(!root)throw Error('CLEA AI panel nije dostupan.');
 // Static owner-authored markup only; all project/request content is rendered as text.
 root.innerHTML='<article class="clea-ai-card"><p class="eyebrow">LOKALNI EKSPERIMENT · 0.19</p><h1>CLEA AI Inspector</h1><p>Zahtjev → plan → BIL → Runtime → rezultat. Prvi tok stvara kalkulator i dodaje reset postojećem kodu. Mali naučeni klasifikator i provjereni planer nisu opći razgovorni model.</p><label for="clea-ai-request">Šta želiš napraviti?</label><textarea id="clea-ai-request" rows="3" maxlength="1200" placeholder="Create a simple calculator application."></textarea><div class="actions"><button id="clea-ai-example-create" type="button">Primjer: kalkulator</button><button id="clea-ai-example-reset" type="button">Primjer: reset</button></div><div class="clea-ai-options"><label><input id="clea-ai-cache-enabled" type="checkbox" checked> Ponovo koristi provjereni rad</label><label><input id="clea-ai-persistent" type="checkbox"> Čuvaj analizu ovog projekta na uređaju</label></div><p id="clea-ai-cache-status">Projekti se čuvaju odvojeno od cachea.</p><div class="actions"><button id="clea-ai-generate" class="primary" type="button">Pripremi i provjeri prijedlog</button><button id="clea-ai-cancel" type="button" disabled>Otkaži</button><button id="clea-ai-clear-cache" type="button">Očisti cache ovog projekta</button></div><p id="clea-ai-status" role="status" aria-live="polite"></p></article><div id="clea-ai-result" class="clea-ai-grid" hidden><article class="clea-ai-card"><h2>Stvarni plan</h2><ol id="clea-ai-plan"></ol><h3>Ekrani prijedloga</h3><div id="clea-ai-components" class="actions"></div><h3>Runtime provjera</h3><p id="clea-ai-runtime"></p><ul id="clea-ai-validation"></ul><p id="clea-ai-model"></p><details><summary>Porijeklo i granice modela</summary><pre id="clea-ai-model-details"></pre></details></article><article class="clea-ai-card"><h2>BIL izvor prijedloga</h2><p id="clea-ai-source-location"></p><textarea id="clea-ai-source" rows="18" readonly spellcheck="false" aria-label="BIL izvor CLEA AI prijedloga"></textarea><details><summary>Tačne izmjene izvora</summary><pre id="clea-ai-diff"></pre></details><label class="clea-ai-review"><input id="clea-ai-reviewed" type="checkbox"> Pregledao/la sam izvor i izmjene.</label><div class="actions"><button id="clea-ai-apply" class="primary" type="button" disabled>Primijeni i pokreni</button><button id="clea-ai-undo" type="button" disabled>Poništi AI izmjenu</button><button id="clea-ai-open-source" type="button" disabled>Otvori BIL editor</button><button id="clea-ai-export-source" type="button">Preuzmi BIL prijedlog</button></div></article><article class="clea-ai-card"><h2>Mjerenje izvršavanja</h2><dl id="clea-ai-metrics" class="clea-ai-metrics"></dl><p id="clea-ai-metric-note"></p><button id="clea-ai-compare" type="button" disabled>Ponovi bez cachea i uporedi</button><p id="clea-ai-comparison" role="status"></p></article><article class="clea-ai-card"><h2>Izvršni trag</h2><ol id="clea-ai-trace" class="clea-ai-trace"></ol></article></div>';
 const el=(tag,text)=>{const node=d.createElement(tag);if(text!==undefined)node.textContent=String(text);return node;};
 const controls=['clea-ai-generate','clea-ai-compare','clea-ai-apply','clea-ai-undo','clea-ai-open-source'];
 let cache=null,cacheKey=null,worker=null,controller=null,serial=0,proposal=null,appliedFingerprint=null,lastRun=null,busy=false,disposed=false;
 const say=text=>{$('clea-ai-status').textContent=text;};
 const unsupported=()=>!scope.CLEA7AIEngine?.create||!scope.CLEA7CACI?.create;
 function activity(stage,status,detail){const row=el('li');row.dataset.stage=String(stage||'task');row.dataset.status=String(status||'recorded');row.append(el('strong',stage||'Korak'),el('span',detail||status||''));$('clea-ai-trace').append(row);while($('clea-ai-trace').children.length>80)$('clea-ai-trace').firstChild.remove();}
 function setBusy(value){busy=value;root.setAttribute('aria-busy',String(value));$('clea-ai-cancel').disabled=!value;for(const id of controls)$(id).disabled=value||unsupported();if(!value){$('clea-ai-compare').disabled=!proposal;$('clea-ai-apply').disabled=!proposal||proposal.changed!==true||proposal.validation?.passed!==true||!$('clea-ai-reviewed').checked;$('clea-ai-undo').disabled=!appliedFingerprint||!api.canUndo();$('clea-ai-open-source').disabled=!appliedFingerprint;}}
 function invalidate(text){serial++;controller?.abort();controller=null;proposal=null;$('clea-ai-reviewed').checked=false;$('clea-ai-apply').disabled=true;$('clea-ai-compare').disabled=true;if(text)say(text);}
 function prettyBytes(value){if(!Number.isFinite(value))return 'Nije dostupno';return value<1024?Math.round(value)+' B':value<1048576?(value/1024).toFixed(1)+' KiB':(value/1048576).toFixed(2)+' MiB';}
 function metric(label,value){const item=el('div');item.append(el('dt',label),el('dd',value));$('clea-ai-metrics').append(item);}
 function drawMetrics(result,measurement){
  const m=result?.metrics||{},s=result?.cache||cache?.stats?.()||{};const rows=$('clea-ai-metrics');rows.replaceChildren();
  metric('Zahtjev do prijedloga',Number.isFinite(measurement?.elapsedMs)?measurement.elapsedMs.toFixed(2)+' ms':'Nije mjereno');
  for(const [key,label]of [['analysisMs','Analiza'],['generationMs','Generisanje'],['validationMs','Provjera u Runtimeu']])if(Number.isFinite(m[key]))metric(label,m[key].toFixed(2)+' ms');
  metric('Cache pogoci u zadatku',String(m.cacheHits??'Nije dostupno'));
  metric('Hashirani podaci',prettyBytes(m.bytesHashed));metric('Ponovo indeksirani podaci',prettyBytes(m.bytesIndexed));
  metric('Aktivni obračunati podaci',prettyBytes(m.accountedActiveBytes));
  metric('RAM cache — obračun',prettyBytes(s.memoryRetainedBytes));metric('Cache na uređaju — obračun',s.persistence==='ready'?prettyBytes(s.persistentRetainedBytes):s.persistence==='disabled'?'Isključen':'Nije dostupan');
  metric('JS heap preglednika',measurement?.heapAfter===null?'Nije dostupan':prettyBytes(measurement?.heapAfter));
  $('clea-ai-metric-note').textContent='Obračunati podaci i cache nisu ukupna RAM memorija procesa. JS heap, kada ga preglednik izloži, obuhvata cijeli preglednik/stranicu i ne mjeri samo CLEA AI.';
  $('clea-ai-cache-status').textContent=s.persistence==='ready'?'Lokalni cache je dostupan. Brisanje browser podataka može ga ukloniti.':s.persistence==='disabled'?'Ponovna upotreba je u RAM-u; trajni cache je isključen.':'Trajni cache nije dostupan; podržani rad nastavlja se bez njega.';
 }
 function drawModel(result){const m=result.model||{};const desc=scope.CLEA7LocalIntentModel?.describe?.();$('clea-ai-model').textContent=m.kind==='trained-local'?'Lokalni trenirani klasifikator namjere'+(m.version?' · '+m.version:'')+(Number.isFinite(m.confidence)?' · rezultat modela '+(m.confidence*100).toFixed(1)+'%':'')+'. Plan i kod i dalje provjeravaju pravila, kompajler i Runtime.': 'Podržani zahtjev obrađen je pravilima i gramatikom; nema tvrdnje da je cache naučeni model.';if(m.abstained)$('clea-ai-model').textContent+=' Model se suzdržao od odluke; primijenjena su dostupna provjerena pravila.';if(desc)$('clea-ai-model-details').textContent=json(desc);}
 function sourceSelection(location){const area=$('clea-ai-source'),start=Math.max(0,Math.min(area.value.length,Number(location?.start)||0)),end=Math.max(start,Math.min(area.value.length,Number(location?.end)||area.value.length));area.focus();area.setSelectionRange(start,end);const line=area.value.slice(0,start).split('\n').length;area.scrollTop=Math.max(0,(line-3)*20);$('clea-ai-source-location').textContent='Izvor prijedloga · red '+line+'. Za uređivanje primijeni prijedlog, pa otvori BIL editor.';}
 function drawComponents(result){const list=$('clea-ai-components');list.replaceChildren();const screens=result.application?.bil?.ir?.ui?.screens||[];for(const page of screens){const pick=el('button',page.label||page.id);pick.type='button';pick.dataset.screen=page.id;pick.onclick=()=>sourceSelection(page.loc);list.append(pick);}if(!screens.length)list.append(el('p','Ovaj provjereni model nema BIL ekrane za odabir.'));}
 function drawProposal(result,measurement){
  if(!result||result.format!=='clea7.ai.proposal/1'||typeof result.source!=='string'||result.source.length>131072||result.application?.bil?.source!==result.source||result.validation?.passed!==true)throw Error('Prijedlog nema potpun provjeren BIL izvor i Runtime rezultat. Projekt nije promijenjen.');
  proposal=result;lastRun=measurement;$('clea-ai-reviewed').checked=false;$('clea-ai-source').value=result.source;$('clea-ai-source-location').textContent='Pregled generisanog izvora; uređivanje ide kroz postojeći BIL editor.';
  const plan=$('clea-ai-plan');plan.replaceChildren();for(const item of result.plan||[]){const li=el('li');li.append(el('strong',item.label||item.kind||'Korak'));for(const [key,label]of [['reads','Čita'],['writes','Mijenja'],['components','Komponente']])if(item[key]?.length)li.append(el('small',label+': '+item[key].join(', ')));plan.append(li);}
  $('clea-ai-diff').textContent=json(result.changes||[]);
  const validation=$('clea-ai-validation');validation.replaceChildren();for(const check of result.validation.checks||[]){const row=el('li',(check.passed?'✓ ':'✕ ')+check.name);row.dataset.passed=String(check.passed===true);validation.append(row);}
  $('clea-ai-runtime').textContent=result.validation.runtime||'Provjereni CLEA Runtime';
  for(const event of result.trace||[])activity(event.stage,event.status,event.detail);
  drawMetrics(result,measurement);drawModel(result);drawComponents(result);
  $('clea-ai-result').hidden=false;say(result.changed?'Prijedlog je provjeren. Pregledaj kod i izmjene; trenutni projekt još nije promijenjen.':'Zahtjev ne traži novu izmjenu. Postojeći kod je sačuvan.');setBusy(false);
 }
 function dropCache(){cache?.close();cache=null;worker=null;cacheKey=null;}
 async function context(project){
  if(unsupported())throw Error('Lokalni CLEA AI modul nije učitan.');
  const key=String(project.id)+'|'+$('clea-ai-cache-enabled').checked+'|'+$('clea-ai-persistent').checked;
  if(key!==cacheKey){dropCache();cacheKey=key;cache=scope.CLEA7CACI.create({scope:'studio:'+project.id,memoryBytes:262144,persistentBytes:$('clea-ai-persistent').checked?2097152:0,storage:$('clea-ai-persistent').checked?undefined:false,enabled:$('clea-ai-cache-enabled').checked});await cache.ready;worker=scope.CLEA7AIEngine.create({cache});}
  return worker;
 }
 async function generate(compare=false){
  if(disposed||busy)return;const request=$('clea-ai-request').value.trim();if(!request){say('Napiši podržani zahtjev prije pokretanja.');$('clea-ai-request').focus();return;}
  const beforeProposal=proposal,token=++serial;controller=new AbortController();const signal=controller.signal;setBusy(true);$('clea-ai-trace').replaceChildren();$('clea-ai-comparison').textContent='';activity('Zahtjev','started',compare?'Izvršava se poređenje bez ponovne upotrebe.':'Pokrenut je lokalni zahtjev.');say('Obrada i stvarna provjera su u toku. Projekt se ne mijenja.');
  const beforeHeap=heap(),started=time();
  try{
   const project=api.project(),runtime=await context(project);if(signal.aborted||token!==serial)return;
   const result=await runtime.propose({request,project,signal,cacheEnabled:compare?false:$('clea-ai-cache-enabled').checked});
   if(signal.aborted||token!==serial)return;const measurement={elapsedMs:Math.max(0,time()-started),heapBefore:beforeHeap,heapAfter:heap()};
   if(compare){
    if(!beforeProposal)throw Error('Prvo pripremi prijedlog s kojim se može napraviti poređenje.');
    if(!(await runtime.matchesBase(beforeProposal,api.project())))throw Error('Projekt se promijenio; pripremi novi prijedlog prije poređenja.');
    const equal=result.source===beforeProposal.source&&scope.CLEA7.stable(result.application)===scope.CLEA7.stable(beforeProposal.application);
    $('clea-ai-comparison').textContent=(equal?'Isti BIL izvor i aplikacijski model.':'Rezultati se razlikuju; prijedlog nije zamijenjen.')+' Prethodni zahtjev: '+(lastRun?.elapsedMs?.toFixed(2)||'—')+' ms; bez cachea: '+measurement.elapsedMs.toFixed(2)+' ms. Ovo je jedno lokalno mjerenje, bez garancije općeg ubrzanja.';
    $('clea-ai-comparison').dataset.equal=String(equal);activity('Poređenje',equal?'passed':'different','Izvor i aplikacijski model su stvarno upoređeni.');drawMetrics(result,measurement);proposal=beforeProposal;say(equal?'Poređenje je završeno bez promjene projekta.':'Poređenje se razlikuje; provjeri dijagnostiku prije nastavka.');
   }else drawProposal(result,measurement);
  }catch(error){if(signal.aborted||error?.name==='AbortError'){activity('Zadatak','cancelled','Obrada je otkazana. Projekt nije promijenjen.');say('Obrada je otkazana.');}else{activity('Greška','failed',error?.message||'Lokalna obrada nije završena.');say(error?.message||'Lokalna obrada nije završena.');if(!compare){proposal=null;$('clea-ai-reviewed').checked=false;}}}
  finally{if(token===serial){controller=null;setBusy(false);}}
 }
 $('clea-ai-generate').onclick=()=>generate(false);$('clea-ai-compare').onclick=()=>generate(true);
 $('clea-ai-cancel').onclick=()=>{if(!busy)return;controller?.abort();say('Zatraženo je otkazivanje; čeka se prekid podržanog koraka.');};
 $('clea-ai-reviewed').onchange=()=>setBusy(busy);
 $('clea-ai-apply').onclick=async()=>{
  if(busy||!proposal||!$('clea-ai-reviewed').checked)return;const current=proposal;setBusy(true);say('Provjera trenutnog projekta prije primjene…');
  try{
   const snapshot=api.project(),runtime=await context(snapshot);if(!await runtime.matchesBase(current,snapshot))throw Error('Projekt ili BIL skica su promijenjeni. Pripremi novi prijedlog; postojeći kod nije prepisan.');
   if(proposal!==current)throw Error('Prijedlog je promijenjen prije primjene.');
   api.apply(current.application,snapshot);appliedFingerprint=await runtime.fingerprint(api.project());
   activity('Primjena','completed','Odobreni prijedlog primijenjen je kroz postojeću Studio historiju.');say('Odobrena izmjena je primijenjena. Pokreće se postojeći Runtime.');await api.run();
  }catch(error){say(error.message);activity('Primjena','failed',error.message);}
  finally{setBusy(false);}
 };
 $('clea-ai-undo').onclick=async()=>{if(busy||!appliedFingerprint)return;try{const snapshot=api.project(),runtime=await context(snapshot);if(await runtime.fingerprint(snapshot)!==appliedFingerprint)throw Error('Nakon primjene je napravljen novi rad. Koristi uobičajeno Poništi za pregled historije; CLEA AI ga neće preskočiti.');api.undo();appliedFingerprint=null;invalidate('Vraćen je prethodni projekt kroz Studio historiju.');setBusy(false);}catch(error){say(error.message);}};
 $('clea-ai-open-source').onclick=()=>{try{api.showSource(proposal?.application?.bil?.ir?.ui?.screens?.[0]?.loc);}catch(error){say(error.message);}};
 for(const [id,text]of [['clea-ai-example-create','Create a simple calculator application.'],['clea-ai-example-reset','Add a reset button.']])$(id).onclick=()=>{$('clea-ai-request').value=text;invalidate('Primjer je upisan. Pripremi prijedlog kada želiš pokrenuti obradu.');setBusy(false);};
 $('clea-ai-request').addEventListener('input',()=>{if(busy)controller?.abort();proposal=null;$('clea-ai-reviewed').checked=false;if(!busy)setBusy(false);});
 for(const id of ['clea-ai-cache-enabled','clea-ai-persistent'])$(id).onchange=()=>{invalidate('Postavka cachea je promijenjena. Projekt ostaje sačuvan; pripremi novi prijedlog.');dropCache();setBusy(false);};
 $('clea-ai-clear-cache').onclick=async()=>{
  if(busy)return;setBusy(true);try{const project=api.project();await context(project);let result=await cache.clear({persistent:true});if(!$('clea-ai-persistent').checked){const temporary=scope.CLEA7CACI.create({scope:'studio:'+project.id,memoryBytes:0,persistentBytes:2097152,enabled:true});try{await temporary.ready;result=await temporary.clear({persistent:true});}finally{temporary.close();}}invalidate(result.persistentCleared?'Cache ovog projekta je očišćen. Projekt i korisnički podaci nisu obrisani.':'RAM cache je očišćen; trajni cache nije dostupan za potvrđeno brisanje. Projekt nije obrisan.');activity('Cache','cleared','Brisanje je ograničeno na CACI prostor ovog projekta.');drawMetrics(null,{heapAfter:heap()});}catch(error){say(error.message);}finally{setBusy(false);}};
 $('clea-ai-export-source').onclick=()=>{if(!proposal)return;const url=URL.createObjectURL(new Blob([proposal.source],{type:'text/plain;charset=utf-8'})),link=el('a');link.href=url;link.download='clea-ai-proposal.bil';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const model=scope.CLEA7LocalIntentModel?.describe?.();$('clea-ai-model-details').textContent=model?json(model):'Lokalni model nije dostupan. Podržana pravila mogu raditi bez njega.';
 setBusy(false);say(unsupported()?'Lokalni modul nije učitan.':'Spremno za lokalni eksperiment. Za prvi dokaz podržani su kalkulator i dodavanje reset dugmeta.');
 function close(){if(disposed)return;disposed=true;invalidate();dropCache();}
 scope.addEventListener?.('beforeunload',close,{once:true});
 const workspace={FORMAT,get proposal(){return proposal?plain(proposal):null;},get busy(){return busy;},get cacheStats(){return cache?.stats?.()||null;},get measurement(){return lastRun?plain(lastRun):null;},refresh(){if(!busy)setBusy(false);},close};
 return Object.freeze(workspace);
}
scope.CLEA7AIStudio=Object.freeze({FORMAT,attach});
})(globalThis);
