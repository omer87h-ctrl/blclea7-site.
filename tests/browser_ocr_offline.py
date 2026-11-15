"""Actual OCR from the one-file distribution, with browser network disabled."""
import argparse,base64,functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_sense_ocr import fixture

def main():
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True);png,_=fixture();errors=[]
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.root)));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as pw:
   b=pw.chromium.launch(executable_path=os.environ.get('CLEA7_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);c=b.new_context();page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));requests=[];page.on('request',lambda r:requests.append(r.url));page.goto(f'http://127.0.0.1:{server.server_port}/downloads/BL-CLEA-Sense-0.42-test.html',wait_until='networkidle');assert page.evaluate('CLEA7SenseOCR.capabilities().configured');c.set_offline(True);count=len(requests)
   result=page.evaluate('''async data=>{const diagnostics=[];const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),file=new File([bytes],'synthetic.png',{type:'image/png'}),result=await CLEA7SenseOCR.read(file,{approved:true,language:'bos',onDiagnostic:d=>diagnostics.push(d)}).catch(e=>{throw Error(JSON.stringify({message:e.message,diagnostics}));});return {text:result.text,local:result.local,review:result.requiresReview};}''',base64.b64encode(png).decode());assert 'Python' in result['text'] and result['local'] and result['review'];assert not any(u.startswith(('http:','https:')) for u in requests[count:]),requests[count:];assert not errors,errors
   report={'format':'sense.ocr-offline-browser/1','passed':True,'actualRecognition':True,'browserNetworkOffline':True,'networkRequestsAfterLoad':0,'source':'synthetic public fixture','fileSchemeTested':False,'physicalAndroid':False};(a.output/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
