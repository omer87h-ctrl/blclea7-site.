/* Original Sense event vocabulary. A vibration is a cue, not a replacement
 * for document content, hearing, sight or an assistive technology assessment. */
(function(scope){'use strict';
const patterns=Object.freeze({select:Object.freeze([25]),review:Object.freeze([45,75,45]),confirm:Object.freeze([100]),error:Object.freeze([90,80,30]),complete:Object.freeze([35,60,35,60,100])});
const labels=Object.freeze({select:'Odabrano',review:'Nalaz čeka tvoj pregled',confirm:'Promjena prihvaćena',error:'Radnja traži pažnju',complete:'Radnja pripremljena'});
function pattern(kind){if(!Object.hasOwn(patterns,kind))throw Error('Nepoznat Sense signal.');return [...patterns[kind]];}
scope.CLEA7SenseFeedback=Object.freeze({version:1,pattern,labels});
if(typeof document==='undefined')return;
let enabled=false,last=0,timer=null;
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const settings=document.querySelector('#settings-dialog .settings-grid');if(!settings)return;
const group=make('section');group.className='sense-feedback-settings';
const title=make('h3','Signali koje biraš'),label=make('label'),toggle=make('input');toggle.type='checkbox';toggle.id='feedback-haptics';
label.append(toggle,document.createTextNode(' Taktilni signali u ovoj sesiji'));
const note=make('p','Vibracija, ako je podržana, označava događaj. Sadržaj ostaje dostupan tekstom i čitačem ekrana.');note.id='feedback-support';note.className='field-help';
const test=make('button','Isprobaj signal potvrde');test.type='button';test.className='button secondary';test.id='feedback-test';test.disabled=true;
group.append(title,label,note,test);settings.after(group);
const legend=make('details');legend.className='sense-signal-legend';const legendTitle=make('summary','Značenje signala');legend.append(legendTitle);
for(const [kind,text]of Object.entries(labels)){const p=make('p',text+' · '+({select:'jedan kratak impuls',review:'dva kratka impulsa',confirm:'jedan duži impuls',error:'duži pa kratak impuls',complete:'dva kratka pa duži impuls'}[kind]));legend.append(p);}group.append(legend);
const shortcuts=make('div');shortcuts.className='sense-project-shortcuts';
for(const [id,title]of [['load-local','Otvori sačuvani rad'],['import-project-button','Uvezi svoj projekt']]){const b=make('button',title);b.type='button';b.className='quiet-button';b.addEventListener('click',()=>{document.body.classList.add('sense-entered');document.getElementById(id)?.click();});shortcuts.append(b);}
document.querySelector('#sense-spatial-host .spatial-footer')?.after(shortcuts);
const experience=make('button','Način doživljaja');experience.type='button';experience.className='spatial-mode';experience.id='sense-experience';experience.addEventListener('click',()=>document.getElementById('settings-open')?.click());document.querySelector('#sense-spatial-host .spatial-heading')?.append(experience);
const hud=make('div');hud.id='sense-feedback';hud.className='sense-feedback';hud.hidden=true;hud.setAttribute('aria-hidden','true');
const glyph=make('span'),caption=make('span');hud.append(glyph,caption);document.body.append(hud);
function stop(){if(timer)clearTimeout(timer);timer=null;hud.hidden=true;if(enabled&&typeof navigator.vibrate==='function')try{navigator.vibrate(0);}catch{}}
function emit(kind,{testOnly=false}={}){
 if(!Object.hasOwn(patterns,kind)||document.hidden||document.body.dataset.tactilePlaying==='true')return;
 const now=performance.now();if(kind==='select'&&!testOnly&&now-last<180)return;last=now;
 if(timer)clearTimeout(timer);hud.hidden=false;hud.dataset.signal=kind;glyph.textContent=({select:'◇',review:'?',confirm:'✓',error:'!',complete:'✓✓'})[kind];caption.textContent=labels[kind];
 timer=setTimeout(()=>{hud.hidden=true;timer=null;},2200);
 if(enabled){try{const accepted=navigator.vibrate(pattern(kind));if(!accepted){enabled=false;toggle.checked=false;test.disabled=true;note.textContent='Preglednik nije prihvatio vibraciju. Tekstualni i vizuelni signali ostaju dostupni.';}else if(testOnly)note.textContent='Preglednik je prihvatio zahtjev. Ako ne osjetiš vibraciju, uređaj ili njegove postavke je možda ne podržavaju.';}catch{enabled=false;toggle.checked=false;test.disabled=true;note.textContent='Vibracija nije dostupna u ovom okruženju. Koristi tekstualne i vizuelne signale.';}}
 }
 if(typeof navigator.vibrate!=='function'){toggle.disabled=true;note.textContent='Ovaj preglednik ne nudi vibraciju. Sve radnje ostaju dostupne tekstom i vizuelno.';}
 toggle.addEventListener('change',()=>{enabled=toggle.checked&&typeof navigator.vibrate==='function';test.disabled=!enabled;if(!enabled)stop();else note.textContent='Taktilni signali su uključeni samo za ovu sesiju. Isprobaj signal na svom uređaju.';});
 test.addEventListener('click',()=>{scope.dispatchEvent(new CustomEvent('sense:feedback',{detail:{kind:'confirm',testOnly:true}}));});
 scope.addEventListener('sense:feedback',event=>emit(event.detail?.kind,{testOnly:event.detail?.testOnly===true}));
 document.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target||target.disabled)return;
  if(target.closest('#primary-nav')||['demo','analyze','spatial-review','load-local','import-project-button'].includes(target.id))document.body.classList.add('sense-entered');
  if(target.id!=='feedback-test'&&!target.closest('.requirement-actions'))scope.dispatchEvent(new CustomEvent('sense:feedback',{detail:{kind:'select'}}));
 },true);
 document.addEventListener('focusin',event=>{if(event.target.matches('#cv-text,#job-text,#draft-text,#scenario-cv'))document.body.classList.add('sense-entered');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});scope.addEventListener('pagehide',stop);scope.addEventListener('sense:erase',()=>{stop();enabled=false;toggle.checked=false;test.disabled=true;});
})(globalThis);
