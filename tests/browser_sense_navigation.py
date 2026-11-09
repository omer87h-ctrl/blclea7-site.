"""Actual mobile touch/focus geometry with labelled speech/vibration fixtures.

Device APIs are fixtures; DOM, modal isolation, pointer events and focus are real.
No claim about physical haptics, audio output or human assistive evaluation.
"""
import argparse,functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright

FIXTURE="""(() => {
 window.__senseDeviceFixture={spoken:[],vibrations:[],clicks:0,voicesAvailable:true,voiceListeners:new Set()};
 const voice={name:'Local test voice',lang:'bs-BA',localService:true};
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
 getVoices:()=>__senseDeviceFixture.voicesAvailable?[voice]:[],cancel(){},addEventListener(type,fn){if(type==='voiceschanged')__senseDeviceFixture.voiceListeners.add(fn);},removeEventListener(type,fn){__senseDeviceFixture.voiceListeners.delete(fn);},
 speak(u){__senseDeviceFixture.spoken.push(u.text);queueMicrotask(()=>u.onend?.());}}});
 window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 Object.defineProperty(navigator,'vibrate',{configurable:true,value:p=>{__senseDeviceFixture.vibrations.push(p);return true;}});
})()"""

def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--site',type=Path);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 root=a.site or Path(__file__).resolve().parents[1]/'web';checks=[];errors=[]
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ.get('CLEA7_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
   context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce');context.add_init_script(FIXTURE);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/sense/',wait_until='networkidle')
   page.locator('#sense-create-cv-shortcut').click();page.locator('#sense-cv-name').fill('PRIVATE_VALUE_MUST_NOT_BE_SPOKEN')
   page.locator('#sense-cv-authoring [data-sense-touch-launch]').click();page.locator('#sense-touch-guide').wait_for(state='visible')
   choices=page.locator('#sense-touch-target option').all_text_contents();assert any('ime' in x.lower() for x in choices),choices
   page.select_option('#sense-touch-target',label=next(x for x in choices if 'ime' in x.lower()))
   page.locator('#sense-touch-start').click()
   data=page.evaluate('''()=>{const r=document.querySelector('#sense-cv-name').getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,top:r.top,bottom:r.bottom,left:r.left,right:r.right};}''')
   client=context.new_cdp_session(page)
   def touch(event,x,y):client.send('Input.dispatchTouchEvent',{'type':event,'touchPoints':[] if event=='touchEnd' else [{'x':x,'y':y,'id':1}]})
   x=data['x'];y=max(8,data['top']-110)
   touch('touchStart',x,y);page.wait_for_timeout(40)
   current=page.evaluate('CLEA7SenseNavigation.current()')
   if not current or 'dy' not in current:
    page.screenshot(path=str(a.output/'failure-touch.png'));print(json.dumps({'target':data,'point':[x,y],'current':current,'topElement':page.evaluate('([x,y])=>document.elementFromPoint(x,y)?.outerHTML.slice(0,600)',[x,y])}))
   assert current and current.get('dy',0)>0,current
   assert 'niže' in page.locator('#sense-touch-status').inner_text()
   touch('touchMove',x,data['top']-18);page.wait_for_timeout(300)
   assert page.evaluate('CLEA7SenseNavigation.current().zone')=='near'
   touch('touchMove',x,data['y']);page.wait_for_timeout(300)
   assert page.evaluate('CLEA7SenseNavigation.current().arrived') is True
   touch('touchEnd',x,data['y'])
   assert page.locator('#sense-cv-name').input_value()=='PRIVATE_VALUE_MUST_NOT_BE_SPOKEN'
   assert page.locator('#sense-touch-guide').is_visible()
   assert page.locator('#sense-cv-authoring').is_visible()
   assert 'Tu je cilj' in page.locator('#sense-touch-status').inner_text()
   signals=page.evaluate('__senseDeviceFixture.vibrations');assert any(x==[65,70,65] for x in signals),signals
   spoken=page.evaluate('__senseDeviceFixture.spoken');assert spoken and all('PRIVATE_VALUE' not in s for s in spoken)
   checks.append('Real touch events report measured down/near/arrived positions; labelled haptic patterns and local speech API requested without reading input values')
   page.screenshot(path=str(a.output/'mobile-touch-guide.png'))
   page.locator('#sense-touch-focus').click();assert not page.locator('#sense-touch-guide').is_visible()
   assert page.evaluate('document.activeElement.id')=='sense-cv-name'
   assert page.locator('#sense-cv-name').input_value()=='PRIVATE_VALUE_MUST_NOT_BE_SPOKEN'
   checks.append('Exploration cannot activate underlying controls; separate focus action returns to the exact editable field')
   page.locator('#sense-cv-authoring [data-sense-touch-launch]').click()
   assert page.locator('#sense-touch-mode').input_value()=='explore'
   page.locator('#sense-touch-start').click()
   points=page.evaluate('''()=>[...document.querySelector('#sense-cv-authoring').querySelectorAll('input,textarea,button')].filter(n=>!n.closest('[hidden]')&&!n.disabled&&!n.hasAttribute('data-sense-touch-launch')).map(n=>{const r=n.getBoundingClientRect();return {id:n.id,x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,w:r.width,h:r.height};}).filter(r=>r.w>0&&r.h>0&&r.y>10&&r.y<innerHeight-10)''')
   first=next(x for x in points if x['id']=='sense-cv-name');second=next(x for x in points if x['id'] and x['id']!=first['id'])
   touch('touchStart',first['x'],first['y']);assert page.evaluate('CLEA7SenseNavigation.current().underFinger')
   touch('touchMove',second['x'],second['y']);expected=page.evaluate('CLEA7SenseNavigation.current().underFinger');assert expected
   page.wait_for_timeout(1200)
   assert expected in page.evaluate('__senseDeviceFixture.spoken.at(-1)'),page.evaluate('__senseDeviceFixture.spoken')
   assert page.evaluate('CLEA7SenseNavigation.current().point.x')==second['x']
   touch('touchEnd',second['x'],second['y'])
   assert 'Ispod prsta' in page.locator('#sense-touch-status').inner_text()
   assert all('PRIVATE_VALUE' not in s for s in page.evaluate('__senseDeviceFixture.spoken'))
   # Hover and unrelated pointers cannot silently change the user's location.
   before=page.evaluate('CLEA7SenseNavigation.current()')
   page.locator('.sense-touch-surface').dispatch_event('pointermove',{'pointerId':999,'pointerType':'mouse','buttons':0,'clientX':1,'clientY':1})
   assert page.evaluate('CLEA7SenseNavigation.current()')==before
   page.locator('#sense-touch-explain').click();assert 'Dio:' in page.locator('#sense-touch-status').inner_text()
   page.locator('#sense-touch-close').click()
   checks.append('Free exploration identifies actual controls under a moving finger; final queued speech is delivered even when movement stops, without reading private input values')
   page.evaluate('__senseDeviceFixture.voicesAvailable=false')
   page.locator('#sense-cv-authoring [data-sense-touch-launch]').click()
   assert page.locator('#sense-touch-voice option').count()==0
   page.evaluate('()=>{__senseDeviceFixture.voicesAvailable=true;for(const fn of __senseDeviceFixture.voiceListeners)fn();}')
   assert page.locator('#sense-touch-voice option').count()==1
   assert 'Sense istražuje ekran' in page.evaluate('__senseDeviceFixture.spoken.at(-1)')
   page.locator('#sense-touch-close').click()
   checks.append('A local voice that appears asynchronously speaks the current guidance instead of leaving the user with a silent initial session')
   page.locator('#sense-cv-authoring [data-sense-touch-launch]').click();page.keyboard.press('Escape');assert not page.locator('#sense-touch-guide').is_visible()
   assert page.evaluate('CLEA7SenseNavigation.current()') is None
   page.locator('#sense-cv-authoring [data-sense-touch-launch]').click();page.evaluate("dispatchEvent(new Event('sense:erase'))");assert not page.locator('#sense-touch-guide').is_visible()
   assert page.evaluate('CLEA7SenseNavigation.current()') is None
   checks.append('Escape and content erase close the session and discard live guidance state')
   studio='studio/workbench/' if a.site else 'workbench/'
   page.goto(f'http://127.0.0.1:{server.server_port}/{studio}',wait_until='networkidle');page.wait_for_function('()=>Boolean(globalThis.CLEA7Workbench)')
   page.locator('body > [data-sense-touch-launch]').click();page.wait_for_selector('#sense-touch-guide[open]')
   assert page.locator('#sense-touch-target option').count()>5
   page.locator('#sense-touch-focus').click();assert page.evaluate('document.activeElement!==document.body')
   checks.append('The same shared module locates actual Studio controls and returns real keyboard focus')
   page.locator('[data-panel="clea-chat"]').click();page.locator('#chat-question').fill('')
   question_label=page.locator('#chat-question').evaluate("n=>n.getAttribute('aria-label')||n.labels[0].textContent")
   page.locator('body > [data-sense-touch-launch]').click()
   choices=page.locator('#sense-touch-target option').all_text_contents()
   page.select_option('#sense-touch-target',label=next(x for x in choices if question_label.strip() in x))
   page.locator('#sense-touch-ask').click()
   page.wait_for_function("()=>document.querySelector('#chat-question').value.includes('sense.control-context/1')")
   assert not page.locator('#sense-touch-guide').is_visible()
   assert page.locator('#clea-ai-task-mode').input_value()=='chat'
   assert 'PRIVATE_VALUE' not in page.locator('#chat-question').input_value()
   draft=page.locator('#chat-question').input_value()
   page.locator('body > [data-sense-touch-launch]').click();page.locator('#sense-touch-ask').click()
   assert page.locator('#chat-question').input_value()==draft
   assert 'Sačuvaj trenutno pitanje' in page.locator('#sense-touch-status').inner_text()
   page.keyboard.press('Escape')
   checks.append('Measured control context reaches the single existing AI composer for explicit review without automatic send or overwriting an unfinished question')
   # Author through the real editor/compiler, rather than relying on a default
   # project that may intentionally contain no interactive controls. No model.
   bil='''let clicks = 0
screen main "Prstom do cilja" {
    input clicks label "Broj"
    button "Dodaj jedan" runs increase
    show clicks
}
on increase {
    clicks = clicks + 1
}
'''
   page.once('dialog',lambda dialog:dialog.accept())
   page.locator('#guided-start').click();page.wait_for_function('()=>Boolean(CLEA7Workbench.project.bil)')
   page.locator('[data-panel="bil"]').click();page.locator('#bil-source').fill(bil);page.locator('#bil-apply').click()
   page.wait_for_function("()=>Boolean(CLEA7Workbench.project.bil?.source.includes('Prstom do cilja'))")
   application_id=page.evaluate('CLEA7Workbench.project.id')
   page.locator('[data-panel="build"]').click()
   with page.expect_download() as downloading:page.locator('#export-package').click()
   package=Path(downloading.value.path()).read_bytes();(a.output/'guided-runtime.clea7').write_bytes(package)
   launcher='studio/launcher/' if a.site else 'launcher/'
   page.goto(f'http://127.0.0.1:{server.server_port}/{launcher}',wait_until='networkidle')
   page.locator('#package-file').set_input_files({'name':'guided-runtime.clea7','mimeType':'application/json','buffer':package})
   page.get_by_role('button',name='Instaliraj',exact=True).click()
   with context.expect_page() as opening:page.locator('[data-app="'+application_id+'"] .primary').click()
   app=opening.value;app.on('pageerror',lambda e:errors.append(str(e)));app.wait_for_function('()=>Boolean(globalThis.CLEA7RuntimeApp?.engine)')
   control=app.locator('#application button,#application input:not([type=hidden]),#application textarea,#application select').first
   control.wait_for(state='visible')
   control_name=control.evaluate("n=>(n.getAttribute('aria-label')||(n.labels?.length?n.labels[0].textContent:n.textContent)).replace(/\\s+/g,' ').trim()")
   app.evaluate("()=>{globalThis.__appClicks=0;document.querySelector('#application').addEventListener('click',()=>__appClicks++);}")
   app.locator('body > [data-sense-touch-launch]').click()
   labels=app.locator('#sense-touch-target option').all_text_contents()
   app.select_option('#sense-touch-target',label=next(x for x in labels if control_name in x))
   app.select_option('#sense-touch-mode','explore');app.locator('#sense-touch-start').click()
   r=control.bounding_box();runtime_client=context.new_cdp_session(app)
   runtime_client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':r['x']+r['width']/2,'y':r['y']+r['height']/2,'id':1}]})
   assert app.evaluate('CLEA7SenseNavigation.current().underFinger')==control_name
   runtime_client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   assert app.evaluate('__appClicks')==0
   app.screenshot(path=str(a.output/'runtime-finger-guide.png'))
   app.locator('#sense-touch-focus').click();assert control.evaluate('n=>document.activeElement===n')
   app.get_by_role('spinbutton',name='Broj',exact=True).fill('7');app.get_by_role('button',name='Dodaj jedan',exact=True).click()
   app.wait_for_function('()=>CLEA7RuntimeApp.engine.state.bilValues.clicks===8')
   checks.append('A genuine Studio-exported CLEA7 package installs and runs in the independent Runtime with the same real finger guidance and separate focus, without activating the application')
   assert not errors,errors
   result={'format':'clea7.sense-touch-browser/1','passed':True,'checks':checks,'viewport':[390,844],'pointerEvents':'Chromium CDP touch','deviceAPIs':'explicit local voice/vibration fixtures','physicalHapticsVerified':False,'humanAccessibilityVerified':False,'errors':errors}
   (a.output/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False));browser.close()
 finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
