'use strict';
const {chromium}=require('/tmp/clea7-qa/node_modules/playwright'),http=require('node:http');
const assert=require('node:assert/strict');
(async()=>{
 let received=[],health=0;
 const ai=http.createServer((req,res)=>{
   res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:4173');
   res.setHeader('Access-Control-Allow-Headers','Content-Type');
   res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
   res.setHeader('Access-Control-Allow-Private-Network','true');
   res.setHeader('Content-Type','application/json');
   if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
   if(req.url==='/health'){health++;res.end(JSON.stringify({brand:'BL CLEA AI',apiVersion:'clea7.public-ai/1',mode:'local',ready:true}));return;}
   let body='';req.on('data',x=>body+=x);req.on('end',()=>{received.push(JSON.parse(body));res.end(JSON.stringify({brand:'BL CLEA AI',reply:'Provjeren testni odgovor (mock).',sources:[]}));});
 });
 await new Promise(resolve=>ai.listen(8765,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CLEA7_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext(),page=await context.newPage();
 page.on('dialog',d=>d.accept());
 try{
  await page.goto('http://127.0.0.1:4173/studio/workbench/');
  await page.waitForFunction(()=>globalThis.CLEA7Workbench && document.getElementById('clea-local-model-opt-in'));
  assert.equal(await page.locator('[data-panel="clea-chat"]').innerText(),'CLEA AI');
  assert.equal(await page.locator('[data-panel="assistant"]').isVisible(),false);
  assert.equal(await page.locator('#clea-local-model-opt-in').isChecked(),false);
  assert.equal(received.length,0);console.log('PASS BL CLEA AI: same Studio interface, opt-in off and no transmitted data');
  await page.locator('[data-panel="clea-chat"]').click();
  await page.locator('.chat-local-model-controls summary').click();
  await page.locator('#clea-local-model-opt-in').check();
  await page.waitForFunction(()=>document.getElementById('clea-local-model-status').textContent.includes('uključen'),null,{timeout:10000});
  await page.locator('#chat-question').fill('Objasni CLEA jezik.');
  await page.locator('#chat-send').click();
  await page.waitForFunction(()=>document.getElementById('chat-log').textContent.includes('Provjeren testni odgovor'),null,{timeout:10000});
  assert.equal(received.length,1);
  assert.equal(received[0].question,'Objasni CLEA jezik.');
  assert.deepEqual(received[0].history,[]);
  console.log('PASS BL CLEA AI: browser-to-local CORS opt-in bridge uses only sent question (mock inference)');
  await page.goto('http://127.0.0.1:4173/sense/');
  await page.locator('#sense-ai-question').fill('Kako da napišem opis iskustva?');
  await page.locator('#sense-ai-target').selectOption('local');
  const old=received.length;
  assert.equal(old,1);
  await page.locator('.sense-ai-bridge button').click();
  await page.waitForFunction(()=>document.getElementById('sense-ai-local-answer').textContent.includes('Provjeren testni odgovor'),null,{timeout:10000});
  assert.equal(received.length,2);
  assert.deepEqual(received[1],{question:'Kako da napišem opis iskustva?',history:[]});
  console.log('PASS BL CLEA Sense: manual question only; CV, job and analysis are never sent');
  await page.goto('http://127.0.0.1:4173/model-licence.html');
  assert((await page.locator('body').innerText()).includes('Apache'));
  assert((await page.locator('body').innerText()).includes('Qwen3.5-0.8B'));
  console.log('PASS Model license notice published; no claim of own Qwen weights');
 }finally{await browser.close();await new Promise(resolve=>ai.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
