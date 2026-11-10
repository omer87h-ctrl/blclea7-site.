"""Real Studio additions to an existing app, gestures, state persistence and undo."""
import argparse,functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright

SOURCE='''let existing = 4
# Developer algorithm must remain byte-identical
fn own_logic(n: Number) -> Number { return n * 7 }
screen home "Home" {
    heading "Original application" key original_title
    show existing key original_value
    button "Existing action" runs original key original_button
}
screen other "Other" { heading "Other screen" key other_title }
on original { existing = own_logic(existing) }
start home
'''

def main():
 p=argparse.ArgumentParser();p.add_argument('--site',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 root=a.site or Path(__file__).resolve().parents[1]/'web';route='studio/workbench/' if a.site else 'workbench/';checks=[];errors=[]
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ.get('CLEA7_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
   context=browser.new_context(viewport={'width':1200,'height':900},has_touch=True,accept_downloads=True);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.goto(f'http://127.0.0.1:{server.server_port}/{route}',wait_until='networkidle');page.locator('#guided-start').click();page.locator('[data-panel="bil"]').click();page.locator('#bil-source').fill(SOURCE);page.locator('#bil-apply').click()
   identity=page.evaluate('CLEA7Workbench.project.id');page.locator('#bil-run').click();page.locator('#player').get_by_role('button',name='Existing action',exact=True).click();page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.existing===28')
   page.locator('[data-panel="bil"]').click()
   def add(kind,identifier,label):
    page.select_option('#bil-element-kind',kind);page.locator('#bil-element-id').fill(identifier);page.locator('#bil-element-label').fill(label);page.locator('#bil-element-add').click()
   add('progress','progress_meter','Napredak')
   assert 'progress_meter' in page.locator('#bil-source').input_value();assert 'fn own_logic(n: Number) -> Number { return n * 7 }' in page.locator('#bil-source').input_value();assert page.evaluate('CLEA7Workbench.project.id')==identity
   page.locator('#bil-undo').click();assert page.locator('#bil-source').input_value()==SOURCE
   checks.append('One visual addition and one Undo preserve the exact existing source, algorithm and project identity; no new app is created')
   add('progress','progress_meter','Napredak');page.locator('#bil-run').click();page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.progress_meter===0');assert page.evaluate('CLEA7Workbench.engine.state.bilValues.existing')==28
   for _ in range(12):page.locator('#player').get_by_role('button',name='Povećaj',exact=True).click()
   page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.progress_meter===100');assert page.locator('#player progress').evaluate('n=>n.value')==100
   checks.append('Real progress controls change persisted state, clamp to declared bounds and preserve previously saved application values')
   page.locator('[data-panel="bil"]').click();add('motion','moving_shape','Pokretni objekt');page.locator('#bil-run').click();page.locator('#player').get_by_role('button',name='Pomjeri desno',exact=True).click();page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.moving_shape===24')
   shape=page.locator('#player [data-bil-node="bilui_moving_shape_shape"]');shape.focus();page.keyboard.press('ArrowLeft');page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.moving_shape===0')
   shape.scroll_into_view_if_needed();box=shape.bounding_box();assert box;client=context.new_cdp_session(page);x=box['x']+box['width']/2;y=box['y']+box['height']/2
   client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]});client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+70,'y':y,'id':1}]});client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.moving_shape===24')
   page.locator('#player').get_by_role('button',name='Vrati položaj',exact=True).click();page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.moving_shape===0')
   checks.append('Actual Runtime movement, keyboard alternatives, CDP touch swipe and reset execute source-mapped handlers; no simulated animation data')
   page.locator('[data-panel="bil"]').click();page.select_option('#bil-element-kind','action');page.locator('#bil-element-id').fill('update_existing');page.locator('#bil-element-label').fill('Promijeni postojeće');page.select_option('#bil-element-target','existing');page.locator('#bil-element-amount').fill('3');page.locator('#bil-element-add').click();page.locator('#bil-run').click();page.locator('#player').get_by_role('button',name='Promijeni postojeće',exact=True).click();page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.existing===31')
   checks.append('Adding a behavior-connected button updates the pre-existing typed value without rewriting the old event or algorithm')
   page.locator('[data-panel="bil"]').click()
   for kind,identifier,label in [('text','profile_title','Moje ime'),('multiline','profile_bio','Biografija'),('number','profile_rating','Ocjena'),('toggle','profile_active','Uključeno'),('select','profile_group','Kategorija')]:add(kind,identifier,label)
   page.locator('#bil-run').click();player=page.locator('#player');player.get_by_label('Moje ime',exact=True).fill('Synthetic person');player.get_by_label('Moje ime',exact=True).press('Tab');player.get_by_label('Biografija',exact=True).fill('Local multiline\nSecond line');player.get_by_label('Biografija',exact=True).press('Tab');player.get_by_label('Ocjena',exact=True).fill('42');player.get_by_label('Ocjena',exact=True).press('Tab');player.get_by_label('Uključeno',exact=True).check();player.get_by_label('Kategorija',exact=True).select_option(label='Drugi')
   page.wait_for_function('()=>{const s=CLEA7Workbench.engine.state.bilValues;return s.profile_title==="Synthetic person"&&s.profile_bio.includes("Second line")&&s.profile_rating===42&&s.profile_active===true&&s.profile_group==="Drugi";}')
   checks.append('All five automatically bound field elements accept real typed input and update the same Runtime state')
   page.locator('[data-panel="bil"]').click();add('navigation','page_menu','Moji ekrani');page.locator('#bil-run').click();page.locator('#player').get_by_role('button',name='Other',exact=True).click();page.wait_for_function('()=>CLEA7Workbench.engine.state.bilScreen==="other"');assert page.locator('#player').get_by_role('heading',name='Other screen',exact=True).is_visible()
   checks.append('The reusable menu navigates existing screens through actual Runtime events')
   assert page.evaluate('CLEA7Workbench.project.id')==identity;assert not errors,errors
   page.locator('[data-panel="build"]').click()
   with page.expect_download() as downloading:page.locator('#export-project').click()
   data=Path(downloading.value.path()).read_bytes();app=json.loads(data);assert app['id']==identity and 'fn own_logic' in app['bil']['source'];(a.output/'extended-existing.clea7').write_bytes(data)
   report={'format':'clea7.working-elements-browser/1','passed':True,'checks':checks,'existingProjectPreserved':True,'actualCompilerAndRuntime':True,'actualCDPTouch':True,'neuralInference':False,'physicalDeviceEvaluation':False,'errors':errors};(a.output/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));browser.close()
 finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
