'use strict';
/* CLEA7 Draw — original functional drawing authoring by Brzo i Lokalno.
 * Geometry and behaviors become checked BIL. No source text is executed as JS. */
(function(scope){
const B=scope.CLEA7BIL,q=JSON.stringify;
const BOX=[[0,0],[1000,0],[1000,1000],[0,1000],[0,0]];
const COMMON=`record CleaDrawBox { scene: Text, x: Number, y: Number, width: Number, height: Number }
derive draw7_solids: List<CleaDrawBox> = []
fn draw7_free(scene: Text, x: Number, y: Number, width: Number, height: Number) -> Boolean {
    for box in draw7_solids {
        if box.scene == scene and box.width > 0 and x < box.x + box.width and x + width > box.x and y < box.y + box.height and y + height > box.y { return false }
    }
    return true
}
fn draw7_near(ax: Number, ay: Number, aw: Number, ah: Number, bx: Number, by: Number, bw: Number, bh: Number, radius: Number) -> Boolean {
    let dx = ax + aw / 2 - bx - bw / 2
    let dy = ay + ah / 2 - by - bh / 2
    return dx * dx + dy * dy <= radius * radius
}
fn draw7_slide(opened: Boolean, distance: Number) -> Number {
    if opened { return distance }
    return 0
}
fn draw7_closed_width(opened: Boolean, width: Number) -> Number {
    if opened { return 0 }
    return width
}
`;
function model(source){
 const compiled=B.compile(source),declarations=new Map(compiled.ast.body.filter(n=>['declare','assign'].includes(n.kind)&&n.name).map(n=>[n.name,n])),objects=[],spaces=[];
 const initial=name=>{const n=declarations.get(name);return n?.value.kind==='literal'&&typeof n.value.value==='number'?n.value.value:null;};
 const visit=(nodes,screen,space=null)=>{for(const n of nodes){if(n.kind==='ui_space'){spaces.push({id:n.id,key:n.key,label:n.label,size:n.spaceSize,screen,loc:n.loc});}if(n.kind==='ui_drawing'){const key=n.key||n.id,xName=key+'_x',yName=key+'_y',managed=compiled.ir.globals[xName]?.type==='Number'&&compiled.ir.globals[yName]?.type==='Number';objects.push({id:n.id,key,label:n.label,role:n.role,points:n.points,closed:n.closed,fill:n.fill,ink:n.ink,weight:n.weight,screen,space:space?.id,managed,xName,yName,x:managed?initial(xName):typeof n.style?.x==='number'?n.style.x:0,y:managed?initial(yName):typeof n.style?.y==='number'?n.style.y:0,width:typeof n.style?.width==='number'?n.style.width:100,height:typeof n.style?.height==='number'?n.style.height:100,loc:n.loc});}if(n.children)visit(n.children,screen,n.kind==='ui_space'?n:space);}};
 for(const page of compiled.ast.body.filter(n=>n.kind==='screen'))visit(page.children,page.name);
 return {format:'clea7.draw-model/1',compiled,objects,spaces};
}
function solids(objects){return '['+objects.filter(o=>o.managed&&['door','solid'].includes(o.role)).map(o=>'new CleaDrawBox { scene: '+q(o.screen)+', x: '+o.xName+', y: '+o.yName+', width: '+(o.role==='door'?'draw7_closed_width('+o.key+'_open, '+o.width+')':o.width)+', height: '+o.height+' }').join(', ')+']';}
function reset(objects){return 'on draw7_reset {\n'+objects.filter(o=>o.managed).map(o=>'    '+o.xName+' = '+o.x+'\n    '+o.yName+' = '+o.y).join('\n')+'\n}';}
function replaceOwned(source,node,expected,next){const old=source.slice(node.loc.start,node.loc.end);if(old.trim()!==expected.trim())throw Error('Ovaj Draw dio je ručno promijenjen. Kod je sačuvan; izmijeni ga u BIL editoru.');return source.slice(0,node.loc.start)+next+source.slice(node.loc.end);}
function addObject(source,spec){
 let current=model(source);const page=current.compiled.ast.body.find(n=>n.kind==='screen'&&n.name===spec.screen),id=String(spec.id||'');
 if(!page||!B.safe(id)||id.length>20)throw Error('Odaberi ekran i jedinstven identitet objekta do20 znakova.');
 const key='draw7_'+id,role=spec.role||'object',label=String(spec.label||'Moj objekat').trim();
 if(!['object','actor','door','solid'].includes(role)||!label||label.length>160)throw Error('Odaberi ulogu i naziv objekta od1–160 znakova.');
 const number=(value,fallback,min,max)=>{const n=value===undefined?fallback:Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error('Položaj ili veličina objekta prelazi dozvoljeni raspon.');return n;};
 const x=number(spec.x,80,0,800),y=number(spec.y,160,0,450),width=number(spec.width,role==='door'?50:40,8,800),height=number(spec.height,role==='door'?140:60,8,450),step=number(spec.step,16,1,100),radius=number(spec.radius,120,16,600);
 if(x+width>800||y+height>450)throw Error('Objekat treba ostati unutar prostora800×450.');
 const points=spec.points||BOX,fill=spec.fill||({actor:'#2dd4bf',door:'#c084fc',solid:'#64748b',object:'#ffac77'})[role],ink=spec.ink||'#e2e8f0';
 if(!Array.isArray(points)||points.length<2||points.length>256||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000))||![fill,ink].every(c=>/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(c)||c==='transparent'))throw Error('Crtež treba2–256 numeričkih tačaka i dozvoljene boje.');
 const occupied=new Set(current.compiled.ast.body.map(n=>n.name).filter(Boolean));if(current.objects.some(o=>o.key===key)||[...occupied].some(n=>n===key||n.startsWith(key+'_')))throw Error('Identitet objekta već postoji. Postojeći kod nije promijenjen.');
 const first=!current.compiled.ir.globals.draw7_solids;
 if(first){if([...occupied].some(n=>n.startsWith('draw7_')||n==='CleaDrawBox'))throw Error('Postojeći simbol sprečava sigurno dodavanje Draw jezgra.');if(!current.compiled.ir.imports.includes('math')){if(occupied.has('math'))throw Error('Postojeći simbol math sprečava import.');source='import math\n'+source;}source+='\n'+COMMON;current=model(source);}
 const actor=role==='door'?current.objects.find(o=>o.key===spec.actor&&o.role==='actor'&&o.managed):null;
 if(role==='door'&&(!actor||actor.screen!==spec.screen))throw Error('Vrata trebaju postojećeg Draw igrača u istom ekranu za provjeru blizine.');
 const declarations=['let '+key+'_x = '+x,'let '+key+'_y = '+y],events=[];
 if(role==='door')declarations.push('derive '+key+'_open = draw7_near('+actor.xName+', '+actor.yName+', '+actor.width+', '+actor.height+', '+key+'_x, '+key+'_y, '+width+', '+height+', '+radius+')','derive '+key+'_render_x = '+key+'_x + draw7_slide('+key+'_open, '+(width+12)+')');
 let controls='';if(role==='actor'){
  for(const [direction,dx,dy,text]of [['left',-step,0,'Lijevo'],['right',step,0,'Desno'],['up',0,-step,'Gore'],['down',0,step,'Dolje']])events.push('on '+key+'_'+direction+' {\n    let nx = math.clamp('+key+'_x + '+dx+', 0, '+(800-width)+')\n    let ny = math.clamp('+key+'_y + '+dy+', 0, '+(450-height)+')\n    if draw7_free('+q(spec.screen)+', nx, ny, '+width+', '+height+') { '+key+'_x = nx; '+key+'_y = ny }\n}');
  controls='\n    row '+q(label+' · upravljanje')+' {\n'+[['left','Lijevo'],['right','Desno'],['up','Gore'],['down','Dolje']].map(([d,t])=>'        button '+q(label+' · '+t)+' runs '+key+'_'+d+' key '+key+'_'+d+'_button').join('\n')+'\n    } key '+key+'_controls\n';
 }
 const drawing='drawing '+q(label)+' points '+q(points)+' role '+role+(spec.closed===false?'':' closed')+' fill '+q(fill)+' ink '+q(ink)+' weight 2 style {\n        x '+key+(role==='door'?'_render_x':'_x')+'\n        y '+key+'_y\n        width '+width+'\n        height '+height+'\n    } motion move 180'+(role==='actor'?' gestures {\n        swipeLeft runs '+key+'_left\n        swipeRight runs '+key+'_right\n    }':'')+' key '+key;
 const c=B.compile(source),selected=c.ast.body.find(n=>n.kind==='screen'&&n.name===spec.screen),space=current.spaces.find(s=>s.screen===spec.screen&&s.key?.startsWith('draw7_world_')),world=space?find(c.ast.body,space.id):null;
 if(space&&(space.size[0]!==800||space.size[1]!==450))throw Error('Ovaj prostor ima ručno promijenjene dimenzije. Izvor je sačuvan; uređuj ga kroz BIL.');
 let at=world?.childrenEnd??selected.childrenEnd??selected.loc.end-1;
 const worldKey='draw7_world_'+spec.screen.slice(0,12)+'_'+Array.from(spec.screen).reduce((h,ch)=>(h*31+ch.charCodeAt(0))>>>0,0).toString(16);
 let addition=world?'\n    '+drawing+'\n':'\n    space "CLEA7 Draw" size [800, 450] {\n    '+drawing.replaceAll('\n','\n    ')+'\n    } key '+worldKey+'\n';
 source=source.slice(0,at)+addition+source.slice(at);
 if(controls||first){const p=B.parse(source).body.find(n=>n.kind==='screen'&&n.name===spec.screen);at=p.childrenEnd??p.loc.end-1;source=source.slice(0,at)+controls+(first?'\n    button "Vrati Draw položaje" runs draw7_reset key draw7_reset_button\n':'')+source.slice(at);}
 source+='\n'+declarations.join('\n')+'\n'+events.join('\n\n')+'\n';
 // Add reset before final full compilation; a referenced missing handler is never run.
 const oldObjects=current.objects,newObject={key,xName:key+'_x',yName:key+'_y',x,y,width,height,role,managed:true,screen:spec.screen};
 const previousReset=current.compiled.ast.body.find(n=>n.kind==='handler'&&n.name==='draw7_reset');
 if(previousReset){const astNode=findBySpan(source,'handler','draw7_reset');source=replaceOwned(source,astNode,reset(oldObjects),reset([...oldObjects,newObject]));}
 else source+='\n'+reset([...oldObjects,newObject])+'\n';
 const derive=findBySpan(source,'derive','draw7_solids');source=replaceOwned(source,derive,'derive draw7_solids: List<CleaDrawBox> = '+solids(oldObjects),'');source+='\nderive draw7_solids: List<CleaDrawBox> = '+solids([...oldObjects,newObject])+'\n';
 B.compile(source);return {source,object:key,role};
}
function find(nodes,id){for(const n of nodes){if(n.id===id)return n;if(n.children){const found=find(n.children,id);if(found)return found;}}return null;}
function findBySpan(source,kind,name){const node=B.parse(source).body.find(n=>n.kind===kind&&n.name===name);if(!node)throw Error('Draw ugovor je ručno promijenjen. Kod je sačuvan.');return node;}
function setPosition(source,key,x,y){
 const m=model(source),object=m.objects.find(o=>o.key===key);x=Number(x);y=Number(y);
 if(!object?.managed||object.x===null||object.y===null||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x+object.width>800||y+object.height>450)throw Error('Položaj treba biti unutar prostora. Ručne izraze uređuj u BIL kodu.');
 const changes=[[object.xName,x],[object.yName,y]].map(([name,value])=>{const n=m.compiled.ast.body.find(n=>n.name===name&&n.kind==='declare');if(n?.value.kind!=='literal'||typeof n.value.value!=='number')throw Error('Početni položaj je ručni BIL izraz; nije prepisan.');return {loc:n.value.loc,value};});
 let next=source;for(const change of changes.sort((a,b)=>b.loc.start-a.loc.start))next=next.slice(0,change.loc.start)+change.value+next.slice(change.loc.end);
 const resetNode=findBySpan(next,'handler','draw7_reset');next=replaceOwned(next,resetNode,reset(m.objects),reset(m.objects.map(o=>o.key===key?{...o,x,y}:o)));B.compile(next);return next;
}
function explain(source,id,engine){const m=model(source),o=m.objects.find(n=>n.key===id||n.id===id);if(!o)throw Error('Odaberi postojeći Draw objekat.');const actual=engine?.project?.bil?.source===source&&!engine.closed&&!!engine.state?.bilValues,values=actual?engine.state.bilValues:null,rule=m.compiled.ast.body.find(n=>n.kind==='derive'&&n.name===o.key+'_open');return {format:'clea7.draw-explanation/1',object:o.key,label:o.label,role:o.role,actual,position:actual?{x:values[o.xName],y:values[o.yName]}:{x:o.x,y:o.y},open:actual&&rule?values[o.key+'_open']:null,rule:rule?source.slice(rule.loc.start,rule.loc.end):null,line:o.loc.line,column:o.loc.column};}
function attach(api){
 const root=api.parent,d=root.ownerDocument,el=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n;},svgEl=tag=>d.createElementNS('http://www.w3.org/2000/svg',tag);
 root.replaceChildren();root.classList.add('clea-draw');
 const heading=el('div'),mark=el('span','7');mark.className='draw-mark';mark.setAttribute('aria-hidden','true');heading.className='draw-heading';heading.append(mark,el('h2','CLEA7 Draw'));root.append(heading,el('p','Nacrtaj objekat, poveži ponašanje i pokreni stvarnu aplikaciju.'));
 const status=el('p');status.id='draw-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const button=(label,fn)=>{const n=el('button',label);n.type='button';n.onclick=()=>Promise.resolve().then(fn).catch(e=>{status.textContent=e.message;api.error?.(e);});return n;};
 const toolbar=el('div');toolbar.className='draw-toolbar';const screen=el('select');screen.id='draw-screen';screen.setAttribute('aria-label','Draw ekran');toolbar.append(screen,button('Novi Draw projekat',()=>{if(api.newProject('screen home "Moj Draw prostor" {\n    heading "Moj svijet" key title\n}\nstart home\n','Moj Draw projekat')){api.activate?.();refresh();}}),button('Pokreni aplikaciju',api.run),button('Sačuvaj projekt',api.save),button('Izvezi aplikaciju',api.export),button('Poništi izmjenu',()=>{d.getElementById('bil-undo')?.click();refresh();}));root.append(toolbar);
 const workspace=el('div'),palette=el('section'),stage=el('section'),inspector=el('section');workspace.className='draw-workspace';palette.className='draw-palette';stage.className='draw-stage';inspector.className='draw-inspector';palette.append(el('h3','Novi funkcionalni objekat'));inspector.append(el('h3','Objekti i njihove veze'));workspace.append(palette,stage,inspector);root.append(workspace,status);
 const field=(parent,label,id,tag='input')=>{const l=el('label',label),n=el(tag);n.id=id;n.setAttribute('aria-label',label);l.append(n);parent.append(l);return n;};
 const name=field(palette,'Naziv objekta','draw-name'),identifier=field(palette,'Identitet objekta','draw-id'),role=field(palette,'Uloga objekta','draw-role','select');name.value='Moj objekat';identifier.value='object1';identifier.maxLength=20;
 for(const [v,t]of [['object','Objekat aplikacije ili animacije'],['actor','Igrač s kontrolama'],['door','Vrata koja reaguju na blizinu'],['solid','Čvrsta prepreka']]){const o=el('option',t);o.value=v;role.append(o);}
 const positions=el('div');positions.className='draw-coordinate-fields';const coords={};for(const [key,label,value]of [['x','Početni X',80],['y','Početni Y',160],['width','Širina',40],['height','Visina',60]]){const n=field(positions,label,'draw-'+key);n.type='number';n.step='any';n.value=String(value);coords[key]=n;}palette.append(positions);
 const fill=field(palette,'Boja objekta','draw-fill');fill.type='color';fill.value='#2dd4bf';const actor=field(palette,'Igrač koji otvara vrata','draw-actor','select'),radius=field(palette,'Udaljenost otvaranja','draw-radius');radius.type='number';radius.min='16';radius.max='600';radius.value='120';
 const closed=field(palette,'Zatvori nacrtanu konturu','draw-closed');closed.type='checkbox';closed.checked=true;
 const hint=el('p','Nacrtaj konturu u prostoru ili dodaj oblik kroz ove kontrole. Precizno crtanje nije obavezno.');hint.className='draw-hint';palette.append(hint);
 let selected='',current=null,geometry=null,pointer=null,zoom=1,activeScreen='';
 const surface=svgEl('svg');surface.id='draw-surface';surface.setAttribute('viewBox','0 0 800 450');surface.setAttribute('role','group');surface.setAttribute('aria-label','Draw prostor za crtanje i odabir objekata');surface.setAttribute('tabindex','0');surface.style.touchAction='none';stage.append(surface);
 const stageControls=el('div');stageControls.className='draw-toolbar';const adjustZoom=next=>{zoom=Math.max(1,Math.min(4,next));const w=800/zoom,h=450/zoom;surface.setAttribute('viewBox',[(800-w)/2,(450-h)/2,w,h].join(' '));};stageControls.append(button('Uvećaj',()=>adjustZoom(zoom*1.25)),button('Umanji',()=>adjustZoom(zoom/1.25)),button('Cijeli prostor',()=>adjustZoom(1)),button('Odbaci konturu',()=>{geometry=null;paint();}));stage.append(stageControls,el('p','Dizajn · pomjeri objekat ili promijeni početni položaj. Za postojeće izvođenje koristi „Vrati Draw položaje“.'));
 const hierarchy=el('div');hierarchy.id='draw-hierarchy';inspector.append(hierarchy);
 const selectedName=el('strong');selectedName.id='draw-selected-name';const editX=field(inspector,'Odabrani objekat · početni X','draw-edit-x'),editY=field(inspector,'Odabrani objekat · početni Y','draw-edit-y');editX.type=editY.type='number';inspector.prepend(selectedName);
 const details=el('pre');details.id='draw-explanation';details.setAttribute('aria-live','polite');
 const showFacts=()=>{if(!selected)return;const fact=explain(api.source(),selected,api.runtime?.());details.textContent=(fact.actual?'Stvarno izvršavanje':'Definicija u projektu · aplikacija nije pokrenuta')+'\n'+fact.label+' · '+fact.role+'\nPoložaj: '+q(fact.position)+(fact.open!==null?'\nVrata otvorena: '+(fact.open?'Da':'Ne'):'')+(fact.rule?'\nBIL pravilo:\n'+fact.rule:'')+'\nIzvor: '+fact.line+':'+fact.column;};
 inspector.append(button('Primijeni početni položaj',()=>{if(!selected)throw Error('Odaberi objekat.');api.setSource(setPosition(api.source(),selected,editX.value,editY.value));api.inspect();status.textContent='Početni položaj je izmijenjen. Spremljeno stanje igre ostaje; reset položaja je izričita radnja.';}),button('Objasni stvarno stanje',showFacts),button('Prikaži BIL objekta',()=>{const o=current?.objects.find(o=>o.key===selected);if(o)api.showCode?.(o.loc);}),details);
 const intent=field(inspector,'Željena dodatna promjena ponašanja','draw-ai-intent','textarea');intent.rows=3;inspector.append(button('Pripremi u CLEA AI',()=>{const o=current?.objects.find(o=>o.key===selected);if(!o||!intent.value.trim())throw Error('Odaberi objekat i opiši ponašanje.');api.askAI?.('Izmijeni ponašanje Draw objekta '+o.label+' ('+o.key+') u mom postojećem BIL projektu: '+intent.value.trim());status.textContent='Zahtjev je pripremljen u postojećem CLEA AI razgovoru. Pregledaj i pošalji ga; kod nije automatski poslan.';}));
 function selectedProperties(){const o=current?.objects.find(o=>o.key===selected);selectedName.textContent=o?o.label+' · '+o.role:'Odaberi objekat';editX.value=o?.x??'';editY.value=o?.y??'';editX.disabled=editY.disabled=!o?.managed;if(o)showFacts();else details.textContent='';}
 function paint(){
  surface.replaceChildren();const grid=svgEl('g');grid.setAttribute('aria-hidden','true');for(let x=0;x<=800;x+=40){const l=svgEl('line');l.setAttribute('x1',x);l.setAttribute('x2',x);l.setAttribute('y1','0');l.setAttribute('y2','450');grid.append(l);}for(let y=0;y<=450;y+=40){const l=svgEl('line');l.setAttribute('x1','0');l.setAttribute('x2','800');l.setAttribute('y1',y);l.setAttribute('y2',y);grid.append(l);}surface.append(grid);
  for(const o of current?.objects.filter(o=>o.screen===activeScreen)||[]){const group=svgEl('g'),path=svgEl('path'),label=svgEl('text');group.dataset.drawObject=o.key;group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label','Odaberi '+o.label);group.setAttribute('aria-pressed',String(selected===o.key));group.setAttribute('transform','translate('+(o.x??0)+' '+(o.y??0)+')');path.setAttribute('d',o.points.map((p,i)=>(i?'L':'M')+(p[0]*o.width/1000)+' '+(p[1]*o.height/1000)).join(' ')+(o.closed?' Z':''));path.setAttribute('fill',o.fill);path.setAttribute('stroke',selected===o.key?'#ffffff':o.ink);path.setAttribute('stroke-width',selected===o.key?'3':'2');label.textContent=o.label;label.setAttribute('x','0');label.setAttribute('y','-8');group.append(path,label);group.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();selected=o.key;selectedProperties();paint();}};group.onclick=e=>{e.stopPropagation();selected=o.key;selectedProperties();paint();};surface.append(group);}
  if(geometry){const path=svgEl('path');path.setAttribute('d',geometry.points.map((p,i)=>(i?'L':'M')+(geometry.x+p[0]*geometry.width/1000)+' '+(geometry.y+p[1]*geometry.height/1000)).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#fbbf24');path.setAttribute('stroke-width','3');path.setAttribute('pointer-events','none');surface.append(path);}
 }
 const coordinates=e=>{const point=surface.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const p=point.matrixTransform(surface.getScreenCTM().inverse());return [Math.max(0,Math.min(800,p.x)),Math.max(0,Math.min(450,p.y))];};
 surface.onpointerdown=e=>{if(e.button!==0)return;const object=e.target.closest?.('[data-draw-object]'),p=coordinates(e);if(object){const o=current.objects.find(o=>o.key===object.dataset.drawObject);selected=o.key;selectedProperties();if(o.managed)pointer={id:e.pointerId,kind:'move',object:o,start:p,last:p};}else pointer={id:e.pointerId,kind:'stroke',points:[p]};surface.setPointerCapture(e.pointerId);e.preventDefault();};
 surface.onpointermove=e=>{if(!pointer||pointer.id!==e.pointerId)return;const p=coordinates(e);if(pointer.kind==='stroke'){const last=pointer.points.at(-1);if(Math.hypot(last[0]-p[0],last[1]-p[1])>=3&&pointer.points.length<1024)pointer.points.push(p);}else{pointer.last=p;const o=pointer.object,g=[...surface.querySelectorAll('[data-draw-object]')].find(n=>n.dataset.drawObject===o.key);g?.setAttribute('transform','translate('+Math.max(0,Math.min(800-o.width,o.x+p[0]-pointer.start[0]))+' '+Math.max(0,Math.min(450-o.height,o.y+p[1]-pointer.start[1]))+')');}};
 surface.onpointerup=e=>{if(!pointer||pointer.id!==e.pointerId)return;const stroke=pointer;pointer=null;try{surface.releasePointerCapture(e.pointerId);}catch{}if(stroke.kind==='move'){const o=stroke.object,x=Math.max(0,Math.min(800-o.width,o.x+stroke.last[0]-stroke.start[0])),y=Math.max(0,Math.min(450-o.height,o.y+stroke.last[1]-stroke.start[1]));if(Math.abs(x-o.x)+Math.abs(y-o.y)>2){try{api.setSource(setPosition(api.source(),o.key,Math.round(x),Math.round(y)));api.inspect();}catch(error){status.textContent=error.message;}}return;}
  if(stroke.points.length<2)return;const xs=stroke.points.map(p=>p[0]),ys=stroke.points.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),width=Math.max(8,Math.max(...xs)-left),height=Math.max(8,Math.max(...ys)-top),points=stroke.points.filter((_,i)=>i%Math.max(1,Math.ceil(stroke.points.length/128))===0);if(points.at(-1)!==stroke.points.at(-1))points.push(stroke.points.at(-1));geometry={x:Math.max(0,Math.min(800-width,left)),y:Math.max(0,Math.min(450-height,top)),width,height,points:points.map(p=>[Math.round((p[0]-left)/width*1000),Math.round((p[1]-top)/height*1000)])};for(const key of ['x','y','width','height'])coords[key].value=String(Math.round(geometry[key]));paint();status.textContent='Kontura je spremna. Odredi naziv i ulogu pa dodaj funkcionalni objekat.';
 };
 surface.onpointercancel=()=>{pointer=null;paint();};surface.onkeydown=e=>{if(e.key==='Escape'){pointer=null;geometry=null;paint();status.textContent='Nacrtana kontura je odbačena.';}};
 palette.append(button('Dodaj funkcionalni objekat',()=>{const spec={id:identifier.value.trim(),label:name.value,screen:activeScreen,role:role.value,fill:fill.value,actor:actor.value,radius:radius.value,closed:closed.checked};for(const key of ['x','y','width','height'])spec[key]=coords[key].value;if(geometry)spec.points=geometry.points;const next=addObject(api.source(),spec);selected=next.object;geometry=null;api.setSource(next.source);api.inspect();let n=1;while(current.objects.some(o=>o.key==='draw7_object'+n))n++;identifier.value='object'+n;status.textContent='Objekat i njegovo ponašanje su stvarni BIL kod. Pokreni aplikaciju ili nastavi uređivanje.';}));
 function behaviorFields(){actor.closest('label').hidden=radius.closest('label').hidden=role.value!=='door';if(role.value==='door'){coords.width.value='50';coords.height.value='140';fill.value='#c084fc';}else if(role.value==='actor'){coords.width.value='40';coords.height.value='60';fill.value='#2dd4bf';}else if(role.value==='solid')fill.value='#64748b';}
 role.onchange=behaviorFields;screen.onchange=()=>{activeScreen=screen.value;refresh();};
 function refresh(){try{current=model(api.source());const screens=current.compiled.ast.body.filter(n=>n.kind==='screen');if(!screens.some(s=>s.name===activeScreen))activeScreen=api.screen?.()||screens[0]?.name||'';screen.replaceChildren();for(const page of screens){const option=el('option',page.label);option.value=page.name;screen.append(option);}screen.value=activeScreen;const previous=actor.value;actor.replaceChildren();for(const object of current.objects.filter(o=>o.role==='actor'&&o.managed&&o.screen===activeScreen)){const option=el('option',object.label);option.value=object.key;actor.append(option);}if([...actor.options].some(o=>o.value===previous))actor.value=previous;
  hierarchy.replaceChildren();for(const object of current.objects.filter(o=>o.screen===activeScreen)){const b=button(object.label+' · '+object.role,()=>{selected=object.key;selectedProperties();paint();});b.setAttribute('aria-pressed',String(selected===object.key));hierarchy.append(b);}selectedProperties();paint();}catch(error){status.textContent=error.message;}}
 behaviorFields();refresh();return {refresh};
}
scope.CLEA7Draw=Object.freeze({format:'clea7.draw/1',model,addObject,setPosition,explain,attach,defaultPoints:BOX});
})(globalThis);
