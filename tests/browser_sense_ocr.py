"""Actual local WASM OCR, user review and scanned PDF; no recognition fixture."""
import argparse,functools,http.server,io,json,os,threading,time,zipfile
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright

def fixture():
    image=Image.new('RGB',(1500,850),'white');draw=ImageDraw.Draw(image)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',42)
    for i,line in enumerate(['Mira Dedić','Radno iskustvo','Razvoj mobilnih aplikacija','Python, BIL i testiranje','Obrazovanje i vještine']):
        draw.text((100,100+i*110),line,font=font,fill='black')
    png=io.BytesIO();image.save(png,format='PNG');pdf=io.BytesIO();image.save(pdf,format='PDF',resolution=150)
    return png.getvalue(),pdf.getvalue()

def main():
    p=argparse.ArgumentParser();p.add_argument('--site',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
    root=a.site or Path(__file__).resolve().parents[1]/'web';png,pdf=fixture();checks=[];errors=[];requests=[]
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=os.environ.get('CLEA7_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);context=browser.new_context(accept_downloads=True);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append({'method':r.method,'url':r.url}))
            page.goto(f'http://127.0.0.1:{server.server_port}/sense/?tool=cv',wait_until='networkidle');page.get_by_role('button',name='Uključi ravni prikaz radnog prostora',exact=True).click()
            assert not any('/vendor/ocr/' in r['url'] for r in requests)
            assert page.evaluate("async()=>{try{await CLEA7SenseOCR.read(new Blob(['x']));return false;}catch(e){return e.code==='Permission'}}")
            checks.append('No OCR engine/model downloads or device access on load; image bytes require explicit approval')
            page.locator('#cv-text').fill('Previous confirmed CV')
            page.locator('#sense-cv-ocr-enable').check();start=time.perf_counter()
            page.locator('#sense-cv-text-file').set_input_files({'name':'synthetic-cv.png','mimeType':'image/png','buffer':png})
            page.locator('#sense-cv-import-preview').wait_for(timeout=95000)
            text=page.locator('#sense-cv-import-text').input_value();assert all(x in text.lower() for x in ('mira','radno','mobilnih','python','testiranje')),text
            assert page.locator('#cv-text').input_value()=='Previous confirmed CV'
            page.get_by_role('button',name='Odbaci uvoz',exact=True).click();assert page.locator('#cv-text').input_value()=='Previous confirmed CV'
            checks.append('Actual Tesseract WASM and pinned Bosnian weights recognize a synthetic PNG; rejecting review preserves the current CV')
            page.locator('#sense-cv-text-file').set_input_files({'name':'synthetic-scan.pdf','mimeType':'application/pdf','buffer':pdf})
            page.locator('#sense-cv-import-preview').wait_for(timeout=95000);text=page.locator('#sense-cv-import-text').input_value();assert 'mobilnih' in text.lower() and 'python' in text.lower(),text
            page.get_by_role('button',name='Potvrdi učitani CV',exact=True).click();assert 'mobilnih' in page.locator('#cv-text').input_value().lower()
            with page.expect_download() as download:page.locator('#sense-cv-download').click()
            with zipfile.ZipFile(download.value.path()) as z:assert b'Python' in z.read('word/document.xml')
            checks.append('Actual image-only PDF renders locally, uses real OCR and exports confirmed recognized content as a real DOCX')
            rejected=page.evaluate("async()=>{const b=new Uint8Array(24);b.set([137,80,78,71,13,10,26,10]);const d=new DataView(b.buffer);d.setUint32(8,13);d.setUint32(12,0x49484452);d.setUint32(16,9000);d.setUint32(20,9000);try{await CLEA7SenseOCR.read(new Blob([b]),{approved:true});return false;}catch(e){return e.code==='Budget';}}")
            assert rejected;checks.append('Oversized decoded dimensions are rejected before image decoding or OCR execution')
            assert not errors,errors
            assert not any(x['method']!='GET' or not x['url'].startswith(f'http://127.0.0.1:{server.server_port}/') for x in requests),requests
            result={'format':'clea7.sense-local-ocr-browser/1','passed':True,'checks':checks,'actualWasmRecognition':True,'recognitionFixture':False,'syntheticImageOnly':True,'privateUploads':0,'externalRequests':0,'elapsedSeconds':round(time.perf_counter()-start,3),'physicalDeviceTested':False,'errors':errors}
            (a.output/'report.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
