"""Real Studio operator -> BIL -> selected image -> reviewed OCR -> package/Runtime."""
import argparse,functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_sense_ocr import fixture

def main():
    p=argparse.ArgumentParser();p.add_argument('--site',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
    root=a.site or Path(__file__).resolve().parents[1]/'web';prefix='studio/' if a.site else '';checks=[];errors=[];png,_=fixture()
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=os.environ.get('CLEA7_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);context=browser.new_context(accept_downloads=True);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
            page.goto(base+prefix+'workbench/',wait_until='networkidle');page.locator('[data-panel="clea-chat"]').click();page.locator('#chat-question').fill('Napravi novu aplikaciju za OCR skeniranog CV-a');page.locator('#chat-send').click();proposal=page.locator('[data-ai-app-proposal]').last;proposal.wait_for();assert 'bez neuronskog modela' in proposal.inner_text();assert proposal.locator('[data-ai-app-apply]').is_disabled();proposal.locator('[data-ai-app-reviewed]').check();proposal.locator('[data-ai-app-apply]').click()
            grant=page.locator('#clea7-remote-config');grant.wait_for();grant.get_by_role('checkbox',name='scan_assist · Odobri document.ocr',exact=True).check();grant.get_by_role('button',name='Sačuvaj konfiguraciju i dozvole',exact=True).click();page.wait_for_function('()=>CLEA7Workbench.engine?.state.bilValues.scan_text===""');identity=page.evaluate('CLEA7Workbench.project.id')
            checks.append('One existing conversation invokes the real registered OCR tool; compiler/SHADOW and review run before source apply; explicit scoped operation grant is required')
            page.locator('#draw-live-runtime').get_by_role('button',name='Pročitaj sliku lokalno',exact=True).click();choose=page.get_by_role('dialog',name='Pročitaj tekst slike lokalno',exact=True);choose.get_by_label('Slika za lokalni OCR',exact=True).set_input_files({'name':'synthetic.png','mimeType':'image/png','buffer':png});choose.get_by_role('button',name='Potvrdi ovu radnju',exact=True).click();review=page.get_by_role('dialog',name='Pregledaj prepoznati tekst',exact=True);review.wait_for(timeout=95000);text=review.get_by_label('Prepoznati tekst za pregled',exact=True).input_value();assert 'mobilnih' in text.lower(),text;assert page.evaluate('CLEA7Workbench.engine.state.bilValues.scan_text')=='';review.get_by_label('Prepoznati tekst za pregled',exact=True).fill(text+'\nPotvrđeno lokalno.');review.get_by_role('button',name='Potvrdi ovu radnju',exact=True).click();page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.scan_text.includes("Potvrđeno lokalno.")')
            checks.append('Actual nested-worker WASM recognition returns typed Text only after a separate editable content approval; no recognition response fixture')
            page.locator('[data-panel="build"]').click()
            with page.expect_download() as downloading:page.locator('#export-package').click()
            package=Path(downloading.value.path()).read_bytes();(a.output/'local-ocr.clea7').write_bytes(package);value=json.loads(package);assert value['manifest']['runtime']=='0.42.0';assert 'Mira' not in package.decode()
            page.goto(base+prefix+'launcher/');page.wait_for_function('()=>globalThis.CLEA7Library');page.locator('#package-file').set_input_files({'name':'local-ocr.clea7','mimeType':'application/json','buffer':package});page.get_by_role('button',name='Instaliraj',exact=True).click()
            with context.expect_page() as opening:page.locator('[data-app="'+identity+'"] .primary').click()
            app=opening.value;app.on('pageerror',lambda e:errors.append(str(e)));app.wait_for_function('()=>globalThis.CLEA7RuntimeApp?.engine||document.querySelector("#clea7-remote-config")');grant=app.locator('#clea7-remote-config');
            if grant.count():grant.get_by_role('checkbox',name='scan_assist · Odobri document.ocr',exact=True).check();grant.get_by_role('button',name='Sačuvaj konfiguraciju i dozvole',exact=True).click()
            app.wait_for_function('()=>globalThis.CLEA7RuntimeApp?.engine');assert app.evaluate('CLEA7RuntimeApp.engine.state.bilValues.scan_text')==''
            app.locator('#application').get_by_role('button',name='Pročitaj sliku lokalno',exact=True).click();choose=app.get_by_role('dialog',name='Pročitaj tekst slike lokalno',exact=True);choose.get_by_label('Slika za lokalni OCR',exact=True).set_input_files({'name':'synthetic.png','mimeType':'image/png','buffer':png});choose.get_by_role('button',name='Potvrdi ovu radnju',exact=True).click();review=app.get_by_role('dialog',name='Pregledaj prepoznati tekst',exact=True);review.wait_for(timeout=95000);review.get_by_role('button',name='Potvrdi ovu radnju',exact=True).click();app.wait_for_function('()=>CLEA7RuntimeApp.engine.state.bilValues.scan_text.includes("Python")');app.reload();app.wait_for_function('()=>globalThis.CLEA7RuntimeApp?.engine?.state.bilValues.scan_text.includes("Python")')
            checks.append('The same0.42 package excludes imported CV data, installs in independent Runtime, performs real OCR and preserves its separately approved local state after restart')
            assert not errors,errors;result={'format':'clea7.studio-ocr-browser/1','passed':True,'checks':checks,'actualWasmRecognition':True,'neuralAuthoringInvoked':False,'recognitionFixture':False,'errors':errors};(a.output/'report.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
