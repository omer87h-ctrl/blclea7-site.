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

def validate_program(project):
    bundle=project.get('bil')
    if not isinstance(bundle,dict) or set(bundle)!={'format','source','ir'} or bundle['format']!='bil.program/1':raise UserError('Neispravna BIL omotnica.')
    source=bundle['source'];ir=bundle['ir']
    if not isinstance(source,str) or len(source)>131072 or not isinstance(ir,dict) or set(ir)!={'format','language','globals','records','imports','functions','handlers','main','controls','sourceMap'} or ir['format']!='bil.ir/1' or ir['language']!='bil/1':raise UserError('Nepodržan BIL ugovor.')
    for key in ('globals','records','functions','handlers'):
        if not isinstance(ir[key],dict) or len(ir[key])>64 or any(not safe(k) for k in ir[key]):raise UserError('Neispravni BIL simboli.')
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
    if project['state']!={'bilValues':initial,'bilViews':[],'bilMotion':[]} or project['permissions'] or project['tables']:raise UserError('BIL početno stanje ili dozvole ne odgovaraju ugovoru.')
    expected={'bil_main':[{'action':'bil','block':'main'}]}
    for name,body in ir['handlers'].items():
        if name=='main' or len(name)>60 or not isinstance(body,list):raise UserError('Neispravan BIL događaj.')
        expected['bil_'+name]=[{'action':'bil','block':name}]
    if project['flows']!=expected:raise UserError('BIL tokovi ne odgovaraju programu.')
    controls=[]
    for c in ir['controls']:
        if not isinstance(c,dict) or set(c)!={'id','label','handler'} or not safe(c['id']) or not isinstance(c['label'],str) or c['handler'] not in ir['handlers']:raise UserError('Neispravna BIL kontrola.')
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
