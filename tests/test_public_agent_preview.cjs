'use strict';
const {createRequire}=require('node:module'),{chromium}=createRequire('/tmp/clea7-qa/package.json')('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const base='http://127.0.0.1:4173',site='https://clea7.brzoilokalno.com',gateway='https://voting-crafty-protegee.ngrok-free.dev',pages=['home','write','list','archive','settings'];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CLEA7_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[],calls=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route(site+'/**',async route=>{
   const url=new URL(route.request().url()),response=await context.request.get(base+url.pathname+url.search);
   await route.fulfill({response});
 });
 await context.route(gateway+'/**',async route=>{
   const headers={'Access-Control-Allow-Origin':site,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type,ngrok-skip-browser-warning'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(route.request().url().endsWith('/health'))return route.fulfill({json:{service:'CLEA public beta',ready:true,streaming:true},headers});
   const prompt=route.request().postDataJSON().question;calls.push(prompt);
   let result;
   if(prompt.startsWith('Plan only the app title'))result='TITLE|Notes\n'+pages.map(id=>'PAGE|'+id+'|'+id+'|Local notes').join('\n')+'\nEND';
   else if(prompt.startsWith('Plan data and actions'))result='V|draft|Text\nV|entries|List<Text>\nE|add|append note\nE|clear|clear notes\nEND';
   else if(prompt.startsWith('Write event add:'))result='SET|entries|collections.append(entries,draft)\nINPUT|draft|"test entry"\nEXPECT|entries|["test entry"]\nEND';
   else if(prompt.startsWith('Write event clear:'))result='SET|entries|collections.slice(entries,0,0)\nEXPECT|entries|[]\nEND';
   else {const id=pages.find(x=>prompt.startsWith('Design screen '+x+' '));assert(id);result='THEME|#112233|#ffffff|#445566|column\n'+(id==='write'?'M|draft|Note\nB|Add|add':id==='list'?'O|entries\nB|Clear|clear':'H|'+id)+'\nEND';}
   await route.fulfill({status:200,headers:{...headers,'Content-Type':'application/x-ndjson'},body:JSON.stringify({type:'delta',text:result})+'\n'+JSON.stringify({type:'done'})+'\n'});
 });
 await page.goto(site+'/studio/workbench/?workspace=clea-chat');
 await page.waitForFunction(()=>!!window.CLEA7Workbench);
 await page.locator('#chat-ready').getByText('CLEA AI · Qwen 9B povezan').waitFor({timeout:15000}).catch(async()=>{await page.waitForFunction(()=>document.querySelector('#chat-ready').textContent.includes('Qwen 9B povezan'));});
 const original=await page.evaluate(()=>CLEA7.stable(CLEA7Workbench.snapshot()));
 await page.locator('#chat-question').fill('Pet ekrana za bilješke');
 const mode=page.locator('#chat-form select').filter({has:page.locator('option[value="create"]')});await mode.selectOption('create');
 await page.locator('#chat-send').click();
 await page.locator('[data-ai-app-proposal=true]').waitFor({timeout:30000});
 const preview=page.locator('[data-ai-app-preview=true]');await preview.waitFor();
 await preview.getByRole('button',{name:'write',exact:true}).click();
 await preview.getByLabel('Note',{exact:true}).fill('Mobile test');
 await preview.getByRole('button',{name:'Add',exact:true}).click();
 await preview.getByRole('button',{name:'home',exact:true}).click();
 await preview.getByRole('button',{name:'list',exact:true}).click();
 await preview.getByText('["Mobile test"]',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>CLEA7.stable(CLEA7Workbench.snapshot())),original);
 assert.equal(calls.length,9);
 await fs.mkdir('test-evidence/agent-preview',{recursive:true});await page.screenshot({path:'test-evidence/agent-preview/mobile.png',fullPage:true});
 await preview.getByRole('button',{name:'Clear',exact:true}).click();
 await preview.getByText('[]',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('FIVE_SCREEN_BROWSER_PREVIEW_REAL_RUNTIME_PASS (fixture model transport, not live Qwen)');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
