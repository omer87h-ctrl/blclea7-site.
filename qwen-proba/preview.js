'use strict';
(() => {
 const endpoint='https://voting-crafty-protegee.ngrok-free.dev';
 const form=document.getElementById('chat'),question=document.getElementById('question'),send=document.getElementById('send'),state=document.getElementById('state'),log=document.getElementById('log');
 let busy=false,online=false,checking=false,history=[],generation=0;
 const headers={'ngrok-skip-browser-warning':'1'};
 function controls(){send.disabled=busy||!online;}
 async function refresh(){if(busy||checking)return;checking=true;try{
   const res=await fetch(endpoint+'/health',{mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',headers,signal:AbortSignal.timeout(8000)});
   const data=await res.json();online=res.ok&&data.service==='CLEA public beta'&&data.model==='Qwen3.5-9B'&&data.ready===true;
 }catch{online=false;}finally{checking=false;if(!busy){state.textContent=online?'CLEA AI je povezan · Qwen 9B':'Javni CLEA servis trenutno nije dostupan. Potrebno je da vlasnik pokrene CLEA Runner na HP-u.';controls();}}}
 function append(who,value){const article=document.createElement('article'),name=document.createElement('strong'),p=document.createElement('p');name.textContent=who;p.textContent=value;article.append(name,p);log.append(article);while(log.children.length>24)log.firstChild.remove();return p;}
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!online)return;const text=question.value.trim();if(!text||text.length>3000)return;
 const epoch=generation;busy=true;controls();question.value='';append('Ti',text);const reply=append('BL CLEA AI','Qwen obrađuje poruku. Ako je server zauzet, zahtjev čeka…');state.textContent='Obrada na HP serveru…';
 try{
  let context=history.slice(-6);
  while(context.length&&(context.reduce((a,x)=>a+x.content.length,0)>4800||new TextEncoder().encode(JSON.stringify({question:text,history:context})).length>20000))context=context.slice(2);
  const res=await fetch(endpoint+'/chat',{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({question:text,history:context}),signal:AbortSignal.timeout(210000)});
  const data=await res.json();if(!res.ok||typeof data.reply!=='string'||!data.reply.trim())throw new Error(typeof data.error==='string'?data.error:'Gateway nije vratio odgovor.');
  if(epoch===generation){reply.textContent=data.reply;history.push({role:'user',content:text.slice(0,1600)},{role:'assistant',content:data.reply.slice(0,1600)});history=history.slice(-6);}
  state.textContent='Odgovor je vratio stvarni Qwen 9B.';
 }catch(error){if(epoch===generation)reply.textContent='Odgovor nije uspio: '+error.message;state.textContent='Provjera veze ili opterećenja servera.';}finally{busy=false;controls();refresh();}});
 document.getElementById('clear').onclick=()=>{generation++;history=[];log.replaceChildren();};
 refresh();setInterval(refresh,20000);
})();