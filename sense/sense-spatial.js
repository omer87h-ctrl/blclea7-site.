/* Original BL CLEA Sense spatial workspace. Presentation of existing results,
 * never a second analyzer. No user text, sensors, uploads or external assets. */
(function(scope){'use strict';
if(typeof document==='undefined')return;
const workspace=document.getElementById('view-workspace');if(!workspace)return;
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
let host=document.getElementById('sense-spatial-host');
if(!host){host=make('section');host.id='sense-spatial-host';const grid=workspace.querySelector('.input-grid');workspace.insertBefore(host,grid||workspace.firstChild);}
host.classList.add('sense-spatial');host.setAttribute('aria-label','Prostorni pregled tvoje prijave');
const heading=make('div','spatial-heading'),brand=make('div','spatial-wordmark');brand.append(make('span','spatial-brand-mark','7'),make('span','','SENSE'));
const mode=make('button','spatial-mode','Ravni prikaz');mode.id='spatial-mode';mode.type='button';mode.setAttribute('aria-pressed','false');mode.setAttribute('aria-label','Uključi ravni prikaz radnog prostora');heading.append(brand,mode);
const stage=make('div','spatial-stage');stage.setAttribute('aria-hidden','true');
stage.append(make('div','spatial-aura aura-a'),make('div','spatial-aura aura-b'),make('div','spatial-grid'));
const desk=make('div','spatial-desk');desk.append(make('div','spatial-route route-a'),make('div','spatial-route route-b'),make('div','spatial-platform'));
function documentCard(cls,title,kind){
 const holder=make('div','spatial-object '+cls),shadow=make('div','spatial-object-shadow');holder.append(shadow);
 const card=make('div','spatial-paper '+kind);card.append(make('div','spatial-paper-edge'),make('div','spatial-paper-back'));
 const face=make('div','spatial-paper-face'),top=make('div','spatial-paper-top');top.append(make('span','spatial-paper-symbol',kind==='source-paper'?'A':'B'),make('span','spatial-paper-title',title));face.append(top);
 if(kind==='source-paper'){face.append(make('div','spatial-avatar'));const lines=make('div','spatial-profile-lines');for(let i=0;i<3;i++)lines.append(make('i'));face.append(lines);}
 for(let i=0;i<4;i++){const row=make('div','spatial-evidence-line evidence-'+i);row.append(make('span','spatial-evidence-dot'),make('i'),make('i'));face.append(row);}
 const bottom=make('div','spatial-paper-bottom');bottom.append(make('span','spatial-mini-mark'),make('span','',kind==='source-paper'?'TVOJI NAVODI':'TVOJA ODLUKA'));face.append(bottom);card.append(face);holder.append(card);return holder;
}
const source=documentCard('spatial-source','Tvoj CV','source-paper'),result=documentCard('spatial-result','Tvoja prijava','result-paper');
const core=make('div','spatial-core'),coreBase=make('div','spatial-core-base');coreBase.append(make('span'),make('span'),make('span'));
const coreBody=make('div','spatial-core-body');coreBody.append(make('div','spatial-core-back'),make('div','spatial-core-side'),make('div','spatial-core-top'));
const coreFace=make('div','spatial-core-face');coreFace.append(make('span','spatial-core-glyph','7'),make('span','spatial-core-label','CLEA'));coreBody.append(coreFace);core.append(coreBase,coreBody);
const sourceTag=make('div','spatial-object-caption source-caption','Tvoj izvor'),coreTag=make('div','spatial-object-caption core-caption','Provjera'),resultTag=make('div','spatial-object-caption result-caption','Tvoj izbor');
const evidence=make('div','spatial-evidence-chip');evidence.append(make('span','spatial-chip-dot'),make('span','','Povezani izvori'));
desk.append(source,core,result,evidence);stage.append(desk,sourceTag,coreTag,resultTag);
const footer=make('div','spatial-footer'),copy=make('div','spatial-copy'),title=make('h2','spatial-title','Tvoj korak. Tvoj dokaz.'),status=make('p','spatial-status','Dodaj CV i oglas. Sense će povezati zahtjeve s tvojim navodima.');status.id='spatial-status';
copy.append(title,status);const review=make('button','spatial-review','Počni od svog CV-a');review.type='button';review.id='spatial-review';review.addEventListener('click',()=>{if(host.classList.contains('spatial-has-result')){document.querySelector('#primary-nav [data-view="review"]')?.click();const target=document.querySelector('#view-review h2');if(target){target.tabIndex=-1;target.focus({preventScroll:true});}}else document.getElementById('cv-text')?.focus();});footer.append(copy,review);
const metrics=make('div','spatial-metrics');metrics.id='spatial-metrics';metrics.hidden=true;
const metricValues=[];for(const label of ['Potvrđeno','Obavezno za pregled','Za tvoju potvrdu']){const item=make('div','spatial-metric');const value=make('strong','','—');item.append(value,make('span','',label));metrics.append(item);metricValues.push(value);}
host.append(heading,stage,footer,metrics);
function flat(value){host.classList.toggle('spatial-flat',value);document.body.classList.toggle('sense-flat',value);mode.setAttribute('aria-pressed',String(value));mode.textContent=value?'Prostorni prikaz':'Ravni prikaz';mode.setAttribute('aria-label',value?'Uključi prostorni prikaz radnog prostora':'Uključi ravni prikaz radnog prostora');}
try{flat(localStorage.getItem('blclea.sense.cv.space/1')==='flat');}catch(_){flat(false);}
mode.addEventListener('click',()=>{const next=!host.classList.contains('spatial-flat');flat(next);try{localStorage.setItem('blclea.sense.cv.space/1',next?'flat':'spatial');}catch(_){/* View preference is optional; private work is unaffected. */}});
function update(){
 const summary=document.getElementById('summary'),values=summary?Array.from(summary.querySelectorAll('.summary-card strong')).map(e=>e.textContent.trim()):[];
 const available=values.length>=3;review.textContent=available?'Pregledaj nalaze':'Počni od svog CV-a';metrics.hidden=!available;host.classList.toggle('spatial-has-result',available);
 if(available){for(let i=0;i<3;i++)metricValues[i].textContent=values[i];title.textContent='Pronađeno nije isto što i potvrđeno.';status.textContent='Otvori nalaze. Ti provjeravaš izvor i odlučuješ šta je tačno.';}
 else{title.textContent='Tvoj korak. Tvoj dokaz.';status.textContent='Dodaj CV i oglas. Sense će povezati zahtjeve s tvojim navodima.';}
}
const summary=document.getElementById('summary');if(summary)new MutationObserver(update).observe(summary,{childList:true,subtree:true,characterData:true});
update();scope.CLEA7SenseSpatial=Object.freeze({refresh:update,format:'sense.spatial/1'});
})(globalThis);
