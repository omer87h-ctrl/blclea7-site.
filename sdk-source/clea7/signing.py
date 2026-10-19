"""Publisher package signatures using standard ECDSA P-256/SHA-256.

Signatures prove control of a key, not a publisher's legal identity or app safety.
Private native identities are protected by Windows DPAPI for the current user.
"""
import base64
import hashlib
import json
import os
import re
from pathlib import Path
from .schema import UserError

def crypto():
    try:
        from cryptography.hazmat.primitives import hashes,serialization
        from cryptography.hazmat.primitives.asymmetric import ec,utils
        return hashes,serialization,ec,utils
    except ImportError:raise UserError('Potpisivanje zahtijeva priloženu cryptography biblioteku ili SDK signing zavisnost.') from None

def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)
def encode64(value):return base64.urlsafe_b64encode(value).decode().rstrip('=')
def decode64(value,length):
    if not isinstance(value,str) or not re.fullmatch('[A-Za-z0-9_-]+',value):raise UserError('Neispravno kodiranje potpisa.')
    try:raw=base64.urlsafe_b64decode(value+'='*((-len(value))%4))
    except ValueError:raise UserError('Neispravno kodiranje potpisa.') from None
    if len(raw)!=length or encode64(raw)!=value:raise UserError('Neispravna dužina potpisa ili ključa.')
    return raw

def public_jwk(key):
    numbers=key.public_key().public_numbers()
    return {'kty':'EC','crv':'P-256','x':encode64(numbers.x.to_bytes(32,'big')),'y':encode64(numbers.y.to_bytes(32,'big'))}
def fingerprint(jwk):return hashlib.sha256(canonical(jwk).encode()).hexdigest()
def transcript(value):return ('CLEA7-PACKAGE-2\n'+canonical(value['manifest'])+'\n'+value['payload']+'\n'+canonical(value['publisherKey'])).encode()

def sign_package(project,key,publisher='',targets=None):
    from .package import encode
    hashes,serialization,ec,utils=crypto()
    if not isinstance(key,ec.EllipticCurvePrivateKey) or key.curve.name!='secp256r1':raise UserError('Potreban je ECDSA P-256 ključ.')
    if targets is None and any(b['adapter']=='android.native/1' for b in project.get('remote',{}).get('backends',{}).values()):targets=('android',)
    if targets is None:targets=('browser',) if project.get('format') in ('clea7.application/7','clea7.application/8','clea7.application/9') else ('browser','windows','android')
    value=json.loads(encode(project,targets,publisher));value['format']='clea7.package/2';value['publisherKey']=public_jwk(key);value['manifest']['runtime']='0.5.0' if tuple(map(int,value['manifest']['runtime'].split('.'))) < (0,5,0) else value['manifest']['runtime']
    der=key.sign(transcript(value),ec.ECDSA(hashes.SHA256()));r,s=utils.decode_dss_signature(der)
    value['signature']=encode64(r.to_bytes(32,'big')+s.to_bytes(32,'big'))
    return json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()

def verify_package(value,target=None):
    from .package import decode,MAX_PACKAGE
    hashes,serialization,ec,utils=crypto()
    if not isinstance(value,dict) or set(value)!={'format','manifest','payload','publisherKey','signature'} or value['format']!='clea7.package/2':raise UserError('Neispravna potpisana omotnica.')
    if value.get('manifest',{}).get('runtime') not in ('0.5.0','0.6.0','0.7.0','0.8.0','0.9.0','0.10.0','0.11.0','0.12.0','0.13.0','0.14.0','0.16.0'):raise UserError('Potpisani paket zahtijeva Runtime 0.5.0 ugovor.')
    jwk=value['publisherKey']
    if not isinstance(jwk,dict) or set(jwk)!={'kty','crv','x','y'} or jwk.get('kty')!='EC' or jwk.get('crv')!='P-256':raise UserError('Nepodržan javni ključ autora.')
    x=int.from_bytes(decode64(jwk['x'],32),'big');y=int.from_bytes(decode64(jwk['y'],32),'big');raw=decode64(value['signature'],64)
    unsigned={'format':'clea7.package/1','manifest':value['manifest'],'payload':value['payload']}
    parsed=decode(json.dumps(unsigned,ensure_ascii=False).encode(),target)
    try:
        key=ec.EllipticCurvePublicNumbers(x,y,ec.SECP256R1()).public_key()
        key.verify(utils.encode_dss_signature(int.from_bytes(raw[:32],'big'),int.from_bytes(raw[32:],'big')),transcript(value),ec.ECDSA(hashes.SHA256()))
    except Exception:raise UserError('Potpis autora nije važeći. Paket nije prihvaćen.') from None
    parsed['package']=value;parsed['signature']={'verified':True,'fingerprint':fingerprint(jwk),'algorithm':'ECDSA-P256-SHA256'}
    return parsed

def protect(raw,decode=False):
    if os.name!='nt':raise UserError('Native identitet autora koristi Windows DPAPI.')
    import ctypes
    from ctypes import wintypes
    class Blob(ctypes.Structure):_fields_=[('size',wintypes.DWORD),('data',ctypes.POINTER(ctypes.c_ubyte))]
    buf=ctypes.create_string_buffer(raw);source=Blob(len(raw),ctypes.cast(buf,ctypes.POINTER(ctypes.c_ubyte)));out=Blob()
    library=ctypes.WinDLL('crypt32',use_last_error=True);kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    fn=library.CryptUnprotectData if decode else library.CryptProtectData
    fn.argtypes=[ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(Blob)];fn.restype=wintypes.BOOL
    kernel.LocalFree.argtypes=[ctypes.c_void_p];kernel.LocalFree.restype=ctypes.c_void_p
    if not fn(ctypes.byref(source),None,None,None,None,1,ctypes.byref(out)):raise UserError('Windows nije mogao zaštititi identitet autora.')
    try:return ctypes.string_at(out.data,out.size)
    finally:kernel.LocalFree(out.data)

class Identity:
    def __init__(self,folder):self.folder=Path(folder)/'publisher';self.path=self.folder/'identity.dpapi'
    def key(self):
        hashes,serialization,ec,utils=crypto()
        if not self.path.is_file() or self.path.stat().st_size>16384:raise UserError('Prvo kreiraj identitet za potpisivanje.')
        return serialization.load_der_private_key(protect(self.path.read_bytes(),True),password=None)
    def status(self):
        if not self.path.is_file():return {'configured':False}
        key=self.key();jwk=public_jwk(key);return {'configured':True,'fingerprint':fingerprint(jwk),'publicKey':jwk,'protection':'Windows DPAPI / current user'}
    def create(self):
        if self.path.exists():raise UserError('Identitet već postoji. Ne zamjenjuje se bez procesa promjene ključa.')
        hashes,serialization,ec,utils=crypto();key=ec.generate_private_key(ec.SECP256R1())
        raw=key.private_bytes(serialization.Encoding.DER,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())
        protected=protect(raw);self.folder.mkdir(parents=True,exist_ok=True)
        with self.path.open('xb') as output:output.write(protected)
        return self.status()

