'use strict';
/* Original bounded CV import adapter. PDF parsing uses unmodified Apache-2.0
 * PDF.js; document bytes stay in the current browser and are never AI input. */
(function(scope){
const base=scope.document?.currentScript?.src||scope.document?.baseURI;
const MAX_FILE=5*1024*1024,MAX_XML=2*1024*1024,MAX_TEXT=30000;
const fault=(code,message)=>Object.assign(Error(message),{code});
let pdfModule=null,clientURL=null,workerURL=null;
function checkedText(text){text=text.replace(/\r\n?/g,'\n').trim();if(!text||text.length>MAX_TEXT||text.includes('\0'))throw fault('Invalid','CV mora sadržavati tekst do 30.000 znakova. Postojeći CV je sačuvan.');return text;}
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
async function boundedStream(stream,limit,signal){
 const reader=stream.getReader(),chunks=[];let size=0;
 try{while(true){if(signal?.aborted)throw fault('Cancelled','Uvoz je otkazan.');const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw fault('Budget','Dokument prelazi dozvoljeni opseg za CV.');chunks.push(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 const result=new Uint8Array(size);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;
}
async function docx(bytes,signal){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=at=>view.getUint16(at,true),u32=at=>view.getUint32(at,true);
 let end=-1;for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--)if(u32(at)===0x06054b50&&at+22+u16(at+20)===bytes.length){end=at;break;}
 if(end<0||u16(end+4)!==0||u16(end+6)!==0||u16(end+8)!==u16(end+10)||u16(end+10)>2048)throw fault('Invalid','DOCX arhiva nije podržana ili je oštećena.');
 let at=u32(end+16),entry=null;const count=u16(end+10),names=new Set();if(at+u32(end+12)>end)throw fault('Invalid','Neispravan DOCX direktorij.');
 for(let i=0;i<count;i++){
  if(at+46>end||u32(at)!==0x02014b50)throw fault('Invalid','Neispravan DOCX zapis.');
  const length=u16(at+28),extra=u16(at+30),comment=u16(at+32),next=at+46+length+extra+comment;if(next>end)throw fault('Invalid','Neispravan DOCX naziv.');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(at+46,at+46+length));
  if(names.has(name)||name.includes('\\')||name.split('/').includes('..')||name.startsWith('/'))throw fault('Invalid','Dvosmislen ili nesiguran DOCX zapis.');names.add(name);
  if(u16(at+8)&1)throw fault('Unavailable','Šifrirani DOCX nije podržan. Otključaj vlastiti dokument prije uvoza.');
  if(name==='word/document.xml')entry={method:u16(at+10),crc:u32(at+16),compressed:u32(at+20),size:u32(at+24),offset:u32(at+42)};at=next;
 }
 if(!entry||entry.size>MAX_XML||entry.compressed>MAX_FILE||entry.size===0)throw fault('Budget','Dokument nema podržan glavni DOCX tekst ili je prevelik.');
 const local=entry.offset;if(local+30>bytes.length||u32(local)!==0x04034b50||u16(local+8)!==entry.method)throw fault('Invalid','DOCX sadržaj ne odgovara direktoriju.');
 const start=local+30+u16(local+26)+u16(local+28);if(start+entry.compressed>end)throw fault('Invalid','DOCX sadržaj je nepotpun.');
 const compressed=bytes.subarray(start,start+entry.compressed);let xml;
 if(entry.method===0)xml=compressed;
 else if(entry.method===8){if(typeof scope.DecompressionStream!=='function')throw fault('Unavailable','Preglednik ne nudi lokalno raspakivanje DOCX-a. Koristi TXT ili noviji preglednik.');xml=await boundedStream(new Blob([compressed]).stream().pipeThrough(new scope.DecompressionStream('deflate-raw')),MAX_XML,signal);}
 else throw fault('Unavailable','Ovaj način DOCX kompresije nije podržan.');
 if(xml.length!==entry.size||crc32(xml)!==entry.crc)throw fault('Invalid','Provjera integriteta DOCX teksta nije prošla.');
 const source=new TextDecoder('utf-8',{fatal:true}).decode(xml);if(/<!DOCTYPE|<!ENTITY/i.test(source))throw fault('Invalid','XML s vanjskim entitetima nije dopušten.');
 const tree=new DOMParser().parseFromString(source,'application/xml');if(tree.querySelector('parsererror'))throw fault('Invalid','DOCX XML je oštećen.');
 const ns=tree.documentElement.namespaceURI;if(!['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main'].includes(ns))throw fault('Invalid','Datoteka ne sadrži Word dokument.');
 const paragraphs=[...tree.getElementsByTagNameNS(ns,'p')].map(p=>{let text='';const walk=n=>{if(n.nodeType!==1)return;if(n.namespaceURI===ns&&n.localName==='del')return;if(n.namespaceURI===ns&&n.localName==='t'){text+=n.textContent;return;}if(n.namespaceURI===ns&&['tab','br','cr'].includes(n.localName)){text+=n.localName==='tab'?'\t':'\n';return;}for(const child of n.children)walk(child);};walk(p);return text;});
 return {text:checkedText(paragraphs.join('\n\n')),format:'docx',warnings:['Učitan je glavni tekst. Provjeri redoslijed kolona, zaglavlja, podnožja i sadržaj slika; izvorni raspored nije prenesen.']};
}
async function library(){
 if(!pdfModule)pdfModule=(async()=>{
  const bundled=scope.CLEA7SensePDFBundle;
  clientURL=bundled?URL.createObjectURL(new Blob([bundled.client],{type:'text/javascript'})):new URL('vendor/pdfjs/pdf.mjs',base).href;
  workerURL=bundled?URL.createObjectURL(new Blob([bundled.worker],{type:'text/javascript'})):new URL('vendor/pdfjs/pdf.worker.mjs',base).href;
  const pdf=await import(clientURL);pdf.GlobalWorkerOptions.workerSrc=workerURL;return pdf;
 })().catch(error=>{pdfModule=null;throw fault('Unavailable','Lokalni PDF čitač nije dostupan. Koristi TXT/DOCX ili osvježi preuzetu aplikaciju.');});
 return pdfModule;
}
async function pdf(bytes,signal){
 const reader=await library();if(signal?.aborted)throw fault('Cancelled','Uvoz je otkazan.');
 const task=reader.getDocument({data:bytes,isEvalSupported:false,disableAutoFetch:true,disableStream:true,disableFontFace:true,useSystemFonts:false,useWasm:false,stopAtErrors:true});
 const abort=()=>task.destroy();signal?.addEventListener('abort',abort,{once:true});let document;
 try{
  document=await task.promise;if(document.numPages>25)throw fault('Budget','Za CV je podržano najviše 25 PDF stranica.');
  const lines=[];let size=0;
  for(let i=1;i<=document.numPages;i++){
   if(signal?.aborted)throw fault('Cancelled','Uvoz je otkazan.');
   const page=await document.getPage(i),content=await page.getTextContent();let text='';for(const item of content.items)if(typeof item.str==='string')text+=item.str+(item.hasEOL?'\n':' ');
   size+=text.length;if(size>MAX_TEXT)throw fault('Budget','PDF tekst prelazi 30.000 znakova.');lines.push(text);page.cleanup();
  }
  const text=lines.join('\n\n');if(!text.trim())throw fault('Unavailable','PDF nema izdvojiv tekst. Skenirana slika zahtijeva OCR; ova funkcija ga ne izmišlja.');
  return {text:checkedText(text),format:'pdf',warnings:['Tekst je izdvojen lokalno. Provjeri redoslijed kolona i znakove. Skenirane slike se ne pretvaraju u tekst.']};
 }finally{signal?.removeEventListener('abort',abort);await task.destroy();}
}
async function read(file,{approved=false,signal}={}){
 if(approved!==true)throw fault('Permission','Prvo sam odaberi datoteku za lokalni uvoz.');
 if(!file||typeof file.arrayBuffer!=='function'||!Number.isInteger(file.size)||file.size<1||file.size>MAX_FILE)throw fault('Budget','Datoteka mora imati najviše 5 MiB. Postojeći CV je sačuvan.');
 if(signal?.aborted)throw fault('Cancelled','Uvoz je otkazan.');const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length!==file.size)throw fault('Invalid','Veličina dokumenta se promijenila.');
 const name=String(file.name||'').toLowerCase();let result;
 if(name.endsWith('.txt'))result={text:checkedText(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),format:'txt',warnings:[]};
 else if(name.endsWith('.docx'))result=await docx(bytes,signal);
 else if(name.endsWith('.pdf'))result=await pdf(bytes,signal);
 else throw fault('Invalid','Odaberi TXT, DOCX ili PDF. Izvorna datoteka se ne izvršava.');
 if(signal?.aborted)throw fault('Cancelled','Uvoz je otkazan.');return Object.freeze({...result,local:true,aiUsed:false});
}
scope.CLEA7SenseDocumentImport=Object.freeze({format:'sense.document-import/1',read,limits:Object.freeze({fileBytes:MAX_FILE,textCharacters:MAX_TEXT,pdfPages:25}),pdfLibrary:Object.freeze({name:'PDF.js',version:'6.5.438',license:'Apache-2.0'})});
})(globalThis);
