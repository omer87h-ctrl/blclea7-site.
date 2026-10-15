'use strict';
(function(scope){
function attach({enabled,request,project,apply}){
 const $=id=>document.getElementById(id),F=CLEA7Format;let connection=null,candidate=null,base=null,busy=false;
 if(enabled)$('ai-provider').value='openai';
 const provider=()=> $('ai-provider').value,remote=()=>provider()!=='local';
 const say=text=>$('ai-status').textContent=text;
 function invalidate(){connection=null;candidate=null;base=null;$('accept-ai').hidden=true;$('ai-proposal').textContent='';}
 function refresh(){const cloud=remote();$('ai-local-label').hidden=cloud;$('ai-key-label').hidden=!cloud;$('ai-cloud-policy').hidden=!cloud;$('ai-send-label').hidden=!cloud;for(const id of ['ai-provider','ai-model','ai-endpoint','ai-api-key','ai-terms','ai-send-consent','connect-ai','forget-ai'])$(id).disabled=!enabled||busy;$('generate-ai').disabled=!enabled||busy;$('accept-ai').disabled=!enabled||busy;}
 async function task(run){if(!enabled||busy)return;busy=true;refresh();try{await run();}catch(error){say(error.message);}finally{busy=false;refresh();}}
 $('ai-provider').onchange=()=>{invalidate();$('ai-api-key').value='';$('ai-terms').checked=false;$('ai-send-consent').checked=false;refresh();say('Promijenjen je izbor. Provjeri vezu prije novog zahtjeva; koristi se samo jedan servis.');};
 $('ai-model').oninput=()=>{invalidate();$('ai-send-consent').checked=false;say('Model je promijenjen. Ponovo provjeri vezu.');};
 $('ai-endpoint').oninput=()=>invalidate();
 $('connect-ai').onclick=()=>task(async()=>{
  invalidate();const selected=provider(),cloud=selected!=='local';
  if(cloud&&!$('ai-terms').checked)throw Error('Potvrdi pravo korištenja i uslove odabranog servisa.');
  say('Stvarna provjera odabranog servisa; model još ne generiše sadržaj.');
  try{await request('ai/config',{provider:selected,endpoint:$('ai-endpoint').value.trim(),model:$('ai-model').value.trim(),api_key:cloud?$('ai-api-key').value.trim():undefined,terms_confirmed:$('ai-terms').checked});}finally{$('ai-api-key').value='';}
  let value=await (await request('ai/status',{})).json();
  if(!value.available)throw Error(value.message||'AI servis nije dostupan.');
  $('ai-models').textContent='';for(const name of value.models||[]){const option=document.createElement('option');option.value=name;$('ai-models').append(option);}
  if(!cloud&&!$('ai-model').value.trim()&&value.models?.[0]){$('ai-model').value=value.models[0];await request('ai/config',{provider:'local',endpoint:$('ai-endpoint').value.trim(),model:value.models[0]});}
  connection={provider:selected,model:$('ai-model').value.trim()};
  say(cloud?'API veza je potvrđena. Izaberi tačan tekstualni model s računa. Slanje projekta zahtijeva zasebnu potvrdu.':'Lokalna veza je potvrđena. Provjeri da tvoj model server ne prosljeđuje sadržaj dalje.');
 });
 $('forget-ai').onclick=()=>task(async()=>{await request('ai/forget',{});invalidate();$('ai-api-key').value='';$('ai-send-consent').checked=false;say('API ključ je uklonjen iz aktivne host sesije. Već poslani zahtjevi ili podaci kod servisa time se ne brišu.');});
 $('generate-ai').onclick=()=>task(async()=>{
  candidate=null;$('accept-ai').hidden=true;$('ai-proposal').textContent='';
  const selected=provider(),cloud=remote(),prompt=$('ai-request').value.trim();
  if(!connection||connection.provider!==selected||connection.model!==$('ai-model').value.trim())throw Error('Prvo provjeri vezu za odabrani servis i model.');
  if(!prompt)throw Error('Opiši aplikaciju.');
  if(cloud&&!connection.model)throw Error('Odaberi tačan tekstualni model i ponovo provjeri vezu.');
  if(cloud&&!$('ai-send-consent').checked)throw Error('Potvrdi slanje opisa i modela projekta za ovaj zahtjev.');
  base=F.clone(project());say(cloud?'Stvarni API zahtjev odabranom servisu; potrošnju obračunava tvoj servis.':'Stvarni zahtjev lokalnom modelu…');
  try{const response=await request('ai/chat',{provider:selected,prompt,app:base,design:true,allow_remote:cloud&&$('ai-send-consent').checked}),value=await response.json();const checked=F.validate(value.candidate),notices=new Map((checked.licenses||[]).map(entry=>[entry.id,entry]));if((base.licenses||[]).some(entry=>CLEA7.stable(notices.get(entry.id)||null)!==CLEA7.stable(entry)))throw Error('AI prijedlog ne čuva postojeće licence materijala. Projekt nije promijenjen.');candidate=checked;$('ai-proposal').textContent=JSON.stringify(candidate,null,2);$('accept-ai').hidden=false;say('Primljen je i validiran prijedlog. To nije potvrda funkcionalnosti, originalnosti ili uspješnog builda. Pregledaj ga prije primjene.');}finally{$('ai-send-consent').checked=false;}
 });
 $('accept-ai').onclick=()=>{if(!candidate||busy)return;try{if(CLEA7.stable(project())!==CLEA7.stable(base))throw Error('Projekt se promijenio tokom zahtjeva. Prijedlog nije primijenjen.');if(!confirm('Primijeniti prikazani AI prijedlog? Prvo sačuvaj ili preuzmi trenutni projekt.'))return;apply(F.clone(candidate));invalidate();say('Prijedlog je primijenjen. Provjeri ponašanje aplikacije prije izvoza ili builda.');}catch(error){say(error.message);}};
 refresh();if(!enabled)say('AI povezivanje je dostupno u Windows Studiju. Ovaj web/HTML pregled ne prikuplja API ključeve i ne izvršava plaćene zahtjeve.');
 return {clear:invalidate};
}
scope.CLEA7AIControls={attach};
})(globalThis);
