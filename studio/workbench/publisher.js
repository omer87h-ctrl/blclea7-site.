'use strict';
(function(scope){
const C=scope.CLEA7;
function bytes(text,length){if(typeof text!=='string'||!/^[A-Za-z0-9_-]+$/.test(text))throw Error('Neispravno kodiranje potpisa.');const raw=Uint8Array.from(scope.atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4)),x=>x.charCodeAt(0));if(raw.length!==length)throw Error('Neispravna dužina ključa ili potpisa.');return raw;}
async function verify(value){
 if(!scope.crypto?.subtle)throw Error('Host nema kriptografsku provjeru potpisa. Paket nije prihvaćen.');
 if(!value||value.format!=='clea7.package/2'||JSON.stringify(value).length>2*1024*1024||Object.keys(value).sort().join('|')!==['format','manifest','payload','publisherKey','signature'].sort().join('|'))throw Error('Neispravna potpisana omotnica.');
 const key=value.publisherKey;if(!key||Object.keys(key).sort().join('|')!=='crv|kty|x|y'||key.kty!=='EC'||key.crv!=='P-256')throw Error('Nepodržan javni ključ autora.');bytes(key.x,32);bytes(key.y,32);const signature=bytes(value.signature,64);
 const data=new TextEncoder().encode('CLEA7-PACKAGE-2\n'+C.stable(value.manifest)+'\n'+value.payload+'\n'+C.stable(key));let valid=false;
 try{const imported=await scope.crypto.subtle.importKey('jwk',key,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);valid=await scope.crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},imported,signature,data);}catch{throw Error('Potpis autora nije važeći ili host ne podržava algoritam.');}
 if(!valid)throw Error('Potpis autora nije važeći. Paket nije prihvaćen.');const fingerprint=await C.digest(C.stable(key));if(!fingerprint)throw Error('Otisak autora nije mogao biti izračunat.');return {verified:true,fingerprint,algorithm:'ECDSA-P256-SHA256'};
}
scope.CLEA7Publisher={verify};
})(globalThis);
