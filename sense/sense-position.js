/* BL CLEA Sense browser-position navigator — original implementation.
 * Describes real DOM focus and viewport geometry. This is not a screen reader,
 * OS cursor tracker, touch interceptor or physical-screen coordinate system.
 * The map moves focus only. It never activates an application operation.
 */
(function(scope){'use strict';
const freeze=Object.freeze,finite=Number.isFinite,clean=value=>typeof value==='string'?value.replace(/[↶↷⌄■◇✓]/g,'').replace(/\s+/g,' ').trim().slice(0,180):'';
const rounded=value=>Math.round(value*100)/100;
function describeRect(rect,viewport){
 const invalid=()=>freeze({status:'unavailable',sentence:'Položaj u vidljivom prozoru trenutno nije dostupan.'});
 if(!rect||!viewport)return invalid();
 const l=rect.left,t=rect.top,r=rect.right!==undefined?rect.right:l+rect.width,b=rect.bottom!==undefined?rect.bottom:t+rect.height;
 const vl=viewport.left!==undefined?viewport.left:viewport.offsetLeft!==undefined?viewport.offsetLeft:0,vt=viewport.top!==undefined?viewport.top:viewport.offsetTop!==undefined?viewport.offsetTop:0;
 const vw=viewport.width,vh=viewport.height;
 if(![l,t,r,b,vl,vt,vw,vh].every(finite)||r<=l||b<=t||vw<=0||vh<=0)return invalid();
 const vr=vl+vw,vb=vt+vh;if(!finite(vr)||!finite(vb))return invalid();const il=Math.max(l,vl),it=Math.max(t,vt),ir=Math.min(r,vr),ib=Math.min(b,vb);
 const bounds=freeze({left:rounded(l),top:rounded(t),right:rounded(r),bottom:rounded(b)}),frame=freeze({left:rounded(vl),top:rounded(vt),width:rounded(vw),height:rounded(vh)});
 if(ir<=il||ib<=it){
  const directions=[];if(b<=vt)directions.push('iznad');else if(t>=vb)directions.push('ispod');if(r<=vl)directions.push('lijevo od');else if(l>=vr)directions.push('desno od');
  return freeze({status:'offscreen',bounds,viewport:frame,directions:freeze(directions),sentence:'Kontrola je '+(directions.join(' i ')||'izvan')+' vidljivog prozora. Navigacija je može dovesti u prikaz.'});
 }
 const x=((il+ir)/2-vl)/vw,y=((it+ib)/2-vt)/vh,horizontal=x<1/3?'left':x>2/3?'right':'center',vertical=y<1/3?'top':y>2/3?'bottom':'middle';
 const names={top:{left:'u gornjem lijevom dijelu',center:'u gornjem središnjem dijelu',right:'u gornjem desnom dijelu'},middle:{left:'u sredini lijevo',center:'u sredini',right:'u sredini desno'},bottom:{left:'u donjem lijevom dijelu',center:'u donjem središnjem dijelu',right:'u donjem desnom dijelu'}};
 const partial=l<vl||t<vt||r>vr||b>vb;
 return freeze({status:partial?'partial':'visible',horizontal,vertical,bounds,viewport:frame,visibleBounds:freeze({left:rounded(il),top:rounded(it),right:rounded(ir),bottom:rounded(ib)}),centerPercent:freeze({x:rounded(x*100),y:rounded(y*100)}),sentence:'Položaj: '+names[vertical][horizontal]+' vidljivog prozora'+(partial?'; dio elementa je izvan prikaza':'')+'.'});
}
scope.CLEA7SensePosition=freeze({format:'sense.position/1',describeRect});
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),panel=$('sense-guide-panel');if(!panel||$('sense-position-tools'))return;
const selectors='button,input:not([type=hidden]),textarea,select,a[href],summary,[tabindex]:not([tabindex="-1"])';
const own=node=>!!(node?.nodeType===1?node:node?.parentElement)?.closest?.('#sense-guide-panel,#sense-guide-launch,.sense-dialog-guide,.sense-position-dialog-tools');
function rendered(node){
 if(!node||!node.isConnected||node.closest('[hidden],[inert],[aria-hidden="true"]'))return false;
 const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||style.opacity==='0'||!node.getClientRects().length)return false;
 for(let ancestor=node.parentElement;ancestor;ancestor=ancestor.parentElement){
  if(ancestor.tagName==='DETAILS'&&!ancestor.open){const summary=[...ancestor.children].find(child=>child.tagName==='SUMMARY');if(!summary?.contains(node))return false;}
 }
 return true;
}
function allowed(node){return rendered(node)&&!own(node)&&!node.matches(':disabled,[aria-disabled="true"]')&&node.tabIndex>=0;}
function controls(){
 const dialog=document.querySelector('dialog[open]');
 return [...(dialog||document).querySelectorAll(selectors)].filter(node=>allowed(node)&&(!dialog||dialog.contains(node)));
}
function name(node){
 if(!node)return '';
 const direct=node.getAttribute('aria-label');if(direct)return clean(direct);
 const labelled=node.getAttribute('aria-labelledby');if(labelled){const result=clean(labelled.split(/\s+/).map(id=>$(id)?.textContent||'').join(' '));if(result)return result;}
 if(node.labels?.length)return clean([...node.labels].map(label=>label.textContent).join(' '));
 if(node.matches('button,a,summary,h1,h2,h3,h4,h5,h6'))return clean(node.textContent);
 return clean(node.getAttribute('title'))||'Kontrola bez naziva';
}
function region(node){
 const host=node?.closest?.('dialog,nav,section[aria-labelledby],section[aria-label],aside[aria-label],header,footer,main');
 if(!host)return 'Radni prostor';
 const labelled=host.getAttribute('aria-labelledby');if(labelled){const label=clean(labelled.split(/\s+/).map(id=>$(id)?.textContent||'').join(' '));if(label)return label;}
 const explicit=clean(host.getAttribute('aria-label'));if(explicit)return explicit;
 return ({NAV:'Glavna navigacija',HEADER:'Gornje kontrole',FOOTER:'Pomoć i brisanje',MAIN:'Radni prostor'})[host.tagName]||'Radni prostor';
}
function role(node){
 if(node.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file])'))return 'polje za unos';
 if(node.matches('input[type=checkbox]'))return 'prekidač';if(node.matches('input[type=radio]'))return 'izbor';if(node.matches('input[type=range]'))return 'podesiva vrijednost';
 if(node.matches('input[type=file]'))return 'odabir datoteke';if(node.matches('select'))return 'lista opcija';if(node.matches('a'))return 'veza';
 if(node.matches('summary'))return 'otvori ili zatvori detalje';if(node.matches('h1,h2,h3,h4,h5,h6'))return 'naslov';if(node.matches('button'))return 'dugme';return 'tekst za čitanje';
}
function elementState(node){
 const parts=[];if(node.matches(':disabled,[aria-disabled="true"]'))parts.push('nije dostupno');
 if(node.matches('input[type=checkbox],input[type=radio]'))parts.push(node.checked?'uključeno':'isključeno');
 const expanded=node.matches('summary')?String(!!node.parentElement?.open):node.getAttribute('aria-expanded');if(expanded==='true')parts.push('otvoreno');else if(expanded==='false')parts.push('zatvoreno');
 const pressed=node.getAttribute('aria-pressed');if(pressed==='true')parts.push('pritisnuto');else if(pressed==='false')parts.push('nije pritisnuto');else if(pressed==='mixed')parts.push('djelimično pritisnuto');
 if(node.hasAttribute('aria-current')&&node.getAttribute('aria-current')!=='false')parts.push('trenutni dio');if(node.getAttribute('aria-invalid')==='true')parts.push('potrebna je ispravka');if(node.required||node.getAttribute('aria-required')==='true')parts.push('obavezno');if(node.readOnly)parts.push('samo za čitanje');
 return parts.join(', ');
}
function groupName(node){const host=node.closest('article[aria-labelledby],article[aria-label],fieldset,[role=group]');if(!host)return '';const labelled=host.getAttribute('aria-labelledby');return clean(host.getAttribute('aria-label'))||clean(labelled?labelled.split(/\s+/).map(id=>$(id)?.textContent||'').join(' '):host.querySelector('legend')?.textContent||'');}
function viewport(){const v=scope.visualViewport;return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight};}
function describeElement(node,list){
 if(!rendered(node))return null;
 list=Array.isArray(list)?list:controls();const index=list.indexOf(node),label=name(node),kind=role(node),state=elementState(node),area=region(node),group=groupName(node),geometry=describeRect(node.getBoundingClientRect(),viewport());
 const order=index>=0?index+1:null,total=list.length;
 const sentence=area+'. '+(group?'Grupa: '+group+'. ':'')+label+' — '+kind+(state?', '+state:'')+'. '+(order?'Kontrola '+order+' od '+total+' dostupnih. ':'')+geometry.sentence;
 return freeze({id:node.id||null,label,role:kind,state,region:area,group,order,total,geometry,sentence});
}
const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const ui=make('section');ui.id='sense-position-tools';ui.setAttribute('aria-label','Položaj i mapa ekrana');
const heading=make('h3','Položaj i mapa ekrana');
const intro=make('p','Prati označenu kontrolu u ovom prozoru. Mapa samo pomjera fokus; radnju potvrđuješ sam. Za TalkBack koristi i uobičajeno istraživanje dodirom.');intro.className='sense-position-help';
const buttons=make('div');buttons.className='sense-position-buttons';
function button(id,text,fn){const node=make('button',text);node.type='button';node.id=id;node.addEventListener('click',fn);buttons.append(node);return node;}
const where=button('sense-position-current','Gdje sam?',()=>refresh(true));
const previous=button('sense-position-prev','Prethodna kontrola',()=>step(-1));
const next=button('sense-position-next','Sljedeća kontrola',()=>step(1));
const toggle=button('sense-position-map-toggle','Mapa ekrana',()=>{map.hidden=!map.hidden;toggle.setAttribute('aria-expanded',String(!map.hidden));if(!map.hidden)renderMap();});toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','sense-position-map');
// The shared guide caption is the one live announcement channel. This second
// visual copy is a note, avoiding duplicate speech in a system screen reader.
const output=make('p','Odaberi kontrolu da dobiješ njen naziv, svrhu i položaj.');output.id='sense-position-description';output.setAttribute('role','note');
const map=make('div');map.id='sense-position-map';map.hidden=true;const mapNote=make('p'),mapList=make('ol'),mapMore=make('button','Prikaži još kontrola');mapMore.type='button';mapMore.id='sense-position-map-more';mapMore.addEventListener('click',()=>{mapLimit+=240;mapKey='';renderMap();});mapNote.className='sense-position-help';map.append(mapNote,mapList,mapMore);
ui.append(heading,intro,buttons,output,map);const settings=$('sense-guide-settings');if(settings)settings.before(ui);else panel.append(ui);
const style=make('style');style.textContent='#sense-position-tools{border-top:1px solid #58737b;margin-top:18px;padding-top:14px}#sense-position-tools h3{font-size:1rem;margin:0 0 10px}.sense-position-help{font-size:.875rem;line-height:1.6;color:inherit}.sense-position-buttons{display:flex;flex-wrap:wrap;gap:8px}.sense-position-buttons button{flex:1 1 140px;min-height:44px;padding:10px;border-radius:10px;background:#1c414e;color:#f0faf8;border:1px solid #78969c;font-size:.875rem}#sense-position-description{font-size:.9375rem;line-height:1.6}#sense-position-map ol{padding-left:24px;max-height:40svh;overflow:auto}#sense-position-map li{padding:3px 0}#sense-position-map button{display:block;width:100%;min-height:44px;text-align:left;padding:8px;white-space:normal;overflow-wrap:anywhere;border:1px solid #58737b;border-radius:8px;background:#142f3b;color:#f0faf8;font-size:.875rem}#sense-position-tools button:focus-visible{outline:3px solid #f2c27d;outline-offset:3px}body.high-contrast #sense-position-tools button{background:#000;color:#fff;border:2px solid #fff}@media print{#sense-position-tools{display:none}}';document.head.append(style);
let focused=null,lastSnapshot=null,frame=null,lastKey='',mapKey='',erasing=false,mapLimit=240;
let nextIdentity=1;const nodeIdentities=new WeakMap();function identity(node){if(!nodeIdentities.has(node))nodeIdentities.set(node,nextIdentity++);return nodeIdentities.get(node);}
const empty=()=>freeze({id:null,label:'',role:'',state:'',region:'Radni prostor',order:null,total:controls().length,geometry:null,sentence:'Trenutno nije označena kontrola aplikacije. Izaberi sljedeću kontrolu ili otvori mapu ekrana.'});
function current(){return lastSnapshot||empty();}
function adjacentIndex(list,delta){
 const index=list.indexOf(focused);if(index>=0)return index+delta;
 // Context headings deliberately have tabindex=-1. From such a heading,
 // continue in document order instead of unexpectedly jumping to the header.
 if(focused?.isConnected){
  if(delta>0)return list.findIndex(node=>!!(focused.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING));
  for(let i=list.length-1;i>=0;i--)if(focused.compareDocumentPosition(list[i])&Node.DOCUMENT_POSITION_PRECEDING)return i;
  return -1;
 }
 return delta>0?0:list.length-1;
}
function renderMap(){
 if(map.hidden)return;const list=controls(),key=mapLimit+'|'+list.map(node=>identity(node)+'|'+(node.id||'')+'|'+name(node)+'|'+region(node)+'|'+elementState(node)).join('\n');if(key===mapKey)return;mapKey=key;
 const active=document.activeElement,activeIndex=active.closest?.('#sense-position-map li')?.dataset.positionIndex;
 mapNote.textContent=list.length+' dostupnih kontrola u '+(document.querySelector('dialog[open]')?'otvorenom prozoru':'trenutnom prikazu')+'. '+(list.length>mapLimit?'Prikazano je prvih '+mapLimit+'; izaberi Prikaži još kontrola za nastavak. Tab i prethodna/sljedeća kontrola već obilaze sve. ':'')+'Izbor označava kontrolu i dovodi je u prikaz; ne pokreće njenu radnju.';mapMore.hidden=list.length<=mapLimit;
 const items=list.slice(0,mapLimit).map((node,index)=>{const item=make('li');item.dataset.positionIndex=String(index);const state=elementState(node),control=make('button',(index+1)+'. '+name(node)+' — '+region(node)+(state?' ('+state+')':''));control.type='button';control.addEventListener('click',()=>focusNode(node));item.append(control);return item;});mapList.replaceChildren(...items);
 if(activeIndex!==undefined)mapList.querySelector('li[data-position-index="'+activeIndex+'"] button')?.focus();
}
function refresh(explicit=false){
 if(frame!==null){cancelAnimationFrame(frame);frame=null;}
 if(focused&&!rendered(focused))focused=null;
 const dialog=document.querySelector('dialog[open]');if(dialog&&focused&&!dialog.contains(focused))focused=null;
 lastSnapshot=focused?describeElement(focused):empty();
 const description=lastSnapshot||empty(),key=JSON.stringify(description);if(explicit||key!==lastKey){lastKey=key;output.textContent=description.sentence;scope.dispatchEvent(new CustomEvent('sense:position',{detail:freeze({description,explicit:!!explicit})}));}
 const list=controls(),before=adjacentIndex(list,-1),after=adjacentIndex(list,1);previous.disabled=before<0||before>=list.length;next.disabled=after<0||after>=list.length;renderMap();return description;
}
function schedule(){if(frame!==null||document.hidden)return;frame=requestAnimationFrame(()=>{frame=null;refresh();});}
function focusNode(node){
 if(!allowed(node))return false;
 focused=node;node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});node.focus({preventScroll:true});refresh(true);return document.activeElement===node;
}
function focusControl(index){const list=controls();return Number.isInteger(index)&&index>=0&&index<list.length?focusNode(list[index]):false;}
function step(delta){if(delta!==-1&&delta!==1)return false;const list=controls(),target=adjacentIndex(list,delta);return target>=0&&target<list.length?focusNode(list[target]):false;}
document.addEventListener('focusin',event=>{const node=event.target;if(own(node)||!rendered(node))return;focused=node;refresh();});
document.addEventListener('scroll',schedule,true);scope.addEventListener('resize',schedule);scope.visualViewport?.addEventListener('resize',schedule);scope.visualViewport?.addEventListener('scroll',schedule);
document.addEventListener('change',event=>{if(!own(event.target))schedule();});document.addEventListener('toggle',event=>{if(!own(event.target))schedule();},true);
document.addEventListener('close',event=>{if(event.target.matches?.('dialog'))schedule();},true);
scope.addEventListener('sense:erase',()=>{erasing=true;focused=null;lastSnapshot=null;lastKey='';mapKey='';mapLimit=240;map.hidden=true;mapList.replaceChildren();toggle.setAttribute('aria-expanded','false');refresh(true);erasing=false;});
const observer=new MutationObserver(records=>{if(erasing)return;if(records.some(record=>!own(record.target)&&(record.type!=='attributes'||record.attributeName!=='class'||record.target===document.body)))schedule();});
observer.observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['hidden','open','disabled','readonly','required','aria-required','aria-disabled','aria-current','aria-expanded','aria-pressed','aria-invalid','aria-label','aria-labelledby','inert','data-sense-view','class']});
scope.CLEA7SensePosition=freeze({format:'sense.position/1',describeRect,describeElement,current,controls:()=>{const list=controls();return list.map(node=>describeElement(node,list));},focusControl,step,refresh});
refresh();
})(globalThis);
