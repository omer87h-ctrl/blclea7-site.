'use strict';
/* One self-contained HTML host for the existing checked BIL/Core. No app-specific JS. */
(function(scope){
const FILES=['../runtime.js','living.js','bil-compiler.js','bil-runtime.js','working-cache.js','clea-core.js','format.js','plan.js','review.js','consumer.js','engine.js','studio.css'];
const CSS=`
:root{color-scheme:light;--bg:#f5f4f0;--surface:#ffffff;--line:#dedfdc;--accent:#214ed3;--ink:#202b36;--muted:#63707c;font:15px/1.55 system-ui,sans-serif}
body{margin:0;background:var(--bg);color:var(--ink)}[hidden]{display:none!important}
.standalone-bar{max-width:1160px;margin:auto;padding:24px 28px;display:flex;align-items:center;gap:16px;border:0;flex-wrap:wrap}
.standalone-emblem{width:44px;height:44px;border-radius:14px;background:var(--ink);color:#fff;display:grid;place-items:center;font-weight:800;font-size:23px;flex:0 0 auto}
.standalone-brand{flex:1;min-width:160px}.standalone-brand h1{font-size:22px;line-height:1.25;letter-spacing:-.04em;margin:0}.standalone-brand p{font-size:12px;color:var(--muted);margin:4px 0 0}
.standalone-status{font-size:12px;display:inline-flex;align-items:center;gap:7px;color:#27684c}.standalone-status:before{content:'';width:7px;height:7px;background:currentColor;border-radius:100%}.standalone-status[data-state=error]{color:#9e302e}
.standalone-tools{position:relative;margin:0}.standalone-tools summary{list-style:none;cursor:pointer;border:1px solid var(--line);background:#fff;border-radius:10px;padding:10px 15px;min-height:44px;font-weight:650}.standalone-tools summary::-webkit-details-marker{display:none}
.standalone-tools>div{position:absolute;z-index:20;right:0;top:52px;width:min(320px,85vw);padding:16px;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 32px #18243518;display:grid;gap:10px}.standalone-tools p{font-size:12px;color:var(--muted);margin:0}
.standalone-content{padding:0 24px 32px;max-width:1160px;margin:auto}.standalone-content #app{margin:0;min-height:70vh;overflow-wrap:anywhere}.standalone-content #app>section{min-width:0}
.standalone-content input,.standalone-content select,.standalone-content textarea{background:#fff;border-color:#cdd3d9;color:#202b36;min-height:48px;border-radius:10px;accent-color:var(--accent)}
.standalone-content input:focus-visible,.standalone-content select:focus-visible,.standalone-content textarea:focus-visible,.standalone-tools summary:focus-visible{outline:3px solid #214ed380;outline-offset:3px}
.standalone-content .bil-collection{border:0!important;background:transparent!important;padding:0!important}.standalone-content .bil-collection nav{padding:10px 0}.standalone-content .bil-collection article{box-shadow:0 3px 12px #18243508}
.standalone-content .bil-application{padding:0;color:var(--ink)}.standalone-content .bil-application>h1{font-size:12px;line-height:1.4;margin:0 0 12px;color:var(--muted)}
.standalone-content .bil-row{margin:0}.standalone-content [data-bil-view]>span:first-child{display:none}.standalone-content .bil-metric output{font:inherit;color:inherit;display:block}
.standalone-content button{background:#e8efe5;color:#24342e;border-color:#cdd7ca;font-weight:650}.standalone-content .bil-collection-card{background:#fff;border-color:#dfe5dc!important;padding:22px!important;box-shadow:0 3px 12px #18243508}.standalone-content .bil-collection-card h3{margin:0 0 14px;font-size:21px;letter-spacing:-.025em}.standalone-content .bil-collection-card dt{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#66756c}.standalone-content .bil-collection-card dd{margin:3px 0 14px}.standalone-content .bil-collection-card button{width:100%;min-height:46px;border-radius:10px}
.standalone-content .bil-card>h2{margin:0 0 12px}.standalone-content .bil-field{font-weight:600;font-size:13px}.standalone-content .bil-field input,.standalone-content .bil-field textarea{font-weight:400}
#standalone-notice{max-width:1104px;margin:0 auto 12px;border-left:3px solid #b83f35;padding:10px 14px;background:#fff0ed;color:#852922;white-space:pre-wrap;overflow-wrap:anywhere}#standalone-notice:empty{display:none}
.standalone-tools button{background:#f3f5f8;color:#202b36;border-color:#cdd3d9;text-align:left}.standalone-foot{max-width:1160px;margin:auto;padding:0 28px 24px;font-size:11px;color:var(--muted);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:650px){.standalone-bar{padding:18px 16px;gap:12px}.standalone-brand h1{font-size:19px}.standalone-status{width:100%;order:3}.standalone-content{padding:0 12px 24px}.standalone-content #app>section{padding:18px!important}.standalone-content .bil-row{gap:12px!important}.standalone-content .bil-row>*{min-width:min(100%,180px)}.standalone-foot{padding:0 16px 20px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:0s!important;transition-duration:0s!important}}
`;
const escapeHTML=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const scriptSafe=value=>value.replace(/<\/script/gi,'<\\/script');
function themeCSS(app){
 const ui=app.bil?.ir?.ui,screen=ui?.screens.find(x=>x.id===ui.start),root=screen?.children?.[0];
 const hex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:null;
 const bg=hex(root?.style?.background)||'#f5f4f0',ink=hex(root?.style?.color)||'#202b36';
 const rgb=[1,3,5].map(i=>parseInt(bg.slice(i,i+2),16)),dark=(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000<128;
 return ':root{color-scheme:'+(dark?'dark':'light')+';--bg:'+bg+';--ink:'+ink+';--surface:'+(dark?'#151d28':'#ffffff')+';--line:'+(dark?'#303944':'#dedfdc')+';--muted:'+(dark?'#b9bdc6':'#63707c')+';--accent:'+(dark?'#ff9b5d':'#214ed3')+'}'+
 '.standalone-tools summary,.standalone-tools>div,.standalone-content input,.standalone-content select,.standalone-content textarea,.standalone-content .bil-collection-card{background:var(--surface);color:var(--ink);border-color:var(--line)!important}'+
 '.standalone-content .bil-collection-card dt{color:var(--muted)}.standalone-content .bil-collection-card button,.standalone-tools button{background:var(--surface);color:var(--ink);border-color:var(--line)}'+
 (dark?'.standalone-status{color:#a8dbbd}.standalone-emblem{background:#ff9b5d;color:#1c1009}.standalone-content input:focus-visible,.standalone-content select:focus-visible,.standalone-content textarea:focus-visible{outline-color:#ff9b5d}':'');
}
function checked(project){
 const app=scope.CLEA7Format.validate(project);
 if(app.remote)throw Error('Samostalni HTML ne sadrži udaljeni broker. Koristi .clea7 paket ili APK.');
 const native=steps=>steps.some(x=>x.action==='native'||['then','else','steps'].some(k=>x[k]&&native(x[k])));
 if(Object.values(app.flows).some(native))throw Error('HTML izvoz ne izvršava Android module. Za njih izgradi APK.');
 return app;
}
async function build(project,{load=async name=>{const r=await fetch(name,{cache:'no-cache'});if(!r.ok)throw Error('Nedostaje Runtime datoteka: '+name);return r.text();}}={}){
 const app=checked(project),assets=await Promise.all(FILES.map(load));
 if(assets.some(x=>typeof x!=='string')||assets.reduce((n,x)=>n+x.length,0)>4*1024*1024)throw Error('Neispravan ili prevelik skup Runtime datoteka.');
 const css=assets.pop(),nonce=Array.from(scope.crypto.getRandomValues(new Uint8Array(18)),x=>x.toString(16).padStart(2,'0')).join('');
 const data=JSON.stringify(app).replace(/</g,'\\u003c');
 const boot=`
const app=${data};
const root=document.getElementById('app'),notice=document.getElementById('standalone-notice'),storage=document.getElementById('storage-state');
const report=text=>{notice.textContent=text;};
function saveFile(name,bytes,type){const u=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
const engine=new CLEA7Engine.Engine(app,{modules:null,diagnosticsMode:'production',notify:report,render:e=>{CLEA7Engine.mount(root,e);for(const output of root.querySelectorAll('[data-bil-view] output')){const card=output.closest('.bil-card'),label=card?.querySelector(':scope > h2')?.textContent;output.setAttribute('aria-label',label||'Vrijednost');}}});
engine.open().then(()=>{

 storage.textContent=engine.vault.persistent?'Lokalno čuvanje uključeno':'Trajno čuvanje nije dostupno';storage.dataset.state=engine.vault.persistent?'ready':'error';
 if(!engine.vault.persistent)report('Preglednik je odbio trajno čuvanje. Preuzmi kopiju podataka prije zatvaranja.');
 document.getElementById('data-backup').disabled=false;document.getElementById('data-restore').disabled=false;
}).catch(e=>{storage.textContent='Aplikacija nije pokrenuta';storage.dataset.state='error';report(e.message);});
document.getElementById('data-backup').onclick=async()=>{try{saveFile(app.id+'-podaci.json',JSON.stringify(await engine.backupFull(),null,2),'application/json');}catch(e){report(e.message);}};
const restore=document.getElementById('restore-file');document.getElementById('data-restore').onclick=()=>restore.click();
restore.onchange=async()=>{try{const f=restore.files[0];if(!f)return;if(f.size>20*1024*1024)throw Error('Kopija prelazi20 MiB.');if(!confirm('Zamijeniti podatke ove aplikacije odabranom kopijom?'))return;await engine.restoreFull(JSON.parse(await f.text()));report('Podaci su vraćeni iz kopije.');}catch(e){report(e.message);}finally{restore.value='';}};
addEventListener('beforeunload',e=>{if(engine.pending){e.preventDefault();e.returnValue='';}});addEventListener('pagehide',()=>engine.close());addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
`;
 const policy="default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
 return '<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="'+policy+'"><title>'+escapeHTML(app.name)+'</title><style>'+css.replace(/<\/style/gi,'<\\/style')+'\n'+CSS+'\n'+themeCSS(app)+'</style></head><body><header class="standalone-bar"><span class="standalone-emblem" aria-hidden="true">7</span><div class="standalone-brand"><h1>'+escapeHTML(app.name)+'</h1><p>Tvoj radni prostor · by Brzo i Lokalno</p></div><span id="storage-state" class="standalone-status" role="status">Otvaranje aplikacije…</span><details class="standalone-tools"><summary>Moji podaci</summary><div><p>Zapisi ostaju u ovom pregledniku. Preuzmi kopiju za prenos ili prije brisanja podataka preglednika.</p><button id="data-backup" type="button" disabled>Preuzmi kopiju podataka</button><button id="data-restore" type="button" disabled>Vrati svoju kopiju</button></div></details></header><p id="standalone-notice" role="status" aria-live="polite"></p><main class="standalone-content"><div id="app"></div></main><footer class="standalone-foot"><span>BL CLEA7 · lična aplikacija</span><span>Bez računa i automatskog slanja podataka</span></footer><input id="restore-file" type="file" accept=".json,application/json" hidden><script nonce="'+nonce+'">'+scriptSafe(assets.join('\n')+'\n'+boot)+'</script></body></html>';
}
scope.CLEA7Standalone=Object.freeze({FILES,build,checked});
})(globalThis);
