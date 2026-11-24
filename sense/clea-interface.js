'use strict';
/* One action starts Sense. Everything else remains inside existing CLEA tools.
 * This is an explicit user gesture, not microphone or AI auto-activation. */
(function(){
 function mount(){
  const button=document.getElementById('sense-interface-toggle');
  if(!button)return;
  const oldLaunch=document.querySelector('body>[data-sense-touch-launch]');
  const focus=document.getElementById('sense-focus-companion');
  // These are redundant for the single-switch Sense entry; keep their APIs,
  // but never expose a second control or a competing speech engine.
  if(oldLaunch)oldLaunch.hidden=true;
  if(focus)focus.hidden=true;
  const update=active=>{
   button.setAttribute('aria-pressed',String(active));
   button.textContent=active?'Isključi Sense':'Uključi Sense';
   button.setAttribute('aria-label',active?'Isključi Sense i zaustavi govor':'Uključi Sense: odmah počni vođenje dodirom i govorom');
  };
  button.addEventListener('click',()=>{
   const guide=globalThis.CLEA7SenseNavigation;
   const status=document.getElementById('sense-mode-status');
   if(!guide?.open||!guide?.close){
    if(status)status.textContent='Sense vodič nije dostupan. Pokušaj ponovo učitati stranicu.';
    return;
   }
   if(guide.isActive?.())guide.close();
   else if(guide.startLive)guide.startLive(button);
   else guide.open(button);
  });
  const communication=document.createElement('button');
  communication.id='sense-live-communication';
  communication.type='button';
  communication.className='sense-action sense-action-secondary';
  communication.textContent='Komunikacija · titlovi i poruka';
  communication.hidden=true;
  communication.onclick=()=>globalThis.CLEA7SenseExperience?.launch?.('communicate');
  button.insertAdjacentElement('afterend',communication);
  document.addEventListener('sense:navigation-changed',event=>{
    const active=event.detail?.active===true;
    update(active);communication.hidden=!active;
  });
  update(false);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
