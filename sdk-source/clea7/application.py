"""Original application/2 validator and local Android packaging toolchain."""
import copy
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from .schema import UserError
KEY=re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,63}$')
TYPES={'column','row','card','text','heading','button','input','textarea','number','checkbox','select','list','divider','image'}
ACTIONS={'set','increment','append','remove','navigate','notify','if','repeat','calculate','native','record.create','record.update','record.delete','record.query','machine.event','animate'}
NATIVE={'device.camera':'camera','device.location':'location','device.notification':'notifications'}
OPS={'add','subtract','multiply','divide','equal','greater','less','and','or','not','concat','length','field'}
def validate(raw):
    if not isinstance(raw,dict):raise UserError('Projekt treba biti objekat.')
    try:p=json.loads(json.dumps(raw,allow_nan=False))
    except (TypeError,ValueError):raise UserError('Projekt sadrži neispravne vrijednosti.')
    if len(json.dumps(p).encode())>1048576:raise UserError('Projekt prelazi 1 MiB.')
    v7=p.get('format') in ('clea7.application/7','clea7.application/8','clea7.application/9')
    v5=p.get('format') in ('clea7.application/5','clea7.application/6','clea7.application/7','clea7.application/8','clea7.application/9')
    v4=v5 or p.get('format')=='clea7.application/4'
    living=v4 or p.get('format')=='clea7.application/3'
    if any(k not in ('format','id','name','package','version','start','permissions','state','screens','flows','tables')+(('machines','animations','components') if living else ())+(('licenses',) if v4 else ())+(('bil',) if v5 else ())+(('remote',) if v7 else ()) for k in p):raise UserError('Nepodržano svojstvo projekta.')
    if p.get('format')!='clea7.application/2' and not living:raise UserError('Potreban je application/2 format.')
    def key(value):return isinstance(value,str) and KEY.fullmatch(value) and value not in ('constructor','prototype','__proto__')
    if not key(p.get('id')) or not isinstance(p.get('name'),str) or not p['name'].strip() or len(p['name'])>100:raise UserError('Neispravan naziv ili identitet.')
    if not isinstance(p.get('package'),str) or not re.fullmatch(r'([a-z][a-z0-9_]*\.){2,}[a-z][a-z0-9_]*',p['package']):raise UserError('Neispravan Android paket.')
    if not isinstance(p.get('state'),dict) or len(p['state'])>100 or not all(key(k) for k in p['state']):raise UserError('Neispravno stanje.')
    tables=p.get('tables',{})
    if not isinstance(tables,dict) or len(tables)>20:raise UserError('Neispravne tabele.')
    for table,fields in tables.items():
        if not key(table) or not isinstance(fields,dict) or not 1<=len(fields)<=50 or any(not key(k) or t not in ('text','number','boolean') for k,t in fields.items()):raise UserError('Neispravan model tabele.')
    p['tables']=tables
    permissions=p.get('permissions',[])
    if not isinstance(permissions,list) or any(x not in ('camera','location','notifications') for x in permissions):raise UserError('Nepodržana dozvola.')
    screens=p.get('screens');flows=p.get('flows')
    if not isinstance(screens,list) or not 1<=len(screens)<=50 or not isinstance(flows,dict) or len(flows)>200 or not all(key(k) for k in flows):raise UserError('Neispravni ekrani ili tokovi.')
    ids=[s.get('id') for s in screens if isinstance(s,dict)]
    if len(ids)!=len(screens) or not all(key(x) for x in ids) or len(set(ids))!=len(ids) or p.get('start') not in ids:raise UserError('Neispravni identiteti ekrana.')
    def expression(v,depth=0):
        if depth>16:raise UserError('Izraz je predubok.')
        if isinstance(v,list):
            for x in v:expression(x,depth+1)
        elif isinstance(v,dict):
            if 'ref' in v:
                if v['ref'] not in ('state','event','item','loop') or not isinstance(v.get('key'),str) or v['key'] in ('constructor','prototype','__proto__'):raise UserError('Neispravna referenca.')
                if v['ref']=='state' and v['key'] not in p['state']:raise UserError('Izraz koristi nepostojeće stanje.')
            elif 'op' in v:
                if v['op'] not in OPS or not isinstance(v.get('args'),list) or len(v['args'])>16:raise UserError('Neispravna operacija izraza.')
                for x in v['args']:expression(x,depth+1)
            else:
                for k,x in v.items():
                    if k in ('constructor','prototype','__proto__'):raise UserError('Nedozvoljen ključ.')
                    expression(x,depth+1)
    if v4 and 'licenses' in p:
        licenses=p['licenses'];seen=set()
        if not isinstance(licenses,list) or len(licenses)>20:raise UserError('Neispravan spisak licenci.')
        for entry in licenses:
            if not isinstance(entry,dict) or set(entry)!={'id','name','text'} or not key(entry['id']) or entry['id'] in seen or not isinstance(entry['name'],str) or not entry['name'].strip() or len(entry['name'])>100 or not isinstance(entry['text'],str) or not entry['text'].strip() or len(entry['text'])>16000:raise UserError('Neispravna licenca materijala.')
            seen.add(entry['id'])
    nodes=set()
    def node(n,depth=0):
        if depth>12 or not isinstance(n,dict) or not key(n.get('id')) or n['id'] in nodes or not (n.get('type') in TYPES or v5 and n.get('type')=='bil'):raise UserError('Neispravna komponenta.')
        if any(k not in ('id','type','text','label','bind','options','events','children','style','source')+(('review',) if v4 else ()) for k in n):raise UserError('Nepodržano svojstvo komponente.')
        nodes.add(n['id'])
        if 'review' in n and (type(n['review']) is not bool or n['type']!='button'):raise UserError('Pregled izmjene je dozvoljen samo na dugmetu.')
        style=n.get('style',{})
        if not isinstance(style,dict):raise UserError('Neispravan stil.')
        for k,v in style.items():
            if k in ('color','background') and isinstance(v,str) and re.fullmatch(r'#[0-9a-fA-F]{6}',v):continue
            if k in ('padding','gap','radius','fontSize') and type(v) in (int,float) and 0<=v<=100:continue
            if k in ('width','minHeight') and type(v) in (int,float) and 0<=v<=1200:continue
            if k=='fontWeight' and type(v) is int and v in (400,500,600,700,800):continue
            if k=='justify' and v in ('flex-start','center','flex-end','space-between'):continue
            if k=='wrap' and type(v) is bool:continue
            if k=='align' and v in ('left','center','right'):continue
            raise UserError('Nepodržan stil.')
        if len(nodes)>500:raise UserError('Previše komponenti.')
        if n.get('bind') and n['bind'] not in p['state']:raise UserError('Komponenta koristi nepostojeće stanje.')
        if n.get('bind'):
            value=p['state'][n['bind']];kind=n['type']
            if (kind=='list' and not isinstance(value,list)) or (kind=='number' and type(value) not in (int,float)) or (kind=='checkbox' and type(value) is not bool) or (kind in ('input','textarea','select') and not isinstance(value,str)):raise UserError('Tip podataka ne odgovara komponenti.')
        expression(n.get('text'));expression(n.get('source'))
        events=n.get('events',{})
        if not isinstance(events,dict) or any(k not in ('click','change','input') or v not in flows for k,v in events.items()):raise UserError('Neispravni događaji.')
        if 'options' in n and (not isinstance(n['options'],list) or not all(isinstance(x,str) for x in n['options'])):raise UserError('Neispravni izbori.')
        children=n.get('children',[])
        if not isinstance(children,list):raise UserError('Djeca trebaju biti lista.')
        for child in children:node(child,depth+1)
    def steps(xs,depth=0):
        if not isinstance(xs,list) or len(xs)>100 or depth>8:raise UserError('Tok je prevelik.')
        for x in xs:
            if not isinstance(x,dict) or not (x.get('action') in ACTIONS or v5 and x.get('action')=='bil') or not living and x.get('action') in ('machine.event','animate'):raise UserError('Nepodržana akcija.')
            if any(k not in ('action','key','value','condition','count','screen','operation','then','else','steps','table','id','where','limit')+(('machine','event','animation') if living else ())+(('offset','search') if v4 else ())+(('block',) if v5 else ()) for k in x):raise UserError('Nepodržano svojstvo akcije.')
            if x['action'] in ('set','increment','append','remove','calculate','native') and x.get('key') not in p['state']:raise UserError('Nepostojeće stanje u toku.')
            if x['action']=='navigate' and x.get('screen') not in ids:raise UserError('Nepostojeće odredište.')
            if x['action'].startswith('record.'):
                if x.get('table') not in tables or x.get('key') not in p['state']:raise UserError('Nepostojeća tabela ili rezultat.')
                expected=list if x['action']=='record.query' else dict
                if not isinstance(p['state'][x['key']],expected):raise UserError('Pogrešan tip rezultata zapisa.')
                if x['action'] in ('record.update','record.delete') and 'id' not in x:raise UserError('Potreban je identitet zapisa.')
                if x['action'] in ('record.create','record.update') and 'value' not in x:raise UserError('Potrebna su polja zapisa.')
                if 'limit' in x and (type(x['limit']) is not int or not 1<=x['limit']<=100):raise UserError('Neispravan limit upita.')
            for field in ('value','condition','count','id','where','offset','search'):expression(x.get(field))
            if x['action']=='if':steps(x.get('then',[]),depth+1);steps(x.get('else',[]),depth+1)
            if x['action']=='repeat':steps(x.get('steps',[]),depth+1)
            if x['action']=='native' and (x.get('operation') not in NATIVE or NATIVE[x['operation']] not in permissions):raise UserError('Native modul nema deklarisanu dozvolu.')
            if x['action']=='calculate' and x.get('operation') not in ('text.transform','table.stats','data.filter'):raise UserError('Nepodržan modul.')
    for s in screens:
        if not isinstance(s.get('children'),list):raise UserError('Ekran treba listu komponenti.')
        for n in s['children']:node(n)
    for xs in flows.values():steps(xs)
    if living:
        from .living import validate_living
        def definition(n):
            nonlocal nodes
            previous=nodes
            try:
                nodes=set();node(n)
            finally:nodes=previous
        validate_living(p,expression,definition)
    if not v5:expression(p['state'])
    if v5:
        from .bil import validate_program
        validate_program(p)
    p['permissions']=permissions;p['version']=p.get('version') if type(p.get('version')) is int and p['version']>0 else 1
    return p

def source_files(root,project):
    root=Path(root);p=validate(project);files={}
    android=root/'android'
    template_paths=(
        'settings.gradle','build.gradle','gradle.properties','runtime/build.gradle',
        'runtime/src/main/AndroidManifest.xml','runtime/src/main/assets/index.html',
        'runtime/src/main/assets/boot.js','runtime/src/main/java/com/brzoilokalno/clea7/Clea7Runtime.java',
        'runtime/src/main/java/com/brzoilokalno/clea7/Clea7Backend.java','runtime/src/main/java/com/brzoilokalno/clea7/Clea7Modules.java','runtime/src/main/java/com/brzoilokalno/clea7/Clea7Camera.java','runtime/src/main/java/com/brzoilokalno/clea7/Clea7Media.java',
        'app/build.gradle','app/src/main/AndroidManifest.xml',
        'app/src/main/java/com/brzoilokalno/clea7/demo/MainActivity.java',
        'app/src/main/res/xml/clea7_network.xml','app/src/main/res/drawable/clea7_icon.xml','app/src/main/res/values/styles.xml')
    for rel in template_paths:
        files['android/'+rel]=(android/rel).read_bytes()
    if any(b['adapter'].startswith('firebase.development/') for b in p.get('remote',{}).get('backends',{}).values()):
        for rel in ('app/src/debug/AndroidManifest.xml','app/src/debug/res/xml/clea7_network.xml'):
            files['android/'+rel]=(android/rel).read_bytes()
    # Generated apps contain only the whitelisted embedded consumer and AAR.
    # The repository's independent launcher is a different product, not a missing dependency.
    files['android/settings.gradle']=re.sub(r'^include\b.*$',"include ':runtime', ':app'",files['android/settings.gradle'].decode(),flags=re.MULTILINE).encode()
    for rel in ('runtime.js','workbench/living.js','workbench/bil-compiler.js','workbench/bil-runtime.js','workbench/format.js','workbench/plan.js','workbench/publisher.js','workbench/package.js','workbench/review.js','workbench/consumer.js','workbench/firebase-development.js','workbench/android-backend.js','workbench/remote.js','workbench/remote-studio.js','workbench/engine.js','workbench/device.js','workbench/studio.css','launcher/index.html','launcher/launcher.css','launcher/library.js','launcher/player.html','launcher/player.js'):
        files['web/'+rel]=(root/'web'/rel).read_bytes()
    files['android/app/src/main/assets/application/project.json']=json.dumps(p,ensure_ascii=False,allow_nan=False).encode()
    files['android/gradle.properties']+=('\nclea7Package='+p['package']+'\n'+('clea7DevelopmentBackend=true\n' if any(b['adapter'].startswith('firebase.development/') for b in p.get('remote',{}).get('backends',{}).values()) else '')).encode()
    # App label comes from validated XML-escaped user content; no source injection.
    import html
    manifest=re.sub(r'<uses-permission\b[^>]*/>', '',files['android/app/src/main/AndroidManifest.xml'].decode()).replace('BL CLEA7 aplikacija',html.escape(p['name'],quote=True))
    permissions_xml=''.join('<uses-permission android:name="'+permission+'"/>' for flag,names in {'camera':['android.permission.CAMERA'],'location':['android.permission.ACCESS_FINE_LOCATION','android.permission.ACCESS_COARSE_LOCATION'],'notifications':['android.permission.POST_NOTIFICATIONS']}.items() if flag in p['permissions'] for permission in names)
    manifest=manifest.replace('<application',permissions_xml+'<application',1)
    files['android/app/src/main/AndroidManifest.xml']=manifest.encode()
    gradle=files['android/app/build.gradle'].decode().replace('versionCode 1','versionCode '+str(p['version']))
    files['android/app/build.gradle']=gradle.encode()
    for name in ('THIRD_PARTY.md','LICENSE-STATUS.md','PRIVACY.md'):
        files[name]=((root/name) if (root/name).is_file() else (root/'notices'/name)).read_bytes()
    for entry in p.get('licenses',[]):files['materials/license_'+entry['id']+'.txt']=(entry['name']+'\n\n'+entry['text']).encode()
    files['BUILD-INSTRUCTIONS.txt']=b'Use JDK 17+, Android SDK platform/build-tools 35 and Gradle 8.10.2.\nFrom android/: gradle --no-daemon :app:assembleDebug :runtime:assembleRelease\nDebug APK is owner testing only. Production publication requires your own signing key.\nNo user project is uploaded by this source export or local build.\n'
    return files

def source_zip(root,project):
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
        for name,contents in source_files(root,project).items():z.writestr(name,contents)
    return output.getvalue()

def build_apk(root,project,destination):
    project=validate(project)
    java=shutil.which('java');gradle=shutil.which('gradle')
    sdk=os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
    if not java or not gradle or not sdk or not (Path(sdk)/'platforms'/'android-35').is_dir():
        raise UserError('APK nije izgrađen: potreban je instaliran JDK 17+, Gradle 8.10.2 i Android SDK 35. Ništa nije preuzeto ili instalirano automatski.')
    target=Path(destination);target.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='clea7-build-') as temp:
        folder=Path(temp)
        for name,contents in source_files(root,project).items():
            path=folder/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(contents)
        result=subprocess.run([gradle,'--no-daemon',':app:assembleDebug'],cwd=folder/'android',capture_output=True,text=True,timeout=600,shell=False)
        if result.returncode:raise UserError('Android build nije prošao:\n'+(result.stderr+result.stdout)[-6000:])
        apk=folder/'android/app/build/outputs/apk/debug/app-debug.apk'
        if not apk.is_file():raise UserError('Alatni lanac nije proizveo APK.')
        with zipfile.ZipFile(apk) as z:
            if z.testzip() or 'AndroidManifest.xml' not in z.namelist() or 'classes.dex' not in z.namelist():raise UserError('APK paket nije ispravan.')
        output=target/'application-debug.apk';shutil.copy2(apk,output);return output

def validate_project(raw):
    if isinstance(raw,dict) and raw.get('format') in ('clea7.application/2','clea7.application/3','clea7.application/4','clea7.application/5','clea7.application/6','clea7.application/7','clea7.application/8','clea7.application/9'):return validate(raw)
    from .schema import validate_app
    return validate_app(raw)
