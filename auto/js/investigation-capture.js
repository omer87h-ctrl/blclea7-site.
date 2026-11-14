/* Original, synchronous capture of the EXACT Gamepad packet checked by a job.
 * No second navigator read, controller commands, background polling or imports. */
import {createDeviceSnapshot} from './device-core.js';

export function captureControllerPacket(pad,{binding,lastTimestamp=-1,timeOrigin=globalThis.performance?.timeOrigin}={}){
 if(!pad?.connected||!binding||pad.index!==binding.index||pad.id!==binding.id)throw Error('Kontroler je nestao ili je promijenjen tokom provjere.');
 const packet=pad.timestamp;
 if(typeof packet!=='number'||!Number.isFinite(packet)||packet<=lastTimestamp||packet<0)return null;
 if(typeof timeOrigin!=='number'||!Number.isFinite(timeOrigin))throw Error('Pouzdana vremenska osnova kontrolera nije dostupna.');
 const ms=timeOrigin+packet;if(!Number.isFinite(ms)||Math.abs(ms)>8.64e15)throw Error('Neispravno vrijeme paketa kontrolera.');
 const capturedAt=new Date(ms).toISOString(),observations=[];
 const buttons=Array.from(pad.buttons||[]).slice(0,64),axes=Array.from(pad.axes||[]).slice(0,32);
 buttons.forEach((b,i)=>observations.push({id:'gamepadButton'+i,value:b.value,unit:'1',capturedAt}));
 axes.forEach((value,i)=>observations.push({id:'gamepadAxis'+i,value,unit:'1',capturedAt}));
 const snapshot=createDeviceSnapshot({transport:'gamepad',name:String(pad.id||'Kontroler').slice(0,160),profileId:'gamepad-state/1',observedAt:capturedAt,metadata:{index:pad.index,mapping:String(pad.mapping||'').slice(0,80),connected:true,buttonsCount:buttons.length,axesCount:axes.length},observations,capabilities:[{id:'gamepad',status:'available',reason:'Očitan je isti provjereni paket kontrolera, s njegovim originalnim vremenom.'}],limitations:['Vrijeme paketa potiče iz Gamepad API-ja; autentičnost uređaja nije kriptografski potvrđena.'],testOnly:false});
 return {snapshot,packetTimestamp:packet};
}
