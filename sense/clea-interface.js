'use strict';
// One optional control over the existing measured Sense navigation SDK.
(function(){
 function mount(){
  const bar=document.querySelector('.topbar-actions'),enabled=document.getElementById('sense-focus-enabled'),focus=document.getElementById('sense-focus-companion'),launch=document.querySelector('body>[data-sense-touch-launch]');
  if(!bar||!enabled||!focus||!launch||document.getElementById('sense-interface-toggle'))return;
  focus.hidden=true;launch.hidden=true;bar.append(focus,launch);
  const button=document.createElement('button');button.id='sense-interface-toggle';button.type='button';button.className='button';button.textContent='Uključi Sense';button.setAttribute('aria-pressed','false');
  button.onclick=()=>{enabled.checked=!enabled.checked;enabled.dispatchEvent(new Event('change'));button.textContent=enabled.checked?'Isključi Sense':'Uključi Sense';button.setAttribute('aria-pressed',String(enabled.checked));if(enabled.checked)globalThis.CLEA7SenseNavigation?.open();};bar.prepend(button);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
