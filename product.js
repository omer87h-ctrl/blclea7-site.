"use strict";
const menu = document.querySelector('.menu'), nav = document.getElementById('navigation');
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {menu.click();menu.focus();} });
document.getElementById('product-intent').addEventListener('submit', e => {
 e.preventDefault(); const text = document.getElementById('intent').value.trim(); if (!text) return;
 try {sessionStorage.setItem('clea-public-intent', text);} catch {document.getElementById('public-ai-status').textContent = 'Prenos opisa nije dostupan u ovom pregledniku. Otvori Studio i unesi opis tamo.';return;}
 location.assign('studio/workbench/?workspace=clea-chat&audience=public');
});
(async () => {
 const status = document.getElementById('public-ai-status');
 try {
  const response = await fetch('clea-ai-config.json', {cache:'no-store', signal:AbortSignal.timeout(6000)});
  if(!response.ok) throw Error('configuration'); const config=await response.json();
  status.textContent = config.enabled === true && config.publicHTTPSHealthVerified === true
   ? 'AI veza je podešena. Dostupnost modela provjeri u razgovoru.'
   : 'Razgovor radi u Studiju na ovom uređaju, bez koda. Draw, BIL, Sense i izvoz ostaju u istom CLEA okruženju.';
 } catch {status.textContent='Razgovor radi u Studiju na ovom uređaju. Draw, BIL i Sense ostaju dostupni.';}
})();
