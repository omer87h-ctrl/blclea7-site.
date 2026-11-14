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
SENSE_OPS={'speech.speak':(1,'Boolean'),'speech.listen':(1,'Text'),'speech.stop':(0,'Boolean'),'document.docx':(1,'Boolean'),'haptic.cue':(1,'Boolean')}
IMAGE_OPS={'image.choose':(0,'NativeMedia'),'image.upload':(2,'RemoteImage'),'image.load':(1,'NativeMedia'),'image.remove':(1,'Boolean'),'image.discard':(1,'Boolean')}
IMAGE_TYPES={**NATIVE_TYPES,'RemoteImage':{'path':'Text'}}
REMOTE_OPS=frozenset(('auth.register','auth.session','auth.signIn','auth.signOut','document.delete','document.get','document.set','document.add','query.list','query.documents','observe.query.documents','observe.document.get','observe.query.list'))

# These are feature names, not executable Python operations. The execution host
# recompiles BIL source and checks canonical IR; this native envelope validator
# can inspect the already bounded IR without requiring an installed Node runtime.
CORE2_OPERATIONS=frozenset(('text.normalize','text.includes','text.trim',
    'text.codePointLength','text.sliceCodePoints','text.split','text.join',
    'collections.contains','collections.slice','collections.concat','collections.unique'))
CORE3_OPERATIONS=frozenset(('json.encode','json.decode'))

def core_features(project):
    """Return structural feature requirements from a validated application.

    This is not a second lexer/compiler. Full source/IR integrity remains the
    trusted host compiler's responsibility before execution. Core feature
    markers are verified again by that authoritative compiler.
    """
    ir=project.get('bil',{}).get('ir',{}) if isinstance(project,dict) else {}
    used=set()
    def inspect(value):
        if isinstance(value,list):
            for child in value:inspect(child)
        elif isinstance(value,dict):
            if value.get('op')=='CALL' and value.get('call') in CORE2_OPERATIONS:used.add(value['call'])
            if value.get('op')=='CALL' and value.get('call') in CORE3_OPERATIONS:used.add(value['call'])
            if value.get('op')=='STORE_NEW' and value.get('coreFeature')=='derive':used.add('derive')
            if value.get('op')=='LOOP_WHILE':used.add('while')
            for child in value.values():
                if isinstance(child,(list,dict)):inspect(child)
    # validate_program bounds this structure before packaging uses this helper.
    for value in (ir.get('main',[]),ir.get('functions',{}),ir.get('handlers',{})):inspect(value)
    for item in ir.get('sourceMap',[]):
        if isinstance(item,dict) and item.get('coreFeature') in ('guard','derive','while'):used.add(item['coreFeature'])
    version=3 if used & (CORE3_OPERATIONS|{'derive','while'}) else 2 if used else 1
    return {'format':'bil.core.features/1','version':version,
            'minimumRuntime':'0.18.0' if version==3 else '0.17.0' if used else '0.6.0','used':sorted(used)}

def validate_derive_markers(ir):
    """Check the new bounded native metadata, not a second source compiler.

    The trusted execution host still recompiles source and compares the whole
    IR. This structural check prevents accepting malformed declarations or a
    source-map marker as proof of a valid derivation.
    """
    declarations={}
    markers={}
    while_markers={}
    while_nodes={}
    for item in ir['sourceMap']:
        if not isinstance(item,dict) or 'coreFeature' not in item:continue
        feature=item['coreFeature']
        if feature=='guard' and item.get('op')=='BRANCH':continue
        if feature not in ('derive','while') or item.get('op')!=('STORE_NEW' if feature=='derive' else 'LOOP_WHILE') or not safe(item.get('id')):
            raise UserError('Nepoznata BIL Core mogućnost u source mapi.')
        if set(item)!={'id','op','coreFeature','line','column','start','end'}:
            raise UserError('Neispravna BIL derive source mapa.')
        if item['id'] in markers or item['id'] in while_markers:raise UserError('Duplirana BIL Core source mapa.')
        (markers if feature=='derive' else while_markers)[item['id']]=item

    def loads(value):
        result=set()
        if isinstance(value,list):
            for child in value:result.update(loads(child))
        elif isinstance(value,dict):
            if value.get('op')=='LOAD' and isinstance(value.get('name'),str):result.add(value['name'])
            for child in value.values():
                if isinstance(child,(dict,list)):result.update(loads(child))
        return result

    seen=set()
    for statement in ir['main']:
        if not isinstance(statement,dict):continue
        if statement.get('coreFeature')=='derive':
            required={'op','id','loc','name','mutable','global','declaredType','value','coreFeature','dependencies'}
            name=statement.get('name');identifier=statement.get('id');deps=statement.get('dependencies')
            symbol=ir['globals'].get(name) if isinstance(name,str) else None
            if set(statement)!=required or statement.get('op')!='STORE_NEW' or not safe(identifier) or not safe(name) or statement.get('mutable') is not False or statement.get('global') is not True:
                raise UserError('Neispravna BIL derive deklaracija.')
            if not isinstance(symbol,dict) or symbol.get('mutable') is not False or statement['declaredType']!=symbol.get('type'):
                raise UserError('BIL derive mora odgovarati nepromjenjivom globalnom tipu.')
            if not isinstance(deps,list) or any(not safe(dep) or dep not in seen or dep==name for dep in deps) or deps!=sorted(set(deps)) or set(deps)!=loads(statement['value']):
                raise UserError('BIL derive zavisnosti ne odgovaraju ranijem globalnom stanju.')
            if identifier in declarations or identifier not in markers:
                raise UserError('BIL derive nema jedinstvenu source mapu.')
            marker=markers[identifier];location=statement.get('loc')
            if not isinstance(location,dict) or set(location)!={'line','column','start','end'} or any(type(location.get(k)) is not int for k in location) or location['line']<1 or location['column']<1 or location['start']<0 or location['end']<location['start'] or any(marker.get(k)!=location.get(k) for k in ('line','column','start','end')):
                raise UserError('BIL derive source lokacija ne odgovara deklaraciji.')
            declarations[identifier]=statement
        if statement.get('op')=='STORE_NEW' and statement.get('global') is True and isinstance(statement.get('name'),str):seen.add(statement['name'])
    if set(markers)!=set(declarations):raise UserError('BIL derive marker nema odgovarajuću deklaraciju.')

    def inspect(value):
        if isinstance(value,list):
            for child in value:inspect(child)
        elif isinstance(value,dict):
            if 'op' in value and 'id' in value:
                if value['op']=='LOOP_WHILE':
                    required={'op','id','loc','condition','limit','body','coreFeature'}
                    identifier=value.get('id');location=value.get('loc');condition=value.get('condition')
                    if set(value)!=required or value.get('coreFeature')!='while' or not safe(identifier) or type(value.get('limit')) is not int or not 1<=value['limit']<=100 or not isinstance(value.get('body'),list) or not isinstance(condition,dict) or condition.get('type')!='Boolean':
                        raise UserError('Neispravan ograničeni BIL while plan.')
                    if identifier in while_nodes or identifier not in while_markers:raise UserError('BIL while nema jedinstvenu source mapu.')
                    marker=while_markers[identifier]
                    if not isinstance(location,dict) or set(location)!={'line','column','start','end'} or any(type(location.get(k)) is not int for k in location) or location['line']<1 or location['column']<1 or location['start']<0 or location['end']<location['start'] or any(marker.get(k)!=location.get(k) for k in ('line','column','start','end')):
                        raise UserError('BIL while source lokacija ne odgovara planu.')
                    while_nodes[identifier]=value
                if 'coreFeature' in value and not (value.get('coreFeature')=='derive' and declarations.get(value.get('id')) is value or value.get('coreFeature')=='while' and while_nodes.get(value.get('id')) is value):
                    raise UserError('BIL Core oznaka nije dozvoljena u ovom izvršnom bloku.')
                if 'dependencies' in value and value.get('coreFeature')!='derive':raise UserError('BIL derive zavisnosti nemaju deklarisanu mogućnost.')
            if value.get('op')=='CALL' and isinstance(value.get('call'),str) and value['call'].startswith('json.'):
                operation=value['call'];arguments=value.get('args')
                if operation not in CORE3_OPERATIONS or 'json' not in ir['imports'] or not isinstance(arguments,list) or len(arguments)!=(1 if operation=='json.encode' else 2):raise UserError('Neispravan tipizirani BIL JSON poziv.')
                if operation=='json.encode' and value.get('type')!='Text':raise UserError('BIL JSON kodiranje mora vratiti Text.')
                if operation=='json.decode' and (not isinstance(arguments[0],dict) or arguments[0].get('type')!='Text' or not isinstance(arguments[1],dict) or value.get('type')!=arguments[1].get('type') or value.get('type') in ('Void','Null','Unknown')):raise UserError('BIL JSON dekodiranje treba tekst i provjeren primjer tipa.')
            for child in value.values():
                if isinstance(child,(list,dict)):inspect(child)
    for block in (ir['main'],ir['functions'],ir['handlers']):inspect(block)
    if set(while_markers)!=set(while_nodes):raise UserError('BIL while marker nema odgovarajući plan.')

def validate_remote(value):
    if not isinstance(value,dict) or set(value)!={'format','backends'} or value['format']!='bil.remote/1' or not isinstance(value['backends'],dict) or not 1<=len(value['backends'])<=4:raise UserError('Neispravan BIL remote ugovor.')
    for name,backend in value['backends'].items():
        if not safe(name) or not isinstance(backend,dict) or set(backend)!={'adapter','operations'} or backend['adapter'] not in ('firebase.development/1','firebase.development/2','firebase.development/3','firebase.development/4','android.native/1','sense.local/1'):raise UserError('Nepodržan udaljeni adapter.')
        operations=backend['operations']
        if not isinstance(operations,list) or any(not isinstance(op,str) or (op not in (SENSE_OPS if backend['adapter']=='sense.local/1' else NATIVE_OPS if backend['adapter']=='android.native/1' else REMOTE_OPS|IMAGE_OPS.keys() if backend['adapter']=='firebase.development/4' else REMOTE_OPS) or op in ('query.documents','observe.query.documents') and backend['adapter'] not in ('firebase.development/3','firebase.development/4') or backend['adapter']=='firebase.development/1' and (op in ('query.list','query.documents','document.add') or op.startswith('observe.'))) for op in operations) or operations!=sorted(set(operations)):raise UserError('Neispravne udaljene operacije.')
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
        if node['type'] not in ('row','card','heading','text','shape','drawing') or not isinstance(gestures,dict) or not set(gestures)<=GESTURES:raise UserError('Neispravan ugovor gesti.')
        for key,event in gestures.items():
            if not isinstance(event,dict) or set(event)!={'handler','entry'} or not safe(event['handler']) or not safe(event['entry']) or event['handler'] not in ir['handlers'] or event['entry'] not in ir['handlers'] or event['handler'] in ir.get('events',{}).get('handlers',{}):raise UserError('Gesta treba postojeću običnu radnju.')
            code=ir['handlers'][event['entry']]
            if len(code)!=1 or code[0].get('op')!='UI_EVENT' or code[0].get('control')!=node['id'] or code[0].get('gesture')!=key:raise UserError('Izvršni ugovor geste ne odgovara komponenti.')

def validate_cards_node(node,ir):
    required={'id','type','loc','name','label','columns','identity','selection','image','actionLabel','handler','empty','entry'}
    if not required <= set(node) or set(node)-required-{'style','motion'}:
        raise UserError('Neispravan ugovor BIL kartica.')
    if any(not safe(node[key]) for key in ('name','identity','selection','handler','entry')):raise UserError('Neispravan identitet ugovora kartica.')
    if ir['ui']['format']!='bil.ui/3':raise UserError('Kartice zahtijevaju bil.ui/3.')
    item=ir['globals'].get(node['name'],{}).get('type',{})
    item=item.get('list',{}) if isinstance(item,dict) else {}
    fields=item.get('record',{}) if isinstance(item,dict) else {}
    selected=ir['globals'].get(node['selection'],{})
    if not fields or fields.get(node['identity'])!='Text' or selected.get('type')!='Text' or selected.get('mutable') is not True:
        raise UserError('Kartice trebaju List<Record>, tekstualni identitet i promjenjivi tekstualni odabir.')
    columns=node['columns']
    if not isinstance(columns,list) or not 1<=len(columns)<=8:raise UserError('Kartice trebaju 1–8 polja.')
    seen=set()
    for column in columns:
        if not isinstance(column,dict) or set(column)!={'field','label'} or not safe(column['field']) or column['field'] in seen or fields.get(column['field']) not in ('Text','Number','Boolean'):
            raise UserError('Neispravno polje kartice.')
        seen.add(column['field'])
        if not isinstance(column['label'],str) or not column['label'].strip() or len(column['label'])>200:raise UserError('Neispravan naziv polja kartice.')
    for key in ('label','actionLabel','empty'):
        if not isinstance(node[key],str) or not node[key].strip() or len(node[key])>200:raise UserError('Nazivi kartica trebaju 1–200 znakova.')
    if not safe(node['handler']) or node['handler'].startswith('ui_') or node['handler'] not in ir['handlers'] or node['handler'] in ir.get('events',{}).get('handlers',{}):
        raise UserError('Kartica treba postojeći obični događaj.')
    if node['entry']!='ui_'+node['id'] or node['entry'] not in ir['handlers']:raise UserError('Neispravan ulazni događaj kartice.')
    if node['image'] is not None:
        if not safe(node['image']):raise UserError('Neispravno polje fotografije kartice.')
        photo=fields.get(node['image'],{})
        photo=photo.get('nullable',photo) if isinstance(photo,dict) else {}
        if not isinstance(photo,dict) or photo.get('record')!=NATIVE_TYPES['NativeMedia'] or not any(b['adapter'] in ('android.native/1','firebase.development/4') for b in ir.get('remote',{}).get('backends',{}).values()):
            raise UserError('Fotografija kartice treba NativeMedia i podržani adapter.')

def validate_draw_node(node,ir):
    if ir['ui']['format']!='bil.ui/3':raise UserError('Draw zahtijeva bil.ui/3.')
    base={'id','type','loc','label'}
    extra={'spaceSize','children'} if node['type']=='space' else {'points','role','closed','fill','ink','weight'}
    if not base|extra <= set(node) or set(node)-base-extra-{'style','motion','gestures'}:raise UserError('Neispravan Draw objekat.')
    if not isinstance(node['label'],str) or not node['label'].strip() or len(node['label'])>160:raise UserError('Draw objekat treba naziv1–160 znakova.')
    if node['type']=='space':
        size=node['spaceSize']
        if not isinstance(size,list) or len(size)!=2 or any(type(x) not in (int,float) or not 64<=x<=4096 for x in size) or not isinstance(node['children'],list) or any(not isinstance(n,dict) or n.get('type')!='drawing' for n in node['children']):raise UserError('Draw prostor treba dimenzije64–4096 i objekte crteža.')
        return
    points=node['points']
    if not isinstance(points,list) or not 2<=len(points)<=256 or any(not isinstance(p,list) or len(p)!=2 or any(type(v) not in (int,float) or not 0<=v<=1000 for v in p) for p in points):raise UserError('Crtež treba2–256 parova koordinata0–1000.')
    if node['role'] not in ('object','actor','door','solid') or type(node['closed']) is not bool or type(node['weight']) not in (int,float) or not 1<=node['weight']<=16:raise UserError('Neispravna Draw uloga ili debljina linije.')
    for key in ('fill','ink'):
        if not isinstance(node[key],str) or not (re.fullmatch(r'#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?',node[key]) or node[key] in ('transparent','currentColor')):raise UserError('Nedozvoljena boja crteža.')

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
    rich_ui=isinstance(ir.get('ui'),dict) and ir['ui'].get('format') in ('bil.ui/2','bil.ui/3')
    for key in ('globals','records','functions','handlers'):
        if not isinstance(ir[key],dict) or len(ir[key])>(4224 if rich_ui and key=='handlers' else 128 if rich_ui and key in ('globals','functions') else 192 if extended and key=='handlers' else 64) or any(not safe(k) for k in ir[key]):raise UserError('Neispravni BIL simboli.')
    if not isinstance(ir['imports'],list) or len(ir['imports'])>4 or any(x not in ('math','text','collections','json') for x in ir['imports']):raise UserError('Nedozvoljen BIL modul.')
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
    validate_derive_markers(ir)
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
        if not live and any(b['adapter'] in ('firebase.development/3','firebase.development/4','android.native/1','sense.local/1') for b in ir['remote']['backends'].values()):raise UserError('Adapter3 zahtijeva BIL5 aplikacijski ugovor.')
        if project['remote']!=ir['remote']:raise UserError('Udaljene mogućnosti ne odgovaraju BIL izvoru.')
        actual={name:set() for name in ir['remote']['backends']}
        def requests(value):
            if isinstance(value,list):
                for entry in value:requests(entry)
            elif isinstance(value,dict):
                if value.get('op') in ('REQUEST','WATCH'):
                    if set(value)!=({'op','id','loc','backend','operation','args','target','error','resultType'}|({'completion'} if asynchronous and 'completion' in value else set())|({'subscription','interval'} if live and value.get('op')=='WATCH' else set())) or not isinstance(value.get('backend'),str) or value['backend'] not in actual or not isinstance(value.get('operation'),str) or value['operation'] not in (SENSE_OPS if ir['remote']['backends'][value['backend']]['adapter']=='sense.local/1' else NATIVE_OPS if ir['remote']['backends'][value['backend']]['adapter']=='android.native/1' else REMOTE_OPS|IMAGE_OPS.keys() if ir['remote']['backends'][value['backend']]['adapter']=='firebase.development/4' else REMOTE_OPS) or not isinstance(value.get('args'),list) or not safe(value.get('target')) or not safe(value.get('error')) or value['target'] not in ir['globals'] or value['error'] not in ir['globals']:raise UserError('Neispravan udaljeni BIL zahtjev.')
                    target=ir['globals'][value['target']];error=ir['globals'][value['error']]
                    if not isinstance(target,dict) or target.get('mutable') is not True or value['resultType']!=target.get('type'):raise UserError('Tip udaljenog rezultata ne odgovara stanju.')
                    failure_type=error.get('type',{}) if isinstance(error,dict) else {}
                    failure=failure_type.get('nullable',{}) if isinstance(failure_type,dict) else {}
                    if not isinstance(error,dict) or error.get('mutable') is not True or not isinstance(failure,dict) or failure.get('record')!={'code':'Text','message':'Text','uncertain':'Boolean'} or value['target']==value['error']:raise UserError('Udaljeni zahtjev treba odvojeni promjenjivi nullable RemoteFailure rezultat.')
                    if value['operation'].startswith('observe.') or (value['operation'] in ('query.list','query.documents','document.add') or value['op']=='WATCH') and ir['remote']['backends'][value['backend']]['adapter'] not in ('firebase.development/2','firebase.development/3','firebase.development/4') or value['operation']=='query.documents' and ir['remote']['backends'][value['backend']]['adapter'] not in ('firebase.development/3','firebase.development/4'):raise UserError('Neispravan adapter za upit ili pretplatu.')
                    result=value['resultType'];nullable=isinstance(result,dict) and 'nullable' in result
                    result_type=result['nullable'] if nullable else result
                    if ir['remote']['backends'][value['backend']]['adapter']=='sense.local/1':
                        spec=SENSE_OPS[value['operation']]
                        if len(value['args'])!=spec[0] or result_type!=spec[1]:raise UserError('Sense operation has an invalid typed contract.')
                    elif ir['remote']['backends'][value['backend']]['adapter']=='android.native/1':
                        native_result=NATIVE_OPS[value['operation']][1]
                        expected={'list':{'record':NATIVE_TYPES['NativeMedia'],'name':'NativeMedia'}} if native_result=='NativeMediaList' else 'Boolean' if native_result=='Boolean' else {'record':NATIVE_TYPES[native_result],'name':native_result}
                        if result_type!=expected:raise UserError('Native rezultat ne odgovara registrovanom tipu.')
                    elif value['operation'] in IMAGE_OPS:
                        if ir['remote']['backends'][value['backend']]['adapter']!='firebase.development/4':raise UserError('Slike zahtijevaju adapter4.')
                        image_result=IMAGE_OPS[value['operation']][1]
                        expected='Boolean' if image_result=='Boolean' else {'record':IMAGE_TYPES[image_result],'name':image_result}
                        if result_type!=expected:raise UserError('Slika treba registrovani rezultat.')
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
                    expected_args=(SENSE_OPS[value['operation']][0] if value['operation'] in SENSE_OPS else NATIVE_OPS[value['operation']][0] if value['operation'] in NATIVE_OPS else IMAGE_OPS[value['operation']][0] if value['operation'] in IMAGE_OPS else {'auth.session':0,'auth.register':0,'auth.signIn':0,'auth.signOut':0,'document.get':1,'document.set':2,'document.delete':1,'query.list':2,'query.documents':2,'document.add':2}[value['operation']])
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
        if not isinstance(ui,dict) or set(ui)!={'format','start','screens'} or ui['format'] not in ('bil.ui/1','bil.ui/2','bil.ui/3') or not isinstance(ui['screens'],list) or len(ui['screens'])>(64 if rich_ui else 32):raise UserError('Neispravan BIL UI ugovor.')
        screens=set();node_ids=set()
        def nodes(items,depth=0):
            if not isinstance(items,list) or depth>8:raise UserError('Neispravan BIL raspored.')
            for n in items:
                if not isinstance(n,dict) or not safe(n.get('id')) or n['id'] in node_ids or n.get('type') not in (('row','card','heading','text','input','select','toggle','table','view','button','image','shape','cards','drawing','space') if rich_ui else ('row','card','heading','text','input','select','toggle','table','view','button','image')):raise UserError('Neispravna BIL komponenta.')
                if n['type']=='cards':validate_cards_node(n,ir)
                if n['type'] in ('drawing','space'):validate_draw_node(n,ir)
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
    expected_permissions=sorted(set(expected_permissions)|{{'speech.listen':'microphone','haptic.cue':'haptics'}[op] for b in ir.get('remote',{}).get('backends',{}).values() if b['adapter']=='sense.local/1' for op in b['operations'] if op in ('speech.listen','haptic.cue')})
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

