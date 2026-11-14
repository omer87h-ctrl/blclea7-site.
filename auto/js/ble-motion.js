/* Original CLEA parsers for the public Bluetooth SIG CSC/RSC wire contracts.
 * No location, vendor commands, calibration assumptions or whole-device scores. */
export const MOTION_PROFILES=Object.freeze({
 cycling:Object.freeze({id:'ble-csc/1',service:0x1816,characteristic:0x2a5b}),
 running:Object.freeze({id:'ble-rsc/1',service:0x1814,characteristic:0x2a53})
});
function view(value){
 if(value instanceof DataView)return value;
 if(value instanceof Uint8Array)return new DataView(value.buffer,value.byteOffset,value.byteLength);
 if(value instanceof ArrayBuffer)return new DataView(value);
 throw Error('Profil kretanja očekuje binarnu poruku.');
}
function assert(ok,message){if(!ok)throw Error(message);}
export function decodeCSC(value){
 const v=view(value);assert(v.byteLength>=1&&v.byteLength<=11,'Neispravna dužina CSC poruke.');
 const flags=v.getUint8(0);assert(!(flags&0xfc),'CSC poruka koristi nepodržane zastavice.');
 const expected=1+((flags&1)?6:0)+((flags&2)?4:0);assert(v.byteLength===expected,'CSC poruka nije potpuna ili ima višak podataka.');
 let i=1;const result={profile:'ble-csc/1'};
 if(flags&1){result.wheel={revolutions:v.getUint32(i,true),eventTicks:v.getUint16(i+4,true)};i+=6;}
 if(flags&2)result.crank={revolutions:v.getUint16(i,true),eventTicks:v.getUint16(i+2,true)};
 return result;
}
function counter(value,max){return value&&Number.isInteger(value.revolutions)&&value.revolutions>=0&&value.revolutions<=max&&Number.isInteger(value.eventTicks)&&value.eventTicks>=0&&value.eventTicks<=65535;}
/** Rates use two consecutive packets from one bounded connection, never one
 * stale last-event time. A <64 second receive window bounds acquisition, but
 * cannot prove the last-event timestamps are recent or distinguish a reset. */
export function deriveCSC(previous,current,{observedMilliseconds}={}){
 assert(previous?.profile==='ble-csc/1'&&current?.profile==='ble-csc/1','Razlika zahtijeva dva CSC paketa.');
 assert(Number.isFinite(observedMilliseconds)&&observedMilliseconds>0&&observedMilliseconds<64000,'CSC interval mora biti pozitivan i kraći od 64 sekunde.');
 const result={wheelRate:null,cadence:null,missing:[]};
 for(const [part,max,modulus,out,multiplier] of [['wheel',0xffffffff,0x100000000,'wheelRate',1],['crank',0xffff,0x10000,'cadence',60]]){
  const a=previous[part],b=current[part];
  if(!a||!b){result.missing.push(part+': oba paketa ne sadrže odgovarajući brojač.');continue;}
  assert(counter(a,max)&&counter(b,max),'Neispravna CSC vrijednost brojača.');
  const revolutions=(b.revolutions-a.revolutions+modulus)%modulus,ticks=(b.eventTicks-a.eventTicks+65536)%65536;
  if(!revolutions||!ticks){result.missing.push(part+': nema nove vremenski određene revolucije; brzina nije pretpostavljena.');continue;}
  const rate=revolutions*1024/ticks*multiplier;
  if(!Number.isFinite(rate)||rate>1e12){result.missing.push(part+': izvedena vrijednost prelazi ograničenje podataka.');continue;}
  result[out]=rate;
 }
 return result;
}
export function decodeRSC(value){
 const v=view(value);assert(v.byteLength>=4&&v.byteLength<=10,'Neispravna dužina RSC poruke.');
 const flags=v.getUint8(0);assert(!(flags&0xf8),'RSC poruka koristi nepodržane zastavice.');
 const expected=4+((flags&1)?2:0)+((flags&2)?4:0);assert(v.byteLength===expected,'RSC poruka nije potpuna ili ima višak podataka.');
 let i=4;const result={profile:'ble-rsc/1',speed:v.getUint16(1,true)/256,cadence:v.getUint8(3),running:!!(flags&4)};
 if(flags&1){result.strideLength=v.getUint16(i,true)/100;i+=2;}
 if(flags&2)result.distance=v.getUint32(i,true)/10;
 return result;
}
