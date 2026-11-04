'use strict';
// Exercise the actual bundled v1 model, Worker and Core through its standalone host.
const {createRequire}=require('node:module');
const {chromium}=createRequire('/tmp/clea7-qa/package.json')('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createHash}=require('node:crypto');
const base=process.env.CLEA7_WEB_BASE||'http://127.0.0.1:4173',out='test-evidence/standalone-chat';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CLEA7_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const checks=[],errors=[],requests=[],workers=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('worker',w=>workers.push(w.url()));
 async function check(name,fn){await fn();checks.push(name);console.log('PASS standalone CLEA '+name);}
 async function info(response){const d=response.locator('details');if(await d.getAttribute('open')===null)await d.locator('summary').click();return JSON.parse(await d.locator('pre').innerText());}
 async function ask(text){const before=await page.locator('#chat-log .assistant').count();await page.locator('#chat-question').fill(text);await page.locator('#chat-send').click();await page.waitForFunction(n=>document.querySelectorAll('#chat-log .assistant').length>n&&!CLEA7ChatWorkspace.busy,before);return page.locator('#chat-log .assistant').last();}
 async function diagnostics(){await page.locator('#conversation-diagnostics>summary').click();assert.equal(await page.locator('#conversation-diagnostics').getAttribute('open'),'');}
 try{
  await page.goto(base+'/razgovor/');
  await check('automatically verifies exact original model in a real Worker without booting Studio',async()=>{
   await page.waitForFunction(()=>document.querySelector('#chat-ready').textContent.includes('je provjeren'));
   assert.equal(await page.evaluate(()=>typeof CLEA7Workbench),'undefined');
   const description=await page.evaluate(()=>CLEA7ChatWorkspace.description);
   assert.equal(description.parameterCount,135349);assert.equal(description.privacy.externalWeights,false);assert.equal(description.privacy.network,false);
   const bytes=await (await context.request.get(base+'/studio/workbench/chat/model.json')).body();
   assert.equal(createHash('sha256').update(bytes).digest('hex'),'e5f7c43f824d692af2b55f525ba4264c5ebec676d257885b275112781609401a');
   assert(workers.some(u=>u.endsWith('/chat/worker.js')));assert(await page.locator('#conversation-scope').isVisible());
   assert.equal(await page.locator('#conversation-diagnostics').getAttribute('open'),null);
   assert.equal(requests.some(r=>/\/studio\.js(?:\?|$)/.test(r.url)),false);
  });
  await check('supported question runs actual autoregressive numerical inference',async()=>{
   const reply=await ask('Šta radi Core AI Manager?');assert.equal(await reply.getAttribute('data-mode'),'neural');
   assert((await reply.innerText()).includes('Core AI Manager koordinira'));const data=await info(reply);
   assert(data.metrics.steps>1&&data.metrics.multiplyAdds>1000);assert.equal(data.validation.neuralAnswerAccepted,true);
  });
  await check('cache reuse and rejected model answer are labeled separately',async()=>{
   const cached=await ask('Šta radi Core AI Manager?');assert.equal(await cached.getAttribute('data-mode'),'cache');assert.equal((await info(cached)).metrics.tokens,0);
   const fallback=await ask('Kako se u Expansion Q provjeravaju proširenja?');assert.equal(await fallback.getAttribute('data-mode'),'grounded-fallback');assert.equal((await info(fallback)).validation.neuralAnswerAccepted,false);
  });
  await check('real BIL arithmetic and unsupported knowledge retain distinct execution modes',async()=>{
   const calculation=await ask('Koliko je 23 * 4?');assert.equal(await calculation.getAttribute('data-mode'),'bil');assert((await calculation.innerText()).includes('Rezultat je 92.'));
   const unknown=await ask('Ko će pobijediti na izborima?');assert.equal(await unknown.getAttribute('data-mode'),'abstained');assert((await unknown.innerText()).includes('nemam provjereno znanje'));
  });
  await check('cancellation commits no partial history and subsequent generation resumes',async()=>{
   const count=await page.evaluate(()=>CLEA7ChatWorkspace.history.length);
   await page.evaluate(()=>{document.querySelector('#chat-question').value='Kako radi Adaptive Recovery?';document.querySelector('#chat-form').requestSubmit();document.querySelector('#chat-stop').click();});
   await page.waitForFunction(()=>!CLEA7ChatWorkspace.busy&&!document.querySelector('#chat-send').disabled);
   assert.equal(await page.evaluate(()=>CLEA7ChatWorkspace.history.length),count);assert((await page.locator('#chat-log .chat-error').last().innerText()).includes('zaustavljen'));
   await diagnostics();await page.locator('#chat-cache').uncheck();await page.locator('#conversation-diagnostics>summary').click();
   const resumed=await ask('Šta je BIL?');assert.equal(await resumed.getAttribute('data-mode'),'neural');
  });
  await check('already-loaded model computes offline without an answer service',async()=>{
   await context.setOffline(true);try{const reply=await ask('Kako radi CACI?');assert.equal(await reply.getAttribute('data-mode'),'neural');assert((await info(reply)).metrics.steps>1);}finally{await context.setOffline(false);}
  });
  await check('real diagnostics, clear controls, local voice availability and mobile focus are usable',async()=>{
   await page.screenshot({path:out+'/desktop.png',fullPage:true});await diagnostics();
   const seen=await page.evaluate(()=>[...new Set(CLEA7ChatWorkspace.events.map(e=>e.pillar))]);
   for(const name of ['Core AI Manager','Link Bridge Elite','Expansion Q','Adaptive Recovery','Holo Interaction','Fallback Executor','Vision Q'])assert(seen.includes(name),name);
   await page.locator('#chat-clear').click();await page.waitForFunction(()=>CLEA7ChatWorkspace.history.length===0);
   assert.equal(await page.locator('#chat-log .chat-message').count(),0);assert.equal(await page.evaluate(()=>CLEA7ChatWorkspace.cacheStats.memoryEntries),0);
   await page.locator('#conversation-diagnostics>summary').click();await page.setViewportSize({width:390,height:844});
   const reply=await ask('Šta je BIL?');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await page.waitForFunction(()=>document.activeElement===document.querySelector('#chat-question'));
   for(const id of ['chat-question','chat-send','chat-stop']){const box=await page.locator('#'+id).boundingBox();assert(box&&box.x>=0&&box.x+box.width<=392,id);assert(box.height>=44,id);}
   const localVoices=await page.evaluate(()=>(speechSynthesis?.getVoices?.()||[]).filter(v=>v.localService===true&&/^(bs|hr|sr)/i.test(v.lang)).length);
   assert.equal(await reply.getByRole('button',{name:'Pročitaj lokalnim glasom'}).isDisabled(),localVoices===0);
   await page.screenshot({path:out+'/mobile.png',fullPage:true});
  });
  await check('no conversation text, telemetry, cross-origin requests or script errors',async()=>{
   assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>new URL(r.url).origin!==base||r.method!=='GET'),[]);assert.equal(requests.some(r=>/question=|prompt=|%C5%A0ta/.test(r.url)),false);
  });
  await check('missing real module fails visibly instead of showing fake readiness',async()=>{
   const failure=await context.newPage();try{await failure.route('**/chat/ui.js',route=>route.abort());await failure.goto(base+'/razgovor/');await failure.locator('#conversation-load-error').waitFor({state:'visible'});assert((await failure.locator('#conversation-load-error').innerText()).includes('ui.js'));assert.equal(await failure.locator('#chat-send').count(),0);}finally{await failure.close();}
  });
 }catch(error){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});await fs.writeFile(out+'/failure.json',JSON.stringify({message:error.message,checks,errors},null,2));throw error;}
 finally{await fs.writeFile(out+'/browser.json',JSON.stringify({format:'clea7.standalone-chat.browser/1',checks,errors,requests,workers,model:'existing-v1',physicalAudioVerified:false,generalConversationVerified:false,appGenerationVerified:false},null,2));await browser.close();}
 console.log('STANDALONE_CHAT_BROWSER_CHECKS '+checks.length+' passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
