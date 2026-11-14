"""Actual functional drawing: Studio -> checked BIL -> Runtime -> package."""
import argparse,functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright

def main():
 p=argparse.ArgumentParser();p.add_argument('--site',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 root=a.site or Path(__file__).resolve().parents[1]/'web';prefix='studio/' if a.site else '';checks=[];errors=[]
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ.get('CLEA7_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.goto(base+prefix+'workbench/',wait_until='networkidle');page.wait_for_function('()=>globalThis.CLEA7Workbench&&globalThis.CLEA7Draw');page.locator('#guided-start').click();page.locator('[data-panel="draw"]').click();draw=page.locator('#draw-studio');draw.get_by_role('button',name='Novi Draw projekat',exact=True).click();page.wait_for_function('()=>document.querySelector("#draw-screen").options.length>0');identity=page.evaluate('CLEA7Workbench.project.id')
   def add(name,key,role,x,y):
    page.locator('#draw-name').fill(name);page.locator('#draw-id').fill(key);page.select_option('#draw-role',role);page.locator('#draw-x').fill(str(x));page.locator('#draw-y').fill(str(y));draw.get_by_role('button',name='Dodaj funkcionalni objekat',exact=True).click();page.wait_for_function('(key)=>CLEA7Draw.model(document.querySelector("#bil-source").value).objects.some(o=>o.key===key)',arg='draw7_'+key)
   add('Igrač','player','actor',80,160);add('Vrata','door','door',240,120);source=page.locator('#bil-source').input_value();assert 'draw7_near' in source and 'derive draw7_door_open' in source;assert page.evaluate('CLEA7Workbench.project.id')==identity;assert draw.locator('#draw-surface').evaluate('(n)=>n.namespaceURI')=='http://www.w3.org/2000/svg';assert draw.locator('canvas').count()==0
   checks.append('Actual Draw UI creates an actor and proximity door as checked source-mapped BIL with the same project identity and SVG geometry')
   draw.get_by_role('button',name='Pokreni aplikaciju',exact=True).click();page.wait_for_function('()=>CLEA7Workbench.engine?.state.bilValues.draw7_door_open===false');player=page.locator('#player');actor=player.locator('[data-bil-node="bilui_draw7_player"]');actor.focus()
   for value in [96,112,128]:page.keyboard.press('ArrowRight');page.wait_for_function('(x)=>CLEA7Workbench.engine.state.bilValues.draw7_player_x===x',arg=value);actor.focus()
   page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.draw7_door_open===true');assert player.locator('[data-bil-node="bilui_draw7_door"] path').evaluate('(n)=>n.getBBox().width')>0;assert page.evaluate('CLEA7Workbench.engine.state.bilValues.draw7_door_render_x')==302
   checks.append('Real Runtime keyboard events move the original drawing and open the door by the BIL proximity condition; the rendered SVG path is real')
   page.locator('[data-panel="draw"]').click();page.locator('#draw-hierarchy').get_by_role('button',name='Vrata · door',exact=True).click();draw.get_by_role('button',name='Objasni stvarno stanje',exact=True).click();assert 'Stvarno izvršavanje' in page.locator('#draw-explanation').inner_text();assert 'Vrata otvorena: Da' in page.locator('#draw-explanation').inner_text();assert 'draw7_near' in page.locator('#draw-explanation').inner_text()
   checks.append('Draw explains the actual running object state and exact checked BIL rule, without a model-generated explanation')
   # Draw a new original vector with actual pointer events, then keep its geometry.
   surface=page.locator('#draw-surface');box=surface.bounding_box();sx=box['x']+box['width']*.57;sy=box['y']+box['height']*.65
   page.mouse.move(sx,sy);page.mouse.down();page.mouse.move(sx+60,sy+5,steps=8);page.mouse.move(sx+75,sy+45,steps=8);page.mouse.move(sx+5,sy+50,steps=8);page.mouse.up();page.locator('#draw-name').fill('Moj crtež');page.locator('#draw-id').fill('sketch');page.select_option('#draw-role','object');draw.get_by_role('button',name='Dodaj funkcionalni objekat',exact=True).click();page.wait_for_function('()=>CLEA7Draw.model(document.querySelector("#bil-source").value).objects.length===3');assert page.evaluate('CLEA7Draw.model(document.querySelector("#bil-source").value).objects.find(o=>o.key==="draw7_sketch").points.length')>5
   page.locator('[data-panel="bil"]').click();page.locator('#bil-undo').click();assert page.locator('#bil-source').input_value()==source;page.locator('[data-panel="draw"]').click()
   checks.append('Actual freehand pointer input becomes bounded vector points; exact shared Undo restores the previous complete BIL source')
   page.locator('#draw-hierarchy').get_by_role('button',name='Igrač · actor',exact=True).click();page.locator('#draw-edit-x').fill('100');page.locator('#draw-edit-y').fill('160');draw.get_by_role('button',name='Primijeni početni položaj',exact=True).click();assert 'draw7_player_x = 100' in page.locator('#bil-source').input_value();draw.get_by_role('button',name='Pokreni aplikaciju',exact=True).click();page.wait_for_function('()=>CLEA7Workbench.engine?.state.bilValues.draw7_player_x===128');player.get_by_role('button',name='Vrati Draw položaje',exact=True).click();page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.draw7_player_x===100');assert page.evaluate('CLEA7Workbench.engine.state.bilValues.draw7_door_open') is False
   checks.append('Initial-layout editing preserves saved gameplay position until the explicit compiled reset action applies the new position')
   page.locator('[data-panel="draw"]').click();draw.get_by_role('button',name='Izvezi aplikaciju',exact=True).click()
   with page.expect_download() as downloading:page.locator('#export-package').click()
   data=Path(downloading.value.path()).read_bytes();package=json.loads(data);assert package['manifest']['runtime']=='0.40.0';(a.output/'draw-door.clea7').write_bytes(data);(a.output/'draw-door.bil').write_text(page.locator('#bil-source').input_value())
   page.goto(base+prefix+'launcher/');page.wait_for_function('()=>globalThis.CLEA7Library');page.locator('#package-file').set_input_files({'name':'draw-door.clea7','mimeType':'application/json','buffer':data});page.get_by_role('button',name='Instaliraj',exact=True).click()
   with context.expect_page() as opening:page.locator('[data-app="'+identity+'"] .primary').click()
   app=opening.value;app.on('pageerror',lambda e:errors.append(str(e)));app.wait_for_function('()=>globalThis.CLEA7RuntimeApp?.engine');runtime=app.locator('#application');runtime.get_by_role('button',name='Igrač · Desno',exact=True).click();app.wait_for_function('()=>CLEA7RuntimeApp.engine.state.bilValues.draw7_player_x===116');runtime.get_by_role('button',name='Igrač · Desno',exact=True).click();app.wait_for_function('()=>CLEA7RuntimeApp.engine.state.bilValues.draw7_door_open===true');app.reload();app.wait_for_function('()=>globalThis.CLEA7RuntimeApp?.engine?.state?.bilValues?.draw7_door_open===true');app.set_viewport_size({'width':390,'height':844});assert app.evaluate('document.documentElement.scrollWidth<=innerWidth+2');app.screenshot(path=str(a.output/'draw-runtime-mobile.png'),full_page=True);app.close()
   checks.append('Same exported package installs and executes drawing/controls/proximity in independent Runtime, persists through reload and fits390px')
   assert errors==[],errors
   result={'format':'clea7.draw-browser/1','passed':True,'checks':checks,'errors':errors,'actualNeuralInference':False,'physicalDeviceTested':False,'fullPhysicsEngineClaimed':False};(a.output/'browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False));browser.close()
 finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
