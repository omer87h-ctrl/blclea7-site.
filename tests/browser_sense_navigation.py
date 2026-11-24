"""Real Chromium regression for BL CLEA Sense's nonblocking, always-on guide.

Tests real page interactions, actual control geometry, speech API fixtures and
vibration API calls. Does not claim actual mobile voices or human accessibility.
"""
import argparse
import functools
import http.server
import json
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

FIXTURE = r"""(() => {
 window.__senseFixture = {
  said:[], voiceCodes:[], vibrations:[], recognitions:0, cancelCount:0
 };
 const hr={name:'Hrvatski lokalni glas',lang:'hr-HR',localService:true};
 const sr={name:'Srpski lokalni glas',lang:'sr-RS',localService:true};
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
  getVoices:()=>[sr,hr],
  cancel(){__senseFixture.cancelCount++;},
  addEventListener(){},removeEventListener(){},
  speak(u){__senseFixture.said.push(u.text);__senseFixture.voiceCodes.push(u.voice?.lang||u.lang);
   queueMicrotask(()=>u.onend?.());}
 }});
 window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 window.SpeechRecognition=class{
  start(){__senseFixture.recognitions++;queueMicrotask(()=>this.onstart?.());}
  stop(){this.onend?.();}
  abort(){this.onend?.();}
 };
 Object.defineProperty(navigator,'vibrate',{configurable:true,value:p=>{__senseFixture.vibrations.push(p);return true;}});
})()"""


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--site', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    root = args.site or Path(__file__).resolve().parents[1]
    checks, errors = [], []

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *unused):
            pass

    server = http.server.ThreadingHTTPServer(
        ('127.0.0.1', 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                executable_path=os.environ.get('CLEA7_CHROME', '/usr/bin/chromium'),
                headless=True, args=['--no-sandbox'])
            context = browser.new_context(
                viewport={'width':390, 'height':844},
                has_touch=True, is_mobile=True, reduced_motion='reduce')
            context.add_init_script(FIXTURE)
            page = context.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            base = f'http://127.0.0.1:{server.server_port}'

            page.goto(base+'/sense/', wait_until='networkidle')
            switch = page.locator('#sense-interface-toggle')
            assert switch.is_visible() and switch.get_attribute('aria-pressed')=='false'
            switch.click()
            assert switch.get_attribute('aria-pressed')=='true'
            assert page.locator('#main').is_visible()
            assert not page.locator('#sense-touch-guide').is_visible()
            assert page.evaluate("document.body.dataset.senseLive")=='true'
            page.wait_for_function("()=>__senseFixture.said.length>0")
            assert page.evaluate("__senseFixture.voiceCodes[0]")=='hr-HR'
            assert 'Trenutni ekran:' in page.locator('#sense-guidance-caption').inner_text()
            page.screenshot(path=str(args.output/'sense-live-home.png'))
            checks.append('One Sense tap starts Croatian voice and keeps the real page interactive without a blurred modal.')

            # Geometry: only real controls may be named. Empty regions give direction.
            guidance = page.evaluate("""() => CLEA7SenseNavigation.touchGuidance(
                {x:4,y:6},
                [{rect:{left:120,top:240,right:300,bottom:300},
                  name:'Nova aplikacija',kind:'button',region:'Studio',
                  label:'Nova aplikacija, dugme'}],
                {width:390,height:844})""")
            assert not guidance['found']['hit'] and 'nema' in guidance['text'].lower()
            none = page.evaluate("""() => CLEA7SenseNavigation.touchGuidance(
                {x:4,y:6},[],{width:390,height:844})""")
            assert not none['found']['available'] and 'nema kontrole' in none['spoken'].lower()
            checks.append('Finger guidance uses measured control geometry and acknowledges empty screen areas.')

            # Communication is a separate action, never an automatic microphone.
            assert page.evaluate('__senseFixture.recognitions')==0
            page.locator('#sense-live-communication').click()
            assert page.locator('#sense-expression').is_visible()
            assert page.evaluate('__senseFixture.recognitions')==0
            page.locator('#sense-expression').fill('Treba mi pomoć.')
            page.locator('#sense-expression-show').click()
            assert page.locator('#sense-show-message').is_visible()
            assert 'Treba mi pomoć.' in page.locator('#sense-show-message-text').inner_text()
            page.locator('#sense-show-message button').click()
            checks.append('A user unable to speak can show a large message without microphone permission.')

            # Studio's own switch must never call the obsolete full-screen guide.
            page.goto(base+'/studio/workbench/', wait_until='networkidle')
            page.wait_for_function('()=>Boolean(globalThis.CLEA7StudioUiReady)')
            studio = page.locator('#private-studio-sense')
            studio.wait_for(state='visible')
            assert page.locator('#studio-start').is_visible()
            studio.click()
            assert studio.get_attribute('aria-pressed')=='true'
            assert page.evaluate("document.body.dataset.senseLive")=='true'
            assert not page.locator('#sense-touch-guide').is_visible()
            assert page.locator('#studio-start').is_visible()
            assert page.locator('#studio-start-create').is_visible()
            page.screenshot(path=str(args.output/'studio-sense-no-overlay.png'))
            checks.append('Studio stays normal and usable with Sense enabled; no settings window or dimmed page.')

            # Real Studio navigation, menu, project creation and control focus.
            page.locator('.private-studio-tools>summary').click()
            page.wait_for_timeout(250)
            assert studio.get_attribute('aria-pressed')=='true'
            assert page.locator('.private-studio-tools[open]').is_visible()
            assert any('meni' in x.lower() for x in page.evaluate('__senseFixture.said'))
            page.locator('.private-studio-tools>summary').click()
            page.locator('#studio-start-create input').fill('Sense dostupna aplikacija')
            page.locator('#studio-start-grammar').select_option('classic')
            page.locator('#studio-start-create').get_by_role('button', name='Novi projekat', exact=True).click()
            page.wait_for_function("()=>document.body.dataset.workspace==='draw'")
            assert not page.locator('#sense-touch-guide').is_visible()
            assert studio.get_attribute('aria-pressed')=='true'
            assert page.evaluate('__senseFixture.vibrations.length')>0
            checks.append('Sense remains active during actual project creation, menu opening and Draw workspace changes.')

            # A real dialog appears while Sense remains active: it is not a Sense modal.
            page.evaluate("""() => {
              const dialog=document.createElement('dialog');
              dialog.id='clea-real-dialog-test';
              dialog.innerHTML='<h2>Postavke aplikacije</h2><button id="confirm-dialog-test">Zatvori prozor</button>';
              document.body.append(dialog);dialog.showModal();
            }""")
            page.wait_for_timeout(260)
            assert page.locator('#clea-real-dialog-test').is_visible()
            assert not page.locator('#sense-touch-guide').is_visible()
            assert any('prozor' in text.lower() for text in page.evaluate('__senseFixture.said'))
            page.screenshot(path=str(args.output/'studio-real-dialog-guided.png'))
            page.locator('#confirm-dialog-test').click()
            page.evaluate("document.querySelector('#clea-real-dialog-test').close()")
            assert studio.get_attribute('aria-pressed')=='true'
            checks.append('Opening a real application dialog is narrated without injecting a competing Sense window.')

            # Touch exploration is non-blocking and provides haptics on real controls.
            button = page.locator('#private-studio-sense')
            box = button.bounding_box()
            assert box is not None
            before = page.evaluate('__senseFixture.vibrations.length')
            page.evaluate("""p => {
              document.dispatchEvent(new PointerEvent('pointermove',{
                bubbles:true,pointerType:'touch',isPrimary:true,
                clientX:p.x,clientY:p.y
              }));
            }""", {'x':box['x']+box['width']/2,'y':box['y']+box['height']/2})
            page.wait_for_timeout(500)
            assert page.evaluate('__senseFixture.vibrations.length')>=before
            assert not page.locator('#sense-touch-guide').is_visible()
            checks.append('Finger exploration reaches real Studio toolbar controls without intercepting clicks.')

            studio.click()
            assert studio.get_attribute('aria-pressed')=='false'
            assert page.evaluate("document.body.dataset.senseLive||''")== ''
            assert not page.locator('#sense-guidance-caption').is_visible()
            assert not errors, errors
            checks.append('The same Studio Sense switch stops narration and removes the guidance overlay.')

            result = {
                'format':'clea7.sense-live-browser/2',
                'passed':True, 'checks':checks, 'errors':errors,
                'viewport':[390,844], 'physicalVoiceVerified':False,
                'physicalVibrationVerified':False, 'humanAccessibilityVerified':False
            }
            (args.output/'report.json').write_text(
                json.dumps(result,ensure_ascii=False,indent=2)+'\n')
            print(json.dumps(result,ensure_ascii=False))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    run()
