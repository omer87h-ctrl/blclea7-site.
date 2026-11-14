/* Original, read-only BL CLEA device inspection adapters. Browser permissions and
 * standardized exposed fields are capabilities, never proof of whole-device health. */

import {MOTION_PROFILES,decodeCSC,deriveCSC,decodeRSC} from './ble-motion.js';

const BLE_SERVICES = Object.freeze({ battery:0x180f, info:0x180a, environment:0x181a, heart:0x180d, generic:0x1800 });
const INFO_FIELDS = Object.freeze({ manufacturer:0x2a29, model:0x2a24, firmware:0x2a26, hardware:0x2a27, software:0x2a28 });
const text = (value,max=160) => String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max);
const count = (value,max) => Math.min(max,Math.max(0,Math.trunc(Number(value)||0)));
const aborted = () => Object.assign(new Error('Pregled uređaja je otkazan.'),{name:'AbortError'});
const timeout = (phase='read') => Object.assign(new Error(phase==='chooser'?'Vrijeme za odabir uređaja je isteklo. Ponovo pokrenite birač kada budete spremni.':'Uređaj nije odgovorio unutar ograničenog vremena. Povežite ga ponovo ako želite pokušati.'),{name:'TimeoutError',phase});
const asView = value => {
  if(value instanceof DataView)return value;
  if(value instanceof Uint8Array)return new DataView(value.buffer,value.byteOffset,value.byteLength);
  if(value instanceof ArrayBuffer)return new DataView(value);
  throw Error('Uređaj nije vratio očekivani binarni podatak.');
};
function iso(now){const t=now();const date=new Date(t);if(!Number.isFinite(date.getTime()))throw Error('Neispravno vrijeme pregleda.');return date.toISOString();}
function numeric(value,min,max){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error('Uređaj je vratio vrijednost izvan standardnog opsega.');return value;}
function canonicalServiceUUID(value){
  if(typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=0xffffffff)value=value.toString(16).padStart(8,'0');
  if(typeof value!=='string')return null;
  const raw=value.toLowerCase();
  if(/^[0-9a-f]{4}$/.test(raw))return '0000'+raw+'-0000-1000-8000-00805f9b34fb';
  if(/^[0-9a-f]{8}$/.test(raw))return raw+'-0000-1000-8000-00805f9b34fb';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raw)?raw:null;
}
function decodeText(value){const view=asView(value);if(view.byteLength>512)throw Error('Identifikacijski podatak prelazi dozvoljenu veličinu.');return text(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(view.buffer,view.byteOffset,view.byteLength)));}

/** Bluetooth SIG Heart Rate Measurement: flags select 8- or 16-bit bpm. */
export function decodeHeartRate(value){
  const v=asView(value);if(v.byteLength<2||v.byteLength>512)throw Error('Neispravna poruka srčane frekvencije.');
  const flags=v.getUint8(0),wide=!!(flags&1),base=wide?3:2;
  if(flags&0xe0||v.byteLength<base)throw Error('Nepodržana ili nepotpuna poruka srčane frekvencije.');
  let cursor=base;if(flags&8){if(v.byteLength<cursor+2)throw Error('Nepotpuna poruka energije.');cursor+=2;}
  if(flags&16){if(v.byteLength===cursor||(v.byteLength-cursor)%2)throw Error('Neispravan RR interval.');}else if(v.byteLength!==cursor)throw Error('Neočekivani podaci srčane frekvencije.');
  // Sensor contact is unsupported, supported but absent, or detected. A missing
  // contact is not silently promoted to a valid human reading.
  if((flags&4)&&!(flags&2))throw Error('Senzor ne potvrđuje kontakt s kožom.');
  return wide?v.getUint16(1,true):v.getUint8(1);
}

export class DeviceReader {
  constructor({navigator=globalThis.navigator,now=()=>Date.now(),timeoutMs=8000,totalTimeoutMs=30000,notificationTimeoutMs=5000,chooserTimeoutMs=90000}={}){
    this.navigator=navigator||{};this.now=now;this.timeoutMs=Math.min(15000,Math.max(10,Number(timeoutMs)||8000));this.totalTimeoutMs=Math.min(60000,Math.max(20,Number(totalTimeoutMs)||30000));this.notificationTimeoutMs=Math.min(10000,Math.max(10,Number(notificationTimeoutMs)||5000));this.chooserTimeoutMs=Math.min(180000,Math.max(20,Number(chooserTimeoutMs)||90000));this.session=null;this.generation=0;
  }
  _check(s){if(this.session!==s||s.stopped||s.signal?.aborted)throw s.failure||aborted();if(Date.now()>s.deadline){s.failure=timeout(s.phase);throw s.failure;}}
  _close(s,error){if(!s)return;if(error&&!s.failure)s.failure=error;s.stopped=true;for(const cancel of [...s.pending])cancel();s.pending.clear();try{s.notificationCleanup?.();}catch{}try{s.device?.gatt?.disconnect();}catch{}s.signal?.removeEventListener('abort',s.abort);}
  cancel(){this.generation++;const s=this.session;this.session=null;this._close(s);}
  disconnect(){this.cancel();}
  dispose(){this.cancel();}
  _step(promise,s,{onLate,ms=this.timeoutMs}={}){
    return new Promise((resolve,reject)=>{
      let done=false;
      const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);s.pending.delete(cancel);fn(value);};
      const cancel=()=>finish(reject,s.failure||aborted());
      const timer=setTimeout(()=>{const error=timeout(s.phase);finish(reject,error);this._close(s,error);},Math.max(1,Math.min(ms,s.deadline-Date.now())));
      s.pending.add(cancel);
      Promise.resolve(promise).then(value=>{
        if(done||s.stopped||this.session!==s){try{onLate?.(value);}catch{}finish(reject,aborted());return;}
        try{this._check(s);finish(resolve,value);}catch(error){try{onLate?.(value);}catch{}finish(reject,error);}
      },error=>finish(reject,error));
    });
  }
  async _choose(promise,s,{onLate}={}){
    // A person choosing a device must not consume the bounded device-I/O budget.
    // Native choosers cannot be programmatically closed; cancellation invalidates
    // their eventual result and the fixed selection deadline prevents timer leaks.
    const value=await this._step(promise,s,{onLate,ms:this.chooserTimeoutMs});
    this._check(s);s.phase='read';s.deadline=Date.now()+this.totalTimeoutMs;return value;
  }
  _observation(s,out,id,value,unit){this._check(s);out.observations.push({id,value,unit,capturedAt:iso(this.now)});}
  _cap(out,id,status,reason){out.capabilities.push({id,status,reason:text(reason,400)});}
  async inspect(kind,{signal,includeHeartRate=false,includeMotion=false}={}){
    if(globalThis.isSecureContext===false)throw Error('Pregled uređaja zahtijeva HTTPS ili localhost.');
    if(!['ble','usb','hid','serial','gamepad','midi','browser'].includes(kind))throw Error('Nepodržani adapter pregleda.');
    this.cancel();if(signal?.aborted)throw aborted();
    const s={generation:this.generation,signal,stopped:false,pending:new Set(),deadline:Date.now()+this.chooserTimeoutMs,device:null,phase:'chooser',failure:null};
    this.session=s;s.abort=()=>{if(this.session===s)this.cancel();};signal?.addEventListener('abort',s.abort,{once:true});
    const out={transport:kind,name:'Uređaj',profileId:kind==='ble'?'ble-standard/1':kind==='gamepad'?'gamepad-state/1':kind==='midi'?'midi-ports/1':kind==='browser'?'browser-context/1':kind+'-descriptors/1',metadata:{},observations:[],capabilities:[],limitations:[],testOnly:false};
    try{
      if(kind==='ble')await this._ble(s,out,!!includeHeartRate,!!includeMotion);
      if(kind==='usb')await this._usb(s,out);
      if(kind==='hid')await this._hid(s,out);
      if(kind==='serial')await this._serial(s,out);
      if(kind==='gamepad'){s.phase='read';s.deadline=Date.now()+this.totalTimeoutMs;this._gamepad(s,out);}
      if(kind==='midi')await this._midi(s,out);
      if(kind==='browser'){s.phase='read';s.deadline=Date.now()+this.totalTimeoutMs;this._browser(s,out);}
      this._check(s);out.observedAt=iso(this.now);return out;
    }catch(error){
      let message=error?.message||'Pregled uređaja nije uspio.';
      if(error?.name==='NotFoundError')message='Niste odabrali dostupan uređaj. Uređaj mora biti vidljiv u sistemskom biraču.';
      if(error?.name==='SecurityError'||error?.name==='NotAllowedError')message='Preglednik ili sistem nisu dozvolili ovu vezu. Dozvolu možete dati kroz njegov birač uređaja.';
      const failure=new Error(message);failure.name=error?.name||'Error';failure.phase=error?.phase||s.phase;failure.cause=error;throw failure;
    }finally{if(this.session===s)this.session=null;this._close(s);}
  }
  async _ble(s,out,includeHeartRate,includeMotion){
    const api=this.navigator.bluetooth;if(!api?.requestDevice)throw Error('Web Bluetooth nije dostupan u ovom pregledniku.');
    const optionalServices=[BLE_SERVICES.battery,BLE_SERVICES.info,BLE_SERVICES.environment,BLE_SERVICES.generic,...(includeHeartRate?[BLE_SERVICES.heart]:[]),...(includeMotion?[MOTION_PROFILES.cycling.service,MOTION_PROFILES.running.service]:[])];
    // No scans before the explicit click, no vendor protocol guessing, and no
    // serial-number characteristic permission or device identifiers in results.
    const device=await this._choose(api.requestDevice({acceptAllDevices:true,optionalServices}),s,{onLate:d=>d?.gatt?.disconnect()});s.device=device;this._check(s);
    if(!device?.gatt?.connect)throw Error('Odabrani uređaj ne pruža podržanu BLE GATT vezu.');
    const advertisingName=text(device.name).trim();out.name=advertisingName||'BLE uređaj';out.metadata.serviceUUIDs=[];
    s.phase='connect';const server=await this._step(device.gatt.connect(),s,{onLate:()=>device.gatt.disconnect()});s.phase='read';
    const rememberService=id=>{this._check(s);const uuid=canonicalServiceUUID(id);if(uuid&&!out.metadata.serviceUUIDs.includes(uuid)&&out.metadata.serviceUUIDs.length<32)out.metadata.serviceUUIDs.push(uuid);return uuid;};
    const service=async(id,cap)=>{
      try{const found=await this._step(server.getPrimaryService(id),s);this._check(s);if(found?.uuid!==undefined&&canonicalServiceUUID(found.uuid)!==canonicalServiceUUID(id))throw Error('Servis ne odgovara traženom standardu.');rememberService(id);return found;}
      catch(error){this._check(s);if(error?.name==='TimeoutError'||error?.name==='AbortError')throw error;this._cap(out,cap,error?.name==='NotFoundError'?'unavailable':'failed',error?.name==='NotFoundError'?'Uređaj ne izlaže ovaj standardni servis.':'Servis nije bilo moguće pročitati.');return null;}
    };
    const read=async(svc,characteristic)=>{const c=await this._step(svc.getCharacteristic(characteristic),s);this._check(s);const value=await this._step(c.readValue(),s);this._check(s);return value;};
    const battery=await service(BLE_SERVICES.battery,'battery');
    if(battery){try{const v=asView(await read(battery,0x2a19));if(v.byteLength!==1)throw Error('Neispravan Battery Level podatak.');this._observation(s,out,'batteryLevel',numeric(v.getUint8(0),0,100),'%');this._cap(out,'battery','available','Standardni Battery Level je stvarno očitan. To nije mjerenje istrošenosti baterije.');}catch(error){this._check(s);this._cap(out,'battery','failed','Standardni podatak baterije nije dao valjano očitanje.');}}
    const generic=await service(BLE_SERVICES.generic,'generic-access');
    if(generic){let n=0;
      try{const value=decodeText(await read(generic,0x2a00)).trim();if(value){this._observation(s,out,'deviceName',value,'');if(!advertisingName)out.name=value;n++;}}catch(error){this._check(s);}
      try{const v=asView(await read(generic,0x2a01));if(v.byteLength!==2)throw Error('Appearance podatak mora sadržavati dva bajta.');this._observation(s,out,'appearance',v.getUint16(0,true),'1');n++;}catch(error){this._check(s);}
      this._cap(out,'generic-access',n?'available':'unavailable',n?'Pročitana su stvarna dostupna standardna polja naziva/Appearance; nije tražen identifikator ili serijski broj.':'Generic Access servis postoji, ali podržana identifikacijska polja nisu čitljiva.');
    }
    const info=await service(BLE_SERVICES.info,'device-information');
    if(info){let n=0;for(const [id,char]of Object.entries(INFO_FIELDS)){try{const value=decodeText(await read(info,char));if(value){this._observation(s,out,id,value,'');n++;}}catch(error){this._check(s);}}this._cap(out,'device-information',n?'available':'unavailable',n?'Pročitana su dostupna standardna polja identiteta; serijski broj nije tražen.':'Servis postoji, ali podržana identifikacijska polja nisu dostupna.');}
    if(!advertisingName&&!out.observations.some(o=>o.id==='deviceName')){const model=out.observations.find(o=>o.id==='model');if(model?.value)out.name=model.value;}
    const env=await service(BLE_SERVICES.environment,'environment');
    if(env){let n=0;for(const [id,char]of [['temperature',0x2a6e],['humidity',0x2a6f],['pressure',0x2a6d]]){try{const v=asView(await read(env,char));const size=id==='pressure'?4:2;if(v.byteLength!==size)throw Error('Neočekivana dužina očitanja.');const val=id==='temperature'?v.getInt16(0,true)/100:id==='humidity'?v.getUint16(0,true)/100:v.getUint32(0,true)/10000;numeric(val,id==='temperature'?-273.15:0,id==='humidity'?100:id==='pressure'?2e6:327.67);this._observation(s,out,id,val,id==='temperature'?'°C':id==='humidity'?'%':'kPa');n++;}catch(error){this._check(s);}}this._cap(out,'environment',n?'available':'unavailable',n?'Pročitani su dostupni senzorski kanali.':'Nema valjanog podržanog senzorskog očitanja.');}
    if(!includeHeartRate)this._cap(out,'heart-rate','not-requested','Lični podatak se ne traži bez zasebnog uključivanja opcije.');
    else{
      const heart=await service(BLE_SERVICES.heart,'heart-rate');
      if(heart){try{const c=await this._step(heart.getCharacteristic(0x2a37),s);const value=await this._heartNotification(c,s);this._observation(s,out,'heartRate',decodeHeartRate(value),'bpm');this._cap(out,'heart-rate','available','Jedna stvarna standardna notifikacija, bez medicinske procjene.');}catch(error){this._check(s);this._cap(out,'heart-rate','failed','Nema valjane potvrđene notifikacije u dozvoljenom roku.');}}
    }
    if(!includeMotion){
      this._cap(out,'cycling-motion','not-requested','CSC brojači kretanja ne traže se bez zasebnog uključivanja opcije.');
      this._cap(out,'running-motion','not-requested','RSC podaci aktivnosti ne traže se bez zasebnog uključivanja opcije.');
    }else{
      const cycling=await service(MOTION_PROFILES.cycling.service,'cycling-motion');
      if(cycling){try{
        const c=await this._step(cycling.getCharacteristic(MOTION_PROFILES.cycling.characteristic),s);
        const packets=await this._notifications(c,s,2),first=decodeCSC(packets[0].value),last=decodeCSC(packets[1].value);
        const derived=deriveCSC(first,last,{observedMilliseconds:packets[1].receivedAt-packets[0].receivedAt});
        for(const part of ['wheel','crank'])if(first[part]&&last[part])out.limitations.push(`CSC ${part}: brojač ${first[part].revolutions} pri ${first[part].eventTicks} → ${last[part].revolutions} pri ${last[part].eventTicks}; sirovo vrijeme događaja je u 1/1024 s i ima 16-bitni preljev.`);
        if(last.wheel)this._observation(s,out,'cyclingWheelRevolutions',last.wheel.revolutions,'rev');
        if(last.crank)this._observation(s,out,'cyclingCrankRevolutions',last.crank.revolutions,'rev');
        if(derived.wheelRate!==null)this._observation(s,out,'cyclingWheelRate',derived.wheelRate,'rev/s');
        if(derived.cadence!==null)this._observation(s,out,'cyclingCadence',derived.cadence,'rpm');
        const present=!!(last.wheel||last.crank);
        this._cap(out,'cycling-motion',present?'available':'unavailable',present?'Dva stvarna CSC paketa; dostupni brojači i izračunljive stope. Bez pretpostavljenog obima točka ili procjene kvara.':'CSC paketi nemaju dostupne brojače.');
        for(const message of derived.missing)out.limitations.push(message);
        out.limitations.push('CSC stope koriste modularne brojače i posljednja vremena događaja. Reset senzora i preljev brojača nije moguće uvijek razlikovati. Brzina u m/s i udaljenost nisu izvedeni bez poznatog obima točka.');
      }catch(error){this._check(s);this._cap(out,'cycling-motion','failed','Dva valjana CSC paketa nisu dostupna u ograničenom roku. Nema pretpostavljene kadence ili brzine.');}}
      const running=await service(MOTION_PROFILES.running.service,'running-motion');
      if(running){try{
        const c=await this._step(running.getCharacteristic(MOTION_PROFILES.running.characteristic),s),value=decodeRSC(await this._heartNotification(c,s));
        this._observation(s,out,'runningSpeed',value.speed,'m/s');this._observation(s,out,'runningCadence',value.cadence,'steps/min');
        if(value.strideLength!==undefined)this._observation(s,out,'runningStrideLength',value.strideLength,'m');
        if(value.distance!==undefined)this._observation(s,out,'runningDistance',value.distance,'m');
        this._cap(out,'running-motion','available','Jedan stvarni standardni RSC paket: prijavljeni brzina, kadenca i dostupna opciona polja, bez zdravstvene procjene.');
      }catch(error){this._check(s);this._cap(out,'running-motion','failed','Nema valjanog RSC paketa u ograničenom roku.');}}
      out.limitations.push('Podaci kretanja mogu opisivati ličnu aktivnost. Ovaj snimak ne utvrđuje medicinsko stanje, tačnost kalibracije ili ukupnu ispravnost senzora.');
    }
    // Enumerate only services already permitted by the native API. Never ask for
    // arbitrary vendor permissions, inspect vendor characteristics or send data.
    if(typeof server.getPrimaryServices==='function'&&s.deadline-Date.now()>Math.min(this.timeoutMs,500)){
      try{const services=await this._step(server.getPrimaryServices(),s);this._check(s);if(!Array.isArray(services))throw Error('Neispravan popis servisa.');for(const svc of services.slice(0,32))rememberService(svc?.uuid);
        out.limitations.push('Popis UUID-ova prikazuje samo servise koje je preglednik dozvolio ovom porijeklu; nije potpuni inventar uređaja. Nepoznati servisi nisu čitani.');
      }catch(error){this._check(s);out.limitations.push('Dodatni popis dozvoljenih BLE servisa nije dostupan ('+text(error?.name||'Error',80)+'). Ranije potvrđena očitanja su zadržana.');}
    }else out.limitations.push('Sačuvani su UUID-ovi stvarno dostupnih profila. Dodatni popis servisa nije dostupan kroz ovu vezu; ne pretpostavlja se da drugih servisa nema.');
    out.limitations.push('BLE izlaže samo servise koje uređaj i preglednik dopuštaju; slušalice i satovi često koriste zatvorene protokole.','Uspostavljena veza i nivo napunjenosti ne dokazuju ukupnu ispravnost, kapacitet ili istrošenost uređaja.');
  }
  async _heartNotification(characteristic,s){return (await this._notifications(characteristic,s,1))[0].value;}
  async _notifications(characteristic,s,count){
    if(!characteristic?.startNotifications||!characteristic?.addEventListener)throw Error('Notifikacije nisu dostupne.');
    if(![1,2].includes(count))throw Error('Nepodržan broj notifikacija.');
    let finish,fail;let active=true;const packets=[];
    const eventPromise=new Promise((resolve,reject)=>{finish=resolve;fail=reject;});eventPromise.catch(()=>{});
    const handler=e=>{if(active&&this.session===s&&!s.stopped&&packets.length<count){try{const v=asView(e.target?.value??characteristic.value);if(v.byteLength>512)throw Error('Notifikacija prelazi ograničenje podataka.');const bytes=new Uint8Array(v.buffer,v.byteOffset,v.byteLength);packets.push({value:new DataView(bytes.slice().buffer),receivedAt:globalThis.performance?.now?.()??Date.now()});if(packets.length===count)finish(packets);}catch(error){fail(error);}}};
    let cleaned=false;
    const cleanup=()=>{if(cleaned)return;cleaned=true;active=false;characteristic.removeEventListener('characteristicvaluechanged',handler);try{const result=characteristic.stopNotifications?.();result?.catch?.(()=>{});}catch{}};
    s.notificationCleanup=cleanup;characteristic.addEventListener('characteristicvaluechanged',handler);
    try{await this._step(characteristic.startNotifications(),s,{onLate:()=>{try{const p=characteristic.stopNotifications?.();p?.catch?.(()=>{});}catch{}}});return await this._step(eventPromise,s,{ms:this.notificationTimeoutMs});}
    finally{cleanup();if(s.notificationCleanup===cleanup)s.notificationCleanup=null;}
  }
  async _usb(s,out){
    const api=this.navigator.usb;if(!api?.requestDevice)throw Error('WebUSB nije dostupan u ovom pregledniku.');
    const device=await this._choose(api.requestDevice({filters:[]}),s);this._check(s);out.name=text(device.productName)||'USB uređaj';
    out.metadata={};for(const [target,key,max]of [['vendorId','vendorId',65535],['productId','productId',65535],['usbClass','deviceClass',255],['usbSubclass','deviceSubclass',255],['usbProtocol','deviceProtocol',255]]){if(device[key]!==undefined){const v=numeric(device[key],0,max);if(!Number.isInteger(v))throw Error('Neispravan USB deskriptor.');out.metadata[target]=v;}}if(typeof device.productName==='string')out.metadata.productName=text(device.productName);if(typeof device.manufacturerName==='string')out.metadata.manufacturerName=text(device.manufacturerName);if(Array.isArray(device.configurations)){out.metadata.configurationCount=count(device.configurations.length,32);if(device.configurations.every(c=>Array.isArray(c.interfaces)))out.metadata.interfaceCount=count(device.configurations.reduce((n,c)=>n+c.interfaces.length,0),256);}
    this._cap(out,'usb-descriptors','available','Pročitani su deskriptori odabranog uređaja. Nema open, claimInterface, transferIn ili transferOut poziva.');out.limitations.push('USB deskriptori opisuju identitet i interfejse; ne otkrivaju automatski kvar, sadržaj diska ili rad zatvorenog protokola.');
  }
  async _hid(s,out){
    const api=this.navigator.hid;if(!api?.requestDevice)throw Error('WebHID nije dostupan u ovom pregledniku.');
    const devices=await this._choose(api.requestDevice({filters:[]}),s);this._check(s);const device=devices?.[0];if(!device)throw Error('Niste odabrali HID uređaj.');out.name=text(device.productName)||'HID uređaj';
    out.metadata={vendorId:count(device.vendorId,65535),productId:count(device.productId,65535),productName:text(device.productName),collections:count(device.collections?.length,256)};
    this._cap(out,'hid-descriptors','available','Pročitani su samo dostupni deskriptori. Uređaj nije otvoren i ulazni izvještaji nisu praćeni.');out.limitations.push('Zaštićene tastature/miševi i drugi interfejsi mogu biti blokirani preglednikom; nema snimanja tipki ili slanja HID komandi.');
  }
  async _serial(s,out){
    const api=this.navigator.serial;if(!api?.requestPort)throw Error('Web Serial nije dostupan u ovom pregledniku.');
    const port=await this._choose(api.requestPort(),s);this._check(s);const info=port.getInfo();out.name='Serijski uređaj';
    out.metadata={};if(Number.isInteger(info.usbVendorId))out.metadata.vendorId=count(info.usbVendorId,65535);if(Number.isInteger(info.usbProductId))out.metadata.productId=count(info.usbProductId,65535);
    this._cap(out,'serial-port','available','Izabran je serijski port; port nije otvoren i komande nisu slane.');out.limitations.push('Identifikacija porta ne znači podršku njegovom protokolu. Za mjerenja koristite dokumentovani CLEA Sensor/1 ili ELM profil u odgovarajućem alatu.');
  }
  _gamepad(s,out){
    if(typeof this.navigator.getGamepads!=='function')throw Error('Gamepad API nije dostupan u ovom pregledniku.');
    this._check(s);const gamepad=Array.from(this.navigator.getGamepads()||[]).find(p=>p?.connected);if(!gamepad)throw Error('Kontroler nije vidljiv. Povežite ga i pritisnite jednu tipku, zatim ponovo pokrenite pregled.');
    out.name=text(gamepad.id)||'Kontroler';const buttons=Array.from(gamepad.buttons||[]).slice(0,64),axes=Array.from(gamepad.axes||[]).slice(0,32);out.metadata={mapping:text(gamepad.mapping,80),index:count(gamepad.index,15),connected:!!gamepad.connected,buttonsCount:buttons.length,axesCount:axes.length};
    buttons.forEach((b,i)=>this._observation(s,out,'gamepadButton'+i,numeric(b.value,0,1),'1'));axes.forEach((a,i)=>this._observation(s,out,'gamepadAxis'+i,numeric(a,-1,1),'1'));
    this._cap(out,'gamepad','available','Snimljeno je trenutno stvarno stanje izloženih tipki i osi. Nema vibracije ili promjene postavki.');out.limitations.push('Jedan snimak osi ne dokazuje drift ili kvar. Za poređenje snimite više stanja, uključujući mirovanje.');
  }
  async _midi(s,out){
    if(typeof this.navigator.requestMIDIAccess!=='function')throw Error('Web MIDI nije dostupan u ovom pregledniku.');
    const access=await this._choose(this.navigator.requestMIDIAccess({sysex:false}),s);this._check(s);const inputs=[...access.inputs.values()],outputs=[...access.outputs.values()];out.name='MIDI interfejsi';
    out.metadata={inputCount:count(inputs.length,64),outputCount:count(outputs.length,64),inputNames:inputs.slice(0,32).map(p=>text(p.name,120)),outputNames:outputs.slice(0,32).map(p=>text(p.name,120))};
    this._cap(out,'midi-ports',inputs.length||outputs.length?'available':'unavailable',inputs.length||outputs.length?'Popisani su odobreni MIDI portovi; SysEx nije tražen, MIDI poruke nisu slane niti praćene.':'Preglednik ne izlaže MIDI portove.');out.limitations.push('MIDI popis ne potvrđuje ispravnost instrumenta ili svih njegovih tipki.');
  }
  _browser(s,out){
    this._check(s);out.name='Kontekst preglednika';const c=this.navigator.connection;
    if(c){if(typeof c.type==='string')out.metadata.connectionType=text(c.type,40);if(typeof c.effectiveType==='string')out.metadata.effectiveType=text(c.effectiveType,40);if(typeof c.saveData==='boolean')out.metadata.saveData=c.saveData;if(typeof c.rtt==='number'&&Number.isFinite(c.rtt)&&c.rtt>=0&&c.rtt<=1e8)this._observation(s,out,'connectionRtt',c.rtt,'ms');if(typeof c.downlink==='number'&&Number.isFinite(c.downlink)&&c.downlink>=0&&c.downlink<=1e8)this._observation(s,out,'connectionDownlink',c.downlink,'Mbps');}
    this._cap(out,'browser-connection',c?'available':'unavailable',c?'Pročitana je procjena veze koju izlaže preglednik; nije rađen test propusnosti ili skeniranje Wi-Fi mreže.':'Preglednik ne izlaže Network Information podatke; dostupnost API-ja se provjerava odvojeno.');
    out.limitations.push('Wi-Fi, Zigbee, Thread, Matter, IR i Bluetooth audio profili nemaju univerzalan pristup kroz ovu web stranicu. Koristite odgovarajući dokumentovani sistemski adapter; nema izmišljene podrške.');
  }
}

export const STANDARD_BLE_SERVICES = BLE_SERVICES;
