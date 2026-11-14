/* BL CLEA Tools device inspection contract. Original by Brzo i Lokalno.
 * Bounded, typed observations and factual explanations; never executes input. */
export const DEVICE_FORMAT = 'blclea.device.snapshot/1';
export const DEVICE_VAULT_FORMAT = 'blclea.device.vault/1';
const MAX_BYTES=1024*1024, MAX_RECORDS=20;
const FORBIDDEN=new Set(['__proto__','prototype','constructor']);
const TRANSPORTS=new Set(['ble','usb','hid','serial','gamepad','midi','browser']);
const STATES=new Set(['available','unavailable','unsupported','failed','not-requested']);
const clone=value=>JSON.parse(JSON.stringify(value));
const bytes=text=>new TextEncoder().encode(text).length;
function fail(message){const e=new Error(message);e.code='DEVICE_VALIDATION';throw e;}
function requireValue(condition,message){if(!condition)fail(message);}
function plain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);}
function inspect(value){const stack=[{value,depth:0}];let nodes=0;while(stack.length){const {value:v,depth}=stack.pop();requireValue(++nodes<=30000&&depth<=12,'Zapis uređaja je previše složen.');if(v===null||typeof v==='boolean')continue;if(typeof v==='string'){requireValue(v.length<=10000,'Tekst zapisa je predug.');continue;}if(typeof v==='number'){requireValue(Number.isFinite(v)&&Math.abs(v)<=1e12,'Zapis sadrži neispravan broj.');continue;}requireValue(Array.isArray(v)||plain(v),'Dozvoljeni su samo obični JSON podaci.');const keys=Object.keys(v);requireValue(keys.length<=512,'Previše polja u zapisu.');for(const k of keys){requireValue(!FORBIDDEN.has(k),'Opasno ime polja nije dozvoljeno.');const d=Object.getOwnPropertyDescriptor(v,k);requireValue(d&&'value'in d,'Izvršni pristupnici nisu dozvoljeni.');stack.push({value:d.value,depth:depth+1});}}}
function keys(v,allowed,label){requireValue(plain(v),label+': očekivan objekat.');for(const k of Object.keys(v))requireValue(allowed.includes(k),label+': nepodržano polje '+k+'.');}
function text(v,max=160,empty=true){requireValue(typeof v==='string'&&v.length<=max&&(empty||v.trim()),'Neispravan tekst uređaja.');return v;}
function numeric(v,min,max){requireValue(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,'Vrijednost uređaja je izvan dozvoljenog raspona.');return v;}
function date(v){requireValue(typeof v==='string'&&v.length<=40&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v)),'Neispravno vrijeme očitanja.');return v;}
function identifier(v){requireValue(typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,79}$/.test(v)&&!FORBIDDEN.has(v),'Neispravan identifikator.');return v;}
function nowISO(now){const v=now();return new Date(v).toISOString();}
function uniqueID(){if(!globalThis.crypto?.randomUUID)throw Error('Sigurno generisanje identifikatora nije dostupno.');return globalThis.crypto.randomUUID();}
const freezeEntry=(id,label,api,standard,limits)=>Object.freeze({id,label,api,standard,limits});
export const DEVICE_CAPABILITIES=Object.freeze([
 freezeEntry('generic-access','Standardni naziv i izgled','bluetooth','Bluetooth Generic Access 1800','Prijavljeni naziv i appearance su opis uređaja, ne dokaz autentičnosti ili ispravnosti.'),
 freezeEntry('battery','Nivo baterije','bluetooth','Bluetooth Battery Service 180F','Nivo napunjenosti nije kapacitet, istrošenost ili vijek baterije.'),
 freezeEntry('device-information','Podaci proizvođača','bluetooth','Bluetooth Device Information Service 180A','Proizvođač odlučuje koje karakteristike uređaj izlaže.'),
 freezeEntry('environment','Okolinska očitanja','bluetooth','Bluetooth Environmental Sensing 181A','Očitanja okoline nisu potpuna dijagnoza uređaja.'),
 freezeEntry('cycling-motion','Biciklistički senzori','bluetooth','Bluetooth Cycling Speed and Cadence 1816','Brzina točka i kadenca iz dvije standardne poruke; obim točka nije pretpostavljen.'),
 freezeEntry('running-motion','Senzori trčanja','bluetooth','Bluetooth Running Speed and Cadence 1814','Uređaj prijavljuje brzinu i kadencu; nema zdravstvene procjene.'),
 freezeEntry('heart-rate','Puls, uz poseban pristanak','bluetooth','Bluetooth Heart Rate Service 180D','Osjetljiv lični podatak; nije medicinska dijagnoza.'),
 freezeEntry('usb-descriptors','USB opis uređaja','usb','WebUSB descriptors','Opis uređaja nije provjera njegovih unutrašnjih komponenti.'),
 freezeEntry('hid-descriptors','HID opis uređaja','hid','WebHID descriptors','Nema čitanja tipki, pokretanja komandi ili otvaranja zaštićenih HID uređaja.'),
 freezeEntry('serial-port','Serijski priključak','serial','Web Serial getInfo','Samo opis odabranog priključka; proizvoljni protokol nije pretpostavljen.'),
 freezeEntry('gamepad','Kontrole gamepada','getGamepads','Gamepad API','Samo stvarne vrijednosti tipki i osa nakon korisničke radnje.'),
 freezeEntry('midi-ports','MIDI priključci','requestMIDIAccess','Web MIDI, sysex disabled','Popis priključaka; nema slanja MIDI komandi ili SysEx podataka.'),
 freezeEntry('browser-connection','Kontekst veze preglednika','connection','Network Information API','Ne otkriva stanje drugih Wi-Fi, LAN, Zigbee ili Matter uređaja.')
]);
const CAP_LABEL=Object.fromEntries(DEVICE_CAPABILITIES.map(c=>[c.id,c.label]));
export function capabilityMatrix(nav=globalThis.navigator||{},secureContext=globalThis.isSecureContext!==false){return DEVICE_CAPABILITIES.map(c=>{const present=c.api==='getGamepads'?typeof nav.getGamepads==='function':c.api==='requestMIDIAccess'?typeof nav.requestMIDIAccess==='function':!!nav[c.api];return {id:c.id,label:c.label,standard:c.standard,available:present&&secureContext,status:!secureContext?'unavailable':present?'available':'unsupported',reason:!secureContext?'Za pristup uređajima potreban je HTTPS ili localhost.':present?'API je dostupan; uređaj i njegov protokol tek treba provjeriti.':'Ovaj preglednik ne izlaže potrebni API.',limits:c.limits};});}
const OBS={
 deviceName:{label:'Naziv pročitan iz uređaja',type:'text',unit:''},
 appearance:{label:'Standardna oznaka izgleda (appearance)',unit:'1',min:0,max:65535},
 batteryLevel:{label:'Nivo napunjenosti',unit:'%',min:0,max:100},
 temperature:{label:'Temperatura',unit:'°C',min:-273.15,max:2000},
 humidity:{label:'Relativna vlaga',unit:'%',min:0,max:100},
 pressure:{label:'Pritisak',unit:'kPa',min:0,max:2e6},
 cyclingWheelRevolutions:{label:'Brojač okretaja točka',unit:'rev',min:0,max:4294967295},
 cyclingCrankRevolutions:{label:'Brojač okretaja pogona',unit:'rev',min:0,max:65535},
 cyclingCadence:{label:'Kadenca pogona',unit:'rpm',min:0,max:4026470400},
 cyclingWheelRate:{label:'Stopa okretanja točka',unit:'rev/s',min:0,max:1e12},
 runningSpeed:{label:'Prijavljena brzina trčanja',unit:'m/s',min:0,max:255.99609375},
 runningCadence:{label:'Prijavljena kadenca koraka',unit:'steps/min',min:0,max:255},
 runningStrideLength:{label:'Prijavljena dužina koraka',unit:'m',min:0,max:655.35},
 runningDistance:{label:'Prijavljena ukupna udaljenost',unit:'m',min:0,max:429496729.5},
 heartRate:{label:'Puls',unit:'bpm',min:0,max:65535},
 manufacturer:{label:'Proizvođač',type:'text',unit:''},model:{label:'Model',type:'text',unit:''},firmware:{label:'Firmware',type:'text',unit:''},hardware:{label:'Hardverska verzija',type:'text',unit:''},software:{label:'Softverska verzija',type:'text',unit:''},bodySensorLocation:{label:'Mjesto senzora pulsa',type:'text',unit:''},
 connectionRtt:{label:'Procijenjeni RTT veze preglednika',unit:'ms',min:0,max:1e8},connectionDownlink:{label:'Procijenjena brzina veze preglednika',unit:'Mbps',min:0,max:1e8}
};
export const DEVICE_OBSERVATIONS=Object.freeze(Object.fromEntries(Object.entries(OBS).map(([id,v])=>[id,Object.freeze({id,...v})])));
function observationSpec(id){if(OBS[id])return OBS[id];if(/^gamepadButton(?:[0-9]|[1-5][0-9]|6[0-3])$/.test(id))return {label:'Tipka '+id.slice(13),unit:'1',min:0,max:1};if(/^gamepadAxis(?:[0-9]|[12][0-9]|3[01])$/.test(id))return {label:'Osa '+id.slice(11),unit:'1',min:-1,max:1};fail('Nepodržano očitanje: '+id+'.');}
const META_TEXT={productName:160,manufacturerName:160,mapping:80,portState:40,connectionType:40,effectiveType:40};
const META_NUM={vendorId:[0,65535],productId:[0,65535],collections:[0,256],interfaceCount:[0,256],index:[0,15],buttonsCount:[0,64],axesCount:[0,32],inputCount:[0,64],outputCount:[0,64],usbClass:[0,255],usbSubclass:[0,255],usbProtocol:[0,255],configurationCount:[0,32],downlink:[0,1e8],rtt:[0,1e8]};
function metadata(value){keys(value,[...Object.keys(META_TEXT),...Object.keys(META_NUM),'connected','saveData','inputNames','outputNames','serviceUUIDs'],'Metapodaci');for(const [key,v]of Object.entries(value)){if(META_TEXT[key])text(v,META_TEXT[key]);else if(META_NUM[key]){numeric(v,...META_NUM[key]);if(!['downlink','rtt'].includes(key))requireValue(Number.isInteger(v),'Broj deskriptora mora biti cijeli broj.');}else if(['connected','saveData'].includes(key))requireValue(typeof v==='boolean','Neispravna logička vrijednost.');else if(key==='serviceUUIDs'){requireValue(Array.isArray(v)&&v.length<=32&&new Set(v).size===v.length,'Previše ili ponovljeni BLE servisi.');v.forEach(n=>requireValue(typeof n==='string'&&/^(?:[0-9a-f]{4}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(n),'Neispravan BLE UUID.'));}else {requireValue(Array.isArray(v)&&v.length<=32,'Previše MIDI naziva.');v.forEach(n=>text(n,120));}}return value;}
function canonicalObservation(o,defaultTime){keys(o,['id','label','value','unit','capturedAt'],'Očitanje');const id=identifier(o.id),spec=observationSpec(id);if(o.label!==undefined)text(o.label,160);const unit=o.unit??'';requireValue(unit===spec.unit,'Nepodržana jedinica za '+id+'.');if(spec.type==='text')text(o.value,160);else numeric(o.value,spec.min,spec.max);return {id,label:spec.label,value:o.value,unit,capturedAt:date(o.capturedAt||defaultTime)};}
function canonicalCapability(c){keys(c,['id','label','status','reason'],'Mogućnost');const id=identifier(c.id);requireValue(Object.hasOwn(CAP_LABEL,id),'Nepodržana mogućnost uređaja.');if(c.label!==undefined)text(c.label,160);requireValue(STATES.has(c.status),'Nepodržan status mogućnosti.');return {id,label:CAP_LABEL[id],status:c.status,reason:text(c.reason||'',600)};}
export function createDeviceSnapshot(input,{now=()=>Date.now(),id=uniqueID}={}){
 inspect(input);keys(input,['transport','name','profileId','observedAt','metadata','observations','capabilities','limitations','testOnly'],'Ulaz uređaja');
 requireValue(TRANSPORTS.has(input.transport),'Nepodržan transport.');
 const observedAt=input.observedAt||input.observations?.at(-1)?.capturedAt||nowISO(now);
 const output={format:DEVICE_FORMAT,id:identifier(id()),transport:input.transport,name:text(input.name||'Odabrani uređaj',160,false),profileId:identifier(input.profileId||input.transport+'/1'),observedAt:date(observedAt),metadata:metadata(input.metadata||{}),observations:(input.observations||[]).map(o=>canonicalObservation(o,observedAt)),capabilities:(input.capabilities||[]).map(canonicalCapability),limitations:input.limitations||[],origin:'live',testOnly:input.testOnly===true};
 return validateDeviceSnapshot(output);
}
export function validateDeviceSnapshot(input){
 inspect(input);keys(input,['format','id','transport','name','profileId','observedAt','metadata','observations','capabilities','limitations','origin','testOnly'],'Snimak uređaja');
 requireValue(input.format===DEVICE_FORMAT,'Nepodržana verzija snimka uređaja.');identifier(input.id);identifier(input.profileId);requireValue(TRANSPORTS.has(input.transport),'Nepodržan transport.');text(input.name,160,false);date(input.observedAt);metadata(input.metadata);
 requireValue(Array.isArray(input.observations)&&input.observations.length<=128,'Previše očitanja.');const ids=new Set();for(const o of input.observations){canonicalObservation(o,input.observedAt);requireValue(!ids.has(o.id),'Duplo očitanje nije dozvoljeno.');ids.add(o.id);}
 requireValue(Array.isArray(input.capabilities)&&input.capabilities.length<=32,'Previše mogućnosti.');const caps=new Set();for(const c of input.capabilities){canonicalCapability(c);requireValue(!caps.has(c.id),'Dupla mogućnost nije dozvoljena.');caps.add(c.id);}
 requireValue(Array.isArray(input.limitations)&&input.limitations.length<=24,'Previše ograničenja.');input.limitations.forEach(v=>text(v,600));requireValue(['live','imported'].includes(input.origin),'Nepodržano porijeklo.');requireValue(typeof input.testOnly==='boolean','Neispravna oznaka testnih podataka.');const serialized=JSON.stringify(input);requireValue(bytes(serialized)<=MAX_BYTES,'Snimak je veći od 1 MiB.');return {...clone(input),observations:input.observations.map(o=>canonicalObservation(o,input.observedAt)),capabilities:input.capabilities.map(canonicalCapability)};
}
export function explainSnapshot(input,{previous=null,confirmedSameDevice=false}={}){
 const s=validateDeviceSnapshot(input),findings=[],limits=[...s.limitations],present=s.observations.length,available=s.capabilities.filter(c=>c.status==='available').length;
 const add=(title,message)=>findings.push({title,message});
 add('Izvor zaključka',`${present} stvarno dostavljenih očitanja i ${available} dostupnih mogućnosti u odabranom profilu. Porijeklo: ${s.origin==='imported'?'uvezeni zapis':'radnja očitavanja'}.`);
 const battery=s.observations.find(o=>o.id==='batteryLevel');if(battery)add('Baterija',`Uređaj prijavljuje ${battery.value}% napunjenosti. Ovaj podatak ne mjeri kapacitet, istrošenost niti preostali vijek baterije.`);
 const info=s.observations.filter(o=>['manufacturer','model','firmware','hardware','software'].includes(o.id));if(info.length)add('Identitet koji uređaj izlaže',`Prijavljena polja: ${info.map(o=>o.label||OBS[o.id].label).join(', ')}. Ti podaci nisu dokaz autentičnosti ili ispravnosti uređaja.`);
 const unavailable=s.capabilities.filter(c=>c.status!=='available');for(const c of unavailable)add(c.label||c.id,c.reason||'Ova mogućnost nije dostavila podatke. Nepostojanje očitanja ne dokazuje kvar.');
 const heart=s.observations.find(o=>o.id==='heartRate');if(heart)add('Puls je lični podatak',`Senzor je prijavio ${heart.value} bpm. Rezultat nije medicinska procjena; čuvanje i izvoz su pod vašom kontrolom.`);
 const buttons=s.observations.filter(o=>o.id.startsWith('gamepadButton')),axes=s.observations.filter(o=>o.id.startsWith('gamepadAxis'));if(buttons.length||axes.length)add('Trenutni ulaz kontrolera',`Očitano ${buttons.length} tipki i ${axes.length} osa. Jedan snimak nije test svih položaja niti dokaz odsustva kvara.`);
 if(['usb','hid','serial','midi'].includes(s.transport))add('Granica pregleda',`Ovaj pregled čita opis i dostupnost ${s.transport.toUpperCase()} priključka. Ne provjerava unutrašnji firmware, električnu sigurnost, mehaniku ili neobjavljene servisne protokole.`);
 if(!present)add('Nema podržanih očitanja','Uređaj nije dostavio registrovana očitanja kroz ovaj profil. To može biti ograničenje protokola, pristupa ili preglednika; ne predstavlja potvrdu kvara.');
 if(previous){const p=validateDeviceSnapshot(previous);if(confirmedSameDevice&&p.transport===s.transport&&p.profileId===s.profileId){const prior=new Map(p.observations.map(o=>[o.id,o]));for(const o of s.observations){const b=prior.get(o.id);if(b&&typeof o.value==='number'&&typeof b.value==='number'&&b.unit===o.unit&&o.value!==b.value)add('Promjena · '+(o.label||o.id),`${b.value} → ${o.value} ${o.unit}; razlika ${Number((o.value-b.value).toPrecision(8))} ${o.unit}. Isti uređaj potvrdio je korisnik; uzrok promjene nije dokazan.`);}}else limits.push('Poređenje nije izvršeno: isti fizički uređaj nije izričito potvrđen ili se profil razlikuje. Naziv uređaja nije pouzdan identifikator.');}
 if(s.testOnly)limits.unshift('OZNAČENI TESTNI PODACI: ovaj snimak nije dokaz fizičkog mjerenja.');if(s.origin==='imported')limits.push('Uvezenim vrijednostima i porijeklu ne može se vjerovati kao hardverski potvrđenim podacima.');limits.push('Preglednik ne omogućava univerzalan pristup svim Bluetooth, Wi-Fi, NFC, Zigbee, Thread ili proizvođačkim servisima.','Nije formiran izmišljeni ukupni rezultat zdravlja; nepodržani podaci ostaju nepoznati.');
 const trace=[{pillar:'Core AI Manager',operation:'bounded-inspection',detail:`Provjeren strukturirani snimak sa ${present} očitanja; AI nije pozivan.`},{pillar:'Link Bridge Elite',operation:'transport-contract',detail:`Transport ${s.transport}; profil ${s.profileId}.`},{pillar:'Expansion Q',operation:'typed-observation-registry',detail:`Provjereno ${present} registrovanih tipova i ${s.capabilities.length} opisanih mogućnosti.`},{pillar:'Adaptive Recovery',operation:'missing-capabilities',detail:`${unavailable.length} mogućnosti nije dostupno; postojeće vrijednosti nisu nadomještene.`},{pillar:'Holo Interaction',operation:'factual-render-model',detail:`Pripremljeni prikazi stvarnih vrijednosti i ograničenja.`},{pillar:'Fallback Executor',operation:'explicit-unknown',detail:present?'Sačuvan djelimičan rezultat; nepodržani podaci označeni su nepoznatim.':'Nema izmišljenih vrijednosti; dostupan je izvještaj o ograničenjima.'},{pillar:'Vision Q',operation:'trace-explanation',detail:`${findings.length} objašnjenja izvedeno je iz ovog zapisa, bez AI nagađanja.`}];
 return {summary:present?`${s.name}: ${present} očitanja kroz ${s.transport.toUpperCase()}. Potpuno stanje uređaja nije potvrđeno.`:`${s.name}: nema podržanih očitanja; dostupni su opis i ograničenja veze.`,findings,limits:[...new Set(limits)],trace};
}
export class DeviceVault{
 constructor({storage,key='blclea.tools.devices.v1',now=()=>Date.now(),id=uniqueID}={}){if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}this.storage=storage;this.key=key;this.now=now;this.id=id;this.records=[];this.available=true;this.message='Snimci se čuvaju lokalno nakon vaše radnje.';this.raw=null;try{this.raw=storage?.getItem(key)??null;if(this.raw!==null){const v=this.parse(this.raw);keys(v,['format','records'],'Biblioteka uređaja');requireValue(v.format===DEVICE_VAULT_FORMAT&&Array.isArray(v.records)&&v.records.length<=MAX_RECORDS,'Neispravna biblioteka uređaja.');const ids=new Set();this.records=v.records.map(r=>{const s=validateDeviceSnapshot(r);requireValue(!ids.has(s.id),'Dupli identitet snimka.');ids.add(s.id);return s;});}if(!storage)this.unavailable('Lokalno spremište nije dostupno; izvezite snimke prije zatvaranja.');}catch{this.records=[];this.unavailable('Lokalna biblioteka nije dostupna ili nije valjana. Novi snimci ostaju u memoriji i mogu se izvesti; postojeći sadržaj nije prepisan.');this.blockWrites=true;}}
 parse(raw){requireValue(typeof raw==='string'&&bytes(raw)<=MAX_BYTES,'Biblioteka je veća od 1 MiB.');let v;try{v=JSON.parse(raw);}catch{fail('Datoteka nije ispravan JSON.');}inspect(v);return v;}
 unavailable(message){this.available=false;this.message=message;}
 getPersistenceStatus(){return {available:this.available,message:this.message};}
 list(){return clone(this.records);}
 save(input){const s=validateDeviceSnapshot(input),next=this.records.filter(r=>r.id!==s.id);requireValue(next.length<MAX_RECORDS,'Biblioteka može sadržavati najviše 20 snimaka. Izvezite i uklonite neki snimak.');next.unshift(s);this.persist(next);return clone(s);}
 persist(next){const serialized=JSON.stringify({format:DEVICE_VAULT_FORMAT,records:next});requireValue(bytes(serialized)<=MAX_BYTES,'Biblioteka premašuje 1 MiB; izvezite i uklonite starije snimke.');if(!this.blockWrites&&this.storage){try{requireValue(this.storage.getItem(this.key)===this.raw,'Biblioteka je promijenjena u drugoj kartici. Izvezite trenutni snimak prije ponovnog učitavanja.');this.storage.setItem(this.key,serialized);this.raw=serialized;this.available=true;this.message='Snimak je sačuvan u ovom pregledniku.';}catch(e){this.unavailable(e.code==='DEVICE_VALIDATION'?e.message:'Spremanje nije uspjelo. Snimci ostaju u memoriji; izvezite ih prije zatvaranja.');this.blockWrites=true;}}else this.unavailable('Snimci su samo u memoriji; izvezite ih prije zatvaranja.');this.records=next;}
 remove(id){identifier(id);if(!this.records.some(r=>r.id===id))return false;this.persist(this.records.filter(r=>r.id!==id));return true;}
 export(id){identifier(id);const s=this.records.find(r=>r.id===id);requireValue(s,'Snimak nije pronađen.');return JSON.stringify(validateDeviceSnapshot(s),null,2);}
 import(raw){const source=validateDeviceSnapshot(this.parse(raw));const fresh=identifier(this.id());requireValue(fresh!==source.id&&!this.records.some(r=>r.id===fresh),'Uvoz mora dobiti novi nezavisan identitet.');source.id=fresh;source.origin='imported';return this.save(source);}
}
