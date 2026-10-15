'use strict';
/* Original reusable compositions. Design material data is MIT licensed;
   the Studio and Runtime retain their separate licence. No network resources. */
(function(scope){
const F=scope.CLEA7Format,L=scope.CLEA7Living;
const LICENSE="MIT License — original CLEA7 reusable design materials\n\nCopyright (c) 2026 Brzo i Lokalno\n\nScope: original composition design data, palette definitions, motion presets and\nmaterialized application components supplied by the CLEA7 Materials library.\nGenerated applications may reuse, modify and redistribute those materials,\nincluding in commercial applications. This grant does not change the licence\nof the Studio, Runtime, SDK implementation, trademarks or third-party components.\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof these materials and associated documentation files (the \"Materials\"), to deal\nin the Materials without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies\nof the Materials, and to permit persons to whom the Materials are furnished to\ndo so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Materials.\n\nTHE MATERIALS ARE PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE MATERIALS OR THE USE OR OTHER DEALINGS IN THE\nMATERIALS.\n";
function notice(p){L.upgrade(p);p.format='clea7.application/4';p.licenses=p.licenses||[];if(!p.licenses.some(x=>x.id==='clea7_materials_mit'))p.licenses.push({id:'clea7_materials_mit',name:'MIT · originalni CLEA7 materijali',text:LICENSE});return p;}
const THEMES=[
 {id:'tech',name:'TECH · bakar',canvas:'#0c1520',surface:'#162534',ink:'#f2f6fa',muted:'#bdd0df',accent:'#ffb27f',contrast:'#17202a'},
 {id:'fjord',name:'Jutro na rijeci',canvas:'#0b1922',surface:'#123040',ink:'#eef9ff',muted:'#b6d3df',accent:'#8bd8f8',contrast:'#0b2230'},
 {id:'forest',name:'Tiha šuma',canvas:'#0d1c18',surface:'#18352a',ink:'#f1faf3',muted:'#bfd9c8',accent:'#a8e4b1',contrast:'#10291a'},
 {id:'violet',name:'Noćni spektar',canvas:'#151226',surface:'#292340',ink:'#f7f2ff',muted:'#d0c4e7',accent:'#c5b3ff',contrast:'#221c3a'},
 {id:'rose',name:'Suton nad gradom',canvas:'#22151c',surface:'#3a2530',ink:'#fff4f8',muted:'#e0c5d0',accent:'#ffb3cb',contrast:'#341b28'},
 {id:'amber',name:'Topla radionica',canvas:'#211b12',surface:'#352c1d',ink:'#fff8e9',muted:'#dfd0ae',accent:'#efcf85',contrast:'#2a230f'},
 {id:'slate',name:'Mirni grafit',canvas:'#151a20',surface:'#252e38',ink:'#f1f6fc',muted:'#c4cedb',accent:'#b9d1f4',contrast:'#1b273a'},
 {id:'mint',name:'Otvoreni horizont',canvas:'#102022',surface:'#1a3439',ink:'#eefdfb',muted:'#bedbd8',accent:'#83e1d5',contrast:'#0c302c'}
];
const CATALOG=[
 ['welcome','Početni prostor','Ekrani','Naslov, uvod i dugme koje stvarno pokreće lokalni tok.'],
 ['steps','Vođeni koraci','Navigacija','Tri koraka s provjerom granica i povratkom.'],
 ['tabs','Izbor radnog pogleda','Navigacija','Tri izbora koji mijenjaju sačuvano stanje.'],
 ['note','Kartica za bilješku','Podaci','Uredi tekst, potvrdi unos i sačuvaj lokalnu bilješku.'],
 ['checklist','Priprema prije rada','Kontrole','Tri nezavisne stavke i provjera spremnosti.'],
 ['disclosure','Detalji na zahtjev','Kontrole','Otvori i zatvori objašnjenje stvarnim tokom.'],
 ['recordlist','Lokalna lista zapisa','Podaci','Dodavanje, osvježavanje i brisanje iz trajne tabele.'],
 ['navigation','Povezani ekrani','Navigacija','Dodatni ekrani s funkcionalnim povratkom.'],
 ['decision','Odluka s uslovom','Logika','Dva ulaza, jasna provjera i obrazložen ishod.'],
 ['lifecycle','Životni ciklus','Logika','Stanja pripreme, pregleda i potvrde preko state machine.'],
 ['typography','Tipografski blok','Oblikovanje','Originalna hijerarhija naslova, uvoda i izdvojene poruke.'],
 ['geometry','Geometrijska kompozicija','Oblikovanje','Uredive geometrijske površine bez slika ili vanjskih fontova.']
].map(([id,name,category,description])=>({id,name,category,description}));
const MOTION=[
 {id:'appear',name:'Jasan dolazak',duration:360,tracks:[['opacity',0,1]]},
 {id:'rise',name:'Mirni uspon',duration:480,tracks:[['opacity',0,1],['translateY',18,0]]},
 {id:'slide',name:'Bočni ulaz',duration:420,tracks:[['opacity',0,1],['translateX',-24,0]]},
 {id:'settle',name:'Fokus površine',duration:320,tracks:[['scale',.94,1],['opacity',.4,1]]},
 {id:'breathe',name:'Jedan mirni impuls',duration:800,tracks:[['scale',1,1.025,1]]},
 {id:'tilt',name:'Blagi naglasak',duration:500,tracks:[['rotate',-3,2,0]]}
];
function theme(id){return THEMES.find(t=>t.id===id)||THEMES[0];}
function fragment(kind,palette='tech'){
 if(!CATALOG.some(m=>m.id===kind))throw Error('Materijal ne postoji.');
 const t=theme(palette),prefix=F.newId('material'),id=name=>prefix+'_'+name,ref=name=>({ref:'state',key:id(name)}),op=(name,...args)=>({op:name,args});
 const state={},flows={},tables={},machines={},screens=[],root={id:id('root'),type:'card',style:{background:t.surface,color:t.ink,padding:20,radius:18,gap:14},children:[]};
 const text=(name,value,type='text')=>({id:id(name),type,text:value,style:{color:type==='heading'?t.ink:t.muted,...(type==='heading'?{fontSize:26,fontWeight:800}:{fontSize:16})}});
 const set=(key,value)=>({action:'set',key:id(key),value});
 const button=(name,label,flow)=>({id:id(name),type:'button',text:label,events:{click:id(flow)},style:{background:t.accent,color:t.contrast,radius:12,padding:12,fontWeight:700}});
 const input=(name,label,type='input')=>({id:id(name+'_input'),type,label,bind:id(name)});
 const row=(name,children)=>({id:id(name),type:'row',style:{gap:10,wrap:true},children});
 function initial(name,value){state[id(name)]=value;}
 function flow(name,steps){flows[id(name)]=steps;}
 const children=root.children;
 if(kind==='welcome'){
  initial('status','Spremno za tvoj prvi korak.');flow('start',[set('status','Radni prostor je pokrenut na ovom uređaju.')]);
  children.push(text('eyebrow','TVOJA IDEJA · TVOJ PROSTOR'),text('title','Od ideje do nečega tvog.','heading'),text('intro','Uredi sadržaj, poveži logiku i isprobaj rezultat u svom ritmu.'),button('start','Pokreni radni prostor','start'),text('status',ref('status')));
 }else if(kind==='steps'){
  initial('step',0);flow('next',[{action:'if',condition:op('less',ref('step'),2),then:[{action:'increment',key:id('step'),value:1}],else:[{action:'notify',value:'Svi koraci su pregledani.'}]}]);flow('back',[{action:'if',condition:op('greater',ref('step'),0),then:[{action:'increment',key:id('step'),value:-1}],else:[]}]);
  children.push(text('title','Prostor za tri jasna koraka','heading'),text('current',op('concat','Korak ',op('add',ref('step'),1),' od 3')),text('guide','1. Opiši ideju.  2. Razradi postupak.  3. Provjeri rezultat.'),row('controls',[button('back','← Nazad','back'),button('next','Dalje →','next')]));
 }else if(kind==='tabs'){
  initial('view','Pregled');for(const [i,label]of ['Pregled','Plan','Zaključak'].entries())flow('choose'+i,[set('view',label)]);
  children.push(text('title','Tvoj radni pogled','heading'),row('choices',['Pregled','Plan','Zaključak'].map((label,i)=>button('tab'+i,label,'choose'+i))),text('selected',op('concat','Odabrano: ',ref('view'))));
 }else if(kind==='note'){
  initial('draft','');initial('saved','');flow('save',[{action:'if',condition:op('greater',op('length',ref('draft')),0),then:[set('saved',ref('draft'))],else:[{action:'notify',value:'Prvo unesi tekst bilješke.'}]}]);
  children.push(text('title','Misao koju želiš sačuvati','heading'),input('draft','Tvoja bilješka','textarea'),button('save','Sačuvaj na ovom uređaju','save'),text('saved',ref('saved')));
 }else if(kind==='checklist'){
  for(const key of ['goal','data','check'])initial(key,false);initial('result','Označi pripremljene stavke.');flow('check',[{action:'if',condition:op('and',ref('goal'),ref('data'),ref('check')),then:[set('result','Sve tri stavke su spremne.')],else:[set('result','Priprema još nije završena.')]}]);
  children.push(text('title','Prije sljedećeg koraka','heading'),input('goal','Cilj je jasan','checkbox'),input('data','Podaci su pripremljeni','checkbox'),input('check','Rezultat je pregledan','checkbox'),button('check','Provjeri spremnost','check'),text('result',ref('result')));
 }else if(kind==='disclosure'){
  initial('open',false);initial('detail','');flow('toggle',[{action:'if',condition:ref('open'),then:[set('open',false),set('detail','')],else:[set('open',true),set('detail','Ovaj sadržaj je dio tvoje aplikacije. Uredi ga u dizajneru ili izvornom modelu; ne preuzima se sa servera.')]}]);
  children.push(text('title','Jasno kad ti zatreba','heading'),button('toggle','Otvori / zatvori detalje','toggle'),text('detail',ref('detail')));
 }else if(kind==='recordlist'){
  initial('draft','');initial('record',{});initial('rows',[]);tables[id('entries')]={title:'text'};const query={action:'record.query',table:id('entries'),key:id('rows'),where:{},limit:100};
  flow('add',[{action:'if',condition:op('greater',op('length',ref('draft')),0),then:[{action:'record.create',table:id('entries'),key:id('record'),value:{title:ref('draft')}},set('draft',''),query],else:[{action:'notify',value:'Unesi naziv zapisa.'}]}]);flow('refresh',[query]);const item={ref:'item',key:'value'};flow('remove',[{action:'record.delete',table:id('entries'),key:id('record'),id:op('field',item,'id')},query]);
  children.push(text('title','Zapisi koji ostaju kod tebe','heading'),input('draft','Naziv novog zapisa'),row('controls',[button('add','Dodaj zapis','add'),button('refresh','Osvježi','refresh')]),{id:id('list'),type:'list',bind:id('rows'),children:[{id:id('entry'),type:'card',children:[text('entry_title',op('field',op('field',item,'data'),'title')),button('remove','Obriši ovaj zapis','remove')]}]});
 }else if(kind==='navigation'){
  // The insertion function resolves the current screen as the home target.
  flow('home',[{action:'navigate',screen:'MATERIAL_HOME'}]);
  for(const [key,title,description]of [['details','Detalji','Ovdje razradi sadržaj svog projekta.'],['help','Pomoć','Napiši jasne upute namijenjene korisniku svoje aplikacije.']]){flow(key,[{action:'navigate',screen:id(key)}]);screens.push({id:id(key),name:title,children:[text(key+'_title',title,'heading'),text(key+'_description',description),button(key+'_home','← Vrati se','home')]});}
  children.push(text('title','Sve ima svoje mjesto','heading'),row('links',[button('details','Detalji','details'),button('help','Pomoć','help')]));
 }else if(kind==='decision'){
  initial('available',0);initial('required',0);initial('result','Unesi vrijednosti i provjeri odnos.');flow('decide',[{action:'if',condition:op('less',ref('available'),ref('required')),then:[set('result','Raspoloživa vrijednost je manja od potrebne.')],else:[set('result','Raspoloživa vrijednost pokriva potrebnu. Provjeri da oba unosa koriste istu jedinicu.')]}]);
  children.push(text('title','Odluka s jasnim razlogom','heading'),input('available','Raspoloživa vrijednost','number'),input('required','Potrebna vrijednost','number'),button('decide','Provjeri odnos','decide'),text('result',ref('result')));
 }else if(kind==='lifecycle'){
  initial('phase','priprema');machines[id('lifecycle')]={stateKey:id('phase'),initial:'priprema',states:{priprema:{on:{next:[{to:'pregled'}]}},pregled:{on:{next:[{to:'potvrda'}],back:[{to:'priprema'}]}},potvrda:{on:{back:[{to:'pregled'}]}}}};for(const event of ['next','back'])flow(event,[{action:'machine.event',machine:id('lifecycle'),event}]);
  children.push(text('title','Postupak koji zna svoje stanje','heading'),text('phase',op('concat','Trenutno: ',ref('phase'))),row('controls',[button('back','Prethodno stanje','back'),button('next','Sljedeće stanje','next')]));
 }else if(kind==='typography'){
  children.push(text('eyebrow','PROSTOR ZA DOBRE IDEJE'),text('title','Jasna poruka.\nVlastiti potpis.','heading'),text('intro','Uvod koji objašnjava šta tvoj korisnik može uraditi i zašto mu to koristi.'),{id:id('quote'),type:'card',style:{background:t.canvas,padding:18,radius:12},children:[text('quote_text','Neka svaki detalj ima svoju svrhu.') ]});
 }else if(kind==='geometry'){
  children.push(text('title','Ritam od sedam površina','heading'),row('shapes',Array.from({length:7},(_,i)=>({id:id('shape'+i),type:'card',style:{background:i%2?t.accent:t.canvas,width:28+i*5,minHeight:26+(i%3)*20,radius:i%2?12:4,padding:0},children:[]}))),text('caption','Kompozicija je izgrađena od uredljivih površina. Promijeni boje, raspored i proporcije u dizajneru.'));
 }
 return {root,state,flows,tables,machines,screens};
}
function insert(project,kind,{themeId='tech',screenId=project.start,parentId=null}={}){
 const p=F.clone(project),screen=p.screens.find(s=>s.id===screenId);if(!screen)throw Error('Odredišni ekran ne postoji.');notice(p);const part=fragment(kind,themeId);
 for(const steps of Object.values(part.flows))for(const step of steps)if(step.screen==='MATERIAL_HOME')step.screen=screen.id;
 Object.assign(p.state,part.state);Object.assign(p.flows,part.flows);Object.assign(p.tables,part.tables);Object.assign(p.machines,part.machines);p.screens.push(...part.screens);
 let parent=null;function walk(ns){for(const n of ns){if(n.id===parentId)parent=n;walk(n.children||[]);}}walk(screen.children);if(parentId&&(!parent||!['row','column','card'].includes(parent.type)))throw Error('Odaberi raspored ili odredišni ekran.');if(parent){parent.children=parent.children||[];parent.children.push(part.root);}else screen.children.push(part.root);
 return {project:F.validate(p),selected:part.root.id};
}
function applyTheme(project,themeId){const p=notice(F.clone(project)),t=theme(themeId);function visit(ns){for(const n of ns){n.style=n.style||{};if(['card','column'].includes(n.type))n.style.background=t.surface;if(n.type==='button'){n.style.background=t.accent;n.style.color=t.contrast;}else if(['text','heading'].includes(n.type))n.style.color=n.type==='heading'?t.ink:t.muted;visit(n.children||[]);}}for(const screen of p.screens)visit(screen.children);return F.validate(p);}
function addMotion(project,target,preset='appear'){
 const p=F.clone(project),recipe=MOTION.find(m=>m.id===preset);if(!recipe)throw Error('Animacijski materijal ne postoji.');notice(p);let found=false;function walk(ns){for(const n of ns){if(n.id===target)found=true;walk(n.children||[]);}}p.screens.forEach(s=>walk(s.children));if(!found)throw Error('Prvo odaberi komponentu na platnu.');
 const id=F.newId('motion');p.animations[id]={duration:recipe.duration,iterations:1,easing:'ease-out',tracks:recipe.tracks.map(([property,...values])=>({target,property,frames:values.map((value,i)=>({at:Math.round(i*recipe.duration/(values.length-1)),value}))}))};const flow=F.newId('motionFlow');p.flows[flow]=[{action:'animate',animation:id}];return {project:F.validate(p),animation:id,flow};
}
function attach(api){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;},section=el('section');section.id='materials';section.className='panel';section.hidden=true;document.querySelector('main').append(section);const nav=el('button','Materijali');nav.dataset.panel='materials';nav.onclick=()=>api.panel('materials');document.querySelector('nav').insertBefore(nav,document.getElementById('open-project'));
 let selectedTheme='tech',category='Sve',query='';const element=(name,run)=>{const b=el('button',name);b.type='button';b.onclick=()=>{try{run();}catch(e){api.status(e.message);}};return b;};
 function commit(next,selected=null){return api.change(()=>{const p=api.project();for(const key of Object.keys(p))delete p[key];Object.assign(p,next);if(selected)api.select(selected);});}
 function draw(){
  section.replaceChildren();const sidebar=el('aside'),main=el('article'),right=el('aside');section.append(sidebar,main,right);sidebar.append(el('h2','Originalna biblioteka'),el('p','Uredive kompozicije, osam tema i šest animacijskih postupaka. Sve radi bez mreže.'));
  const search=el('input');search.type='search';search.placeholder='Pronađi materijal';search.setAttribute('aria-label','Pretraži materijale');search.value=query;sidebar.append(search);const categories=el('select');categories.setAttribute('aria-label','Vrsta materijala');for(const name of ['Sve',...new Set(CATALOG.map(m=>m.category))]){const o=el('option',name);o.value=name;categories.append(o);}categories.value=category;sidebar.append(categories);
  const grid=el('div');grid.className='materials-grid';main.append(el('h1','Sastavi nešto svoje.'),el('p','Svaki interaktivni materijal donosi stvarne podatke i tokove. Možeš ih urediti u dizajneru, logici ili izvornom modelu.'),grid);
  function results(){grid.replaceChildren();const entries=CATALOG.filter(m=>(category==='Sve'||m.category===category)&&(m.name+' '+m.description).toLocaleLowerCase().includes(query.toLocaleLowerCase()));for(const m of entries){const card=el('section');card.className='material-card';const graphic=el('div');graphic.className='material-art';graphic.setAttribute('aria-hidden','true');const demo=insert(F.project('blank'),m.id,{themeId:selectedTheme}).project,engine=new scope.CLEA7Engine.Engine(demo,{vault:new scope.CLEA7.MemoryVault(),modules:null});try{scope.CLEA7Engine.mount(graphic,engine);graphic.querySelectorAll('button,input,textarea,select').forEach(n=>{n.disabled=true;n.tabIndex=-1;});}finally{engine.close();}card.append(graphic,el('p',m.category),el('h2',m.name),el('p',m.description),element('Umetni · '+m.name,()=>{const located=api.locate(api.selected())?.n,parentId=located&&['row','column','card'].includes(located.type)?located.id:null,result=insert(api.project(),m.id,{themeId:selectedTheme,screenId:api.screen().id,parentId});if(!commit(result.project,result.selected))return;api.status('Materijal je umetnut. Uredi njegove komponente i tokove; Undo vraća promjenu.');}));grid.append(card);}if(!entries.length)grid.append(el('p','Nema materijala za ovu pretragu.'));}
  search.oninput=()=>{query=search.value;results();};categories.onchange=()=>{category=categories.value;results();};results();right.append(el('h2','Paleta tvoje aplikacije'));const select=el('select');select.setAttribute('aria-label','Tema materijala');for(const t of THEMES){const o=el('option',t.name);o.value=t.id;select.append(o);}select.value=selectedTheme;select.onchange=()=>{selectedTheme=select.value;swatches();results();};right.append(select);const colors=el('div');colors.className='theme-swatches';right.append(colors);function swatches(){colors.replaceChildren();const t=theme(selectedTheme);for(const color of [t.canvas,t.surface,t.ink,t.muted,t.accent]){const sample=el('span');sample.style.background=color;sample.title=color;colors.append(sample);}}swatches();right.append(element('Primijeni temu na projekt',()=>{if(!commit(applyTheme(api.project(),selectedTheme)))return;api.status('Tema je primijenjena. Undo vraća prethodne boje.');}));
  right.append(el('h2','Pokret za odabranu komponentu'));for(const m of MOTION)right.append(element(m.name,()=>{const result=addMotion(api.project(),api.selected(),m.id);if(!commit(result.project))return;api.status('Animacija je dodana u timeline. Tok '+result.flow+' možeš povezati s događajem komponente.');}));right.append(el('h2','Slobodno za tvoju aplikaciju'),el('p','Originalni materijali ove biblioteke dostupni su pod MIT licencom, uključujući komercijalnu upotrebu. Sistemski fontovi se ne preuzimaju niti prepakivaju. Licenca materijala ne mijenja licencu jezgra Studija.'));
 }
 return {draw};
}
scope.CLEA7Materials={license:LICENSE,catalog:()=>F.clone(CATALOG),themes:()=>F.clone(THEMES),motion:()=>F.clone(MOTION),fragment,insert,applyTheme,addMotion,attach};
})(globalThis);
