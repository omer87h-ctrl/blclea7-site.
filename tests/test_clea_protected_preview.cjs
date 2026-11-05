'use strict';
// Browser/transport fixtures only, not live HP, email delivery or Cloudflare proof.
const {chromium}=require('/tmp/clea7-qa/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const origin='https://fixture.trycloudflare.com',identity='a'.repeat(32),history=[];
 const browser=await chromium.launch({executablePath:process.env.CLEA7_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext();await context.addCookies([{name:'CF-preview-fixture',value:'authenticated-fixture',domain:'fixture.trycloudflare.com',path:'/',secure:true,httpOnly:true}]);
 const page=await context.newPage(),errors=[],assetRequests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(origin+'/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  const requestHeaders=await req.allHeaders();
  assert((requestHeaders.cookie||'').includes('authenticated-fixture'),'Protected same-origin requests must retain the authenticated session cookie');
  if(url.pathname==='/clea-ai-config.json')return route.fulfill({json:{schema:'clea7.web-ai/1',enabled:false,previewOnly:true,endpoint:origin,deploymentId:identity,authentication:'tunnel-email',turnstileSiteKey:null,previewEndsAtUnix:Math.floor(Date.now()/1000)+600,publicHTTPSHealthVerified:false,phoneConversationVerified:false}});
  if(url.pathname==='/health')return route.fulfill({json:{brand:'BL CLEA AI',apiVersion:'clea7.public-ai/1',mode:'public',ready:true,deploymentId:identity}});
  if(url.pathname==='/preview-challenge')return route.fulfill({json:{challenge:'fixture-nonce',authentication:'tunnel-email'}});
  if(url.pathname==='/session'){assert.deepEqual(req.postDataJSON(),{challenge:'fixture-nonce'});return route.fulfill({json:{session:'T'.repeat(43),expiresIn:900}});}
  if(url.pathname==='/chat'){history.push(req.postDataJSON());return route.fulfill({json:{reply:'Protected HP fixture response',sources:[]}});}
  assetRequests.push(url.pathname);
  const response=await route.fetch({url:'http://127.0.0.1:4173'+url.pathname+url.search});return route.fulfill({response});
 });
 try{
  await page.goto(origin+'/razgovor/?clea-verify='+identity);
  await page.waitForFunction(()=>document.getElementById('clea-local-model-status')?.textContent.includes('HP servis uključen'));
  assert.equal(await page.locator('#conversation-load-error').isVisible(),false);
  assert.equal(await page.locator('#clea-public-model-opt-in').isChecked(),true);
  await page.locator('#chat-question').fill('Objasni CLEA.');await page.locator('#chat-send').click();
  await page.waitForFunction(()=>document.getElementById('chat-log').textContent.includes('Protected HP fixture response'));
  assert.deepEqual(history,[{question:'Objasni CLEA.',history:[]}]);
  assert(!assetRequests.some(p=>p.endsWith('/model.json')),'HP preview must not replace the reply with the small offline model');
  assert.deepEqual(errors,[]);
  console.log('PASS protected-preview browser fixture: existing chat UI, authenticated cookie, session, actual client path and no local-model substitution');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
