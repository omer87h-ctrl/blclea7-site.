'use strict';
/* CLEA-side forum drafts only. Never posts, edits a forum, or creates accounts. */
(function(scope){
function fromAnswer(answer){
 if(!answer||typeof answer.reply!=='string'||!answer.reply.trim()||answer.reply.length>12000)throw Error('Nedostaje ograničen stvarni AI odgovor.');
 const sources=[...(answer.sources||[]),...(answer.webSources||[])].filter(row=>{try{const u=new URL(row.url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port;}catch{return false;}}).slice(0,5).map(row=>({title:String(row.title||row.path||'Izvor').slice(0,200),url:row.url}));
 const localSources=(answer.sources||[]).filter(row=>typeof row.path==='string').slice(0,5).map(row=>({path:row.path,section:row.section||null}));
 return {format:'clea7.forum-ai-draft/1',aiGenerated:true,displayName:'BL CLEA AI',body:answer.reply,sources,localSources,requiresHumanReview:true,published:false};
}
function create({client}={}){
 const connection=client||scope.CLEA7AI?.create();if(!connection?.ask||!connection?.reset)throw Error('Potreban je zaseban povezani CLEA klijent.');let busy=false;
 return Object.freeze({
  async draft(question,{confirmed=false,language='bs'}={}){
   if(confirmed!==true)throw Error('Prvo potvrdi tekst pitanja koji se šalje CLEA-i.');
   if(typeof question!=='string'||!question.trim()||question.length>1200||!['bs','en','auto'].includes(language))throw Error('Neispravan forum zahtjev.');
   if(busy)throw Error('Jedan forum zahtjev je već u toku.');busy=true;connection.reset();
   try{const answer=await connection.ask(question,{language});if(typeof answer.reply!=='string'||!answer.reply.trim())throw Error('CLEA nije vratila odgovor.');
    return fromAnswer(answer);
   }finally{busy=false;connection.reset();}
  },cancel:()=>connection.cancel?.()
 });
}
// Explicit, bounded public-source monitoring. No conversation/project/CV data,
// cookies, CMS mutations, email or generated article is sent by this operation.
const FEEDS=Object.freeze([
 ['nvaccess/nvda','NVDA','Čitač ekrana za Windows; važno za pristupačan rad i sadržaj.'],
 ['microsoft/PowerToys','PowerToys','Besplatni Windows alati za svakodnevni rad.'],
 ['obsproject/obs-studio','OBS Studio','Snimanje i emitovanje bez obavezne pretplate.'],
 ['godotengine/godot','Godot','Otvoreni alati za razvoj interaktivnih aplikacija i igara.'],
 ['vitejs/vite','Vite','Web razvoj i priprema aplikacija za objavu.'],
 ['facebook/react-native','React Native','Razvoj mobilnih interfejsa; provjeri kompatibilnost projekta.']
]);
const ARCHIVE='https://api.github.com/repos/omer87h-ctrl/brzoilokalno-website/contents/tech/news-archive.json?ref=main';
let lastMonitor=null,monitorPending=null;
function canonical(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(key))u.searchParams.delete(key);return u.href.replace(/\/$/,'');}catch{return null;}}
async function publicJSON(url,fetcher,signal){
 const bounded=scope.AbortSignal?.timeout?scope.AbortSignal.timeout(12000):undefined;
 const requestSignal=signal&&bounded&&scope.AbortSignal?.any?scope.AbortSignal.any([signal,bounded]):signal||bounded;
 const response=await fetcher(url,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',headers:{Accept:'application/vnd.github+json'},signal:requestSignal});
 if(!response.ok)throw Error('HTTP '+response.status);
 if(Number(response.headers.get('Content-Length')||0)>1500000)throw Error('Izvor prelazi dozvoljenu veličinu.');
 const reader=response.body.getReader(),parts=[];let size=0;
 try{while(true){const row=await reader.read();if(row.done)break;size+=row.value.byteLength;if(size>1500000){await reader.cancel();throw Error('Izvor prelazi dozvoljenu veličinu.');}parts.push(row.value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const row of parts){bytes.set(row,offset);offset+=row.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
async function collect({fetcher=scope.fetch?.bind(scope),now=Date.now(),signal}={}){
 if(!fetcher||!Number.isFinite(now))throw Error('Javna provjera izvora nije dostupna.');
 const report={format:'clea7.tech-editorial-monitor/1',checkedAt:new Date(now).toISOString(),windowDays:7,archiveAvailable:false,archiveUpdated:null,candidates:[],duplicates:[],outsideWindow:[],errors:[],requiresHumanReview:true,published:false,modelInvoked:false,requests:0};
 const get=async url=>{if(++report.requests>13)throw Error('Prekoračen budžet javne provjere.');return publicJSON(url,fetcher,signal);};
 let archive=[];
 try{const file=await get(ARCHIVE);if(file.encoding!=='base64'||typeof file.content!=='string'||file.size>1000000)throw Error('Arhiva nema očekivani format.');
  const raw=Uint8Array.from(scope.atob(file.content.replace(/\s/g,'')),x=>x.charCodeAt(0)),value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(!Array.isArray(value.stories)||value.stories.length>10000)throw Error('Arhiva nema listu tema.');archive=value.stories;report.archiveAvailable=true;report.archiveUpdated=value.updated||null;
 }catch(error){if(signal?.aborted)throw error;report.errors.push({source:'TECH arhiva',message:String(error.message).slice(0,180)});}
 // Six fixed official projects, serially bounded; GitHub API rate exhaustion is
 // reported and never worked around with other credentials or scraping.
 for(const [repo,name,importance]of FEEDS){
  if(signal?.aborted)throw Error('Provjera je zaustavljena.');
  try{const release=await get('https://api.github.com/repos/'+repo+'/releases/latest');
   const url=canonical(release.html_url),prefix='https://github.com/'+repo+'/releases/tag/';
   if(release.draft||release.prerelease||!url?.startsWith(prefix)||typeof release.tag_name!=='string'||release.tag_name.length>120)throw Error('Izvor nema očekivano stabilno izdanje.');
   const stamp=Date.parse(release.published_at);if(!Number.isFinite(stamp)||stamp>now+300000)throw Error('Datum službene objave nije potvrđen.');
   const version=release.tag_name,existing=archive.find(row=>canonical(row.url)===url||canonical(row.url)?.startsWith(prefix)&&decodeURIComponent(canonical(row.url).slice(prefix.length)).toLowerCase()===version.toLowerCase());
   if(existing){report.duplicates.push({name,version,url,previousTitle:String(existing.title||'').slice(0,200)});continue;}
   if(stamp<now-7*86400000){report.outsideWindow.push({name,version,publishedAt:release.published_at,url});continue;}
   const metadata=await get('https://api.github.com/repos/'+repo),license=typeof metadata.license?.spdx_id==='string'&&metadata.license.spdx_id!=='NOASSERTION'?metadata.license.spdx_id:null;
   report.candidates.push({name,version,title:name+': novo stabilno izdanje '+version,url,canonicalURL:url,source:'Službena bilješka izdanja',publishedAt:release.published_at,eventDate:null,eventDateConfirmed:false,
    whatIsNew:'Objavljena je verzija '+version+'. Konkretne izmjene provjeri u priloženoj službenoj bilješci prije uredničke objave.',importance,downloadURL:'https://github.com/'+repo+'/releases/tag/'+encodeURIComponent(version),license,licenseURL:'https://github.com/'+repo+'#license',availability:license?'Slobodno dostupan izvorni kod; uslovi '+license+'. Provjeri konkretni paket prije instalacije.':'Uslovi i dostupnost zahtijevaju uredničku provjeru.',requiresHumanReview:true});
  }catch(error){if(signal?.aborted)throw error;report.errors.push({source:name,message:String(error.message).slice(0,180)});}
 }
 report.deduplicationScope=report.archiveAvailable?'Događaj/verzija i kanonski URL u dostupnoj TECH arhivi; ne uključuje nedostupne privatne izbore.':'Arhiva nije dostupna: ponavljanje nije isključeno.';
 return report;
}
function monitor(options={}){
 const now=options.now??Date.now();if(lastMonitor&&now>=lastMonitor.time&&now-lastMonitor.time<12*3600000)return Promise.resolve(JSON.parse(JSON.stringify({...lastMonitor.value,cached:true})));
 if(monitorPending)throw Error('Jedna javna provjera je već u toku.');
 monitorPending=collect({...options,now}).then(value=>{lastMonitor={time:now,value};return JSON.parse(JSON.stringify(value));}).finally(()=>{monitorPending=null;});return monitorPending;
}
scope.CLEA7ForumAI=Object.freeze({format:'clea7.forum-integration/1',create,fromAnswer,monitor,canonical,feeds:FEEDS.map(([repo,name])=>({repo,name}))});
})(globalThis);
