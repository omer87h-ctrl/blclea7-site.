"""Actual Studio collection authoring, keyboard actions and independent Runtime.

All data are explicit synthetic test content. No neural/device/network fixture is
presented as a physical-device or production-backend result.
"""
import argparse,functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ORIGINAL='''# Keep developer code exactly
let existing = 7
fn own_logic(n: Number) -> Number { return n * 3 }
screen home "Home" {
    heading "Original application" key original_heading
    show existing key original_value
}
'''

def main():
 p=argparse.ArgumentParser();p.add_argument('--site',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 project=Path(__file__).resolve().parents[1];root=a.site or project/'web';prefix='studio/' if a.site else '';checks=[];errors=[];sample_root=project/'sdk-source' if a.site else project
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ.get('CLEA7_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
   context=browser.new_context(viewport={'width':1200,'height':900},accept_downloads=True);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   def author(page,source):
    page.goto(base+prefix+'workbench/',wait_until='networkidle');page.locator('#guided-start').click();page.locator('[data-panel="bil"]').click();page.locator('#bil-source').fill(source);page.locator('#bil-apply').click()
   author(page,ORIGINAL);owner=page.evaluate('CLEA7Workbench.project.id');panel=page.locator('#bil-card-collections');panel.locator('summary').click();page.locator('#bil-cards-id').fill('library');page.locator('#bil-cards-label').fill('Moje lekcije');page.locator('#bil-cards-add').click()
   authored=page.locator('#bil-source').input_value();assert 'fn own_logic(n: Number) -> Number { return n * 3 }' in authored;assert 'heading "Original application" key original_heading' in authored;assert 'cards library_items' in authored;assert page.evaluate('CLEA7Workbench.project.id')==owner
   page.locator('#bil-undo').click();assert page.locator('#bil-source').input_value()==ORIGINAL
   page.locator('#bil-cards-id').fill('library');page.locator('#bil-cards-add').click();page.locator('#bil-run').click();player=page.locator('#player');collection=player.get_by_role('region',name='Moje lekcije',exact=True)
   collection.get_by_text('Dodaj prvu vlastitu stavku.',exact=True).wait_for();assert page.evaluate('CLEA7Workbench.engine.state.bilValues.library_items')==[]
   checks.append('Actual visual collection insertion preserves original source/project, exact Undo and empty factual data')
   for title,detail in [('Prva lekcija','Moj sadržaj'),('Druga lekcija','Drugi sadržaj')]:
    player.get_by_label('Naziv stavke',exact=True).fill(title);player.get_by_label('Sadržaj stavke',exact=True).fill(detail);player.get_by_role('button',name='Dodaj stavku',exact=True).click();page.wait_for_function('(title)=>CLEA7Workbench.engine.state.bilValues.library_items.some(x=>x.title===title)',arg=title)
   action=collection.get_by_role('button',name='Otvori detalje · Druga lekcija',exact=True);action.focus();page.keyboard.press('Enter');page.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.library_shown_detail==="Drugi sadržaj"');assert page.evaluate('CLEA7Workbench.engine.state.bilValues.library_selected')=='library_2'
   search=collection.get_by_role('searchbox',name='Pretraži Moje lekcije');search.fill('Prva');assert collection.get_by_role('button',name='Otvori detalje · Prva lekcija',exact=True).is_visible();assert collection.get_by_role('button',name='Otvori detalje · Druga lekcija',exact=True).count()==0
   search.fill('NEMA_OVO');assert collection.get_by_text('Nema rezultata pretrage.',exact=True).is_visible();search.fill('')
   checks.append('Real typed inputs add records; keyboard card action, selection/details and search execute without AI')
   page.locator('[data-panel="build"]').click()
   with page.expect_download() as downloading:page.locator('#export-package').click()
   data=Path(downloading.value.path()).read_bytes();package=json.loads(data);assert package['manifest']['runtime']=='0.40.0';(a.output/'authored-cards.clea7').write_bytes(data)
   page.goto(base+prefix+'launcher/');page.wait_for_function('()=>globalThis.CLEA7Library');page.locator('#package-file').set_input_files({'name':'cards.clea7','mimeType':'application/json','buffer':data});page.get_by_role('button',name='Instaliraj',exact=True).click()
   with context.expect_page() as opening:page.locator('[data-app="'+owner+'"] .primary').click()
   app=opening.value;app.on('pageerror',lambda e:errors.append(str(e)));app.wait_for_function('()=>globalThis.CLEA7RuntimeApp?.engine');runtime=app.locator('#application');runtime.get_by_label('Naziv stavke',exact=True).fill('Nezavisni Runtime');runtime.get_by_label('Sadržaj stavke',exact=True).fill('Trajni lokalni zapis');runtime.get_by_role('button',name='Dodaj stavku',exact=True).click();app.wait_for_function('()=>CLEA7RuntimeApp.engine.state.bilValues.library_items.some(x=>x.title==="Nezavisni Runtime")');runtime.get_by_role('button',name='Otvori detalje · Nezavisni Runtime',exact=True).click();app.wait_for_function('()=>CLEA7RuntimeApp.engine.state.bilValues.library_shown_detail==="Trajni lokalni zapis"');app.reload();app.wait_for_function('()=>globalThis.CLEA7RuntimeApp?.engine?.state?.bilValues?.library_shown_detail==="Trajni lokalni zapis"');app.screenshot(path=str(a.output/'independent-runtime.png'),full_page=True);app.close()
   checks.append('Actual exported0.40 package installs, executes card actions and retains records/selection after independent Runtime reload')
   second=browser.new_context(viewport={'width':390,'height':844});learning=second.new_page();learning.on('pageerror',lambda e:errors.append(str(e)));learning.on('dialog',lambda d:d.accept());source=(sample_root/'sdk/examples/bil/cards-learning.bil').read_text();author(learning,source);learning.locator('#bil-run').click();surface=learning.locator('#player');surface.get_by_role('button',name='Otvori lekciju · Logički izazov',exact=True).click();learning.wait_for_function('()=>CLEA7Workbench.engine.state.bilScreen==="exercise"');surface.get_by_label('Tvoj odgovor',exact=True).fill('42');surface.get_by_role('button',name='Provjeri odgovor',exact=True).click();learning.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.score===10');surface.get_by_role('button',name='Provjeri odgovor',exact=True).click();assert learning.evaluate('CLEA7Workbench.engine.state.bilValues.score')==10;surface.get_by_role('button',name='Sve lekcije',exact=True).click();surface.get_by_role('button',name='Otvori lekciju · Pristupačan interfejs',exact=True).click();surface.get_by_label('Tvoj odgovor',exact=True).fill('Tab');surface.get_by_role('button',name='Provjeri odgovor',exact=True).click();learning.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.score===25');assert learning.evaluate('document.documentElement.scrollWidth<=innerWidth+2');learning.screenshot(path=str(a.output/'mobile-learning.png'),full_page=True)
   checks.append('Original non-business learning app runs both screens, validates answers, awards each task once and fits390px')
   third=browser.new_context(viewport={'width':1100,'height':800});grid=third.new_page();grid.on('pageerror',lambda e:errors.append(str(e)));grid.on('dialog',lambda d:d.accept())
   records=[]
   for i in range(14):
    title='<img src=x onerror=alert(1)>' if i==0 else 'Zapis '+str(i)
    key='quote"key[1]' if i==1 else 'row_'+str(i)
    records.append('new Row { id: '+json.dumps(key)+', title: '+json.dumps(title)+', detail: "Originalni sadržaj" }')
   grid_source='record Row {id: Text, title: Text, detail: Text}\nlet rows: List<Row> = ['+', '.join(records)+']\nlet chosen = ""\nlet shown = ""\non pick {for row in rows {if row.id == chosen {shown = row.title}}}\non reverse {rows = ['+', '.join('rows['+str(i)+']' for i in reversed(range(14)))+']}\non clear {rows = []}\non duplicate {rows = [rows[0], rows[0]]}\nscreen home "Grid" {\n cards rows label "Zapisi" fields [title, detail] identity id select chosen action "Pregled" runs pick key rows\n button "Obrni redoslijed" runs reverse key reverse\n button "Obriši sve" runs clear key clear\n button "Neispravni identiteti" runs duplicate key duplicate\n show shown\n}\n'
   author(grid,grid_source);grid.locator('#bil-run').click();area=grid.locator('#player');cards=area.get_by_role('region',name='Zapisi',exact=True);cards.locator('[data-card-action]').first.wait_for();assert cards.locator('[data-card-action]').count()==12;assert cards.locator('img,script').count()==0;assert cards.get_by_text('<img src=x onerror=alert(1)>',exact=True).count()==1
   cards.get_by_role('button',name='Sljedeća',exact=True).click();assert cards.locator('[data-card-action]').count()==2;cards.get_by_role('button',name='Prethodna',exact=True).click();late=cards.get_by_role('button',name='Pregled · Zapis 1',exact=True).element_handle();area.get_by_role('button',name='Obrni redoslijed',exact=True).click();grid.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.rows[0].id==="row_13"');late.evaluate('(b)=>b.click()');grid.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.shown==="Zapis 1"');assert grid.evaluate('CLEA7Workbench.engine.state.bilValues.chosen')=='quote"key[1]'
   area.get_by_role('button',name='Neispravni identiteti',exact=True).click();grid.wait_for_function('()=>document.querySelector("#player .bil-form-status").textContent.includes("identities")');assert grid.evaluate('CLEA7Workbench.engine.state.bilValues.rows.length')==14
   area.get_by_role('button',name='Obriši sve',exact=True).click();grid.wait_for_function('()=>CLEA7Workbench.engine.state.bilValues.rows.length===0');late.evaluate('(b)=>b.click()');grid.wait_for_function('()=>document.querySelector("#player .bil-form-status").textContent.includes("no longer available")');assert grid.evaluate('CLEA7Workbench.engine.state.bilValues.chosen')=='quote"key[1]'
   checks.append('Bounded12-row pagination, inert HTML text, quoted stable keys, reordered late clicks, duplicate-key rollback and deleted-key rejection work in actual DOM')
   gallery_source='backend device using "android.native/1"\nrecord Picture {id: Text, title: Text, photo: NativeMedia?}\nlet pictures: List<Picture> = [new Picture {id: "owned",title: "Originalni testni crtež",photo: new NativeMedia {handle: "fixture_owned",mime: "image/jpeg",width:4,height:4,bytes:64}}]\nlet selected = ""\non pick {selected = "owned"}\nscreen home "Gallery" {\n cards pictures label "Galerija" fields [title] identity id select selected image photo action "Otvori" runs pick key gallery\n}\n'
   # This fixture supplies only the trusted media URL boundary. Actual device
   # capture/server ownership enforcement is not claimed by this rendering check.
   grid.evaluate('''async source=>{
    const compiled=CLEA7BIL.compile(source),state=(await CLEA7BILRuntime.execute(compiled.ir,'main',compiled.application.state,{})).state;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=4;const brush=canvas.getContext('2d');brush.fillStyle='#15803d';brush.fillRect(0,0,4,4);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg'));const url=URL.createObjectURL(blob),root=document.createElement('main');root.id='card-media-fixture';document.body.append(root);
    let complete;const remote={mediaUrl:()=>new Promise(resolve=>{complete=resolve;})},engine={root,project:compiled.application,state,closed:false,principalEpoch:1,policy:{reducedMotion:true},bilCapabilities:{motion:false},kernel:{event(){}},remote,dispatch:async()=>{throw Error('Media fixture cannot execute an action.');}};
    CLEA7BILRuntime.render(root,engine);window.cardMediaFixture={engine,root,url,complete,photo:structuredClone(state.bilValues.pictures[0].photo)};
   }''',gallery_source)
   grid.evaluate('''()=>{const f=window.cardMediaFixture;f.engine.principalEpoch++;f.engine.state.bilValues.pictures[0].photo=null;CLEA7BILRuntime.refreshMedia(f.engine);f.complete(f.url);}''');grid.wait_for_timeout(30);assert grid.locator('#card-media-fixture img').get_attribute('src') is None
   grid.evaluate('''()=>{const f=window.cardMediaFixture;f.engine.state.bilValues.pictures[0].photo=f.photo;f.engine.remote.mediaUrl=async()=> 'https://example.invalid/not-owned.jpg';CLEA7BILRuntime.refreshUI(f.engine);}''');grid.wait_for_timeout(30);assert grid.locator('#card-media-fixture img').get_attribute('src') is None
   grid.evaluate('''()=>{const f=window.cardMediaFixture;f.engine.remote.mediaUrl=async()=>f.url;CLEA7BILRuntime.refreshMedia(f.engine);}''');grid.locator('#card-media-fixture').scroll_into_view_if_needed();grid.wait_for_function('()=>{const image=document.querySelector("#card-media-fixture img");return !image.hidden&&image.naturalWidth===4;}');grid.evaluate('()=>{const f=window.cardMediaFixture;f.engine.closed=true;URL.revokeObjectURL(f.url);f.root.remove();}')
   checks.append('Actual card image rendering decodes original JPEG bytes; explicit trusted-media fixture proves stale-principal suppression and arbitrary-URL denial, not physical camera/server ownership')
   assert errors==[],errors
   result={'format':'clea7.bil-cards-browser/1','passed':True,'checks':checks,'errors':errors,'actualNeuralInference':False,'physicalDeviceTested':False,'productionBackendTested':False,'trustedMediaBoundaryUsesExplicitFixture':True}
   (a.output/'browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False));browser.close()
 finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
