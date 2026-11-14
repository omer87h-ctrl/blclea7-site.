'use strict';
/* Original reusable, source-preserving BIL elements, by Brzo i Lokalno.
 * Components are real BIL data, controls and handlers in the current program. */
(function(scope){
const B=scope.CLEA7BIL,q=JSON.stringify;
const KINDS=Object.freeze([
 ['text','Tekstualno polje','Vlastiti podatak, unos i prikaz stvarne vrijednosti.'],
 ['multiline','Višeredni tekst','Uređivanje dužeg teksta bez posebnog pisanja veze sa stanjem.'],
 ['number','Broj s granicama','Tipizirani broj sa stvarnom provjerom raspona.'],
 ['toggle','Prekidač i status','Boolean stanje, promjena dodirom i vidljiv status.'],
 ['select','Ponuđeni izbori','Vlastiti izbori i povezano tekstualno stanje.'],
 ['progress','Napredak s kontrolama','Poznate granice, stvarni događaji i ograničene promjene.'],
 ['motion','Interaktivni pokret','Oblik, pomjeranje, geste, animacija i alternativna dugmad.'],
 ['navigation','Navigacijski meni','Povezuje postojeće ekrane bez njihovog ponovnog pravljenja.'],
 ['action','Dugme s radnjom','Promijeni postojeći podatak ili pokreni postojeći događaj.']
]);
function build(source,spec){
 const compiled=B.compile(source),page=compiled.ast.body.find(n=>n.kind==='screen'&&n.name===spec.screen);
 if(!page)throw Error('Odaberi postojeći ekran.');
 if(!KINDS.some(([key])=>key===spec.kind))throw Error('Odaberi podržani radni element.');
 const label=String(spec.label||'Novi element').trim(),id=String(spec.id||'').trim();
 if(!label||label.length>160||!B.safe(id)||id.length>32)throw Error('Naziv treba 1–160 znakova; identitet do 32 slova, broja ili _.');
 const names=new Set(compiled.ast.body.map(n=>n.name).filter(Boolean)),keys=new Set();
 const walk=items=>{for(const n of items){if(n.key)keys.add(n.key);if(n.children)walk(n.children);}};walk(compiled.ast.body.filter(n=>n.kind==='screen'));
 const reserved=[id,id+'_less',id+'_more',id+'_reset',id+'_run'];
 if(reserved.some(k=>names.has(k))||[...keys].some(k=>k===id||k.startsWith(id+'_')))throw Error('Taj identitet već postoji. Odaberi novi; postojeći kod se ne prepisuje.');
 const globals=[],handlers=[],nodes=[],declarations=[],events=[];
 const value=(type,initial)=>{declarations.push('let '+id+': '+type+' = '+q(initial));globals.push(id);};
 const event=(suffix,body)=>{const name=id+'_'+suffix;events.push('on '+name+' {\n'+body.map(x=>'    '+x).join('\n')+'\n}');handlers.push(name);return name;};
 const key=suffix=>id+'_'+suffix;
 const number=(v,fallback)=>{const n=v===undefined?fallback:Number(v);if(!Number.isFinite(n)||Math.abs(n)>1e12)throw Error('Upiši konačan broj između −10¹² i 10¹².');return n;};
 let low,high,step,initial;
 if(['number','progress','motion'].includes(spec.kind)){
  low=number(spec.min,spec.kind==='motion'?-160:0);high=number(spec.max,spec.kind==='motion'?160:100);step=number(spec.step,spec.kind==='motion'?24:10);initial=number(spec.initial,Math.max(low,0));
  if(low>=high||spec.kind!=='number'&&(step<=0||step>high-low)||initial<low||initial>high)throw Error('Granice moraju rasti, početna vrijednost biti unutar njih, a korak pozitivan i manji od raspona.');
 }
 if(['text','multiline'].includes(spec.kind)){
  initial=String(spec.initial??'');if(initial.length>8192)throw Error('Početni tekst prelazi 8192 znaka.');value('Text',initial);
  nodes.push('input '+id+' label '+q(label)+(spec.kind==='multiline'?' multiline':'')+(spec.required?' required':'')+' key '+key('input'),'show '+id+' key '+key('value'));
 }else if(spec.kind==='number'){
  value('Number',initial);nodes.push('input '+id+' label '+q(label)+' range ['+low+', '+high+'] key '+key('input'),'show '+id+' key '+key('value'));
 }else if(spec.kind==='toggle'){
  value('Boolean',spec.initial===true);nodes.push('toggle '+id+' label '+q(label)+' key '+key('input'),'visualize '+id+' within [status] fallback status key '+key('status'));
 }else if(spec.kind==='select'){
  const options=Array.isArray(spec.options)?spec.options:String(spec.options||'').split('|').map(s=>s.trim());
  if(!options.length||options.length>20||options.some(s=>typeof s!=='string'||!s.trim()||s.length>160)||new Set(options).size!==options.length)throw Error('Upiši 1–20 različitih izbora, razdvojenih znakom |.');
  value('Text',options[0]);nodes.push('select '+id+' label '+q(label)+' options '+q(options)+' key '+key('input'),'show '+id+' key '+key('value'));
 }else if(['progress','motion'].includes(spec.kind)){
  value('Number',initial);
  const less=event('less',[id+' = '+id+' - '+step,'if '+id+' < '+low+' { '+id+' = '+low+' }']);
  const more=event('more',[id+' = '+id+' + '+step,'if '+id+' > '+high+' { '+id+' = '+high+' }']);
  if(spec.kind==='progress')nodes.push('visualize '+id+' range ['+low+', '+high+'] within [progress] fallback progress key '+key('progress'));
  else{
   const reset=event('reset',[id+' = '+initial]);
   if(low< -4096||high>4096)throw Error('Pokret ostaje unutar −4096 do 4096.');
   nodes.push('shape "circle" label '+q(label)+' key '+key('shape')+' style {\n    x '+id+'\n    width 64\n    height 64\n    background "#ffad75"\n} motion move 200 gestures {\n    swipeLeft runs '+less+'\n    swipeRight runs '+more+'\n    tap runs '+reset+'\n}',
    'button "Vrati položaj" runs '+reset+' key '+key('reset_button'));
  }
  nodes.push('show '+id+' key '+key('value'),'row {\n    button '+q(spec.kind==='motion'?'Pomjeri lijevo':'Smanji')+' runs '+less+' key '+key('less_button')+'\n    button '+q(spec.kind==='motion'?'Pomjeri desno':'Povećaj')+' runs '+more+' key '+key('more_button')+'\n} key '+key('controls'));
 }else if(spec.kind==='navigation'){
  const pages=compiled.ast.body.filter(n=>n.kind==='screen');
  if(pages.length<2)throw Error('Za navigaciju prvo dodaj drugi ekran. Postojeći ekran ostaje sačuvan.');
  nodes.push('row {\n'+pages.map((p,i)=>'    button '+q(p.label||p.name)+' opens '+p.name+' key '+key('page_'+i)).join('\n')+'\n} key '+key('navigation'));
 }else if(spec.kind==='action'){
  let handler;
  if(spec.handler){const h=compiled.ast.body.find(n=>n.kind==='handler'&&n.name===spec.handler);if(!h||h.params)throw Error('Odaberi postojeći obični događaj.');handler=h.name;}
  else{
   const target=compiled.ir.globals[spec.target];if(!target?.mutable||!['Number','Text','Boolean'].includes(target.type))throw Error('Odaberi postojeći promjenjivi broj, tekst ili Boolean podatak.');
   const body=target.type==='Boolean'?spec.target+' = not '+spec.target:target.type==='Number'?spec.target+' = '+spec.target+' + '+number(spec.amount,1):spec.target+' = '+q(String(spec.text??''));
   if(target.type==='Text'&&String(spec.text??'').length>8192)throw Error('Tekst prelazi 8192 znaka.');handler=event('run',[body]);
  }
  nodes.push('button '+q(label)+' runs '+handler+' key '+key('button'));
 }
 const block='\n    card '+q(label)+' {\n'+nodes.map(n=>'        '+n.replaceAll('\n','\n        ')).join('\n')+'\n    } key '+id+'\n';
 const at=page.childrenEnd??page.loc.end-1;
 const next=(declarations.length?declarations.join('\n')+'\n':'')+source.slice(0,at)+block+source.slice(at)+(events.length?'\n'+events.join('\n\n')+'\n':'');
 B.compile(next);
 return {source:next,added:{screen:spec.screen,globals,handlers,element:id},kind:spec.kind};
}
function buildCollection(source,spec){
 const c=B.compile(source),page=c.ast.body.find(n=>n.kind==='screen'&&n.name===spec.screen),id=String(spec.id||'');
 if(!page||!B.safe(id)||id.length>24)throw Error('Odaberi ekran i jedinstven identitet kolekcije do24 znaka.');
 const label=String(spec.label||'Moja kolekcija').trim(),action=String(spec.action||'Otvori detalje').trim();
 if(!label||label.length>160||!action||action.length>160)throw Error('Naziv kolekcije i radnje treba1–160 znakova.');
 const names=new Set(c.ast.body.map(n=>n.name).filter(Boolean)),declarations=[],events=[];let nodes;
 const fresh=name=>{if(names.has(name))throw Error('Identitet '+name+' već postoji; postojeći kod nije promijenjen.');names.add(name);return name;};
 if(spec.collection){
  const type=c.ir.globals[spec.collection]?.type?.list?.record,selected=c.ir.globals[spec.selection];
  if(!type||type[spec.identity]!=='Text'||selected?.type!=='Text'||!selected.mutable||!c.ast.body.some(n=>n.kind==='handler'&&n.name===spec.handler&&!n.params))throw Error('Odaberi postojeću kolekciju, tekstualni identitet i odabir te obični događaj.');
  const columns=Object.keys(type).filter(k=>['Text','Number','Boolean'].includes(type[k])).slice(0,8);if(!columns.length)throw Error('Kolekcija treba barem jedno tekstualno, brojčano ili Boolean polje.');
  if(spec.columns!==undefined){if(!Array.isArray(spec.columns)||!spec.columns.length||spec.columns.length>8||spec.columns.some(k=>!columns.includes(k)))throw Error('Odaberi podržana polja kartice.');columns.splice(0,columns.length,...spec.columns);}
  nodes='cards '+spec.collection+' label '+q(label)+' fields ['+columns.map(k=>k+': '+q(k)).join(', ')+'] identity '+spec.identity+' select '+spec.selection+(spec.image?' image '+spec.image:'')+' action '+q(action)+' runs '+spec.handler+' empty '+q('Još nema stavki.')+' key '+id+'_cards';
 }else{
  for(const module of ['text','json','collections'])if(!c.ir.imports.includes(module)){if(names.has(module))throw Error('Postojeći simbol '+module+' sprečava siguran import; preimenuj ga u kodu.');declarations.push('import '+module);}
  const record=fresh(id+'Entry'),items=fresh(id+'_items'),selected=fresh(id+'_selected'),title=fresh(id+'_title'),detail=fresh(id+'_detail'),shownTitle=fresh(id+'_shown_title'),shownDetail=fresh(id+'_shown_detail'),sequence=fresh(id+'_next'),add=fresh(id+'_add'),open=fresh(id+'_open');
  declarations.push('record '+record+' { id: Text, title: Text, detail: Text }','let '+items+': List<'+record+'> = []','let '+selected+' = ""','let '+title+' = ""','let '+detail+' = ""','let '+shownTitle+' = ""','let '+shownDetail+' = ""','let '+sequence+' = 1');
  events.push('on '+add+' {\n    if text.trim('+title+') == "" { raise "ItemTitle", "Upiši naziv stavke." }\n    '+items+' = collections.append('+items+', new '+record+' { id: '+q(id+'_')+' + json.encode('+sequence+'), title: '+title+', detail: '+detail+' })\n    '+sequence+' = '+sequence+' + 1\n    '+title+' = ""\n    '+detail+' = ""\n}',
   'on '+open+' {\n    for item in '+items+' {\n        if item.id == '+selected+' { '+shownTitle+' = item.title; '+shownDetail+' = item.detail }\n    }\n}');
  nodes='card '+q(label+' · nova stavka')+' {\n    input '+title+' label "Naziv stavke" required key '+id+'_title_input\n    input '+detail+' label "Sadržaj stavke" multiline key '+id+'_detail_input\n    button "Dodaj stavku" runs '+add+' validate key '+id+'_add_button\n}\ncards '+items+' label '+q(label)+' fields [title: "Naziv", detail: "Sadržaj"] identity id select '+selected+' action '+q(action)+' runs '+open+' empty "Dodaj prvu vlastitu stavku." key '+id+'_cards\ncard "Odabrana stavka" {\n    show '+shownTitle+' key '+id+'_chosen_title\n    show '+shownDetail+' key '+id+'_chosen_detail\n}';
 }
 const at=page.childrenEnd??page.loc.end-1,added='\n    '+nodes.replaceAll('\n','\n    ')+'\n',next=(declarations.length?declarations.join('\n')+'\n':'')+source.slice(0,at)+added+source.slice(at)+(events.length?'\n'+events.join('\n\n')+'\n':'');
 B.compile(next);return {source:next,added:{screen:spec.screen,element:id+'_cards',collection:spec.collection||id+'_items',selection:spec.selection||id+'_selected',minimumRuntime:'0.40.0'}};
}
function attachCollection(api){
 const d=api.parent.ownerDocument||document,el=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n;},root=el('details');root.id='bil-card-collections';
 root.append(el('summary','Kolekcije · kartice, galerije i radnje po stavci'),el('p','Prikaži vlastitu kolekciju kao ponavljajuće kartice. Svaka stavka ima stabilan identitet i stvarnu radnju. Nova kolekcija počinje prazna, bez izmišljenih podataka. Za izvoz je potreban Runtime0.40.'));
 const field=(text,id,tag='input')=>{const label=el('label',text),n=el(tag);n.id=id;n.setAttribute('aria-label',text);label.append(n);root.append(label);return n;};
 const collection=field('Izvor kartica','bil-cards-source','select'),id=field('Identitet nove kolekcije kartica','bil-cards-id'),label=field('Naziv kolekcije kartica','bil-cards-label'),action=field('Naziv radnje kartice','bil-cards-action');
 id.value='my_cards';id.maxLength=24;label.value='Moja kolekcija';action.value='Otvori detalje';
 const identity=field('Polje stabilnog identiteta','bil-cards-identity','select'),selection=field('Tekstualni podatak odabira','bil-cards-selection','select'),handler=field('Događaj radnje kartice','bil-cards-handler','select'),image=field('Polje fotografije kartice','bil-cards-image','select');
 const status=el('p'),button=el('button','Dodaj kolekciju u odabrani ekran');status.id='bil-cards-status';status.setAttribute('role','status');button.type='button';button.id='bil-cards-add';
 const fill=(n,values,blank)=>{const old=n.value;n.replaceChildren();if(blank){const o=el('option',blank);o.value='';n.append(o);}for(const value of values){const o=el('option',value);o.value=value;n.append(o);}if([...n.options].some(o=>o.value===old))n.value=old;};
 function details(c){const fields=c.ir.globals[collection.value]?.type?.list?.record||{};fill(identity,Object.keys(fields).filter(k=>fields[k]==='Text'));if(identity.querySelector('option[value="id"]'))identity.value='id';fill(image,Object.keys(fields).filter(k=>{const t=fields[k]?.nullable||fields[k];return t?.name==='NativeMedia';}),'Bez fotografije');for(const n of [identity,selection,handler,image])n.closest('label').hidden=!collection.value;}
 function refresh(){try{const c=B.compile(api.source());fill(collection,Object.keys(c.ir.globals).filter(k=>c.ir.globals[k].type?.list?.record),'Kreiraj novu praznu kolekciju');fill(selection,Object.keys(c.ir.globals).filter(k=>c.ir.globals[k].type==='Text'&&c.ir.globals[k].mutable));fill(handler,c.ast.body.filter(n=>n.kind==='handler'&&!n.params).map(n=>n.name));details(c);button.disabled=!c.ir.ui?.screens.length;}catch{button.disabled=true;}}
 collection.onchange=()=>details(B.compile(api.source()));
 button.onclick=()=>{try{const next=buildCollection(api.source(),{screen:api.screen(),id:id.value,label:label.value,action:action.value,collection:collection.value,identity:identity.value,selection:selection.value,handler:handler.value,image:image.value});api.setSource(next.source);api.inspect();status.textContent='Kolekcija je dodana s podacima i događajima. Pokreni aplikaciju; Poništi vraća prethodni izvor.';refresh();}catch(error){status.textContent=error.message;api.error(error);}};
 root.append(button,status);api.parent.append(root);refresh();return {refresh};
}
function attach(api){
 const d=document,el=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const root=el('details');root.id='bil-working-elements';root.open=true;root.append(el('summary','Radni elementi · podaci, interakcije i događaji'),el('p','Dodaj u postojeći projekt. Element dobija provjeren BIL kod i stvarno ponašanje; tvoji ekrani, algoritmi i podaci ostaju sačuvani. Poništi vraća cijelu ovu izmjenu.'));
 const field=(text,id,node)=>{const label=el('label',text);node.id=id;label.htmlFor=id;root.append(label,node);return node;};
 const kind=field('Radni element','bil-element-kind',el('select'));for(const [id,label]of KINDS){const o=el('option',label);o.value=id;kind.append(o);}
 const help=el('p');root.append(help);
 const label=field('Naziv elementa','bil-element-label',el('input'));label.value='Moj element';label.maxLength=160;
 const id=field('Jedinstveni identitet novog elementa','bil-element-id',el('input'));id.value='element_1';id.maxLength=32;
 const initial=field('Početni tekst ili broj','bil-element-initial',el('input'));initial.value='';
 const min=field('Donja granica','bil-element-min',el('input')),max=field('Gornja granica','bil-element-max',el('input')),step=field('Korak promjene','bil-element-step',el('input'));for(const n of [min,max,step]){n.type='number';n.step='any';}min.value='0';max.value='100';step.value='10';
 const options=field('Ponuđeni izbori, odvojeni znakom |','bil-element-options',el('input'));options.value='Prvi | Drugi';
 const target=field('Postojeći podatak za radnju dugmeta','bil-element-target',el('select'));
 const handler=field('Ili postojeći događaj za dugme','bil-element-handler',el('select'));
 const amount=field('Promjena broja ili novi tekst','bil-element-amount',el('input'));amount.value='1';
 const status=el('p');status.id='bil-element-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const button=el('button','Dodaj radni element u odabrani ekran');button.type='button';button.id='bil-element-add';
 const preview=el('details'),result=el('pre');preview.append(el('summary','Šta je dodano u BIL izvor'),result);
 const visible=(node,yes)=>{node.hidden=!yes;root.querySelector('label[for="'+node.id+'"]').hidden=!yes;};
 const configure=()=>{
  const k=kind.value,numeric=['number','progress','motion'].includes(k);help.textContent=KINDS.find(([key])=>key===k)?.[2]||'';
  visible(initial,['text','multiline',...['number','progress','motion']].includes(k));for(const n of [min,max])visible(n,numeric);visible(step,['progress','motion'].includes(k));visible(options,k==='select');for(const n of [target,handler,amount])visible(n,k==='action');
 };
 kind.onchange=()=>{if(kind.value==='motion'){min.value='-160';max.value='160';step.value='24';initial.value='0';}else if(['number','progress'].includes(kind.value)){min.value='0';max.value='100';step.value='10';initial.value='0';}else initial.value='';configure();};
 function fill(select,entries,empty){const old=select.value;select.replaceChildren();if(empty){const o=el('option',empty);o.value='';select.append(o);}for(const [key,text]of entries){const o=el('option',text);o.value=key;select.append(o);}if([...select.options].some(o=>o.value===old))select.value=old;}
 function refresh(){try{const c=B.compile(api.source());fill(target,Object.entries(c.ir.globals).filter(([,v])=>v.mutable&&['Number','Text','Boolean'].includes(v.type)).map(([k,v])=>[k,k+' · '+v.type]),'Odaberi postojeći podatak');fill(handler,c.ast.body.filter(n=>n.kind==='handler'&&!n.params).map(n=>[n.name,n.name]),'Kreiraj radnju nad podatkom');button.disabled=!c.ir.ui?.screens.length;}catch{button.disabled=true;}}
 button.onclick=()=>{try{
  const old=api.source(),spec={kind:kind.value,screen:api.screen(),id:id.value,label:label.value,options:options.value,min:min.value,max:max.value,step:step.value,target:target.value,handler:handler.value,amount:amount.value,text:amount.value};
  if(initial.value!=='')spec.initial=['number','progress','motion'].includes(kind.value)?Number(initial.value):initial.value;
  const next=build(old,spec);api.setSource(next.source);api.inspect();result.textContent=JSON.stringify(next.added,null,2);status.textContent='Element je dodan u postojeći ekran '+next.added.screen+'. Njegova polja i dugmad rade u pregledu. Primijeni skicu ili pokreni aplikaciju da je sačuvaš u projekt.';
  const used=new Set(B.compile(next.source).ast.body.map(n=>n.name));let n=1;while(used.has('element_'+n)||next.source.includes('key element_'+n))n++;id.value='element_'+n;refresh();
 }catch(error){status.textContent=error.message;api.error(error);}};
 root.append(button,status,preview);api.parent.append(root);configure();refresh();return {refresh};
}
scope.CLEA7BILElements=Object.freeze({format:'bil.working-elements/1',kinds:KINDS,build,attach,buildCollection,attachCollection});
})(globalThis);
