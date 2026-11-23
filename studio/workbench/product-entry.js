'use strict';
/* One entry guard for ordinary Studio and public/Android clients.
 * Reveal the real, fully initialized workspace only after the shared shell
 * and project chooser are ready. This never accesses owner credentials. */
(function(){
 const root=document.documentElement;
 const query=new URL(location.href).searchParams;
 const publicClient=query.get('audience')==='public';
 const request=query.get('workspace');
 root.dataset.cleaBoot='loading';
 if(publicClient)root.dataset.cleaAudience='public';
 if(query.get('client')==='android')root.dataset.cleaClient='android';
 let pending=request==='draw'?'draw':
   ['clea-chat','clea-ai','assistant'].includes(request)?'clea-chat':
   publicClient?'clea-chat':null;
 let router=null,completed=false;
 const timer=setTimeout(()=>{
  if(completed)return;
  root.dataset.cleaBoot='failed';
  if(!document.body)return;
  const message=document.createElement('section');
  message.id='clea-entry-error';message.setAttribute('role','alert');
  const title=document.createElement('h1'),text=document.createElement('p'),retry=document.createElement('button');
  title.textContent='CLEA se nije učitala.';
  text.textContent='Provjeri vezu pa pokušaj ponovo. Lokalni projekti i skice nisu obrisani.';
  retry.textContent='Pokušaj ponovo';retry.type='button';retry.onclick=()=>location.reload();
  message.append(title,text,retry);document.body.prepend(message);
 },30000);
 globalThis.CLEA7ProductEntry=Object.freeze({
  request(panel){
   if(!['clea-chat','draw'].includes(panel))return false;
   pending=panel;if(router)router.open(panel);return true;
  },
  ready(value){
   if(completed||!globalThis.CLEA7StudioUiReady)return false;
   router=value;
   if(pending)router.open(pending);
   completed=true;clearTimeout(timer);
   document.getElementById('clea-entry-error')?.remove();
   root.dataset.cleaBoot='ready';return true;
  }
 });
})();
