'use strict';
/* Choose the public workspace before the editor can paint its default screen.
 * This controls presentation only and grants no host or model privileges. */
(function(){
 const query=new URL(location.href).searchParams;
 if(query.get('audience')!=='public')return;
 const root=document.documentElement;
 root.dataset.cleaAudience='public';root.dataset.cleaBoot='loading';
 if(query.get('client')==='android')root.dataset.cleaClient='android';
 let pending=query.get('workspace')==='draw'?'draw':'clea-chat',router=null;
 const timer=setTimeout(()=>{
  if(root.dataset.cleaBoot==='ready')return;
  root.dataset.cleaBoot='failed';
  if(!document.body)return;
  const message=document.createElement('section');message.id='clea-entry-error';
  const title=document.createElement('h1'),text=document.createElement('p'),retry=document.createElement('button');
  title.textContent='CLEA se nije učitala.';text.textContent='Provjeri internet pa pokušaj ponovo. Tvoj sačuvani rad ostaje na uređaju.';
  retry.textContent='Pokušaj ponovo';retry.onclick=()=>location.reload();message.append(title,text,retry);document.body.prepend(message);
 },15000);
 globalThis.CLEA7ProductEntry=Object.freeze({
  request(panel){if(!['clea-chat','draw'].includes(panel))return false;pending=panel;if(router)router.open(panel);return true;},
  ready(value){router=value;router.open(pending);clearTimeout(timer);document.getElementById('clea-entry-error')?.remove();root.dataset.cleaBoot='ready';}
 });
})();
