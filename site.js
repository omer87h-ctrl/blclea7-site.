'use strict';
document.documentElement.classList.add('js');
const menu=document.querySelector('.menu');
const nav=document.querySelector('.nav');
if(menu&&nav){menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){menu.click();menu.focus()}});nav.addEventListener('click',e=>{if(e.target.closest('a')&&menu.getAttribute('aria-expanded')==='true')menu.click()})}
const tabs=[...document.querySelectorAll('[data-mode]')];
if(tabs.length){const activate=(tab,focus=false)=>{for(const t of tabs){const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!active}if(focus)tab.focus()};for(const [index,tab] of tabs.entries()){tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(index+1)%tabs.length;if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();activate(tabs[next],true)}})}activate(tabs[0])}
for(const button of document.querySelectorAll('[data-copy]')){button.addEventListener('click',async()=>{const code=document.getElementById(button.dataset.copy);const message=button.parentElement.querySelector('[role=status]');try{if(!navigator.clipboard||!window.isSecureContext)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(code.textContent.trim());message.textContent='SHA-256 je kopiran.'}catch{const selection=window.getSelection();const range=document.createRange();range.selectNodeContents(code);selection.removeAllRanges();selection.addRange(range);message.textContent='Automatsko kopiranje nije dostupno. Označeni SHA-256 kopiraj ručno.'}})}

// Public catalogue contains only exact approved public-release links, never credentials.
(async()=>{
 const root=document.getElementById('native-assets'),status=document.getElementById('native-status');if(!root||!status)return;
 try{
  const response=await fetch('releases.json',{cache:'no-cache'});if(!response.ok)throw Error('Katalog preuzimanja nije dostupan.');const catalog=await response.json();
  if(catalog.native?.state!=='published')return;
  const names={studio:'BL CLEA7 Studio za Windows x64',runtime:'BL CLEA7 Runtime za Windows x64',android:'BL CLEA7 Runtime za Android'};
  if(!Array.isArray(catalog.native.assets)||catalog.native.assets.length!==3)throw Error('Katalog native paketa nije potpun.');
  const release=catalog.native;if(!/^0\.\d+\.\d+$/.test(release.version||'')||!/^[0-9a-f]{40}$/.test(release.source_commit||'')||release.tag!=='clea7-'+release.version+'-'+release.source_commit.slice(0,7))throw Error('Identitet izdanja nije ispravan.');
  const prefix='/omer87h-ctrl/blclea7-site./releases/download/'+release.tag+'/';const cards=[],seen=new Set();
  for(const asset of catalog.native.assets){
   const url=new URL(asset.url);if(!names[asset.key]||seen.has(asset.key)||url.origin!=='https://github.com'||!url.pathname.startsWith(prefix)||url.search||url.hash||!(/^[a-f0-9]{64}$/).test(asset.sha256)||!Number.isSafeInteger(asset.size_bytes)||asset.size_bytes<1)throw Error('Katalog sadrži neprovjeren link.');seen.add(asset.key);
   const card=document.createElement('article');card.className='download-card';const body=document.createElement('div'),title=document.createElement('h3'),meta=document.createElement('p'),hash=document.createElement('code'),verification=document.createElement('details'),summary=document.createElement('summary'),download=document.createElement('a');title.textContent=names[asset.key];meta.textContent=(catalog.native.version||'0.9.0')+' · '+(asset.size_bytes/1e6).toFixed(2)+' MB';hash.className='hash';hash.textContent='SHA-256: '+asset.sha256;download.className='button primary';download.href=url.href;download.textContent='Preuzmi '+(asset.key==='android'?'APK':'ZIP')+' ↓';summary.textContent='Provjeri preuzetu datoteku';verification.append(summary,hash);body.append(title,meta,verification);card.append(body,download);cards.push(card);
  }
  root.replaceChildren(...cards);status.textContent='Razvojno izdanje '+release.version+' · preuzimanje bez GitHub prijave.';
 }catch(error){status.textContent='Katalog trenutno nije moguće potvrditi. Web Studio i SDK ostaju dostupni.';root.replaceChildren();}
})();
