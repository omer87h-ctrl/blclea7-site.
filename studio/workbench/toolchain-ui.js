'use strict';
(async()=>{
const root=document.getElementById('toolchain-root');if(!root)return;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const intro=el('div');intro.className='toolchain-card';root.append(intro);
intro.append(el('h2','Postavi Android razvojno okruženje'),el('p','Jednom postavi provjerene alate za APK i CLEA7 SDK. Studio i lokalni projekti mogu raditi i bez ovog preuzimanja.'));
const token=new URLSearchParams(location.hash.slice(1)).get('token');
if(!token){intro.append(el('p','Instalacija razvojnih alata dostupna je u Windows Studiu. Web preglednik ih ne može instalirati.'));const a=el('a','Preuzmi Windows Studio');a.href='https://clea7.brzoilokalno.com/preuzimanja.html';intro.append(a);return;}
const api=async(path,value)=>{const response=await fetch('/api/toolchain/'+path,{method:value===undefined?'GET':'POST',headers:{'X-CLEA7-Token':token,...(value===undefined?{}:{'Content-Type':'application/json'})},body:value===undefined?undefined:JSON.stringify(value),cache:'no-store',credentials:'omit'});const data=await response.json();if(!response.ok)throw Error(data.error||'Operacija nije završena.');return data;};
const message=el('p','Provjera dostupnih razvojnih alata…');message.role='status';message.setAttribute('aria-live','polite');intro.append(message);
try{
const contract=await api('contract'),initial=await api('status');let running=false,watching=false;
const ready=el('div');ready.dataset.setupReady='true';intro.append(ready);
ready.append(el('p','Preuzimanje: '+(contract.download_bytes/1e6).toFixed(0)+' MB. Alati se postavljaju u tvoju korisničku mapu, bez promjene globalnih postavki.'));
const list=el('ul');list.className='toolchain-components';
for(const component of contract.components){const item=el('li');item.dataset.component=component.key;item.append(el('strong',component.label),el('span',component.version+' · '+(component.size_bytes/1e6).toFixed(1)+' MB'));list.append(item);}ready.append(list);
const where=el('details');where.append(el('summary','Gdje se čuvaju alati?'),el('p',contract.install_location),el('p','Popravka koristi provjerene lokalne pakete. Projekti i podaci aplikacija ostaju odvojeni.'));ready.append(where);
const consent=el('label');consent.className='setup-consent';const download=el('input');download.type='checkbox';download.id='setup-download-consent';consent.append(download,document.createTextNode('Dopuštam preuzimanje navedenih razvojnih alata i potrebnih biblioteka za prvu APK provjeru. Moji projekti se ne šalju.'));ready.append(consent);
const required=[];
for(const license of contract.licenses){const details=el('details');details.className='toolchain-license';details.append(el('summary',license.acceptance_required?'Android SDK · pregled licence':license.id+' · licence i obavijesti'));const text=el('pre',license.text);text.tabIndex=0;details.append(text);const link=el('a','Službeni izvor licence');link.href=license.url;link.target='_blank';link.rel='noopener noreferrer';details.append(link);ready.append(details);
if(license.acceptance_required){const row=el('label');row.className='setup-consent';const check=el('input');check.type='checkbox';check.dataset.licenseConsent=license.id;row.append(check,document.createTextNode('Pročitao/la sam i prihvatam prikazane uslove za '+license.id+'.'));ready.append(row);required.push(check);}}
const actions=el('div');actions.className='actions';const install=el('button',initial.ready?'Popravi i provjeri razvojne alate':'Instaliraj i provjeri razvojne alate');install.id='setup-install';install.type='button';install.className='primary';const cancel=el('button','Otkaži postavljanje');cancel.id='setup-cancel';cancel.type='button';cancel.disabled=true;const verify=el('button','Provjeri integritet instalacije');verify.type='button';verify.id='setup-verify';actions.append(install,cancel,verify);ready.append(actions);
const progress=el('progress');progress.max=1;progress.value=0;progress.setAttribute('aria-label','Napredak postavljanja');ready.append(progress);
const notice=el('p','Prva provjera pravi stvarni probni APK i može dodatno preuzeti Android biblioteke. Za to je potreban internet. Nema kupovine, računa ni AI ključa.');notice.className='fine';ready.append(notice);
function update(){install.disabled=running||!initial.platform_supported||!download.checked||required.some(n=>!n.checked);cancel.disabled=!running;verify.disabled=running||!initial.installed;}
download.onchange=update;required.forEach(n=>n.onchange=update);
function show(state){running=!!state.running;const labels={starting:'Priprema postavljanja',downloading:'Preuzimanje',cached:'Koristi se provjereni lokalni paket',extracted:'Paket je provjeren i raspakovan',checking:'Stvarna BIL i APK provjera',ready:'Razvojno okruženje je spremno',cancelled:'Postavljanje je otkazano',failed:'Postavljanje nije završeno',idle:initial.ready?'Razvojni alati su instalirani':'Razvojni alati još nisu instalirani'};message.textContent=(labels[state.phase]||state.phase)+(state.component?' · '+state.component:'')+(state.error?' · '+state.error:'');progress.value=state.total?Math.min(1,state.received/state.total):0;if(state.phase==='ready')progress.value=1;update();}
async function watch(){if(watching)return;watching=true;try{do{const state=await api('job');show(state);if(!state.running){const status=await api('status');Object.assign(initial,status);update();break;}await new Promise(resolve=>setTimeout(resolve,700));}while(document.contains(root));}catch(error){message.textContent=error.message;running=false;update();}finally{watching=false;}}
install.onclick=async()=>{if(install.disabled)return;running=true;update();try{show(await api('install',{approval:contract.approval,download_consent:download.checked,accepted_licenses:required.filter(n=>n.checked).map(n=>n.dataset.licenseConsent)}));await watch();}catch(error){running=false;message.textContent=error.message;update();}};
cancel.onclick=async()=>{try{await api('cancel',{});message.textContent='Zaustavljanje trenutne operacije…';}catch(error){message.textContent=error.message;}};
verify.onclick=async()=>{verify.disabled=true;message.textContent='Provjeravaju se stvarne datoteke instalacije…';try{const state=await api('verify',{});Object.assign(initial,state);message.textContent=state.ready?'Integritet razvojnih alata je potvrđen.':state.error||'Instalacija nije potpuna.';}catch(error){message.textContent=error.message;}finally{update();}};
show({running:false,phase:'idle'});const job=await api('job');if(job.running){show(job);watch();}window.CLEA7Setup={contract,api};
}catch(error){message.textContent=error.message;}
})();
