/* BL CLEA Sense 7 -> single owner-controlled BL CLEA AI. Optional and private by default.
 * Only the question typed into THIS panel is sent after explicit approval;
 * no CV, job, analysis results, history, or local storage are read or uploaded.
 */
'use strict';
(()=>{
 const main=document.getElementById('main');
 if(!main||!globalThis.CLEA7AI)return;
 const section=document.createElement('section');
 section.className='sense-ai-bridge';
 section.setAttribute('aria-labelledby','sense-ai-title');
 const h=document.createElement('h2');h.id='sense-ai-title';h.textContent='BL CLEA AI · isti razgovor, i u Senseu';
 const desc=document.createElement('p');
 desc.textContent='Pitaj BL CLEA AI o pripremi prijave ili o CLEA funkcijama. Sense neće automatski slati tvoj CV, oglas ili nalaze. Model može pogriješiti; važne tvrdnje provjeri.';
 const label=document.createElement('label');label.htmlFor='sense-ai-question';label.textContent='Moje pitanje za BL CLEA AI';
 const area=document.createElement('textarea');area.id='sense-ai-question';area.rows=3;area.maxLength=1200;area.placeholder='Kako mogu jasnije opisati rad sa zalihama?';
 const targetLabel=document.createElement('label');targetLabel.htmlFor='sense-ai-target';targetLabel.textContent='Gdje se obrađuje pitanje';
 const target=document.createElement('select');target.id='sense-ai-target';
 for(const [value,text]of [['hp','CLEA HP server — javna veza'],['local','Napredno: servis na ovom uređaju']]){const option=document.createElement('option');option.value=value;option.textContent=text;target.append(option);}
 const action=document.createElement('button');action.type='button';action.textContent='Pošalji samo ovo pitanje';action.className='button secondary';
 const status=document.createElement('p');status.id='sense-ai-local-status';status.setAttribute('role','status');status.textContent='Nema slanja dok ne potvrdiš pitanje. CV analiza nastavlja raditi lokalno i bez AI servera.';
 const output=document.createElement('pre');output.id='sense-ai-local-answer';output.setAttribute('aria-live','polite');
 const link=document.createElement('a');link.href='../studio/workbench/?workspace=clea-chat';link.textContent='Nastavi u istom BL CLEA AI razgovoru u Studiom →';
 const mount=document.createElement('div');mount.hidden=true;
 const client=CLEA7AI.create({challengeMount:mount,onStatus:text=>status.textContent=text});
 target.addEventListener('change',()=>client.useLocal(target.value==='local'));
 section.append(h,desc,label,area,targetLabel,target,action,mount,status,output,link);
 main.append(section);
 action.addEventListener('click',async()=>{
  const question=area.value.trim();
  if(!question||question.length>1200){status.textContent='Unesi pitanje do 1200 znakova.';return;}
  if(!confirm('Poslati samo tekst ovog pitanja '+(target.value==='local'?'CLEA servisu na ovom uređaju':'BL CLEA AI servisu na HP serveru')+'? CV, oglas i nalazi se ne šalju.'))return;
  action.disabled=true;target.disabled=true;status.textContent='Kontaktiram BL CLEA AI…';output.textContent='';
  try{
   client.reset(); // Never include another Sense question or any CV context.
   const data=await client.ask(question);
   output.textContent=data.reply;
   status.textContent='Odgovor '+(data.transport==='hp'?'s HP servera':'lokalnog servisa')+'. Provjeri tvrdnje prije upotrebe u prijavi.';
  }catch(error){status.textContent=error.message;}
  finally{action.disabled=false;target.disabled=false;client.reset();}
 });
 window.addEventListener('pagehide',()=>client.reset());
})();
