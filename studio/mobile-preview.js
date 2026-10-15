'use strict';
(()=>{
 const note=document.createElement('div');note.className='mobile-preview-note';
 const text=document.createElement('span');text.textContent='Webpregled razvoja · kreiraj i isprobaj aplikaciju. Projekti ostaju u ovom pregledniku.';
 const runtime=document.createElement('a');runtime.href='../launcher/';runtime.target='_blank';runtime.rel='noopener';runtime.textContent='Otvori zasebni Runtime ↗';note.append(text,runtime);
 document.querySelector('.studio-topbar').after(note);
 const jump=document.createElement('div');jump.className='mobile-jump';jump.setAttribute('aria-label','Brzi pristup dizajnu');
 for(const [label,selector]of [['Komponente','#design > aside:first-child'],['Platno','#design > article'],['Svojstva','#design > aside:last-child']]){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>document.querySelector(selector)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});jump.append(button);
 }
 document.querySelector('nav').after(jump);
 const sync=()=>{jump.hidden=document.querySelector('[data-panel="design"]')?.getAttribute('aria-pressed')!=='true';};
 document.addEventListener('click',()=>queueMicrotask(sync));new MutationObserver(sync).observe(document.querySelector('nav'),{subtree:true,attributes:true,attributeFilter:['aria-pressed']});sync();
})();
