'use strict';
const {createRequire}=require('node:module'),{chromium}=createRequire('/tmp/clea7-qa/package.json')('playwright'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CLEA7_CHROME,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{Object.defineProperty(globalThis,'indexedDB',{get(){throw new Error('Local document storage is denied');}});delete Element.prototype.replaceChildren;});
 const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto('file:///tmp/BL-CLEA7-Studio-pregled-v2.html');await page.waitForFunction(()=>Boolean(window.CLEA7Workbench));
 assert.equal(await page.locator('[data-panel=design]').getAttribute('aria-pressed'),'true');
 await page.locator('#component-type').selectOption('heading');await page.locator('#add-component').click();assert.equal(await page.locator('#canvas h2,#canvas h1,#canvas .heading').count(),1);
 await page.getByRole('button',{name:'Platno',exact:true}).click();
 const app=JSON.parse(await fs.readFile('sdk-source/sdk/examples/units.application.json','utf8'));await page.evaluate(app=>CLEA7Workbench.open(app),app);await page.locator('#run-top').click();
 const input=page.locator('#player').getByLabel('Kilometri',{exact:true});await input.fill('2.5');await input.press('Tab');await page.locator('#player').getByRole('button',{name:'Pretvori',exact:true}).click();await page.waitForFunction(()=>CLEA7Workbench.engine.state.metres===2500);
 await page.locator('[data-panel=build]').click();const downloadWait=page.waitForEvent('download');await page.locator('#export-project').click();const download=await downloadWait;const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(exported.format,'clea7.application/2');assert.equal(exported.id,app.id);
 await page.locator('[data-panel=design]').click();await page.getByRole('button',{name:'Platno',exact:true}).click();
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await fs.mkdir('test-evidence',{recursive:true});await page.screenshot({path:'test-evidence/mobile-file-v2.png',fullPage:false});await fs.writeFile('test-evidence/mobile-file-v2.json',JSON.stringify({passed:true,checks:['actual Chrome file URL at 390px with touch','blocked IndexedDB boot','missing replaceChildren boot','real visual component add','real app input and calculation 2500','downloaded project identity','no HTTP requests','no horizontal overflow'],errors,requests},null,2));console.log('MOBILE_FILE_CHECKS 8 passed in actual Chrome; physical Android viewer remains untested');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
