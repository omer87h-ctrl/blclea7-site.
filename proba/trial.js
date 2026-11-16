'use strict';
(async()=>{
 const P=globalThis.CLEA7Personalisation,$=id=>document.getElementById(id);
 const blobDownload=(name,data,type)=>{const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 async function json(path,limit){const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error('Podaci usluge nisu dostupni.');const text=await response.text();if(new TextEncoder().encode(text).length>limit)throw Error('Podaci prelaze dozvoljenu veličinu.');return JSON.parse(text);}
 let config;try{config=await json('service.json',8192);}catch{$('collaboration-state').textContent='Pregled je dostupan. Zahtjevi i javne isporuke trenutno nisu otvoreni.';return;}
 // This public gate is enabled only by an explicit owner publication, never a query string.
 if(config.format!=='clea7.collaboration-service/1'||config.active!==true)return;
 const email=typeof config.requestTo==='string'&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(config.requestTo)?config.requestTo:null;
 if(!email){$('collaboration-state').textContent='Prijem zahtjeva još nije otvoren.';return;}
 $('zahtjev').hidden=$('preuzimanje').hidden=false;$('request-fields').disabled=false;$('request-opening').hidden=true;$('collaboration-state').textContent='Opiši potrebe, dogovorimo izradu, pa ovdje preuzmi svoju gotovu aplikaciju.';
 let brief=null;
 $('request-form').onsubmit=event=>{event.preventDefault();try{
  const form=new FormData(event.currentTarget);brief=P.validate({format:'clea7.personal-brief/1',person:form.get('person'),needs:form.get('needs'),palette:form.get('palette'),layout:form.get('layout')});
  $('request-preview').textContent=P.describe(brief);$('request-review').hidden=false;
  try{sessionStorage.setItem(P.KEY,JSON.stringify(brief));}catch{}
  $('request-state').textContent='Zahtjev je pripremljen. Pošalji ga iz svoje e-pošte; još nije dostavljen timu.';
 }catch(e){$('request-state').textContent=e.message;}};
 $('request-send').onclick=()=>{if(!brief)return;location.href='mailto:'+email+'?subject='+encodeURIComponent('Lična aplikacija · '+brief.person)+'&body='+encodeURIComponent(P.describe(brief));$('request-state').textContent='Otvorena je priprema e-pošte. Potvrdi slanje u svojoj aplikaciji za e-poštu.';};
 $('request-download').onclick=()=>{if(brief)blobDownload('moj-clea-zahtjev.json',JSON.stringify(brief,null,2)+'\n','application/json');};
 $('request-delete').onclick=()=>{brief=null;try{sessionStorage.removeItem(P.KEY);}catch{}$('request-form').reset();$('request-review').hidden=true;$('request-preview').textContent='';$('request-state').textContent='Lokalni zahtjev je uklonjen.';};
 $('delivery-form').onsubmit=async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;$('delivery-open').hidden=true;try{
  const code=new FormData(event.currentTarget).get('code').trim().toUpperCase();if(!/^[A-Z0-9-]{3,60}$/.test(code))throw Error('Provjeri broj isporuke koji si dobio od tima.');
  const catalog=await json('deliveries.json',32768);if(catalog.format!=='clea7.personal-deliveries/1'||!Array.isArray(catalog.entries))throw Error('Katalog isporuka nije ispravan.');
  const item=catalog.entries.find(x=>x.code===code);if(!item)throw Error('Za taj broj još nema objavljene aplikacije. Provjeri broj s timom.');
  if(!/^v[1-9][0-9]*\/[A-Za-z0-9_-]+\.html$/.test(item.path)||!Number.isSafeInteger(item.bytes)||item.bytes>4194304||!/^[0-9a-f]{64}$/.test(item.sha256))throw Error('Isporuka nije prošla provjeru.');
  const response=await fetch(item.path,{cache:'no-store'});if(!response.ok)throw Error('Datoteka aplikacije trenutno nije dostupna.');const data=await response.arrayBuffer();
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');if(data.byteLength!==item.bytes||digest!==item.sha256)throw Error('Datoteka nije prošla provjeru integriteta. Preuzimanje je zaustavljeno.');
  blobDownload('Brzo-i-Lokalno-x-COWONDER-'+code+'.html',data,'text/html');$('delivery-state').textContent='Tvoja kreirana aplikacija je preuzeta. Možeš je i otvoriti na ovoj adresi.';
  $('delivery-open').href=item.path;$('delivery-open').textContent='Otvori aplikaciju · '+item.label;$('delivery-open').hidden=false;
 }catch(e){$('delivery-state').textContent=e.message;}finally{button.disabled=false;}};
})().catch(()=>{document.getElementById('collaboration-state').textContent='Pregled je dostupan; usluga zahtjeva trenutno nije otvorena.';});
