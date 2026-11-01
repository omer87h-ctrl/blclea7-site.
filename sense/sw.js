/* No user-content cache. Preparation requires a visible user action. */
importScripts('./offline-assets.js');
const PREFIX='blclea-sense-offline-',NAME=PREFIX+SENSE_OFFLINE.version,MARKER=new URL('./__offline_complete__',self.location).href;
let active=null,preparing=null;
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
const tell=(source,message)=>source?.postMessage({format:'sense.offline/1',...message});
async function completeCache(){if(active)return active;const keys=(await caches.keys()).filter(k=>k.startsWith(PREFIX)).reverse();for(const key of keys){const c=await caches.open(key);if(await c.match(MARKER)){active=c;return c;}}return null;}
async function prepare(source){
 if(preparing)return;const controller=new AbortController();preparing=controller;
 const candidate=NAME+'-'+Date.now();const cache=await caches.open(candidate);
 try{
  let done=0;for(const asset of SENSE_OFFLINE.assets){
   if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
   const url=new URL(asset.path,self.registration.scope),response=await fetch(url,{cache:'reload',signal:controller.signal,credentials:'same-origin'});
   if(!response.ok||new URL(response.url).origin!==self.location.origin)throw Error('Asset unavailable');
   const bytes=await response.clone().arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==asset.sha256)throw Error('Integrity mismatch');
   await cache.put(url,response);tell(source,{kind:'progress',done:++done,total:SENSE_OFFLINE.assets.length});
  }
  if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
  // Marker is committed last. Fetch only sees complete caches.
  await cache.put(MARKER,new Response(SENSE_OFFLINE.version));active=cache;
  const keys=await caches.keys();for(const k of keys)if(k.startsWith(PREFIX)&&k!==candidate)await caches.delete(k);
  tell(source,{kind:'ready'});
 }catch(error){await caches.delete(candidate);tell(source,{kind:error.name==='AbortError'?'cancelled':'error'});}
 finally{preparing=null;}
}
self.addEventListener('message',e=>{
 const m=e.data;if(m?.format!=='sense.offline/1'||!['prepare','cancel','clear','status'].includes(m.op)||!e.source?.url?.startsWith(self.registration.scope))return;
 if(m.op==='prepare')e.waitUntil(prepare(e.source));
 if(m.op==='cancel')preparing?.abort();
 if(m.op==='status')e.waitUntil((async()=>{const c=await completeCache(),marker=c&&await c.match(MARKER);tell(e.source,{kind:'status',ready:!!c,version:marker?await marker.text():null,currentVersion:SENSE_OFFLINE.version});})());
 if(m.op==='clear')e.waitUntil((async()=>{if(preparing)return;for(const k of await caches.keys())if(k.startsWith(PREFIX))await caches.delete(k);active=null;tell(e.source,{kind:'cleared'});})());
});
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope)||url.pathname.includes('/downloads/'))return;
 e.respondWith((async()=>{
  // Online navigation receives the current release. Offline navigation keeps
  // the previously committed complete snapshot; user content is never cached.
  if(e.request.mode==='navigate'){try{const fresh=await fetch(e.request,{cache:'no-store'});if(fresh.ok)return fresh;}catch{}}
  const cache=await completeCache();if(cache){
  const key=e.request.mode==='navigate'&&url.pathname===new URL(self.registration.scope).pathname?new URL('index.html',self.registration.scope).href:e.request;const found=await cache.match(key,{ignoreSearch:false});if(found)return found;}
  return fetch(e.request);})());
});
