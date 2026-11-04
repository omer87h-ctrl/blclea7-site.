'use strict';
(function(){
const $=id=>document.getElementById(id),frame=$('studio-frame');
let candidate=null;
const vocabulary=[
 ['stock',/zali|sklad|magacin|inventar|artik|stock|inventory|warehouse/i],
 ['orders',/nalog|naloz|poslov|poslovi|zadat|order|job|task/i],
 ['clients',/klijent|kupac|kupc|kontakt|client|customer|contact/i],
 ['expenses',/tros|rashod|izdat|expense|cost/i],
 ['offers',/ponud|predracun|offer|quote/i]
];
function normal(s){return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'dj');}
function mark(name,message,state='passed'){for(const item of $('pillar-log').children)if(item.dataset.pillar===name){item.dataset.state=state;item.querySelector('span').textContent=message;}}
function status(s,bad=false){$('status').textContent=s;$('status').dataset.error=String(bad);}
async function studio(){for(let n=0;n<30;n++){const w=frame.contentWindow;if(w?.CLEA7Workbench&&w.CLEA7Business&&w.CLEA7Format)return w;await new Promise(r=>setTimeout(r,300));}throw Error('Studio se još učitava. Pokušaj ponovo.');}
for(const b of document.querySelectorAll('[data-example]'))b.onclick=()=>{$('request').value=b.dataset.example;};
$('prepare').onclick=async()=>{
 candidate=null;$('apply').disabled=true;$('download').disabled=true;$('result').hidden=true;
 for(const item of $('pillar-log').children){delete item.dataset.state;item.querySelector('span').textContent='Čeka zadatak.';}
 const request=$('request').value.trim(),text=normal(request);
 if(!request||request.length>800){status('Unesi zahtjev do 800 znakova.',true);return;}
 if(/online|firebase|server|cloud|payment|placan|naplat|lozink|login|kamera|video|gps|registracij|api/i.test(text)){mark('Fallback Executor','Ove mogućnosti još nisu podržane.','blocked');status('Za sada mogu napraviti samo lokalne poslovne evidencije i BIL kalkulator.',true);return;}
 mark('Core AI Manager','Zahtjev je ograničen na podržane lokalne funkcije.');
 $('prepare').disabled=true;
 try{
 const w=await studio(),ids=vocabulary.filter(([id,re])=>re.test(text)).map(([id])=>id);
 if(/kalkulator|calculator/i.test(text)&&!ids.length){
  w.document.querySelector('[data-panel="clea-ai"]')?.click();
  const area=w.document.getElementById('clea-ai-request');if(area)area.value='Create a simple calculator application.';
  mark('Link Bridge Elite','Otvoren postojeći BIL generator.');mark('Holo Interaction','BIL editor je otvoren u Studiom.');
  status('U Studiom klikni „Pripremi i provjeri prijedlog“, zatim pregledaj kod i potvrdi primjenu.');return;
 }
 if(ids.length===0){mark('Fallback Executor','Namjena nije podržana.','blocked');status('Probaj: zalihe, nalozi, klijenti, troškovi ili ponude.',true);return;}
 const available=w.CLEA7Business.modules(),selected=ids.map(id=>available.find(x=>x.id===id));
 if(selected.some(x=>!x))throw Error('Nedostaje stvarni CLEA modul.');
 mark('Link Bridge Elite','Odabrano: '+selected.map(x=>x.title).join(', '));
 const company=$('company').value.trim();if(!company)throw Error('Unesi naziv aplikacije.');
 const project=w.CLEA7Business.create({name:company,company,modules:selected});
 mark('Expansion Q','Generisano '+project.screens.length+' stvarnih ekrana.');
 candidate=w.CLEA7Format.validate(project);
 mark('Adaptive Recovery','CLEA validator je potvrdio aplikacijski model.');
 mark('Fallback Executor','Rezervni postupak nije potreban.');
 mark('Vision Q','Provjereno: '+Object.keys(candidate.tables||{}).length+' lokalnih evidencija.');
 $('result-summary').textContent=candidate.name+' · '+candidate.screens.length+' ekrana · '+Object.keys(candidate.flows).length+' tokova.';
 $('result-modules').replaceChildren(...selected.map(x=>{const e=document.createElement('span');e.textContent=x.title;return e;}));
 $('result-source').textContent=JSON.stringify(candidate,null,2).slice(0,9000);
 $('result').hidden=false;$('apply').disabled=false;$('download').disabled=false;
 status('Prijedlog je spreman. Provjeri ga i pokreni u Studiom.');
 }catch(e){mark('Adaptive Recovery',e.message,'blocked');status(e.message,true);}
 finally{$('prepare').disabled=false;}
};
$('apply').onclick=async()=>{
 if(!candidate)return;
 if(!confirm('Zamijeniti trenutni projekt unutar ovog testnog Studija? Prethodni prvo sačuvaj.'))return;
 try{const w=await studio();w.CLEA7Workbench.open(w.CLEA7Format.validate(candidate));candidate=null;$('apply').disabled=true;
 w.document.querySelector('[data-panel="test"]')?.click();await w.CLEA7Workbench.run();
 mark('Holo Interaction','Stvarni CLEA Runtime je pokrenuo aplikaciju.');
 status('Aplikacija radi u Studiom desno. Probaj dodati zapis u evidenciju.');
 }catch(e){status(e.message,true);}
};
$('download').onclick=()=>{if(!candidate)return;const url=URL.createObjectURL(new Blob([JSON.stringify(candidate,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='clea-prijedlog.clea7';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);};
function tab(chat){$('builder').hidden=chat;$('chat').hidden=!chat;$('show-builder').setAttribute('aria-pressed',String(!chat));$('show-chat').setAttribute('aria-pressed',String(chat));if(chat&&$('chat-frame').getAttribute('src')==='about:blank')$('chat-frame').setAttribute('src','../razgovor/');}
$('show-builder').onclick=()=>tab(false);$('show-chat').onclick=()=>tab(true);
frame.addEventListener('load',()=>status('CLEA Studio je učitan. Unesi zahtjev za aplikaciju.'));
})();
