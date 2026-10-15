'use strict';
(function(scope){
const pending=new Map();let enabled=false,operations=[];
const client={
 profile(){return {platform:enabled?'android':'browser',operations:enabled?operations.slice():[]};},
 configure(metadata){operations=Object.keys(metadata||{});for(const [operation,definition]of Object.entries(metadata||{}))CLEA7Format.registerNative(operation,definition.permission);enabled=typeof scope.CLEA7Device?.request==='function';},
 invoke(operation,input){if(!enabled)return Promise.reject(Error('Ova funkcija zahtijeva Android CLEA7 Runtime; rezultat nije simuliran.'));if(pending.size>=8)return Promise.reject(Error('Android modulni red je pun.'));return new Promise((resolve,reject)=>{const id=CLEA7Format.newId('native');const timer=setTimeout(()=>{pending.delete(id);reject(Error('Android modul nije završio zahtjev.'));},95000);pending.set(id,{resolve,reject,timer});try{scope.CLEA7Device.request(JSON.stringify({id,operation,input:input||{}}));}catch(e){clearTimeout(timer);pending.delete(id);reject(e);}});},
 receive(message){const item=pending.get(message?.id);if(!item)return;clearTimeout(item.timer);pending.delete(message.id);if(message.ok)item.resolve(message.value);else item.reject(Error(message.error||'Android modul nije završio zahtjev.'));},
 close(){for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Runtime je zatvoren.'));}pending.clear();}
};scope.CLEA7DeviceClient=client;
})(globalThis);
