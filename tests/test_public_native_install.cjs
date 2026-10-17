'use strict';
// Real launcher controls and package storage; only native host availability is
// injected. Hardware execution is verified separately on Android emulators.
const {createRequire}=require('node:module'),{chromium}=createRequire('/tmp/clea7-qa/package.json')('playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const bundle=await fs.readFile('test-evidence/CLEA7-native-media.clea7'),id=JSON.parse(bundle).manifest.id;
 const browser=await chromium.launch({executablePath:process.env.CLEA7_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.CLEA7Launcher={platform:()=> 'android'};window.CLEA7Device={profile:()=>JSON.stringify({format:'clea7.android-native/1',enabled:true,application:'runtime_shell',runtime:'0.13.0'})};});
  await page.goto('http://127.0.0.1:4173/studio/launcher/');await page.waitForFunction(()=>window.CLEA7Library);
  await page.locator('#package-file').setInputFiles({name:'Native.clea7',mimeType:'application/json',buffer:bundle});
  const review=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Provjeri instalaciju',exact:true})});
  await review.waitFor();
  const permissions=review.locator('input[data-native-permission]');assert.equal(await permissions.count(),3);
  for(const permission of ['camera','location','notifications'])assert.equal(await review.getByRole('checkbox',{name:'Dozvoli '+permission,exact:true}).isChecked(),false);
  await review.getByRole('button',{name:'Instaliraj',exact:true}).click();
  const config=page.locator('#clea7-remote-config');await config.waitFor();
  for(const input of await config.locator('input[type=checkbox]').all())await input.check();
  await config.locator('#remote-config-approve').click();
  await page.waitForFunction(()=>document.querySelector('dialog [role=status]')?.textContent.includes('dozvole'));
  assert.equal(await page.locator('[data-app="'+id+'"]').count(),0);
  console.log('PASS native launcher actual install controls reject missing per-application hardware consent');
  for(const input of await permissions.all())await input.check();
  await review.getByRole('button',{name:'Instaliraj',exact:true}).click();
  await page.locator('[data-app="'+id+'"] .primary').waitFor();
  assert.deepEqual((await page.evaluate(id=>CLEA7Library.library.get(id),id)).grants.sort(),['camera','location','notifications']);
  await page.reload();await page.locator('[data-app="'+id+'"] .primary').waitFor();assert.deepEqual(errors,[]);
  console.log('PASS native launcher explicit hardware consent installs the checked package and survives reload');
  console.log('NATIVE_INSTALL_BROWSER_CHECKS 2 passed (injected host availability; not hardware execution)');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
