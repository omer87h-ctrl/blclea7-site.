"""Versioned data-only CLEA7 package. Integrity is not publisher authentication."""
import base64
import hashlib
import json
import re
from .application import validate
from .schema import UserError

FORMAT='clea7.package/1'
RUNTIME='0.9.0'
MAX_PACKAGE=2*1024*1024
MAX_APPLICATION=1024*1024
TARGETS={'browser','windows','android'}
MANIFEST_KEYS={'id','name','version','runtime','abi','targets','permissions','dependencies','sha256','publisher'}

def encode(project,targets=None,publisher=''):
    app=validate(project)
    if targets is None:targets=('browser',) if app['format']=='clea7.application/7' else ('browser','windows')
    payload=json.dumps(app,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode()
    if len(payload)>MAX_APPLICATION:raise UserError('Aplikacija prelazi 1 MiB.')
    manifest={'id':app['id'],'name':app['name'],'version':app['version'],'runtime':('0.9.0' if 'android' in targets else '0.8.0') if app['format']=='clea7.application/7' else '0.7.0' if app['format']=='clea7.application/6' else '0.6.0' if app['format']=='clea7.application/5' else '0.5.0' if app['format']=='clea7.application/4' else '0.4.0' if app['format']=='clea7.application/3' else '0.3.0',
              'abi':app['format'],'targets':list(targets),'permissions':sorted(set(app['permissions'])),
              'dependencies':[],'sha256':hashlib.sha256(payload).hexdigest(),'publisher':publisher}
    if app['format']=='clea7.application/7':manifest['remote']=app['remote']
    package={'format':FORMAT,'manifest':manifest,'payload':base64.b64encode(payload).decode('ascii')}
    result=json.dumps(package,ensure_ascii=False,separators=(',',':')).encode()
    decode(result)
    return result

def decode(raw,target=None):
    if isinstance(raw,str):raw=raw.encode()
    if not isinstance(raw,bytes) or len(raw)>MAX_PACKAGE:raise UserError('Paket prelazi 2 MiB ili nije datoteka.')
    try:
        value=json.loads(raw)
        if isinstance(value,dict) and value.get('format')=='clea7.package/2':
            from .signing import verify_package
            return verify_package(value,target)
        if not isinstance(value,dict) or set(value)!={'format','manifest','payload'} or value['format']!=FORMAT:raise ValueError()
        manifest=value['manifest']
        if not isinstance(manifest,dict) or set(manifest)!=(MANIFEST_KEYS|({'remote'} if manifest.get('abi')=='clea7.application/7' else set())):raise ValueError()
        if manifest['abi'] not in ('clea7.application/2','clea7.application/3','clea7.application/4','clea7.application/5','clea7.application/6','clea7.application/7') or not isinstance(manifest['runtime'],str) or not re.fullmatch(r'\d+\.\d+\.\d+',manifest['runtime']):raise ValueError()
        if tuple(map(int,manifest['runtime'].split('.')))>tuple(map(int,RUNTIME.split('.'))):raise UserError('Paket zahtijeva noviji runtime.')
        if not isinstance(manifest['targets'],list) or not manifest['targets'] or any(x not in TARGETS for x in manifest['targets']) or len(set(manifest['targets']))!=len(manifest['targets']):raise ValueError()
        if manifest['abi']=='clea7.application/7' and ('windows' in manifest['targets'] or 'android' in manifest['targets'] and tuple(map(int,manifest['runtime'].split('.'))) < (0,9,0)):raise UserError('application/7 Android zahtijeva Runtime 0.9.0 native broker; Windows cilj još nije podržan.')
        if target and target not in manifest['targets']:raise UserError('Paket ne podržava ovaj izvršni cilj.')
        if manifest['dependencies']!=[]:raise UserError('Vanjske zavisnosti nisu podržane u package/1.')
        if not isinstance(manifest['publisher'],str) or len(manifest['publisher'])>100:raise ValueError()
        if not isinstance(manifest['sha256'],str) or not re.fullmatch(r'[0-9a-f]{64}',manifest['sha256']):raise ValueError()
        if not isinstance(value['payload'],str) or len(value['payload'])>1400000:raise ValueError()
        payload=base64.b64decode(value['payload'],validate=True)
        if len(payload)>MAX_APPLICATION or hashlib.sha256(payload).hexdigest()!=manifest['sha256']:raise UserError('Integritet aplikacije nije potvrđen.')
        app=validate(json.loads(payload))
        if app['format']=='clea7.application/7':
            if tuple(map(int,manifest['runtime'].split('.'))) < (0,8,0):raise UserError('Udaljeni BIL zahtjevi zahtijevaju Runtime 0.8.0.')
            if manifest['remote']!=app['remote']:raise UserError('Udaljene mogućnosti manifesta ne odgovaraju aplikaciji.')
        if app['format']=='clea7.application/6' and tuple(map(int,manifest['runtime'].split('.'))) < (0,7,0):raise UserError('BIL ekrani zahtijevaju Runtime 0.7.0.')
        if app['format']=='clea7.application/5' and tuple(map(int,manifest['runtime'].split('.'))) < (0,6,0):raise UserError('BIL zahtijeva Runtime 0.6.0.')
        if app['format']!=manifest['abi'] or app['format']=='clea7.application/4' and tuple(map(int,manifest['runtime'].split('.'))) < (0,5,0) or app['format']=='clea7.application/3' and tuple(map(int,manifest['runtime'].split('.'))) < (0,4,0):raise ValueError('ABI ili Runtime nisu kompatibilni.')
        if any(manifest[key]!=app[key] for key in ('id','name','version')) or type(manifest['version']) is not int or not 1<=manifest['version']<=2147483647:raise ValueError()
        if manifest['permissions']!=sorted(set(app['permissions'])):raise UserError('Dozvole manifesta ne odgovaraju aplikaciji.')
        return {'package':value,'manifest':manifest,'app':app}
    except UserError:raise
    except (ValueError,TypeError,KeyError,UnicodeError,RecursionError):raise UserError('Neispravan CLEA7 paket.') from None
