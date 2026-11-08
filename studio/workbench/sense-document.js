/* Original passive HTML CV export, by Brzo i Lokalno. No network or permissions.
 * Export preserves user text. It does not certify claims or create experience. */
(function(scope){'use strict';
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function renderHTML(text){
 if(typeof text!=='string'||!text.trim()||text.length>48000||text.includes('\0'))throw Error('CV mora sadržavati od 1 do 48.000 znakova.');
 const paragraphs=text.replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/).map(p=>'<p>'+escape(p)+'</p>').join('\n');
 return '<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'"><title>Životopis — BL CLEA Sense</title><style>body{margin:0;background:#edf0f3;color:#152432;font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:780px;margin:32px auto;background:#fff;padding:48px 54px;border-top:6px solid #224d59;box-shadow:0 8px 35px #15243215}h1{font-size:30px;letter-spacing:.03em;color:#224d59;margin:0 0 30px}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 20px}footer{border-top:1px solid #ccd5db;padding-top:16px;font-size:12px;color:#4b5964;margin-top:40px}@media(max-width:600px){main{margin:0;padding:28px 22px}}@media print{body{background:#fff}main{margin:0;max-width:none;padding:0;box-shadow:none;border-top:4px solid #224d59}p{break-inside:avoid}footer{font-size:9pt}@page{size:A4;margin:20mm}}</style></head><body><main><h1>Životopis</h1>'+paragraphs+'<footer>Pripremljeno u BL CLEA Sense 7 — TESTNA VERZIJA, by Brzo i Lokalno. Sadržaj uređuje i provjerava autor CV-a.</footer></main></body></html>';
}
function renderDOCX(text){
 if(typeof text!=='string'||!text.trim()||text.length>48000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\uD800-\uDFFF\uFFFE\uFFFF]/u.test(text))throw Error('CV mora biti tekst do 48.000 znakova, bez nedozvoljenih kontrolnih znakova.');
 const paragraph=(value,style='Normal')=>'<w:p><w:pPr><w:pStyle w:val="'+style+'"/></w:pPr><w:r>'+value.split('\n').map((line,i)=>(i?'<w:br/>':'')+'<w:t xml:space="preserve">'+escape(line)+'</w:t>').join('')+'</w:r></w:p>';
 const blocks=text.replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/),headings=/^(radno iskustvo|obrazovanje|vještine|projekti|kontakt|profil|work experience|education|skills|projects)$/i;
 const body=paragraph('Životopis','Title')+blocks.map(value=>headings.test(value)?paragraph(value,'Heading1'):paragraph(value)).join('');
 const files={
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>',
  'word/styles.xml':'<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val="bs-Latn-BA"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>',
  'word/_rels/document.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
 };
 // Original bounded ZIP store writer: no macros, scripts, images or remote relationships.
 const encoder=new TextEncoder(),parts=[],directory=[];let offset=0;
 const write=(size,fields)=>{const bytes=new Uint8Array(size),view=new DataView(bytes.buffer);for(const [at,value,width]of fields)width===2?view.setUint16(at,value,true):view.setUint32(at,value,true);return bytes;};
 const crc=bytes=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;};
 for(const [name,value]of Object.entries(files)){
  const filename=encoder.encode(name),data=encoder.encode(value),checksum=crc(data),header=write(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[10,0,2],[12,33,2],[14,checksum,4],[18,data.length,4],[22,data.length,4],[26,filename.length,2]]);
  parts.push(header,filename,data);directory.push(write(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[12,0,2],[14,33,2],[16,checksum,4],[20,data.length,4],[24,data.length,4],[28,filename.length,2],[42,offset,4]]),filename);offset+=header.length+filename.length+data.length;
 }
 const size=directory.reduce((sum,row)=>sum+row.length,0),end=write(22,[[0,0x06054b50,4],[8,Object.keys(files).length,2],[10,Object.keys(files).length,2],[12,size,4],[16,offset,4]]),result=new Uint8Array(offset+size+end.length);let at=0;for(const part of [...parts,...directory,end]){result.set(part,at);at+=part.length;}return result;
}
scope.CLEA7SenseDocument=Object.freeze({format:'sense.document/1',docxVersion:1,renderHTML,renderDOCX});
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
button('draft-download-docx','Preuzmi CV kao DOCX',()=>{
 const data=renderDOCX(draft.value),url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})),a=document.createElement('a');a.href=url;a.download='Moj-CV-Sense.docx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);document.getElementById('status-text').textContent='Pripremljen je DOCX s tekstom, jezikom dokumenta i stilovima naslova. Provjeri čitanje u svom uređivaču; ovo nije izvoz označenog PDF-a.';
});
})(globalThis);
