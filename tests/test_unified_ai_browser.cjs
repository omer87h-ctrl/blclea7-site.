'use strict';
const assert=require('node:assert/strict'),{createRequire}=require('node:module');
const {chromium}=createRequire('/tmp/clea7-qa/package.json')('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CLEA7_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1300,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 try{
  await page.goto('http://127.0.0.1:4173/studio/workbench/');
  await page.waitForFunction(()=>globalThis.CLEA7Workbench&&globalThis.CLEA7LocalAIWorkspace);
  assert.equal((await page.locator('[data-panel="clea-chat"]').innerText()),'CLEA AI');
  assert.equal(await page.locator('[data-panel="clea-ai"]').isVisible(),false);
  assert.equal(await page.locator('[data-panel="assistant"]').isVisible(),false);
  await page.locator('[data-panel="clea-chat"]').click();
  await page.waitForFunction(()=>document.getElementById('chat-ready').textContent.includes('je provjeren'));
  console.log('PASS ONE CLEA AI NAV: one visible AI entry, original model loaded');

  await page.locator('#chat-question').fill('Napravi aplikaciju za zalihe i radne naloge.');
  await page.locator('#chat-send').click();
  await page.getByRole('button',{name:'Otvori u Studiom i testiraj'}).waitFor();
  assert((await page.locator('#chat-log').innerText()).includes('Radni nalozi'));
  const before=await page.evaluate(()=>CLEA7Workbench.project.id);
  assert.equal(before,await page.evaluate(()=>CLEA7Workbench.project.id));
  await page.getByRole('button',{name:'Otvori u Studiom i testiraj'}).click();
  await page.waitForFunction(()=>Boolean(CLEA7Workbench.engine?.state && CLEA7Workbench.project.tables.stock && CLEA7Workbench.project.tables.orders));
  assert.notEqual(await page.evaluate(()=>CLEA7Workbench.project.id),before);
  console.log('PASS ONE CLEA AI TOOL: real business app generated and executed only after approval');

  await page.locator('[data-panel="clea-chat"]').click();
  await page.locator('#chat-question').fill('Napravi aplikaciju za zalihe i video');
  await page.locator('#chat-send').click();
  await page.waitForFunction(()=>document.getElementById('chat-log').textContent.includes('Nepodržan')||document.getElementById('chat-log').textContent.includes('nepodržane'));
  console.log('PASS ONE CLEA AI SAFETY: unsupported features refused');

  await page.locator('#chat-question').fill('Napravi kalkulator');
  await page.locator('#chat-send').click();
  await page.getByRole('button',{name:'Pregledao sam — primijeni u Studiom'}).waitFor({timeout:25000});
  assert((await page.locator('#chat-log').innerText()).includes('BIL kalkulator'));
  console.log('PASS ONE CLEA AI TOOL: verified BIL calculator proposal inside chat');

  await page.locator('#chat-question').fill('Šta je BIL?');
  await page.locator('#chat-send').click();
  await page.waitForFunction(()=>Boolean(document.querySelector('#chat-log .chat-message.assistant[data-mode]')),null,{timeout:30000});
  assert.deepEqual(errors,[]);
  console.log('PASS ONE CLEA AI MODEL: existing neural conversation preserved');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
