/* Original CLEA Auto finite recording interface. Graphs use actual recorded
 * timestamps and decoded values; unavailable samples remain visible gaps. */
import {OBD_PROFILES,scanOBDCapabilities} from './diagnostics.js';
import {getDeviceAccess} from './device-access.js';
import {hasNativeOBD} from './native-obd.js';
import {hasNativeFiles,openNativeText,saveTextFile} from './native-files.js';
import {AUTO_SERIES_COMMANDS,AutoSeriesVault,recordAutoSeries,validateAutoSeriesRecord} from './auto-series.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Number.isFinite(value)?new Intl.NumberFormat('bs-BA',{maximumFractionDigits:3}).format(value):'—';
const channels=[['010C','Obrtaji motora'],['0142','Napon upravljačkog modula'],['0104','Opterećenje motora'],['010B','Pritisak usisa'],['0110','Protok zraka'],['0106','Kratkoročna korekcija goriva · banka 1'],['0107','Dugoročna korekcija goriva · banka 1'],['011F','Vrijeme rada motora'],['0105','Temperatura rashladne tečnosti'],['010F','Temperatura usisnog zraka'],['0111','Položaj zaklopke'],['012F','Nivo goriva'],['0146','Temperatura okoline'],['010D','Brzina vozila']];
const statuses={available:'Očitano',unavailable:'Nije dostupno',failed:'Neuspjelo očitanje'};
const reasons={completed:'Planirani broj ciklusa je završen.',cancelled:'Snimanje je zaustavljeno; završena očitanja su zadržana.',timeout:'Vremenska granica je dostignuta; završena očitanja su zadržana.',disconnected:'Veza je prekinuta; završena očitanja su zadržana.'};
const fault=message=>Object.assign(new Error(message),{name:'AbortError'});

/** Pure bounded graph preparation. A failed sample of this exact command
 * separates line segments; another command is simply a different stream. */
export function buildSeriesGraphData(samples,{startedAt,completedAt}={}){
 if(!Array.isArray(samples)||samples.length>90)throw Error('Grafikon prihvata najviše 90 stvarnih očitanja.');
 const times=samples.map(s=>Date.parse(s?.capturedAt)).filter(Number.isFinite);
 const start=Number.isFinite(Date.parse(startedAt))?Date.parse(startedAt):Math.min(...times);
 const end=Number.isFinite(Date.parse(completedAt))?Date.parse(completedAt):Math.max(...times);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return[];
 const keys=new Map();
 for(const sample of samples){
  if(sample?.status!=='available'||typeof sample.command!=='string'||!Array.isArray(sample.values))continue;
  for(const v of sample.values.slice(0,2))if(v&&typeof v.id==='string'&&typeof v.unit==='string'&&typeof v.label==='string'&&Number.isFinite(v.value)){
   const key=JSON.stringify([sample.command,v.id,v.unit]);if(!keys.has(key))keys.set(key,{command:sample.command,id:v.id,unit:v.unit,label:v.label});
  }
 }
 return [...keys.values()].map(channel=>{
  const segments=[];let current=[];
  const breakLine=()=>{if(current.length)segments.push(current);current=[];};
  for(const sample of samples){
   if(sample.command!==channel.command)continue;
   const t=Date.parse(sample.capturedAt),v=sample.status==='available'&&sample.values?.find(v=>v.id===channel.id&&v.unit===channel.unit);
   if(!v||!Number.isFinite(v.value)||!Number.isFinite(t)||t<start||t>end){breakLine();continue;}
   current.push({seconds:(t-start)/1000,value:v.value,capturedAt:sample.capturedAt});
  }
  breakLine();const points=segments.flat();
  return {...channel,start,end,durationSeconds:(end-start)/1000,segments,points};
 }).filter(channel=>channel.points.length);
}

export function renderSeriesCharts(record){
 const graphs=buildSeriesGraphData(record.samples||[],record);
 if(!graphs.length)return '<p>Još nema potvrđenog numeričkog uzorka. Nema zamjenskih vrijednosti.</p>';
 return graphs.map(g=>{
  const values=g.points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values);
  const pad=min===max?Math.max(1,Math.abs(min)*.05):(max-min)*.08,lo=min-pad,hi=max+pad;
  const duration=Math.max(g.durationSeconds,1),x=t=>56+t/duration*500,y=v=>155-(v-lo)/(hi-lo)*125;
  const paths=g.segments.filter(s=>s.length>1).map(segment=>`<polyline points="${segment.map(p=>`${x(p.seconds).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ')}"/>`).join('');
  const dots=g.points.map(p=>`<circle cx="${x(p.seconds).toFixed(2)}" cy="${y(p.value).toFixed(2)}" r="3"><title>${esc(fmt(p.value))} ${esc(g.unit)} · ${esc(p.capturedAt)}</title></circle>`).join('');
  return `<article class="auto-series-chart"><h4>${esc(g.label)} <small>${esc(g.command)} · ${esc(g.unit)}</small></h4><p class="auto-series-y-range">Osa Y: ${esc(fmt(lo))}–${esc(fmt(hi))} ${esc(g.unit)}</p><svg viewBox="0 0 600 165" role="img" aria-label="${esc(g.label)} kroz vrijeme, ${g.points.length} stvarnih uzoraka"><title>${esc(g.label)} · stvarna vremena očitanja; prekidi predstavljaju neuspjela očitanja</title><path class="auto-series-axis" d="M56 25V155H565"/><g class="auto-series-line">${paths}${dots}</g></svg><div class="auto-series-time-axis"><span>0 s</span><span>${esc(fmt(g.durationSeconds))} s</span></div><p class="auto-series-axis-caption">Osa X: vrijeme od početka snimanja</p><p>${g.points.length} očitanja · minimum ${esc(fmt(min))} ${esc(g.unit)} · maksimum ${esc(fmt(max))} ${esc(g.unit)}. Raspon osi izveden je iz uzoraka, nije granica ispravnosti.</p></article>`;
 }).join('');
}

export class AutoSeriesWorkbench{
 constructor(el,{createBridge,onBusyChange=()=>{},canStart=()=>true}={}){
  if(!el||typeof createBridge!=='function')throw Error('Snimanje zahtijeva radni prostor i tvornicu provjerene veze.');
  this.el=el;this.createBridge=createBridge;this.onBusyChange=onBusyChange;this.canStart=canStart;this.active=false;this.recording=false;this.fileBusy=false;this.externalBusy=false;this.generation=0;this.fileGeneration=0;this.result=null;this.bridge=null;this.preview=[];this.vault=new AutoSeriesVault();this.confirmDelete=null;
  this.click=e=>{const b=e.target.closest('[data-series-action]');if(b&&this.el.contains(b))this.action(b.dataset.seriesAction,b).catch(error=>this.status(error.message,true));};
  this.change=e=>{if(e.target.matches('[data-series-file]'))this.importFile(e.target).catch(error=>this.status(error.message,true));else this.controls();};
  this.visibility=()=>{if(document.hidden&&this.recording)this.stop('Snimanje je zaustavljeno jer aplikacija više nije u prvom planu.');};
  this.el.addEventListener('click',this.click);this.el.addEventListener('change',this.change);document.addEventListener('visibilitychange',this.visibility);
 }
 get busy(){return this.recording||this.fileBusy;}
 q(selector){return this.el.querySelector(selector);}
 setExternalBusy(value){this.externalBusy=!!value;this.controls();}
 activate(){this.active=true;this.el.hidden=false;if(!this.rendered)this.render();if(!this.recording&&this.result)this.renderResult();this.renderHistory();this.controls();}
 refresh(){if(!this.rendered)return;this.renderHistory();this.controls();}
 deactivate(){this.active=false;this.el.hidden=true;this.stop('Snimanje je zaustavljeno pri izlasku iz radnog prostora.');this.cancelFiles();}
 render(){
  this.rendered=true;this.el.classList.add('auto-advanced','auto-series-panel');
  const supported=new Set(AUTO_SERIES_COMMANDS);
  this.el.innerHTML=`<header><p class="eyebrow">CLEA AUTO / SNIMANJE</p><h2>Posmatrajte promjene kroz stvarne uzorke.</h2><p>Odaberite do tri parametra i pokrenite konačno snimanje na parkiranom vozilu. Vrijeme svake tačke dolazi iz stvarnog odgovora; nedostupna očitanja ostaju prekidi.</p></header><div class="auto-advanced-grid"><section class="auto-advanced-card"><h3>1. Veza i plan</h3><label class="field"><span>Profil adaptera</span><select data-series-profile>${hasNativeOBD()?'<option value="native">Android · Bluetooth Classic SPP</option>':''}${OBD_PROFILES.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}<option value="serial">ELM · USB / serijski port</option><option value="spp">ELM · Bluetooth Classic SPP / desktop</option></select></label><p class="help" data-series-access></p><fieldset class="auto-series-channels"><legend>Parametri · najviše tri</legend>${channels.filter(([id])=>supported.has(id)).map(([id,label],i)=>`<label class="device-consent"><input type="checkbox" value="${id}" data-series-command ${i<2?'checked':''}><span>${esc(label)} <small>${id}</small></span></label>`).join('')}</fieldset><div class="auto-advanced-grid"><label class="field"><span>Razmak između ciklusa</span><select data-series-interval><option value="1000">Najmanje 1 sekunda</option><option value="2000" selected>Najmanje 2 sekunde</option><option value="5000">Najmanje 5 sekundi</option></select></label><label class="field"><span>Broj ciklusa</span><select data-series-cycles><option value="2">2 ciklusa</option><option value="5">5 ciklusa</option><option value="10" selected>10 ciklusa</option><option value="20">20 ciklusa</option><option value="30">30 ciklusa</option></select></label></div><p class="help">Najviše 120 sekundi i 90 pojedinačnih očitanja. Parametri se čitaju uzastopno. Brzina odgovora zavisi od vozila i adaptera.</p><label class="device-consent"><input type="checkbox" data-series-stationary><span>Vozilo je parkirano. Uslovi su sigurni za ovaj pregled i tokom snimanja ne vozim.</span></label><div class="toolbar"><button class="button primary" data-series-action="start">Poveži i snimaj</button><button class="button secondary" data-series-action="stop" disabled>Zaustavi snimanje</button></div><p class="auto-advanced-status" role="status" aria-live="polite" data-series-status>Još nema snimanja. Nijedan uređaj nije automatski povezan.</p></section><section class="auto-advanced-card"><h3>2. Uzorci i grafikoni</h3><div data-series-result><p>Pokrenite snimanje ili otvorite svoj raniji zapis. Nema oglednih očitanja.</p></div><div class="toolbar"><button class="button secondary" data-series-action="save" disabled>Sačuvaj snimanje lokalno</button><button class="button secondary" data-series-action="export" disabled>Preuzmi snimanje</button><button class="button secondary" data-series-action="delete" disabled>Izbriši iz historije</button></div></section></div><section class="auto-advanced-card auto-advanced-history"><h3>Moja snimanja</h3><p data-series-storage></p><div class="toolbar"><button class="button secondary" data-series-action="import">Uvezi snimanje</button></div><div data-series-history></div><input type="file" accept=".json,application/json" data-series-file hidden></section>`;
  this.renderHistory();this.controls();
 }
 access(profile){return profile==='native'?{canRequest:hasNativeOBD(),reason:'Za ovu vezu otvorite instaliranu CLEA Auto Android aplikaciju.'}:getDeviceAccess(['serial','spp'].includes(profile)?'serial':'ble');}
 controls(){
  if(!this.rendered)return;const blocked=this.busy||this.externalBusy||!this.canStart(),profile=this.q('[data-series-profile]').value,access=this.access(profile),selected=[...this.el.querySelectorAll('[data-series-command]:checked')];
  this.q('[data-series-access]').textContent=access.canRequest?'Prvo se provjerava ELM veza i stvarna podrška vozila. Šalju se samo potvrđeni podržani parametri.':access.reason;
  for(const n of this.el.querySelectorAll('[data-series-profile],[data-series-command],[data-series-interval],[data-series-cycles],[data-series-stationary]'))n.disabled=blocked;
  this.q('[data-series-action="start"]').disabled=blocked||!this.canStart()||!access.canRequest||!this.q('[data-series-stationary]').checked||selected.length<1||selected.length>3;
  this.q('[data-series-action="stop"]').disabled=!this.recording;
  for(const a of ['save','export'])this.q(`[data-series-action="${a}"]`).disabled=blocked||!this.result;
  this.q('[data-series-action="delete"]').disabled=blocked||!this.result||!this.vault.list().some(r=>r.id===this.result.id);
  this.q('[data-series-action="import"]').disabled=blocked;
  for(const b of this.el.querySelectorAll('[data-series-action="load"]'))b.disabled=blocked;
 }
 status(message,error=false){const n=this.q('[data-series-status]');if(n){n.textContent=message||'Postupak nije završen.';n.classList.toggle('error',!!error);}}
 notify(){this.onBusyChange(this.busy);this.controls();}
 stop(message='Snimanje je zaustavljeno; završena očitanja će ostati prikazana.'){
  if(!this.recording)return;this.stopMessage=message;this.controller?.abort();this.bridge?.disconnect();this.status(message);
 }
 async start(){
  if(!this.active||this.busy||this.externalBusy||!this.canStart())return;
  const selected=[...this.el.querySelectorAll('[data-series-command]:checked')].map(n=>n.value);
  if(!this.q('[data-series-stationary]').checked||selected.length<1||selected.length>3)throw Error('Potvrdite parkirano vozilo i odaberite od jednog do tri parametra.');
  const profile=this.q('[data-series-profile]').value,access=this.access(profile);if(!access.canRequest)throw Error(access.reason);
  const generation=++this.generation,controller=new AbortController();
  const bridge=this.createBridge({profile,onStatus:s=>{if(generation===this.generation&&this.active)this.status(s?.message||'Provjera veze…');}});
  this.controller=controller;this.bridge=bridge;this.recording=true;this.stopMessage=null;this.preview=[];this.notify();
  let rejectConnection;const interrupted=new Promise((_,reject)=>{rejectConnection=reject;});
  const abort=()=>{bridge.disconnect();rejectConnection(fault(this.stopMessage||'Snimanje je zaustavljeno.'));};controller.signal.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>{this.stopMessage='Izbor i povezivanje adaptera nisu završeni u dozvoljenih 90 sekundi.';controller.abort();},90000);
  try{
   this.status('Odaberite adapter. Nakon potvrde veze čitam stvarnu mapu mogućnosti…');
   const device=await Promise.race([bridge.connect(),interrupted]);clearTimeout(timer);
   if(controller.signal.aborted)throw fault(this.stopMessage||'Snimanje je zaustavljeno.');
   const capabilities=await scanOBDCapabilities(bridge,{signal:controller.signal});
   if(controller.signal.aborted)throw fault(this.stopMessage||'Snimanje je zaustavljeno.');
   const commands=selected.filter(command=>capabilities.discovery.supportedPids.includes(command));
   if(!commands.length)throw Error('Vozilo nije prijavilo nijedan od odabranih parametara. Nije pokrenuto snimanje.');
   const missing=selected.filter(command=>!commands.includes(command));
   this.previewStartedAt=new Date().toISOString();
   this.status(`Snimam ${commands.length} podržanih parametara.${missing.length?' Nisu poslani nepodržani: '+missing.join(', ')+'.':''}`);
   const record=await recordAutoSeries(bridge,{capabilities,device,commands,signal:controller.signal,intervalMs:Number(this.q('[data-series-interval]').value),maxCycles:Number(this.q('[data-series-cycles]').value),maxDurationMs:120000,onSample:sample=>{
    if(generation!==this.generation)return;this.preview.push(sample);
    if(this.active){this.renderPreview();this.status(`Primljeno ${this.preview.length} očitanja. Snimanje je ograničeno i može se zaustaviti.`);}
   }});
   if(generation!==this.generation)return;
   this.result=validateAutoSeriesRecord(record);this.confirmDelete=null;
   if(this.active){this.renderResult();this.status(reasons[record.completion.reason]||'Snimanje je završeno.');}
  }catch(error){if(generation===this.generation&&this.active)this.status(error.message||'Snimanje nije završeno.',error.name!=='AbortError');}
  finally{
   clearTimeout(timer);controller.signal.removeEventListener('abort',abort);bridge.disconnect();
   if(generation===this.generation){this.bridge=null;this.controller=null;this.recording=false;this.q('[data-series-stationary]').checked=false;this.notify();if(this.active&&this.result)this.renderResult();}
  }
 }
 renderPreview(){
  const now=this.preview.at(-1)?.capturedAt||this.previewStartedAt;
  this.q('[data-series-result]').innerHTML=`<p class="eyebrow">SNIMANJE U TOKU · ${this.preview.length} OČITANJA</p><div class="auto-series-charts">${renderSeriesCharts({samples:this.preview,startedAt:this.previewStartedAt,completedAt:now})}</div><p>Preuzimanje je dostupno nakon završetka ili zaustavljanja snimanja.</p>`;
 }
 renderResult(){
  if(!this.result||!this.rendered)return;const r=this.result,available=r.samples.filter(s=>s.status==='available').length,elapsed=(Date.parse(r.completedAt)-Date.parse(r.startedAt))/1000;
  this.q('[data-series-result]').innerHTML=`<p class="eyebrow">${esc(r.device.name)} · ${r.origin==='imported'?'UVEZENI ZAPIS':'ZAPIS SNIMANJA'}${r.testOnly?' · TESTNI PODACI':''}</p><p>${esc(r.startedAt)} → ${esc(r.completedAt)}</p><div class="auto-advanced-metrics"><div class="auto-advanced-metric"><strong>${r.completion.cyclesCompleted} / ${r.settings.maxCycles}</strong><span>Završeni ciklusi</span></div><div class="auto-advanced-metric"><strong>${available} / ${r.samples.length}</strong><span>Valjana očitanja</span></div><div class="auto-advanced-metric"><strong>${esc(fmt(elapsed))} s</strong><span>Zabilježeno trajanje</span></div></div><p>${esc(reasons[r.completion.reason]||r.completion.reason)}</p><div class="auto-series-charts">${renderSeriesCharts(r)}</div><details><summary>Svaki uzorak i status</summary><div class="auto-advanced-table-wrap"><table class="auto-advanced-table"><thead><tr><th scope="col">Ciklus</th><th scope="col">Parametar</th><th scope="col">Vrijeme</th><th scope="col">Rezultat</th></tr></thead><tbody>${r.samples.map(s=>`<tr><td>${s.cycle+1}</td><td>${esc(s.command)}</td><td>${esc(s.capturedAt)}</td><td>${s.status==='available'?s.values.map(v=>`${esc(v.label)}: ${esc(fmt(v.value))} ${esc(v.unit)}`).join('<br>'):`${esc(statuses[s.status]||s.status)} · ${esc(s.reason||'Nema potvrđenog rezultata.')}`}</td></tr>`).join('')}</tbody></table></div></details><details><summary>Izvorni odgovori i cijeli zapis</summary><pre>${esc(JSON.stringify(r,null,2))}</pre></details><p class="help">Snimci pokazuju šta je tada očitano. Promjena ili mirna linija sami ne potvrđuju kvar, kvalitet popravke ili ispravnost vozila.</p>`;
  this.q('[data-series-action="delete"]').textContent=this.confirmDelete===r.id?'Potvrdi brisanje snimanja':'Izbriši iz historije';this.controls();
 }
 renderHistory(){if(!this.rendered)return;this.q('[data-series-storage]').textContent=this.vault.getPersistenceStatus().message;this.q('[data-series-history]').innerHTML=this.vault.list().map(r=>`<button class="auto-advanced-history-row" data-series-action="load" data-series-id="${esc(r.id)}"><strong>${esc(r.device.name)}</strong><span>${esc(r.startedAt)} · ${r.samples.length} očitanja · ${esc(r.completion.reason)}</span><small>${r.origin==='imported'?'Uvezen zapis':'Sačuvan zapis'}</small></button>`).join('')||'<p>Još nema sačuvanih snimanja. Sačuvajte ili izvezite završeni zapis prije zatvaranja.</p>';}
 cancelFiles(){++this.fileGeneration;this.fileController?.abort();this.fileController=null;this.fileBusy=false;this.notify();}
 async fileOperation(task){
  if(!this.active||this.busy||this.externalBusy||!this.canStart())return;const generation=++this.fileGeneration,controller=this.fileController=new AbortController();this.fileBusy=true;this.notify();const current=()=>this.active&&generation===this.fileGeneration&&!controller.signal.aborted;
  try{await task({signal:controller.signal,current});}catch(error){if(current())this.status(error.message||'Datoteka nije potvrđena.',true);}finally{if(generation===this.fileGeneration){this.fileBusy=false;this.fileController=null;this.notify();}}
 }
 applyImport(text){this.result=this.vault.import(text);this.confirmDelete=null;this.renderResult();this.renderHistory();this.status('Otvoren je provjeren uvezeni zapis. Nije pokrenuta veza ni novo snimanje.');}
 async importFile(input){const file=input.files?.[0];input.value='';if(!file)return;return this.fileOperation(async({current})=>{if(file.size>1048576)throw Error('Snimanje premašuje 1 MiB.');const text=await file.text();if(current())this.applyImport(text);});}
 async action(action,b){
  if(action==='stop')return this.stop();if(action==='start')return this.start();if(this.busy||this.externalBusy||!this.canStart())return;
  if(action==='import'){if(hasNativeFiles())return this.fileOperation(async({signal,current})=>{const f=await openNativeText('json',{signal});if(current())this.applyImport(f.text);});this.q('[data-series-file]').click();return;}
  if(action==='load'){const record=this.vault.list().find(r=>r.id===b.dataset.seriesId);if(!record)throw Error('Sačuvano snimanje nije pronađeno.');this.result=validateAutoSeriesRecord(record);this.confirmDelete=null;this.renderResult();this.status('Otvoren je raniji zapis. Uređaj nije povezan i nova očitanja nisu pokrenuta.');return;}
  if(!this.result)return;
  if(action==='save'){this.vault.save(this.result);this.renderHistory();this.controls();const p=this.vault.getPersistenceStatus();this.status(p.available?'Snimanje je sačuvano lokalno.':p.message,!p.available);}
  if(action==='export')return this.fileOperation(async({signal,current})=>{const saved=await saveTextFile('clea-auto-snimanje.json',JSON.stringify(validateAutoSeriesRecord(this.result)),'application/json',{signal});if(current())this.status(saved.native?'Android je potvrdio izvoz odabrane datoteke.':'Preuzimanje snimanja je pokrenuto; provjerite preuzimanja preglednika.');});
  if(action==='delete'){if(this.confirmDelete!==this.result.id){this.confirmDelete=this.result.id;b.textContent='Potvrdi brisanje snimanja';this.status('Ponovnim pritiskom brišete lokalno sačuvan zapis. Izvezene kopije ostaju na vašem uređaju.');return;}this.vault.remove(this.result.id);this.result=null;this.confirmDelete=null;this.q('[data-series-result]').innerHTML='<p>Zapis je uklonjen iz radnog prikaza.</p>';b.textContent='Izbriši iz historije';this.renderHistory();this.controls();const p=this.vault.getPersistenceStatus();this.status(p.available?'Snimanje je uklonjeno iz lokalne historije.':p.message,!p.available);}
 }
 destroy(){this.deactivate();++this.generation;this.el.removeEventListener('click',this.click);this.el.removeEventListener('change',this.change);document.removeEventListener('visibilitychange',this.visibility);}
}
