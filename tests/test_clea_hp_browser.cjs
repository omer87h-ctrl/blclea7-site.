'use strict';
const siteOrigin='http://127.0.0.1:'+(process.env.CLEA7_TEST_PORT||4173);
// Network fixtures test the actual browser UI/protocol, not real HP/TLS/model quality.
const {chromium}=require('/tmp/clea7-qa/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const endpoint='https://ai.clea7.example',identity='a'.repeat(32),token='T'.repeat(43);
 const config={schema:'clea7.web-ai/1',enabled:true,previewOnly:false,endpoint,deploymentId:identity,
  turnstileSiteKey:'public-fixture-site-key',publicHTTPSHealthVerified:true,phoneConversationVerified:true};
 const browser=await chromium.launch({executablePath:process.env.CLEA7_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext(),page=await context.newPage();
 const received=[],failures=[];let status=200,healthy=true,wrongIdentity=false,sessions=0,challenges=0;
 page.on('pageerror',e=>failures.push(e.message));page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>{globalThis.turnstile={render(mount,options){mount.textContent='Fixture access challenge';setTimeout(()=>options.callback('accepted-fixture-challenge'),0);return 'fixture';},remove(){}};});
 await page.route('**/clea-ai-config.json',route=>route.fulfill({json:config}));
 await page.route((siteOrigin+"/**"),async route=>{
  if(new URL(route.request().url()).pathname==='/clea-ai-config.json')return route.fallback();
  const response=await route.fetch(),type=response.headers()['content-type']||'';
  if(!type.includes('text/html'))return route.fulfill({response});
  // Add this fixture host to CSP only in intercepted test HTML. No wildcard.
  const body=(await response.text()).replace("connect-src 'self'", "connect-src 'self' "+endpoint);
  return route.fulfill({response,body});
 });
 await page.route(endpoint+'/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  const headers={'Access-Control-Allow-Origin':siteOrigin,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(path==='/health')return route.fulfill({status:healthy?200:503,headers,json:{brand:'BL CLEA AI',apiVersion:'clea7.public-ai/1',mode:'public',ready:healthy,deploymentId:wrongIdentity?'0'.repeat(32):identity}});
  if(path==='/session'){sessions++;assert.deepEqual(request.postDataJSON(),{challenge:'accepted-fixture-challenge'});return route.fulfill({headers,json:{session:token,expiresIn:900}});}
  assert.equal(path,'/chat');assert.equal(request.headers().authorization,'Bearer '+token);
  received.push(request.postDataJSON());
  return route.fulfill({status,headers,json:status===200?{reply:'Fixture HP odgovor: <img src=x onerror=alert(1)>',sources:[]}:{code:status===429?'busy':'session_required',error:'Fixture error'}});
 });
 try{
  await page.goto((siteOrigin+"/studio/workbench/"));
  await page.locator('[data-panel="clea-chat"]').click();
  await page.waitForFunction(()=>!document.getElementById('clea-public-model-opt-in').disabled);
  assert.equal(received.length,0);assert.equal(sessions,0);
  await page.locator('#clea-ai-settings>summary').click();await page.locator('.chat-local-model-controls summary').click();await page.locator('#clea-public-model-opt-in').check();
  await page.waitForFunction(()=>document.getElementById('clea-local-model-status').textContent.includes('spreman'));
  assert.equal(sessions,0);assert.equal(received.length,0);
  await page.locator('#chat-question').fill('Objasni CLEA jezgro.');await page.locator('#chat-send').click();
  await page.waitForFunction(()=>document.getElementById('chat-log').textContent.includes('Fixture HP odgovor'));
  assert.equal(sessions,1);assert.deepEqual(received[0],{question:'Objasni CLEA jezgro.',history:[]});
  assert.equal(await page.locator('#chat-log img').count(),0);
  await page.locator('#chat-question').fill('Šta sam pitao?');await page.locator('#chat-send').click();
  await page.waitForFunction(()=>!document.getElementById('chat-send').disabled);
  assert.equal(received[1].history.length,2);assert.equal(sessions,1);
  const storage=await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));
  assert(!storage.includes(token));assert(!storage.includes('Objasni CLEA jezgro.'));
  console.log('PASS HP browser fixture: explicit opt-in, bounded session history, text-only reply, no stored token or chat');
  status=429;
  await page.locator('#chat-question').fill('Test zauzetosti.');await page.locator('#chat-send').click();
  await page.waitForFunction(()=>document.getElementById('chat-log').textContent.includes('odgovara drugom korisniku'));
  assert.equal(received.length,3);await page.waitForTimeout(200);assert.equal(received.length,3);
  healthy=false;
  await page.locator('#chat-question').fill('Ne smije otići ugašenom modelu.');await page.locator('#chat-send').click();
  await page.waitForFunction(()=>document.getElementById('chat-log').textContent.includes('server trenutno nije dostupan'));
  assert.equal(received.length,3);
  console.log('PASS HP browser fixture: busy/offline states, no automatic retry or false fallback');
  healthy=true;status=200;
  await page.goto((siteOrigin+"/sense/"));
  await page.waitForSelector('#sense-ai-question');
  await page.evaluate(()=>{for(const area of document.querySelectorAll('textarea'))if(area.id!=='sense-ai-question')area.value='PRIVATE_CV_MUST_NOT_BE_SENT';localStorage.setItem('private-cv-fixture','PRIVATE_CV_MUST_NOT_BE_SENT');});
  assert.equal(received.length,3);
  await page.locator('#sense-ai-question').fill('Kako da opišem iskustvo?');await page.locator('.sense-ai-bridge button').click();
  await page.waitForFunction(()=>document.getElementById('sense-ai-local-answer').textContent.includes('Fixture HP odgovor'));
  assert.deepEqual(received[3],{question:'Kako da opišem iskustvo?',history:[]});assert(!JSON.stringify(received).includes('PRIVATE_CV'));
  console.log('PASS Sense browser fixture: explicit question only; CV, local storage, project and older chats excluded');
  wrongIdentity=true;
  await page.locator('#sense-ai-question').fill('Identity test');await page.locator('.sense-ai-bridge button').click();
  await page.waitForFunction(()=>document.getElementById('sense-ai-local-status').textContent.includes('nije potvrdila'));
  assert.equal(received.length,4);
  assert.deepEqual(failures,[]);
  console.log('PASS HP browser fixture: mismatched deployment blocked before private question transmission');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
