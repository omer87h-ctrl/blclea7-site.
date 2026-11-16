'use strict';
/* Same Studio, compiler, Draw, undo and local save path. No external project URL. */
(function(scope){
 if(new URLSearchParams(location.search).get('collaboration')!=='cowonder')return;
 async function start(){
  const P=scope.CLEA7Personalisation,W=scope.CLEA7Workbench;
  const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  const dialog=el('dialog'),form=el('form'),message=el('p');dialog.id='collaboration-review';message.setAttribute('role','status');
  function field(label,name,kind='input'){const l=el('label',label),input=el(kind);input.name=name;input.setAttribute('aria-label',label);l.append(input);form.append(l);return input;}
  form.append(el('h2',P.BRAND),el('p','Ovdje izrađujemo korisnikovu ličnu aplikaciju. Ivana bi oblikovala dizajn ako prihvati saradnju; BL CLEA Studio i BIL daju joj funkcije.'));
  const person=field('Za koga pravimo aplikaciju?','person');person.maxLength=50;person.required=true;
  const needs=field('Šta aplikacija treba raditi?','needs','textarea');needs.maxLength=3000;needs.required=true;needs.rows=5;
  const palette=field('Boje aplikacije','palette','select'),layout=field('Raspored pregleda','layout','select');
  for(const [value,label]of [['copper','CLEA · tamna podloga i bakar'],['forest','Svijetla podloga i šumska zelena']]){const o=el('option',label);o.value=value;palette.append(o);}
  for(const [value,label]of [['row','Pokazatelji u redu'],['column','Pokazatelji jedan ispod drugog']]){const o=el('option',label);o.value=value;layout.append(o);}
  function fill(b){person.value=b.person;needs.value=b.needs;palette.value=b.palette;layout.value=b.layout;}
  fill({person:'',needs:'',palette:'copper',layout:'row'});
  try{const saved=sessionStorage.getItem(P.KEY);if(saved)fill(P.validate(JSON.parse(saved)));}catch{message.textContent='Sačuvani zahtjev nije dostupan. Možeš ga unijeti ili učitati iz datoteke.';}
  const file=field('Učitaj sačuvani zahtjev','brief','input');file.type='file';file.accept='.json,application/json';
  file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>16384)throw Error('Zahtjev prelazi16 KiB.');fill(P.validate(JSON.parse(await f.text())));message.textContent='Zahtjev je učitan. Pregledaj ga prije kreiranja.';}catch(e){message.textContent=e.message;}finally{file.value='';}};
  form.append(el('p','Početna aplikacija već izvršava projekte, rokove i zadatke. Opis ostalih potreba ostaje uz projekt kao dizajnerski zahtjev; sam opis ne dodaje nove funkcije.'));
  const create=el('button','Kreiraj ličnu aplikaciju u Draw-u');create.type='submit';
  const cancel=el('button','Vrati se u Studio');cancel.type='button';cancel.onclick=()=>{dialog.close();dialog.remove();};form.append(create,cancel,message);dialog.append(form);document.body.append(dialog);dialog.showModal();
  form.onsubmit=async event=>{event.preventDefault();create.disabled=true;try{
   const brief=P.validate({format:'clea7.personal-brief/1',person:person.value,needs:needs.value,palette:palette.value,layout:layout.value}),expected=W.snapshot();
   if(!confirm('Kreirati zasebnu ličnu aplikaciju? Trenutni projekt ostaje u historiji za Poništi.'))return;
   const r=await fetch('personal-workspace.bil',{cache:'no-cache'});if(!r.ok)throw Error('BIL osnova nije dostupna.');const source=await r.text();if(new TextEncoder().encode(source).length>65536)throw Error('BIL osnova prelazi64 KiB.');
   const id=CLEA7Format.newId('app'),candidate=P.build(source,brief,{id,package:'com.brzoilokalno.personal.'+id.replace(/_/g,''),version:1});
   W.applyReviewed(candidate,expected);await W.save();try{sessionStorage.setItem(P.KEY,JSON.stringify(brief));}catch{}
   const notes=el('details'),title=el('summary','Zahtjev korisnika · '+brief.person),body=el('p',brief.needs);notes.id='personal-design-brief';notes.append(title,body,el('p','BIL je funkcija; Draw je izgled. Izgradi → Preuzmi web aplikaciju.'));
   document.querySelector('#personal-design-brief')?.remove();document.querySelector('#draw').prepend(notes);
   document.querySelector('[data-panel="draw"]').click();dialog.close();dialog.remove();
  }catch(e){message.textContent=e.message;}finally{create.disabled=false;}};
 }
 if(scope.CLEA7Workbench)start();else scope.addEventListener('clea:studio-ready',start,{once:true});
})(globalThis);
