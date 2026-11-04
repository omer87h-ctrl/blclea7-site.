/* BL CLEA Sense 7 -> single owner-controlled BL CLEA AI. Optional and private by default.
 * Only the question typed into THIS panel is sent to the user's own localhost;
 * no CV, job, analysis results, history, or local storage are read or uploaded.
 */
'use strict';
(()=>{
 const main=document.getElementById('main');
 if(!main)return;
 const section=document.createElement('section');
 section.className='sense-ai-bridge';
 section.setAttribute('aria-labelledby','sense-ai-title');
 const h=document.createElement('h2');h.id='sense-ai-title';h.textContent='BL CLEA AI · isti razgovor, i u Senseu';
 const desc=document.createElement('p');
 desc.textContent='Pitaj lokalni BL CLEA AI o pripremi prijave ili o CLEA funkcijama. Ovo je ista jezička komponenta koja se koristi u Studiom. Sense neće automatski slati tvoj CV, oglas ili nalaze.';
 const label=document.createElement('label');label.htmlFor='sense-ai-question';label.textContent='Moje pitanje za BL CLEA AI';
 const area=document.createElement('textarea');area.id='sense-ai-question';area.rows=3;area.maxLength=1200;area.placeholder='Kako mogu jasnije opisati rad sa zalihama?';
 const action=document.createElement('button');action.type='button';action.textContent='Pošalji samo ovo pitanje lokalnom CLEA AI-ju';action.className='button secondary';
 const status=document.createElement('p');status.id='sense-ai-local-status';status.setAttribute('role','status');status.textContent='Povezivanje je isključeno dok ne pošalješ pitanje. Potreban je lokalno pokrenut servis na istom računaru.';
 const output=document.createElement('pre');output.id='sense-ai-local-answer';output.setAttribute('aria-live','polite');
 const link=document.createElement('a');link.href='../studio/workbench/?workspace=clea-chat';link.textContent='Nastavi u istom BL CLEA AI razgovoru u Studiom →';
 section.append(h,desc,label,area,action,status,output,link);
 main.append(section);
 action.addEventListener('click',async()=>{
  const question=area.value.trim();
  if(!question||question.length>1200){status.textContent='Unesi pitanje do 1200 znakova.';return;}
  if(!confirm('Poslati samo tekst ovog pitanja lokalnom BL CLEA AI servisu na ovom uređaju? CV, oglas i nalazi se ne šalju.'))return;
  action.disabled=true;status.textContent='Kontaktiram lokalni BL CLEA AI…';output.textContent='';
  try{
   const response=await fetch('http://127.0.0.1:8765/chat',{
    method:'POST',mode:'cors',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({question,history:[]}),signal:AbortSignal.timeout(100000)
   });
   const data=await response.json();
   if(!response.ok||typeof data.reply!=='string')throw Error(data.error||'Nema odgovora modela.');
   output.textContent=data.reply;
   status.textContent='Lokalni odgovor. Provjeri sve tvrdnje prije upotrebe u prijavi.';
  }catch(error){status.textContent='Lokalni CLEA AI nije dostupan: '+error.message;}
  finally{action.disabled=false;}
 });
})();