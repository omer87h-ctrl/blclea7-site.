'use strict';
/* CLEA AI 0.23 web workspace — browser entrypoint to existing verified CLEA modules.
 * Current 0.23 PyTorch server is not deployable on static GitHub Pages.
 * This workspace intentionally does NOT claim to load v3 or offer frontier chat.
 */
(function(){
 const root=document.getElementById('clea-ai-web');
 if(!root)return;
 root.innerHTML=`<div class="clea-ai-web">
 <h1>CLEA AI · Studio</h1>
 <p>Jedan radni prostor za razgovor i razvoj CLEA aplikacija. Model 0.23 je pripremljen za treniranje, ali veliki razgovorni model još nije objavljen na webu.</p>
 <div class="actions">
 <button type="button" id="clea-ai-web-chat">Razgovaraj s CLEA modelom</button>
 <button type="button" id="clea-ai-web-build">Razvij aplikaciju</button>
 <button type="button" id="clea-ai-web-bil">Otvori BIL editor</button>
 </div>
 <p id="clea-ai-web-status" role="status">Na webu je dostupan postojeći lokalni CLEA razgovorni model za 20 provjerenih tema. Izrada aplikacije koristi postojeći ograničeni generator sa pregledom i potvrdom.</p>
 <div id="clea-ai-web-chat-container" hidden><h2>Razgovor · postojeći CLEA model</h2><p>Razgovor radi u zasebnoj sesiji istog porijekla. Poruke se ne šalju vanjskom AI servisu.</p><iframe title="CLEA lokalni razgovor" id="clea-ai-web-frame" loading="lazy" style="width:100%;min-height:660px;border:1px solid #455267;border-radius:12px;background:#0b1019" referrerpolicy="no-referrer" src="about:blank"></iframe></div>
 <details><summary>Šta je spremno, a šta još nije?</summary>
 <p>CLEA 0.23 ima originalni kod neuronskog modela i eksperimentalne testne težine. Web stranica ne može pokrenuti njegov PyTorch GPU server na GitHub Pages. Ovdje je aktivan raniji CLEA model, uz odvojeni provjereni BIL tok izrade jednostavne aplikacije. Napredan razgovor i razvoj proizvoljnih aplikacija još nisu dostupni.</p>
 <p>Core AI Manager · Link Bridge Elite · Expansion Q · Adaptive Recovery · Holo Interaction · Fallback Executor · Vision Q.</p></details>
 </div>`;
 const select=name=>document.querySelector('[data-panel="'+name+'"]')?.click();
 document.getElementById('clea-ai-web-chat').addEventListener('click',()=>{
  const holder=document.getElementById('clea-ai-web-chat-container');
  holder.hidden=false;
  const frame=document.getElementById('clea-ai-web-frame');
  if(frame.getAttribute('src')==='about:blank')frame.src='../../razgovor/';
  document.getElementById('clea-ai-web-status').textContent='Aktivan je postojeći CLEA model za ograničene CLEA teme, ne neuronski model 0.23.';
 });
 document.getElementById('clea-ai-web-build').addEventListener('click',()=>select('clea-ai'));
 document.getElementById('clea-ai-web-bil').addEventListener('click',()=>select('bil'));
})();
