'use strict';
(() => {
 const endpoint='https://voting-crafty-protegee.ngrok-free.dev';
 const form=document.getElementById('chat'),question=document.getElementById('question'),send=document.getElementById('send'),stop=document.getElementById('stop'),state=document.getElementById('state'),log=document.getElementById('log');
 let busy=false,online=false,streaming=false,checking=false,history=[],generation=0,controller=null;
 const headers={'ngrok-skip-browser-warning':'1'};
 function controls(){send.disabled=busy||!online;stop.disabled=!busy;}
 async function refresh(show=true){if(busy||checking)return;checking=true;try{
   const res=await fetch(endpoint+'/health',{mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',headers,signal:AbortSignal.timeout(8000)});
   const data=await res.json();online=res.ok&&data.service==='CLEA public beta'&&data.model==='Qwen3.5-9B'&&data.ready===true;streaming=online&&data.streaming===true;
 }catch{online=false;streaming=false;}finally{checking=false;if(!busy){if(show||!online)state.textContent=online?(streaming?'CLEA AI je povezan · Qwen 9B · streaming':'CLEA AI je povezan · prethodna verzija gatewaya'):'Javni CLEA servis trenutno nije dostupan. Potrebno je da vlasnik pokrene CLEA Runner na HP-u.';controls();}}}
 function append(who,value){const article=document.createElement('article'),name=document.createElement('strong'),p=document.createElement('p');name.textContent=who;p.textContent=value;article.append(name,p);log.append(article);while(log.children.length>24)log.firstChild.remove();return {article,name,p};}
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!online)return;const text=question.value.trim();if(!text||text.length>3000)return;
 const epoch=generation;busy=true;controller=new AbortController();const signal=controller.signal;controls();question.value='';append('Ti',text);const reply=append('BL CLEA AI','');state.textContent='Povezivanje s HP serverom…';
 let answer='',source='',finished=false;const timer=setTimeout(()=>controller?.abort(),300000);
 try{
  let context=history.slice(-6);
  while(context.length&&(context.reduce((a,x)=>a+x.content.length,0)>4800||new TextEncoder().encode(JSON.stringify({question:text,history:context})).length>20000))context=context.slice(2);
  const res=await fetch(endpoint+(streaming?'/chat/stream':'/chat'),{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({question:text,history:context}),signal});
  if(!res.ok){const err=await res.json().catch(()=>({}));throw Error(err.error||'HTTP '+res.status);}
  if(streaming){
   if(!res.body||!res.headers.get('content-type')?.includes('application/x-ndjson'))throw Error('Streaming nije dostupan.');
   const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
   try{while(true){const part=await reader.read();if(part.done)break;buffer+=decoder.decode(part.value,{stream:true});if(buffer.length>65536)throw Error('Neispravan odgovor.');
     const lines=buffer.split('\n');buffer=lines.pop()||'';
     for(const line of lines){if(!line.trim())continue;const event=JSON.parse(line);
      if(event.type==='status')state.textContent=event.message;
      else if(event.type==='delta'&&typeof event.text==='string'){answer+=event.text;if(epoch===generation)reply.p.textContent=answer;state.textContent='CLEA AI piše…';}
      else if(event.type==='error')throw Error(event.message||'Obrada nije uspjela.');
      else if(event.type==='done'){finished=true;source=event.source;}
     }
     if(finished)break;
   }}finally{await reader.cancel().catch(()=>{});}
   if(!finished||!answer.trim())throw Error('Odgovor nije završen.');
  }else{const data=await res.json();if(typeof data.reply!=='string'||!data.reply.trim())throw Error(data.error||'Gateway nije vratio odgovor.');answer=data.reply;source='Qwen3.5-9B';}
  if(epoch===generation){reply.p.textContent=answer;reply.name.textContent=source==='CLEA opis mogućnosti'?'BL CLEA AI · opis mogućnosti':'BL CLEA AI · Qwen 9B';history.push({role:'user',content:text.slice(0,1600)},{role:'assistant',content:answer.slice(0,1600)});history=history.slice(-6);}
  state.textContent=source==='CLEA opis mogućnosti'?'Odgovor iz provjerenog opisa CLEA mogućnosti.':'Qwen 9B završio odgovor.';
 }catch(error){if(epoch===generation){reply.p.textContent=answer+(answer?'\n\n':'')+(signal.aborted?'Odgovor je zaustavljen.':'Odgovor nije uspio: '+error.message);}state.textContent=signal.aborted?'Obrada zaustavljena.':'Provjeri vezu ili opterećenje servera.';}finally{clearTimeout(timer);controller=null;busy=false;controls();refresh(false);}});
 stop.onclick=()=>controller?.abort();
 document.getElementById('clear').onclick=()=>{controller?.abort();generation++;history=[];log.replaceChildren();};
 refresh();setInterval(()=>refresh(false),20000);
})();