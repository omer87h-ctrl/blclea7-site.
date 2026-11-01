/* Original passive HTML CV export, by Brzo i Lokalno. No network or permissions.
 * Export preserves user text. It does not certify claims or create experience. */
(function(scope){'use strict';
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function renderHTML(text){
 if(typeof text!=='string'||!text.trim()||text.length>48000||text.includes('\0'))throw Error('CV mora sadržavati od 1 do 48.000 znakova.');
 const paragraphs=text.replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/).map(p=>'<p>'+escape(p)+'</p>').join('\n');
 return '<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'"><title>Životopis — BL CLEA Sense</title><style>body{margin:0;background:#edf0f3;color:#152432;font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:780px;margin:32px auto;background:#fff;padding:48px 54px;border-top:6px solid #224d59;box-shadow:0 8px 35px #15243215}h1{font-size:30px;letter-spacing:.03em;color:#224d59;margin:0 0 30px}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 20px}footer{border-top:1px solid #ccd5db;padding-top:16px;font-size:12px;color:#4b5964;margin-top:40px}@media(max-width:600px){main{margin:0;padding:28px 22px}}@media print{body{background:#fff}main{margin:0;max-width:none;padding:0;box-shadow:none;border-top:4px solid #224d59}p{break-inside:avoid}footer{font-size:9pt}@page{size:A4;margin:20mm}}</style></head><body><main><h1>Životopis</h1>'+paragraphs+'<footer>Pripremljeno u BL CLEA Sense 7 — TESTNA VERZIJA, by Brzo i Lokalno. Sadržaj uređuje i provjerava autor CV-a.</footer></main></body></html>';
}
scope.CLEA7SenseDocument=Object.freeze({format:'sense.document/1',renderHTML});
if(typeof document==='undefined')return;
const draft=document.getElementById('draft-text'),cv=document.getElementById('cv-text');if(!draft||!cv)return;
const row=document.createElement('div');row.className='button-row';row.style.marginTop='16px';row.setAttribute('aria-label','Cjelovit CV i HTML izvoz');
function button(id,label,action){const b=document.createElement('button');b.id=id;b.type='button';b.className='button secondary';b.textContent=label;b.addEventListener('click',()=>{try{action();}catch(e){document.getElementById('status-text').textContent=e.message;}});row.append(b);return b;}
button('draft-use-original','Kreni od cijelog CV-a',()=>{
 if(!cv.value.trim())throw Error('Prvo unesi svoj CV u radnom prostoru.');
 if(draft.value.trim()&&!scope.confirm('Zamijeniti trenutni nacrt cijelim izvornim CV-om? Promjenu možeš poništiti.'))return;
 draft.value=cv.value;draft.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('status-text').textContent='Cijeli izvorni CV prenesen je u urednik. Pregledaj ga prije izvoza; ova radnja ne potvrđuje njegove navode.';draft.focus();
});
button('draft-download-html','Preuzmi CV kao HTML',()=>{
 const html=renderHTML(draft.value),url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Moj-CV-Sense.html';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);document.getElementById('status-text').textContent='Pripremljen je HTML CV. Otvori ga u pregledniku za čitanje, štampu ili ponuđeno spremanje u PDF.';
});
draft.parentNode.append(row);
})(globalThis);
