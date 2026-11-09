"""Real Studio-authored behavioral tests, isolation and SDK-format round trip."""
import argparse,functools,http.server,json,os,subprocess,sys,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
CODE='''let clicks = 0
screen main "Broj" {
 input clicks label "Broj"
 button "Povećaj" runs increase
 show clicks
}
on increase { clicks = clicks + 1 }
'''
def main():
 p=argparse.ArgumentParser();p.add_argument('--site',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 project_root=Path(__file__).resolve().parents[1];root=a.site or project_root/'web';route='studio/workbench/' if a.site else 'workbench/'
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start();checks=[];errors=[]
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ.get('CLEA7_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);page=browser.new_page(accept_downloads=True);page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.goto(f'http://127.0.0.1:{server.server_port}/{route}',wait_until='networkidle');page.wait_for_function('()=>Boolean(globalThis.CLEA7StudioTests)')
   page.locator('#guided-start').click();page.locator('[data-panel="bil"]').click();page.locator('#bil-source').fill(CODE);page.locator('#bil-apply').click();page.wait_for_function("()=>CLEA7Workbench.project.bil?.source.includes('let clicks')")
   page.locator('[data-panel="test"]').click()
   def add(name,flow,values):
    page.locator('#studio-test-name').fill(name);page.select_option('#studio-test-flow',flow);page.locator('#studio-test-values').fill(json.dumps(values));page.select_option('#studio-test-screen','main');page.locator('#studio-test-add').click()
   add('Dva koraka i restart','increase',{'clicks':1});add('Dva koraka i restart','increase',{'clicks':2});add('Dva koraka i restart',':restart',{'clicks':2});add('Nova instanca','increase',{'clicks':1})
   before=page.evaluate('JSON.stringify(CLEA7Workbench.project)');page.locator('#studio-test-run').click();page.wait_for_function('()=>Boolean(CLEA7StudioTests.last)')
   proof=page.evaluate('CLEA7StudioTests.last');assert proof['passed'];assert page.evaluate('JSON.stringify(CLEA7Workbench.project)')==before
   assert len({e['pillar'] for receipt in proof['receipts'] for e in receipt['events'] if e.get('pillar')})==7
   checks.append('Actual BIL event sequences, independent test instances, restart persistence and screen assertions run through all seven responsibilities without modifying the project')
   with page.expect_download() as downloading:page.locator('#studio-test-export').click()
   exported=Path(downloading.value.path()).read_bytes();suite=json.loads(exported);(a.output/'exported.tests.json').write_bytes(exported)
   assert suite['format']=='clea7.project-tests/1' and len(suite['cases'])==2
   # Execute the identical file in the independently distributed public SDK.
   sdk=(a.site/'sdk-source').resolve() if a.site else project_root;destination=(a.output/'sdk-app').resolve()
   subprocess.run([sys.executable,'-m','clea7','project','new',str(destination)],cwd=sdk,check=True,capture_output=True)
   manifest=json.loads((destination/'project.json').read_text());(destination/manifest['entry']).write_text(CODE)
   test_path=manifest['tests'];assert isinstance(test_path,str);(destination/test_path).write_bytes(exported)
   result=subprocess.run([sys.executable,'-m','clea7','project','test',str(destination)],cwd=sdk,check=True,capture_output=True,text=True);assert json.loads(result.stdout)['passed']
   checks.append('The unchanged Studio-exported test suite passes in the independent public SDK using the same source')
   add('Pogrešna pretpostavka','increase',{'clicks':99});page.locator('#studio-test-run').click();page.wait_for_function('()=>Boolean(CLEA7StudioTests.last)');assert page.evaluate('CLEA7StudioTests.last.passed') is False
   assert 'NIJE PROŠAO' in page.locator('#studio-test-results').inner_text();assert page.evaluate('JSON.stringify(CLEA7Workbench.project)')==before
   checks.append('An incorrect expected value genuinely fails and leaves real application data/source untouched')
   count=len(page.evaluate('CLEA7StudioTests.suite.cases'));page.locator('#studio-test-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"format":"bad","cases":[]}'})
   page.wait_for_function("()=>document.getElementById('studio-test-status').textContent.includes('SDK test paket')");assert len(page.evaluate('CLEA7StudioTests.suite.cases'))==count
   page.locator('[data-panel="bil"]').click();page.locator('#bil-source').fill(CODE+'\n# new unsaved work\n');assert page.evaluate('CLEA7StudioTests.last') is None
   checks.append('Invalid suite imports preserve existing tests; source edits invalidate stale success evidence')
   assert not errors,errors;page.locator('[data-panel="test"]').click();page.screenshot(path=str(a.output/'studio-tests.png'),full_page=True)
   report={'format':'clea7.studio-behavior-tests-browser/1','passed':True,'checks':checks,'actualSDKRoundTrip':True,'actualNeuralInference':False,'errors':errors};(a.output/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
