"""BIL SDK bridge and bounded native envelope validation.

The single original lexer/type checker lives in web/workbench/bil-compiler.js.
Native hosts validate data-only envelopes here; the execution host recompiles
source and compares canonical IR before executing any BIL instruction. No Node
installation is needed by the packaged Windows or Android Runtime.
"""
import json
import re
import shutil
import subprocess
from pathlib import Path
from .schema import UserError

KEY=re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,63}$')
def safe(value):
    return isinstance(value,str) and KEY.fullmatch(value) and value not in ('constructor','prototype','__proto__')

NATIVE_TYPES={'NativeMedia':{'handle':'Text','mime':'Text','width':'Number','height':'Number','bytes':'Number'},'NativeLocation':{'latitude':'Number','longitude':'Number','accuracy':'Number','timestamp':'Number'},'NativeReceipt':{'posted':'Boolean','id':'Number'}}
NATIVE_OPS={'camera.capture':(0,'NativeMedia'),'media.pick':(0,'NativeMedia'),'media.list':(0,'NativeMediaList'),'media.inspect':(1,'NativeMedia'),'media.remove':(1,'Boolean'),'location.current':(0,'NativeLocation'),'notification.post':(1,'NativeReceipt')}
REMOTE_OPS=frozenset(('auth.register','auth.session','auth.signIn','auth.signOut','document.delete','document.get','document.set','document.add','query.list','query.documents','observe.query.documents','observe.document.get','observe.query.list'))

def validate_remote(value):
    if not isinstance(value,dict) or set(value)!={'format','backends'} or value['format']!='bil.remote/1' or not isinstance(value['backends'],dict) or not 1<=len(value['backends'])<=4:raise UserError('Neispravan BIL remote ugovor.')
    for name,backend in value['backends'].items():
        if not safe(name) or not isinstance(backend,dict) or set(backend)!={'adapter','operations'} or backend['adapter'] not in ('firebase.development/1','firebase.development/2','firebase.development/3','android.native/1'):raise UserError('Nepodržan udaljeni adapter.')
        operations=backend['operations']
        if not isinstance(operations,list) or any(not isinstance(op,str) or (op not in (NATIVE_OPS if backend['adapter']=='android.native/1' else REMOTE_OPS) or op in ('query.documents','observe.query.documents') and backend['adapter']!='firebase.development/3' or backend['adapter']=='firebase.development/1' and (op in ('query.list','query.documents','document.add') or op.startswith('observe.'))) for op in operations) or operations!=sorted(set(operations)):raise UserError('Neispravne udaljene operacije.')
    return value


STYLE_NUMBERS={'width':(0,4096),'height':(0,4096),'minWidth':(0,4096),'maxWidth':(0,4096),'padding':(0,128),'gap':(0,128),'radius':(0,256),'borderWidth':(0,16),'fontSize':(8,120),'fontWeight':(100,900),'opacity':(0,1),'x':(-4096,4096),'y':(-4096,4096),'rotate':(-3600,3600),'scale':(0,8),'gradientAngle':(0,360)}
STYLE_COLOURS={'background','color','borderColor','gradientFrom','gradientTo'}
STYLE_ENUMS={'direction':['row','column'],'align':['start','center','end','stretch'],'justify':['start','center','end','space-between','space-around'],'wrap':['wrap','nowrap'],'position':['relative','absolute'],'textAlign':['left','center','right'],'font':['system','mono','serif'],'shadow':['none','soft','lifted']}
SHAPES={'circle','square','diamond','triangle','ring'}
GESTURES={'tap','swipeLeft','swipeRight','press'}
def validate_presentation_node(node,ir):
    style=node.get('style',{})
    if not isinstance(style,dict) or not set(style)<=set(STYLE_NUMBERS)|STYLE_COLOURS|set(STYLE_ENUMS):raise UserError('Nepodržana vizuelna svojstva.')
    for key,value in style.items():
        if isinstance(value,dict):
            if set(value)!={'bind'} or key not in STYLE_NUMBERS or not isinstance(value['bind'],str) or ir['globals'].get(value['bind'],{}).get('type')!='Number':raise UserError('Vizuelna veza zahtijeva deklarisani Number.')
        elif key in STYLE_COLOURS:
            if not isinstance(value,str) or not (re.fullmatch(r'#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?',value) or value in ('transparent','inherit')):raise UserError('Nedozvoljena vizuelna boja.')
        elif key in STYLE_ENUMS:
            if value not in STYLE_ENUMS[key]:raise UserError('Nepodržan vizuelni izbor.')
        elif key in ('width','height') and value in ('fill','auto'):pass
        elif type(value) not in (int,float) or not STYLE_NUMBERS[key][0]<=value<=STYLE_NUMBERS[key][1]:raise UserError('Vizuelna vrijednost prelazi dozvoljeni raspon.')
    if ('gradientFrom' in style)!=('gradientTo' in style):raise UserError('Gradijent zahtijeva obje boje.')
    if node['type']=='shape' and (not isinstance(node.get('geometry'),str) or node.get('geometry') not in SHAPES):raise UserError('Nepodržan geometrijski element.')
    if 'motion' in node:
        motion=node['motion']
        if not isinstance(motion,dict) or set(motion)!={'preset','duration'} or motion['preset'] not in ('none','fade','slide','move','scale') or type(motion['duration']) is not int or not 0<=motion['duration']<=2000:raise UserError('Neispravan ugovor animacije.')
    if 'gestures' in node:
        gestures=node['gestures']
        if node['type'] not in ('row','card','heading','text','shape') or not isinstance(gestures,dict) or not set(gestures)<=GESTURES:raise UserError('Neispravan ugovor gesti.')
        for key,event in gestures.items():
            if not isinstance(event,dict) or set(event)!={'handler','entry'} or not safe(event['handler']) or not safe(event['entry']) or event['handler'] not in ir['handlers'] or event['entry'] not in ir['handlers'] or event['handler'] in ir.get('events',{}).get('handlers',{}):raise UserError('Gesta treba postojeću običnu radnju.')
            code=ir['handlers'][event['entry']]
            if len(code)!=1 or code[0].get('op')!='UI_EVENT' or code[0].get('control')!=node['id'] or code[0].get('gesture')!=key:raise UserError('Izvršni ugovor geste ne odgovara komponenti.')

def validate_program(project):
    live=project.get('format')=='clea7.application/9'
    asynchronous=live or project.get('format')=='clea7.application/8'
    remote=asynchronous or project.get('format')=='clea7.application/7'
    extended=remote or project.get('format')=='clea7.application/6'
    version=5 if live else 4 if asynchronous else 3 if remote else 2 if extended else 1
    bundle=project.get('bil')
    if not isinstance(bundle,dict) or set(bundle)!={'format','source','ir'} or bundle['format']!='bil.program/'+str(version):raise UserError('Neispravna BIL omotnica.')
    source=bundle['source'];ir=bundle['ir']
    if not isinstance(source,str) or len(source)>131072 or not isinstance(ir,dict) or set(ir)!=({'format','language','globals','records','imports','functions','handlers','main','controls','sourceMap'}|({'ui'} if extended else set())|({'remote'} if remote else set())|({'events'} if asynchronous else set())) or ir['format']!='bil.ir/'+str(version) or ir['language']!='bil/'+str(version):raise UserError('Nepodržan BIL ugovor.')
    rich_ui=isinstance(ir.get('ui'),dict) and ir['ui'].get('format')=='bil.ui/2'
    for key in ('globals','records','functions','handlers'):
        if not isinstance(ir[key],dict) or len(ir[key])>(4224 if rich_ui and key=='handlers' else 128 if rich_ui and key in ('globals','functions') else 192 if extended and key=='handlers' else 64) or any(not safe(k) for k in ir[key]):raise UserError('Neispravni BIL simboli.')
    if not isinstance(ir['imports'],list) or len(ir['imports'])>3 or any(x not in ('math','text','collections') for x in ir['imports']):raise UserError('Nedozvoljen BIL modul.')
    if not isinstance(ir['main'],list) or not isinstance(ir['sourceMap'],list) or len(ir['sourceMap'])>8000 or not isinstance(ir['controls'],list) or len(ir['controls'])>64:raise UserError('Neispravan BIL plan.')
    count=0
    def walk(value,depth=0):
        nonlocal count
        count+=1
        if count>50000 or depth>100:raise UserError('BIL prelazi strukturni budžet.')
        if isinstance(value,dict):
            for k,v in value.items():
                if k in ('constructor','prototype','__proto__'):raise UserError('Nedozvoljen BIL ključ.')
                walk(v,depth+1)
        elif isinstance(value,list):
            if len(value)>8000:raise UserError('BIL lista prelazi budžet.')
            for v in value:walk(v,depth+1)
        elif value is not None and type(value) not in (str,int,float,bool):raise UserError('BIL treba podatkovne vrijednosti.')
    walk(ir)
    completion_type={'record':{'requestId':'Text','sourceId':'Text','backend':'Text','operation':'Text'},'name':'RemoteCompletion'}
    remote_failure_type={'record':{'code':'Text','message':'Text','uncertain':'Boolean'},'name':'RemoteFailure'}
    update_type={'record':{'subscriptionId':'Text','sourceId':'Text','backend':'Text','operation':'Text','sequence':'Number','kind':'Text'},'name':'RemoteUpdate'}
    events={}
    if asynchronous:
        contract=ir['events']
        if not isinstance(contract,dict) or set(contract)!={'format','handlers'} or contract['format']!='bil.events/1' or not isinstance(contract['handlers'],dict) or not (0 if live else 1)<=len(contract['handlers'])<=64:raise UserError('Neispravan ugovor završnih događaja.')
        events=contract['handlers']
        for name,params in events.items():
            if not safe(name) or name not in ir['handlers'] or not isinstance(params,list) or len(params)!=2:raise UserError('Neispravan završni događaj.')
            if any(not isinstance(p,dict) or set(p)!={'name','type'} or not safe(p['name']) or p['name'] in ir['globals'] for p in params) or params[0]['name']==params[1]['name'] or params[1]['type']!=completion_type and not (live and params[1]['type']==update_type):raise UserError('Neispravni parametri završnog događaja.')
    used_events=set();watches=set();cancellations=set()
    if remote:
        validate_remote(project.get('remote'));validate_remote(ir.get('remote'))
        if not live and any(b['adapter'] in ('firebase.development/3','android.native/1') for b in ir['remote']['backends'].values()):raise UserError('Adapter3 zahtijeva BIL5 aplikacijski ugovor.')
        if project['remote']!=ir['remote']:raise UserError('Udaljene mogućnosti ne odgovaraju BIL izvoru.')
        actual={name:set() for name in ir['remote']['backends']}
        def requests(value):
            if isinstance(value,list):
                for entry in value:requests(entry)
            elif isinstance(value,dict):
                if value.get('op') in ('REQUEST','WATCH'):
                    if set(value)!=({'op','id','loc','backend','operation','args','target','error','resultType'}|({'completion'} if asynchronous and 'completion' in value else set())|({'subscription','interval'} if live and value.get('op')=='WATCH' else set())) or not isinstance(value.get('backend'),str) or value['backend'] not in actual or not isinstance(value.get('operation'),str) or value['operation'] not in (NATIVE_OPS if ir['remote']['backends'][value['backend']]['adapter']=='android.native/1' else REMOTE_OPS) or not isinstance(value.get('args'),list) or not safe(value.get('target')) or not safe(value.get('error')) or value['target'] not in ir['globals'] or value['error'] not in ir['globals']:raise UserError('Neispravan udaljeni BIL zahtjev.')
                    target=ir['globals'][value['target']];error=ir['globals'][value['error']]
                    if not isinstance(target,dict) or target.get('mutable') is not True or value['resultType']!=target.get('type'):raise UserError('Tip udaljenog rezultata ne odgovara stanju.')
                    failure_type=error.get('type',{}) if isinstance(error,dict) else {}
                    failure=failure_type.get('nullable',{}) if isinstance(failure_type,dict) else {}
                    if not isinstance(error,dict) or error.get('mutable') is not True or not isinstance(failure,dict) or failure.get('record')!={'code':'Text','message':'Text','uncertain':'Boolean'} or value['target']==value['error']:raise UserError('Udaljeni zahtjev treba odvojeni promjenjivi nullable RemoteFailure rezultat.')
                    if value['operation'].startswith('observe.') or (value['operation'] in ('query.list','query.documents','document.add') or value['op']=='WATCH') and ir['remote']['backends'][value['backend']]['adapter'] not in ('firebase.development/2','firebase.development/3') or value['operation']=='query.documents' and ir['remote']['backends'][value['backend']]['adapter']!='firebase.development/3':raise UserError('Neispravan adapter za upit ili pretplatu.')
                    result=value['resultType'];nullable=isinstance(result,dict) and 'nullable' in result
                    result_type=result['nullable'] if nullable else result
                    if ir['remote']['backends'][value['backend']]['adapter']=='android.native/1':
                        native_result=NATIVE_OPS[value['operation']][1]
                        expected={'list':{'record':NATIVE_TYPES['NativeMedia'],'name':'NativeMedia'}} if native_result=='NativeMediaList' else 'Boolean' if native_result=='Boolean' else {'record':NATIVE_TYPES[native_result],'name':native_result}
                        if result_type!=expected:raise UserError('Native rezultat ne odgovara registrovanom tipu.')
                    elif value['operation'].startswith('auth.') and value['operation']!='auth.signOut':
                        if not isinstance(result_type,dict) or result_type.get('record')!={'uid':'Text','email':'Text'} or value['operation']=='auth.session' and not nullable:raise UserError('Autentifikacija treba provjeren RemoteSession rezultat.')
                    elif value['operation']=='document.get':
                        if not nullable or not isinstance(result_type,dict) or not isinstance(result_type.get('record'),dict):raise UserError('Dokument treba nullable Record rezultat.')
                    elif value['operation']=='document.add':
                        if not isinstance(result_type,dict) or result_type.get('record')!={'id':'Text','path':'Text'}:raise UserError('Kreiranje treba RemoteDocument rezultat.')
                    elif value['operation'] in ('query.list','query.documents'):
                        if not isinstance(result,dict) or not isinstance(result.get('list'),dict) or not isinstance(result['list'].get('record'),dict):raise UserError('Upit treba List<Record> rezultat.')
                        if value['operation']=='query.documents':
                            fields=result['list']['record']
                            if set(fields)!={'id','path','value'} or fields['id']!='Text' or fields['path']!='Text' or not isinstance(fields['value'],dict) or not isinstance(fields['value'].get('record'),dict):raise UserError('Identificirani upit treba id, path i tipizirani value Record.')
                    elif result!='Boolean':raise UserError('Udaljena izmjena treba Boolean rezultat.')
                    expected_args=(NATIVE_OPS[value['operation']][0] if value['operation'] in NATIVE_OPS else {'auth.session':0,'auth.register':0,'auth.signIn':0,'auth.signOut':0,'document.get':1,'document.set':2,'document.delete':1,'query.list':2,'query.documents':2,'document.add':2}[value['operation']])
                    if len(value['args'])!=expected_args:raise UserError('Udaljeni zahtjev ima neispravan broj argumenata.')
                    if 'completion' in value:
                        completion=value['completion']
                        if not isinstance(completion,dict) or set(completion)!=({'success','error','stopped'} if value['op']=='WATCH' else {'success','error'}) or any(not isinstance(h,str) or h not in events for h in completion.values()):raise UserError('Neispravni završni handleri zahtjeva.')
                        if events[completion['success']][0]['type']!=value['resultType'] or events[completion['error']][0]['type']!=remote_failure_type:raise UserError('Tipovi završnog događaja ne odgovaraju zahtjevu.')
                        meta=update_type if value['op']=='WATCH' else completion_type
                        if any(events[name][1]['type']!=meta for name in completion.values()):raise UserError('Kontekst događaja ne odgovara vrsti operacije.')
                        if value['op']=='WATCH' and events[completion['stopped']][0]['type']!='Boolean':raise UserError('Otkazivanje treba Boolean događaj.')
                        used_events.update(completion.values())
                    if value['op']=='WATCH':
                        if not live or value['operation'] not in ('document.get','query.list','query.documents') or not safe(value['subscription']) or value['subscription'] in watches or type(value['interval']) is not int or not 1000<=value['interval']<=60000 or 'completion' not in value:raise UserError('Neispravna pretplata.')
                        watches.add(value['subscription']);actual[value['backend']].add('observe.'+value['operation'])
                    actual[value['backend']].add(value['operation'])
                if value.get('op')=='UNWATCH':
                    if not live or set(value)!={'op','id','loc','subscription'} or not safe(value['subscription']):raise UserError('Neispravno otkazivanje pretplate.')
                    cancellations.add(value['subscription'])
                for entry in value.values():requests(entry)
        for block in (ir['main'],ir['handlers'],ir['functions']):requests(block)
        if any(sorted(actual[name])!=backend['operations'] for name,backend in ir['remote']['backends'].items()):raise UserError('Deklarisane udaljene operacije ne odgovaraju izvršnom planu.')
    if len(watches)>4 or not cancellations<=watches:raise UserError('Nepoznata pretplata ili prekoračen budžet.')
    if set(events)!=used_events:raise UserError('Završni događaji moraju biti povezani sa provjerenim zahtjevom.')
    def default(t,depth=0):
        if depth>16:raise UserError('BIL tip je predubok.')
        if t=='Number':return 0
        if t=='Text':return ''
        if t=='Boolean':return False
        if not isinstance(t,dict):raise UserError('Nepodržan sačuvani BIL tip.')
        if set(t)=={'nullable'}:default(t['nullable'],depth+1);return None
        if set(t)=={'list'}:default(t['list'],depth+1);return []
        if set(t) in ({'record'},{'record','name'}) and isinstance(t['record'],dict) and len(t['record'])<=64 and all(safe(k) for k in t['record']):return {k:default(v,depth+1) for k,v in t['record'].items()}
        raise UserError('Neispravan BIL tip.')
    initial={}
    for name,symbol in ir['globals'].items():
        if not isinstance(symbol,dict) or set(symbol)!={'type','mutable'} or type(symbol['mutable']) is not bool:raise UserError('Neispravan BIL simbol.')
        initial[name]=default(symbol['type'])
    expected_state={'bilValues':initial,'bilViews':[],'bilMotion':[]}
    if extended:
        ui=ir['ui']
        if not isinstance(ui,dict) or set(ui)!={'format','start','screens'} or ui['format'] not in ('bil.ui/1','bil.ui/2') or not isinstance(ui['screens'],list) or len(ui['screens'])>(64 if rich_ui else 32):raise UserError('Neispravan BIL UI ugovor.')
        screens=set();node_ids=set()
        def nodes(items,depth=0):
            if not isinstance(items,list) or depth>8:raise UserError('Neispravan BIL raspored.')
            for n in items:
                if not isinstance(n,dict) or not safe(n.get('id')) or n['id'] in node_ids or n.get('type') not in (('row','card','heading','text','input','select','toggle','table','view','button','image','shape') if rich_ui else ('row','card','heading','text','input','select','toggle','table','view','button','image')):raise UserError('Neispravna BIL komponenta.')
                if rich_ui:validate_presentation_node(n,ir)
                elif any(key in n for key in ('style','motion','geometry','gestures')):raise UserError('Napredni prikaz zahtijeva bil.ui/2.')
                node_ids.add(n['id'])
                if len(node_ids)>(1024 if rich_ui else 128):raise UserError('Previše BIL komponenti.')
                if n.get('name') is not None and n['name'] not in ir['globals']:raise UserError('BIL komponenta koristi nepoznato stanje.')
                if n.get('entry') is not None and n['entry'] not in ir['handlers']:raise UserError('BIL komponenta koristi nepoznat događaj.')
                if 'children' in n:nodes(n['children'],depth+1)
        for screen in ui['screens']:
            if not isinstance(screen,dict) or set(screen)!={'id','label','loc','children'} or not safe(screen['id']) or screen['id'] in screens or not isinstance(screen['label'],str):raise UserError('Neispravan BIL ekran.')
            screens.add(screen['id']);nodes(screen['children'])
        if (ui['screens'] and ui['start'] not in screens) or (not ui['screens'] and ui['start']!=''):raise UserError('BIL početni ekran nije deklarisan.')
        expected_state['bilScreen']=ui['start']
    expected_permissions=sorted({{'camera.capture':'camera','location.current':'location','notification.post':'notifications'}[op] for b in ir.get('remote',{}).get('backends',{}).values() if b['adapter']=='android.native/1' for op in b['operations'] if op in ('camera.capture','location.current','notification.post')})
    if project['state']!=expected_state or sorted(project['permissions'])!=expected_permissions or project['tables']:raise UserError('BIL početno stanje ili dozvole ne odgovaraju ugovoru.')
    expected={'bil_main':[{'action':'bil','block':'main'}]}
    for name,body in ir['handlers'].items():
        if name=='main' or len(name)>60 or not isinstance(body,list):raise UserError('Neispravan BIL događaj.')
        expected['bil_'+name]=[{'action':'bil','block':name}]
    if project['flows']!=expected:raise UserError('BIL tokovi ne odgovaraju programu.')
    controls=[]
    for c in ir['controls']:
        if not isinstance(c,dict) or set(c)!={'id','label','handler'} or not safe(c['id']) or not isinstance(c['label'],str) or c['handler'] not in ir['handlers'] or c['handler'] in events:raise UserError('Neispravna BIL kontrola.')
        controls.append({'id':c['id'],'type':'button','text':c['label'],'events':{'click':'bil_'+c['handler']}})
    if project['screens']!=[{'id':'home','name':'BIL','children':[{'id':'bil_surface','type':'bil'},*controls]}] or project['start']!='home':raise UserError('BIL prikaz se uređuje preko BIL izvora.')
    return project

def request(payload):
    node=shutil.which('node')
    if not node:raise UserError('BIL SDK kompajler zahtijeva Node.js 22+. Zapakovani Runtime ga ne zahtijeva.')
    runner=Path(__file__).resolve().parents[1]/'sdk/bil-cli.cjs'
    try:result=subprocess.run([node,'--max-old-space-size=128',str(runner)],input=json.dumps(payload),capture_output=True,text=True,encoding='utf-8',timeout=20,shell=False)
    except subprocess.TimeoutExpired:raise UserError('BIL SDK prekoračio je rok.') from None
    if len(result.stdout)>4*1024*1024:raise UserError('BIL SDK rezultat prelazi budžet.')
    if result.returncode or not result.stdout:raise UserError(result.stderr[-2000:] or 'BIL provjera nije prošla.')
    try:return json.loads(result.stdout)
    except ValueError:raise UserError('BIL SDK vratio je neispravan odgovor.') from None
