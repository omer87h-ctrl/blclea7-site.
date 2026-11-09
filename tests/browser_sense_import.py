"""Real local PDF.js/ZIP extraction and CV review; no OCR/model/device fixture."""
import argparse,functools,http.server,io,json,os,threading,zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright

def word(text):
 output=io.BytesIO()
 with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:body></w:document>')
 return output.getvalue()

def pdf(text):
 stream=('BT /F1 16 Tf 70 720 Td ('+text+') Tj ET').encode()
 objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
 data=b'%PDF-1.4\n';offsets=[0]
 for i,value in enumerate(objects,1):offsets.append(len(data));data+=str(i).encode()+b' 0 obj\n'+value+b'\nendobj\n'
 start=len(data);data+=b'xref\n0 6\n0000000000 65535 f \n'+b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])
 return data+b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+str(start).encode()+b'\n%%EOF\n'

def main():
 p=argparse.ArgumentParser();p.add_argument('--site',type=Path);p.add_argument('--standalone',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 root=a.site or Path(__file__).resolve().parents[1]/'web';checks=[];errors=[];requests=[]
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start();standalone_server=None
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ.get('CLEA7_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);page=browser.new_page(accept_downloads=True)
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append((r.method,r.url)))
   page.goto(f'http://127.0.0.1:{server.server_port}/sense/',wait_until='networkidle');page.get_by_role('button',name='Uključi ravni prikaz radnog prostora',exact=True).click()
   assert not any('/vendor/pdfjs/' in url for _,url in requests)
   denied=page.evaluate("async()=>{try{await CLEA7SenseDocumentImport.read(new File(['private'],'a.txt'));return false;}catch(e){return e.code==='Permission';}}")
   assert denied;checks.append('Document bytes require explicit approval; PDF code/worker are not fetched on page load')
   page.locator('#cv-text').fill('Existing CV must survive rejected imports')
   picker=page.locator('#sense-cv-text-file')
   picker.set_input_files({'name':'Mira.docx','mimeType':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','buffer':word('Mira Test &amp; razvoj aplikacija')})
   page.locator('#sense-cv-import-preview').wait_for();assert 'Mira Test & razvoj' in page.locator('#sense-cv-import-text').input_value()
   assert page.locator('#cv-text').input_value()=='Existing CV must survive rejected imports'
   page.get_by_role('button',name='Odbaci uvoz',exact=True).click();assert page.locator('#cv-text').input_value()=='Existing CV must survive rejected imports'
   picker.set_input_files({'name':'Mira.docx','mimeType':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','buffer':word('Mira Test &amp; razvoj aplikacija')})
   page.locator('#sense-cv-import-preview').wait_for();page.get_by_role('button',name='Potvrdi učitani CV',exact=True).click();assert 'Mira Test & razvoj' in page.locator('#cv-text').input_value()
   checks.append('Real deflated DOCX and XML entity decoding; editable review and rejection preserve the prior CV; explicit confirmation applies extracted text')
   picker.set_input_files({'name':'Mira.pdf','mimeType':'application/pdf','buffer':pdf('Mira Test - application developer')})
   page.locator('#sense-cv-import-preview').wait_for(timeout=45000);assert 'Mira Test - application developer' in page.locator('#sense-cv-import-text').input_value()
   page.get_by_role('button',name='Potvrdi učitani CV',exact=True).click();assert 'application developer' in page.locator('#cv-text').input_value()
   checks.append('Actual PDF.js worker extracts a generated PDF locally; no invented OCR or remote document upload')
   before=page.locator('#cv-text').input_value()
   picker.set_input_files({'name':'image-only.pdf','mimeType':'application/pdf','buffer':pdf('')})
   page.wait_for_function("()=>document.getElementById('status-text').textContent.includes('nema izdvojiv tekst')")
   assert page.locator('#cv-text').input_value()==before
   for name,content in [('bad.docx',b'PKbroken'),('entity.docx',word('&bad;').replace(b'NEVER',b'INVALID'))]:
    picker.set_input_files({'name':name,'mimeType':'application/octet-stream','buffer':content});page.wait_for_function('()=>!document.getElementById("sense-cv-import").disabled');assert page.locator('#cv-text').input_value()==before
   checks.append('Image-only PDF, corrupt ZIP and malformed XML are rejected without changing existing user content')
   try:
    with page.expect_download(timeout=5000) as downloading:page.locator('#sense-cv-download').click()
   except Exception:
    print(json.dumps({'exportStatus':page.locator('#status-text').inner_text(),'cvLength':len(page.locator('#cv-text').input_value()),'errors':errors}));raise
   actual=Path(downloading.value.path()).read_bytes();(a.output/'imported-cv.docx').write_bytes(actual)
   with zipfile.ZipFile(io.BytesIO(actual)) as z:assert b'application developer' in z.read('word/document.xml')
   assert not any(method=='POST' for method,_ in requests);assert not errors,errors
   checks.append('Confirmed imported text exports as a genuine DOCX; no inference request or private-document upload occurs')
   if a.standalone:
    standalone_server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.standalone.resolve().parent)));threading.Thread(target=standalone_server.serve_forever,daemon=True).start()
    page.goto(f'http://127.0.0.1:{standalone_server.server_port}/{a.standalone.name}',wait_until='networkidle');page.get_by_role('button',name='Uključi ravni prikaz radnog prostora',exact=True).click();start=len(requests);page.context.set_offline(True)
    page.locator('#sense-cv-text-file').set_input_files({'name':'offline.pdf','mimeType':'application/pdf','buffer':pdf('Offline local CV text')});page.locator('#sense-cv-import-preview').wait_for(timeout=45000)
    assert 'Offline local CV text' in page.locator('#sense-cv-import-text').input_value();assert not any(url.startswith(('http:','https:')) for _,url in requests[start:])
    page.get_by_role('button',name='Potvrdi učitani CV',exact=True).click();assert 'Offline local CV text' in page.locator('#cv-text').input_value()
    checks.append('Self-contained Sense HTML performs actual PDF extraction after network access is disabled; file:// launch is not claimed because cloud browser policy blocks that origin')
   page.screenshot(path=str(a.output/'imported-cv.png'),full_page=True)
   result={'format':'clea7.sense-document-import-browser/1','passed':True,'checks':checks,'actualPDFWorker':True,'actualDeflatedDOCX':True,'aiUsed':False,'ocrClaimed':False,'privateUploads':0,'errors':errors}
   (a.output/'report.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));browser.close()
 finally:
  server.shutdown();server.server_close()
  if standalone_server:standalone_server.shutdown();standalone_server.server_close()

if __name__=='__main__':main()
