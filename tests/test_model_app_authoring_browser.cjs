'use strict';
/* Real Studio/Runtime/DOM with explicitly labelled inference transport fixtures.
 * Actual HP model authoring has a separate, non-fixture verification job. */
const {chromium}=require('/tmp/clea7-qa/node_modules/playwright'),http=require('node:http'),assert=require('node:assert/strict');
const siteOrigin='http://127.0.0.1:'+String(process.env.CLEA7_TEST_PORT||4173);
const source='let player = ""\nlet score = 0\non answer { score = score + 1; open result }\non again { score = 0; open play }\nscreen play "Moj kviz" {\n input player label "Igrač" key player\n button "Tačan odgovor" runs answer key answer\n}\nscreen result "Rezultat" { show player key name; show score key score; button "Igraj opet" runs again key again }\nstart play\n';
const invalid='let score = "text"\nscore = 1\n';
(async()=>{
 let received=[],failFirst=true;
 const server=http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin',siteOrigin);res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Private-Network','true');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
  if(req.url==='/health'){res.end(JSON.stringify({brand:'BL CLEA AI',apiVersion:'clea7.public-ai/1',mode:'local',ready:true,modelProfile:{id:'qwen3.5-9b-q4_k_m'},capabilities:{bilAuthoring:true,bilAuthoringContract:'bil.author/1'}}));return;}
  let raw='';req.on('data',x=>raw+=x);req.on('end',()=>{const value=JSON.parse(raw);received.push(value);const code=failFirst?invalid:source;failFirst=false;res.end(JSON.stringify({reply:'```bil\n'+code+'```',authoring:{format:'bil.author/1'},sources:[]}));});
 });await new Promise(r=>server.listen(8765,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CLEA7_CHROME||'/usr/bin/chromium',args:['--no-sandbox']}),context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const connect=async path=>{await page.goto(siteOrigin+'/'+path);await page.waitForSelector('#clea-ai-task-mode',{state:'attached'});if(await page.locator('[data-panel="clea-chat"]').count())await page.locator('[data-panel="clea-chat"]').click();await page.locator('.chat-local-model-controls summary').first().click();await page.locator('#clea-local-model-opt-in').check();await page.waitForFunction(()=>document.querySelector('#clea-local-model-status').textContent.includes('uključen')||document.querySelector('#clea-local-model-status').textContent.includes('spreman'));};
 try{
  await connect('studio/workbench/');const before=await page.evaluate(()=>CLEA7.stable(CLEA7Workbench.snapshot()));
  await page.locator('#chat-question').fill('Napravi aplikaciju: originalni kviz s imenom igrača, bodovima i ponovnim igranjem.');await page.locator('#chat-send').click();
  await page.waitForSelector('[data-ai-app-proposal]',{timeout:30000});
  assert.equal(received.length,2);assert.equal(received[0].authoring.mode,'create');assert.equal('source' in received[0].authoring,false);assert.deepEqual(received[0].history,[]);
  assert(received[1].authoring.previous.includes('score = 1'));assert(received[1].authoring.diagnostic.length>0);
  assert.equal(await page.evaluate(()=>CLEA7.stable(CLEA7Workbench.snapshot())),before);
  assert(await page.locator('[data-ai-app-apply]').isDisabled());await page.locator('[data-ai-app-reviewed]').check();await page.locator('[data-ai-app-apply]').click();
  await page.waitForSelector('#player input');assert.equal(await page.evaluate(()=>CLEA7Workbench.project.bil.source),source);
  await page.locator('#player').getByLabel('Igrač',{exact:true}).fill('Mira test');await page.locator('#player').getByRole('button',{name:'Tačan odgovor',exact:true}).click();
  await page.waitForFunction(()=>CLEA7Workbench.engine.state.bilValues.score===1);assert((await page.locator('#player').innerText()).includes('Mira test'));
  await page.locator('#player').getByRole('button',{name:'Igraj opet',exact:true}).click();await page.waitForFunction(()=>CLEA7Workbench.engine.state.bilValues.score===0);
  console.log('PASS actual authoring UI: rejected compiler error -> bounded model repair -> reviewed BIL app -> actual input, events and navigation (inference fixture)');
  await page.locator('[data-panel="clea-chat"]').click();await page.locator('#clea-ai-task-mode').selectOption('change');
  await page.locator('#chat-question').fill('Promijeni naslov kviza.');await page.locator('#chat-send').click();await page.waitForFunction(()=>!document.querySelector('#chat-send').disabled);
  assert.equal(received.length,2);assert((await page.locator('#chat-log').innerText()).includes('odobri'));
  await page.locator('#clea-ai-source-approved').check();await page.locator('#chat-question').fill('Promijeni naslov kviza.');await page.locator('#chat-send').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-ai-app-proposal]').length===2);assert.equal(received.length,3);assert.equal(received[2].authoring.source,source);assert(!received[2].authoring.source.includes('Mira test'));
  console.log('PASS actual authoring privacy: no project transmission before approval; running user state is absent from explicit source change');
  await page.getByRole('button',{name:'Poništi ovu AI izmjenu',exact:true}).first().click();assert.equal(await page.evaluate(()=>CLEA7.stable(CLEA7Workbench.snapshot())),before);
  console.log('PASS actual authoring recovery: applied source is reversible through real Studio history');
  await connect('razgovor/');await page.locator('#clea-ai-task-mode').selectOption('create');await page.locator('#chat-question').fill('Napravi aplikaciju kviza.');await page.locator('#chat-send').click();await page.waitForSelector('[data-ai-app-proposal]');await page.locator('[data-ai-app-reviewed]').check();await page.locator('[data-ai-app-apply]').click();
  await page.waitForURL('**/studio/workbench/**');await page.waitForSelector('[data-ai-app-proposal]');assert((await page.locator('#chat-log').innerText()).includes('ponovna lokalna provjera'));assert(await page.locator('[data-ai-app-apply]').isDisabled());
  console.log('PASS actual authoring handoff: standalone conversation opens the same original Studio, rechecks source and preserves explicit review');
  assert.deepEqual(errors,[]);
 }catch(error){console.error('AUTHORING_DEBUG',JSON.stringify({received:received.map(x=>({question:x.question,contract:x.authoring})),errors,status:await page.locator('[role=status]').allTextContents(),text:(await page.locator('#chat-log').innerText()).slice(-2000)}));throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
