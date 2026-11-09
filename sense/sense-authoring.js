/* Accessible CV authoring from user-confirmed facts. No inference or upload. */
(function(scope){'use strict';
const fields=[['name','Ime ili naziv koji želiš prikazati'],['role','Zanimanje ili kratki opis'],['contact','Kontakt — samo ako ga želiš navesti'],['experience','Radno iskustvo'],['education','Obrazovanje'],['skills','Vještine'],['projects','Projekti']];
function buildCV(values){
 if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(key=>!fields.some(([id])=>id===key)))throw Error('Nepoznata CV polja.');
 const read=id=>{const value=values[id]??'';if(typeof value!=='string'||value.length>6000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('Polje sadrži previše teksta ili nedozvoljene znakove.');return value.trim();};
 const identity=['name','role','contact'].map(read).filter(Boolean).join('\n'),sections=[];if(identity)sections.push(identity);
 for(const [id,label]of fields.slice(3)){const value=read(id);if(value)sections.push(label+'\n\n'+value);}
 const result=sections.join('\n\n');if(!result||result.length>30000)throw Error('Unesi barem jedan podatak; CV može imati do 30.000 znakova.');return result;
}
scope.CLEA7SenseAuthoring=Object.freeze({format:'sense.cv-authoring/1',buildCV});
if(typeof document==='undefined')return;
const cv=document.getElementById('cv-text'),draft=document.getElementById('draft-text');if(!cv||!draft)return;
const make=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
const open=make('button','Napravi CV korak po korak');open.type='button';open.id='sense-create-cv';open.className='button secondary';cv.closest('section').querySelector('.input-bottom')?.append(open);
const dialog=make('dialog');dialog.id='sense-cv-authoring';dialog.setAttribute('aria-labelledby','sense-authoring-title');
const title=make('h2','Napravi svoj CV');title.id='sense-authoring-title';title.tabIndex=-1;
const note=make('p','Navodiš samo vlastite podatke. Nijedan podatak nije obavezan pojedinačno. Sve se obrađuje na ovom uređaju; spremanje biraš zasebno.');
const progress=make('p');progress.setAttribute('role','status');const panels=[],inputs={};
for(const [id,label]of fields){const panel=make('section'),labelNode=make('label',label),input=make(id==='name'||id==='role'?'input':'textarea');input.id='sense-cv-'+id;input.maxLength=6000;if(input.tagName==='TEXTAREA')input.rows=5;labelNode.htmlFor=input.id;panel.append(labelNode,input);panels.push(panel);inputs[id]=input;}
const review=make('section'),preview=make('pre'),confirmLabel=make('label'),approved=make('input');approved.type='checkbox';approved.id='sense-cv-confirm';confirmLabel.append(approved,document.createTextNode(' Pregledao/la sam tekst; ne sadrži izmišljene kvalifikacije.'));review.append(preview,confirmLabel);panels.push(review);
let cvReader=null;
cv.addEventListener('input',()=>cvReader?.stop());
async function readCVText(text,status){
 try{cvReader=cvReader||scope.CLEA7SenseSDK.reader();const voices=cvReader.voices(),voice=voices.find(v=>/^(bs|hr|sr)(-|$)/i.test(v.language))||voices[0];if(!voice)throw Error('Uređaj ne nudi potvrđen lokalni glas. Tekst ostaje dostupan sistemskom čitaču ekrana.');await cvReader.read(text,{approved:true,voiceName:voice.name});}
 catch(error){if(error.code!=='Cancelled')status.textContent=error.message;}
}
const readReview=make('button','Pročitaj pregled CV-a'),stopReview=make('button','Zaustavi čitanje CV-a');readReview.type=stopReview.type='button';readReview.id='sense-cv-read-review';readReview.onclick=()=>readCVText(preview.textContent,progress);stopReview.onclick=()=>cvReader?.stop();review.append(readReview,stopReview);
const controls=make('div');controls.className='button-row';
const previous=make('button','Prethodno'),next=make('button','Sljedeće'),apply=make('button','Potvrdi i prenesi CV'),close=make('button','Zatvori bez prenosa');for(const button of [previous,next,apply,close]){button.type='button';button.className='button secondary';controls.append(button);}
previous.id='sense-cv-previous';next.id='sense-cv-next';apply.id='sense-cv-apply';close.id='sense-cv-close';
dialog.append(title,note,progress,...panels,controls);document.body.append(dialog);let step=0;
const values=()=>Object.fromEntries(fields.map(([id])=>[id,inputs[id].value]));
function draw(){cvReader?.stop();panels.forEach((panel,index)=>panel.hidden=index!==step);progress.textContent='Korak '+(step+1)+' od '+panels.length+': '+(fields[step]?.[1]||'Pregled i potvrda');previous.disabled=step===0;next.hidden=step===panels.length-1;apply.hidden=step!==panels.length-1;apply.disabled=!approved.checked;if(step===panels.length-1)preview.textContent=buildCV(values());(fields[step]?inputs[fields[step][0]]:title).focus();}
open.addEventListener('click',()=>{document.body.classList.add('sense-entered');step=0;approved.checked=false;dialog.showModal();draw();});
const shortcut=make('button','Novi CV · vođeni unos');shortcut.type='button';shortcut.id='sense-create-cv-shortcut';shortcut.className='button secondary';shortcut.onclick=()=>open.click();document.querySelector('#sense-spatial-host .spatial-footer')?.append(shortcut);
previous.onclick=()=>{if(step>0){step--;draw();}};next.onclick=()=>{try{if(step===fields.length-1)buildCV(values());step++;draw();}catch(error){step=Math.min(step,fields.length-1);progress.textContent=error.message;}};
approved.onchange=()=>apply.disabled=!approved.checked;close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{cvReader?.stop();open.focus();});
apply.onclick=()=>{
 try{if(!approved.checked)throw Error('Prvo potvrdi tekst.');const text=buildCV(values());if((cv.value.trim()||draft.value.trim())&&!scope.confirm('Zamijeniti trenutni CV i nacrt potvrđenim tekstom? Prvo sačuvaj prethodni ako ga želiš zadržati.'))return;
  cv.value=text;cv.dispatchEvent(new Event('input',{bubbles:true}));draft.value=text;draft.dispatchEvent(new Event('input',{bubbles:true}));dialog.close();document.querySelector('#primary-nav [data-view="workspace"]')?.click();cv.focus();document.getElementById('status-text').textContent='Tvoj potvrđeni CV je spreman za uređivanje i DOCX izvoz. Za kasniji nastavak izaberi Sačuvaj na ovom uređaju ili preuzmi projekt.';
 }catch(error){progress.textContent=error.message;}
};
const file=make('input');file.type='file';file.accept='.txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';file.id='sense-cv-text-file';file.hidden=true;
const upload=make('button','Učitaj postojeći CV (TXT, DOCX, PDF)');upload.type='button';upload.id='sense-cv-import';upload.className='quiet-button';upload.onclick=()=>file.click();open.after(upload,file);
const cancelImport=make('button','Zaustavi uvoz');cancelImport.type='button';cancelImport.hidden=true;cancelImport.id='sense-cv-import-stop';upload.after(cancelImport);let importController=null,importSerial=0;
cancelImport.onclick=()=>importController?.abort();
const download=make('button','Preuzmi trenutni CV kao DOCX');download.type='button';download.id='sense-cv-download';download.className='button secondary';upload.after(download);
const readCurrent=make('button','Pročitaj moj trenutni CV'),stopCurrent=make('button','Zaustavi čitanje CV-a');readCurrent.type=stopCurrent.type='button';readCurrent.id='sense-cv-read-current';readCurrent.onclick=()=>readCVText(cv.value,document.getElementById('status-text'));stopCurrent.onclick=()=>cvReader?.stop();download.after(readCurrent,stopCurrent);
download.onclick=()=>{try{const data=scope.CLEA7SenseDocument.renderDOCX(cv.value),url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})),a=make('a');a.href=url;a.download='Moj-CV-Sense.docx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);document.getElementById('status-text').textContent='Pripremljen je tvoj trenutni CV kao DOCX. Izvoz ne zahtijeva oglas ili AI servis.';}catch(error){document.getElementById('status-text').textContent=error.message;}};
file.onchange=async()=>{
 const selected=file.files[0];if(!selected)return;importController?.abort();const own=++importSerial,controller=new AbortController(),original=cv.value;importController=controller;const timer=setTimeout(()=>controller.abort(),45000);upload.disabled=true;cancelImport.hidden=false;
 document.getElementById('status-text').textContent='Čitam odabrani CV lokalno. Datoteka se ne šalje AI servisu.';
 try{
  const result=await scope.CLEA7SenseDocumentImport.read(selected,{approved:true,signal:controller.signal});if(own!==importSerial)return;
  const review=make('dialog');review.id='sense-cv-import-preview';const heading=make('h2','Pregledaj učitani CV'),description=make('p','Tekst je izdvojen na ovom uređaju. Provjeri redoslijed, ispravi sadržaj i potvrdi prijenos. Postojeći CV još nije promijenjen.'),label=make('label','Izdvojeni tekst za uređivanje'),area=make('textarea'),status=make('p',result.warnings.join(' ')),accept=make('button','Potvrdi učitani CV'),reject=make('button','Odbaci uvoz');area.id='sense-cv-import-text';area.rows=12;area.maxLength=30000;area.value=result.text;label.htmlFor=area.id;status.setAttribute('role','status');accept.type=reject.type='button';
  area.addEventListener('input',()=>cvReader?.stop());
  const close=()=>{cvReader?.stop();review.close();review.remove();},read=make('button','Pročitaj izdvojeni CV'),stop=make('button','Zaustavi čitanje CV-a');read.type=stop.type='button';read.id='sense-cv-read-import';read.onclick=()=>readCVText(area.value,status);stop.onclick=()=>cvReader?.stop();accept.onclick=()=>{if(cv.value!==original){status.textContent='Trenutni CV se promijenio. Odbaci ovaj pregled i ponovi uvoz.';return;}if(!area.value.trim()||area.value.length>30000){status.textContent='CV mora imati tekst do 30.000 znakova.';return;}cv.value=area.value;cv.dispatchEvent(new Event('input',{bubbles:true}));close();cv.focus();document.getElementById('status-text').textContent='Potvrđeni CV je učitan. Možeš ga urediti, porediti s oglasom ili izvesti kao DOCX.';};reject.onclick=close;review.addEventListener('cancel',close);review.append(heading,description,label,area,status,read,stop,accept,reject);document.body.append(review);review.showModal();area.focus();
 }catch(error){if(own===importSerial)document.getElementById('status-text').textContent=controller.signal.aborted?'Uvoz je zaustavljen. Postojeći CV je sačuvan.':error.message;}
 finally{clearTimeout(timer);if(own===importSerial){importController=null;upload.disabled=false;cancelImport.hidden=true;file.value='';}}
};
scope.addEventListener('sense:erase',()=>{cvReader?.stop();importSerial++;importController?.abort();importController=null;upload.disabled=false;cancelImport.hidden=true;file.value='';document.getElementById('sense-cv-import-preview')?.remove();for(const input of Object.values(inputs))input.value='';approved.checked=false;preview.textContent='';if(dialog.open)dialog.close();});scope.addEventListener('pagehide',()=>{importController?.abort();cvReader?.stop();});
})(globalThis);
