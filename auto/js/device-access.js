/* Original CLEA device access diagnostics. No user-agent fingerprinting, device
 * enumeration, permission requests, network calls or guessed hardware health. */
const ADAPTERS=Object.freeze({
 ble:{api:'bluetooth',method:'requestDevice',feature:'bluetooth',name:'Bluetooth LE'},
 usb:{api:'usb',method:'requestDevice',feature:'usb',name:'USB'},
 hid:{api:'hid',method:'requestDevice',feature:'hid',name:'HID'},
 serial:{api:'serial',method:'requestPort',feature:'serial',name:'serijski priključak'},
 gamepad:{method:'getGamepads',feature:'gamepad',name:'kontroler'},
 midi:{method:'requestMIDIAccess',feature:'midi',name:'MIDI'},
 browser:{name:'kontekst preglednika'}
});
const DIRECT='Otvorite isti link direktno u punom Chromeu ili Edgeu. Na telefonu koristite meni ⋮ → Otvori u pregledniku / Chromeu, ili kopirajte adresu.';
function contextEmbedded(w){try{return !!w&&w.self!==w.top;}catch{return true;}}
function policyState(doc,feature){if(!feature)return 'not-applicable';const p=doc?.permissionsPolicy||doc?.featurePolicy;if(!p||typeof p.allowsFeature!=='function'||typeof p.features!=='function')return 'not-observable';try{const known=p.features();if(!Array.isArray(known)||!known.includes(feature))return 'not-observable';return p.allowsFeature(feature)?'allowed':'blocked';}catch{return 'not-observable';}}

/** Synchronous: callers can check this before a device chooser without losing
 * transient user activation. API availability is not device compatibility. */
export function getDeviceAccess(kind,{navigator=globalThis.navigator||{},document=globalThis.document,window=globalThis.window,secureContext=globalThis.isSecureContext!==false}={}){
 if(!Object.hasOwn(ADAPTERS,kind))throw Error('Nepoznata vrsta veze.');
 const adapter=ADAPTERS[kind],embedded=contextEmbedded(window),policy=policyState(document,adapter.feature);
 let apiPresent=false;try{apiPresent=kind==='browser'||(adapter.api?typeof navigator[adapter.api]?.[adapter.method]==='function':typeof navigator[adapter.method]==='function');}catch{}
 let status='ready',reason='Preglednik nudi potreban pristup. Uređaj i njegov protokol provjeravaju se tek nakon vašeg izbora.',nextSteps=[];
 if(!secureContext){status='insecure-context';reason='Pristup uređajima zahtijeva siguran HTTPS ili localhost prikaz.';nextSteps=['Otvorite objavljenu HTTPS adresu; preuzeta HTML datoteka nije zamjena za nju.'];}
 else if(policy==='blocked'){status='blocked-policy';reason=`Sigurnosna pravila ovog prikaza blokiraju ${adapter.name}. To je ograničenje stranice ili ugrađenog prikaza, ne nalaz o uređaju.`;nextSteps=[DIRECT,'Ako je pristup blokiran i u punom pregledniku, vlasnik hostinga treba provjeriti Permissions Policy. Aplikacija ne može sama dodijeliti tu dozvolu.'];}
 else if(!apiPresent){status='missing-api';reason=`Ovaj prikaz ne nudi potreban API za ${adapter.name}. Uređaj još nije ni pregledan.`;nextSteps=[DIRECT,'Podrška zavisi od operativnog sistema i preglednika. Instalacija PWA ne dodaje API koji preglednik nema.'];}
 else if(embedded)nextSteps=[DIRECT,'Ugrađeni prikaz je otkriven. Prisustvo API-ja samo po sebi ne potvrđuje da su sve potrebne dozvole delegirane.'];
 return {kind,name:adapter.name,status,canRequest:status==='ready',secureContext:!!secureContext,apiPresent,embedded,policy,reason,nextSteps};
}

/** An explicit, separate check; never put this await before requestDevice().
 * getAvailability false has several causes and does not prove Bluetooth is off. */
export async function checkDeviceAccess(kind,{signal,timeoutMs=1800,...context}={}){
 const access=getDeviceAccess(kind,context);let bluetooth='not-queried';
 const api=(context.navigator||globalThis.navigator)?.bluetooth;
 if(kind!=='ble'||!access.canRequest||typeof api?.getAvailability!=='function')return {...access,bluetooth,availabilityDetail:'Nema dodatnog nalaza o Bluetooth radiju.'};
 if(signal?.aborted)throw Object.assign(Error('Provjera pristupa je zaustavljena.'),{name:'AbortError'});
 let timer,onAbort;
 try{
  const value=await Promise.race([
   Promise.resolve().then(()=>api.getAvailability()),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('Provjera nije odgovorila.'),{name:'TimeoutError'})),Math.max(10,Math.min(5000,timeoutMs)));onAbort=()=>reject(Object.assign(Error('Provjera pristupa je zaustavljena.'),{name:'AbortError'}));signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort();})
  ]);
  bluetooth=value===true?'reported-available':value===false?'reported-unavailable':'not-reported';
 }catch(error){if(error.name==='AbortError')throw error;bluetooth='probe-failed';}
 finally{clearTimeout(timer);if(onAbort)signal?.removeEventListener('abort',onAbort);}
 return {...access,bluetooth,availabilityDetail:bluetooth==='reported-available'?'Preglednik prijavljuje Bluetooth mogućnost. To ne potvrđuje uključen radio, dozvolu ili kompatibilnost izabranog uređaja.':bluetooth==='reported-unavailable'?'Preglednik trenutno ne prijavljuje Bluetooth mogućnost. Uzrok može biti pravilo pristupa, podešavanje preglednika ili adapter. Ova provjera sama ne utvrđuje uzrok.':'Preglednik nije dao pouzdan dodatni nalaz o Bluetooth mogućnosti.'};
}

export function explainDeviceError(error,{kind='ble'}={}){
 const name=typeof error?.name==='string'?error.name:'Error';
 const basic={code:name,title:'Pregled nije završen',message:'Nema potvrđenog rezultata o stanju uređaja.',steps:[]};
 if(name==='AbortError')return {...basic,title:'Pregled je zaustavljen',message:'Prethodni snimak ostaje sačuvan u prikazu. Nije donesen novi zaključak o uređaju.'};
 if(name==='NotFoundError')return {...basic,title:'U biraču nije potvrđen izbor',message:'Preglednik nije vratio izabrani uređaj. To može značiti zatvoren birač ili da uređaj nije ponuđen; ne dokazuje kvar.',steps:['Provjerite da je uređaj vidljiv za povezivanje i da koristite odgovarajuću vrstu veze.',...(kind==='ble'?['Bluetooth audio slušalice nisu nužno BLE GATT uređaj. Standardni BLE pregled ne otključava njihov zatvoreni audio ili servisni protokol.']:[])]};
 if(name==='SecurityError'||name==='NotAllowedError')return {...basic,title:'Pristup nije odobren',message:'Preglednik, sistem ili pravilo ovog prikaza nije dozvolilo radnju. Sam uređaj nije proglašen nepodržanim.',steps:[DIRECT,'Provjerite dozvole ove stranice i sistemske dozvole za obližnje uređaje. Ponovo pokrenite pregled samo svojom radnjom.']};
 if(name==='NotSupportedError')return {...basic,title:'Izabrani način povezivanja nije dostupan',message:'Preglednik ili sistem je odbio ovu operaciju. To ne znači da su sve veze tog uređaja nepodržane.',steps:[DIRECT,'Potreban je dokumentovani profil uređaja i odgovarajući sistemski adapter. Web BLE ne zamjenjuje Bluetooth Classic audio, proizvođački protokol ili njihov driver.']};
 if(name==='UnknownError')return {...basic,title:'Sistem nije objasnio grešku veze',message:'Primljen je UnknownError. Iz tog odgovora se ne može utvrditi uzrok niti ispravnost uređaja.',steps:[DIRECT,'Zabilježite marku/model i korak na kojem je veza stala. Provjerite vezu i dozvole; proizvoljne komande neće se slati da bi se nagađao protokol.']};
 if(name==='NetworkError')return {...basic,title:'Uređaj nije uspostavio ili zadržao vezu',message:'Bluetooth/GATT ili druga veza je prijavila grešku. To nije nužno greška interneta.',steps:['Provjerite domet, napajanje i da li druga aplikacija drži vezu s uređajem. Ponovite povezivanje na svoj zahtjev.']};
 if(name==='TimeoutError')return {...basic,title:'Uređaj nije odgovorio na vrijeme',message:'Dozvoljeno vrijeme za ovaj korak je isteklo. Prethodni rezultat nije zamijenjen.',steps:['Provjerite vezu i stanje uređaja pa pokušajte ponovo. Automatske ponovljene komande nisu pokrenute.']};
 return {...basic,message:typeof error?.message==='string'?error.message.slice(0,800):basic.message,steps:[DIRECT]};
}
