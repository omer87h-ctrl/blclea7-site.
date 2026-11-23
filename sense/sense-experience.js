'use strict';
/* BL CLEA Sense experience routing.
 * Every action opens an existing, real workspace. No simulated AI or feature,
 * user-data storage, microphone permission, or automatic speech on load. */
(function(){
 const status=document.getElementById('sense-mode-status');
 const announce=text=>{if(status)status.textContent=text;};
 const focusAndShow=element=>{
  if(!element)return false;
  element.scrollIntoView({block:'start',behavior:'auto'});
  element.focus({preventScroll:true});
  return true;
 };
 function launch(kind){
  if(kind==='communicate'){
   document.body.classList.add('sense-tools-open');document.body.dataset.senseTool='communicate';
   const disclosure=document.getElementById('sense-communication-open');
   const field=document.getElementById('sense-expression');
   if(!disclosure||!field){announce('Komunikacijski alat nije učitan. Osvježi stranicu.');return false;}
   disclosure.open=true;
   announce('Otvoren je Sense alat za tekst, titlove i potvrđeni govor.');
   return focusAndShow(field);
  }
  if(kind==='guide'){
   if(!globalThis.CLEA7SenseNavigation?.open){announce('Vodič nije učitan. Osvježi stranicu.');return false;}
   globalThis.CLEA7SenseNavigation.open();
   announce('Otvoren je Sense vodič kroz stvarne kontrole.');
   return true;
  }
  if(kind==='cv'){
   document.body.classList.add('sense-tools-open');document.body.dataset.senseTool='cv';
   const nav=document.querySelector('#primary-nav [data-view="workspace"]');
   const input=document.getElementById('cv-text');
   if(!nav||!input){announce('CV radni prostor nije učitan. Osvježi stranicu.');return false;}
   nav.click();
   announce('Otvoren je prostor za CV i oglas. Unos ne pokreće analizu automatski.');
   return focusAndShow(input);
  }
  return false;
 }
 for(const button of document.querySelectorAll('[data-sense-launch]')){
  button.addEventListener('click',()=>launch(button.dataset.senseLaunch));
 }
 globalThis.CLEA7SenseExperience=Object.freeze({format:'clea7.sense-experience/1',launch});
})();
