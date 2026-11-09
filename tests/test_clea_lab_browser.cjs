'use strict';
// Historical AI links must lead to the single real conversation, not another product.
const {chromium}=require('/tmp/clea7-qa/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:process.env.CLEA7_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']}),page=await b.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{const origin='http://127.0.0.1:'+(process.env.CLEA7_TEST_PORT||4173);
for(const path of ['/studio/clea-ai-lab.html','/studio/workbench/?workspace=clea-ai','/studio/workbench/?workspace=assistant']){await page.goto(origin+path);await page.waitForFunction(()=>globalThis.CLEA7Workbench&&document.body.dataset.workspace==='clea-chat');assert.equal(await page.locator('#chat-form').count(),1);assert.equal(await page.locator('[data-panel=clea-ai]').count(),0);assert.equal(await page.locator('[data-panel=assistant]').count(),0);assert(await page.locator('#clea-connect-model').isVisible());assert(await page.locator('#chat-send').isDisabled());}
assert.deepEqual(errors,[]);console.log('PASS legacy AI URLs route to one genuine conversation and honest model state');}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
