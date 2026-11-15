'use strict';
/* Original CLEA image admission policy. No decoding, network or device access. */
(function(scope){
const limits=Object.freeze({fileBytes:5*1024*1024,pixels:8000000,dimension:10000,textCharacters:30000,deadlineMilliseconds:90000});
const fault=(code,message)=>Object.assign(Error(message),{code});
function image(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<24||bytes.length>limits.fileBytes)throw fault('Budget','Slika mora imati najviše 5 MiB.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width,height,mime;
 if(bytes.slice(0,8).every((x,i)=>x===[137,80,78,71,13,10,26,10][i])&&v.getUint32(8)===13&&v.getUint32(12)===0x49484452){width=v.getUint32(16);height=v.getUint32(20);mime='image/png';}
 else if(bytes[0]===255&&bytes[1]===216){
  let at=2;
  while(at+4<=bytes.length){
   if(bytes[at++]!==255)throw fault('Invalid','JPEG zapis je oštećen.');while(bytes[at]===255)at++;
   const marker=bytes[at++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;
   if(at+2>bytes.length)break;const size=v.getUint16(at);if(size<2||at+size>bytes.length)throw fault('Invalid','JPEG zapis je nepotpun.');
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(size<8)throw fault('Invalid','Neispravno JPEG zaglavlje.');height=v.getUint16(at+3);width=v.getUint16(at+5);mime='image/jpeg';break;}at+=size;
  }
 }
 if(!mime)throw fault('Invalid','OCR prihvata stvarnu PNG ili JPEG sliku. SVG, web adrese i izvršne datoteke nisu prihvaćeni.');
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>limits.dimension||height>limits.dimension||width*height>limits.pixels)throw fault('Budget','Slika prelazi 8 miliona piksela. Smanji je prije čitanja.');
 return Object.freeze({width,height,mime});
}
function language(value){if(!['bos','eng'].includes(value))throw fault('Invalid','Odaberi bosanski ili engleski OCR.');return value;}
scope.CLEA7SenseOCRPolicy=Object.freeze({format:'sense.ocr-policy/1',limits,image,language});
})(globalThis);
