"""Bounded non-executable project media, mirrored by the shared browser validator."""
import base64,hashlib,re,struct
from .schema import UserError
FORMAT='clea7.resources/1'
REQUIREMENTS='bil.resources/1'
MAX_ITEM=4*1024*1024
MAX_TOTAL=12*1024*1024
MAX_APP=20*1024*1024
MIME={'image':('image/png','image/jpeg','image/webp'),'audio':('audio/wav','audio/mpeg','audio/ogg')}
def safe(x):return isinstance(x,str) and re.fullmatch('[A-Za-z][A-Za-z0-9_]{0,47}',x) and x not in ('constructor','prototype','__proto__')
def shape(x,required,optional=()):return isinstance(x,dict) and set(required)<=set(x)<=set(required)|set(optional)
def fail(message):raise UserError(message)
def requirements(value):
 if not shape(value,('format','items')) or value['format']!=REQUIREMENTS or not isinstance(value['items'],dict) or len(value['items'])>16:fail('Neispravne deklaracije resursa.')
 for key,row in value['items'].items():
  if not safe(key) or not shape(row,('kind',)) or row['kind'] not in MIME:fail('Neispravan identitet ili vrsta resursa.')
 return value
def inspect(data,mime):
 if not isinstance(data,bytes) or not 1<=len(data)<=MAX_ITEM:fail('Resurs prelazi4MiB.')
 size=None
 if mime=='image/png':
  if len(data)<24 or data[:8]!=b'\x89PNG\r\n\x1a\n' or data[12:16]!=b'IHDR':fail('Sadržaj nije PNG.')
  size=struct.unpack_from('>II',data,16)
 elif mime=='image/jpeg':
  if data[:2]!=b'\xff\xd8':fail('Sadržaj nije JPEG.')
  at=2
  while at+4<len(data):
   if data[at]!=255:fail('Neispravan JPEG segment.')
   at+=1
   while at<len(data) and data[at]==255:at+=1
   if at>=len(data):break
   tag=data[at];at+=1
   if tag in (217,218):break
   if at+2>len(data):break
   n=int.from_bytes(data[at:at+2],'big')
   if n<2 or at+n>len(data):fail('Neispravan JPEG segment.')
   if tag in (192,193,194):
    if n<8:fail('Neispravan JPEG okvir.')
    size=(int.from_bytes(data[at+5:at+7],'big'),int.from_bytes(data[at+3:at+5],'big'));break
   at+=n
  if size is None:fail('JPEG nema podržan okvir.')
 elif mime=='image/webp':
  if len(data)<30 or data[:4]!=b'RIFF' or data[8:12]!=b'WEBP':fail('Sadržaj nije WebP.')
  tag=data[12:16]
  if tag==b'VP8X':size=(1+int.from_bytes(data[24:27],'little'),1+int.from_bytes(data[27:30],'little'))
  elif tag==b'VP8 ' and data[23:26]==b'\x9d\x01\x2a':size=(int.from_bytes(data[26:28],'little')&16383,int.from_bytes(data[28:30],'little')&16383)
  elif tag==b'VP8L' and data[20]==47:size=(1+((data[21]|data[22]<<8)&16383),1+((data[22]>>6|data[23]<<2|data[24]<<10)&16383))
  else:fail('Nepodržan WebP okvir.')
 elif mime=='audio/wav':
  if len(data)<44 or data[:4]!=b'RIFF' or data[8:12]!=b'WAVE':fail('Sadržaj nije WAV.')
  at=12;fmt=None;samples=None
  while at+8<=len(data):
   tag=data[at:at+4];n=int.from_bytes(data[at+4:at+8],'little');start=at+8
   if start+n>len(data):fail('WAV segment je skraćen.')
   if tag==b'fmt ':
    if n<16:fail('WAV nema valjan format.')
    code,channels,rate,_,align,bits=struct.unpack_from('<HHIIHH',data,start);fmt=(code,channels,rate,align,bits)
   if tag==b'data':samples=n
   at=start+n+n%2
  if not fmt or samples is None:fail('WAV nema format ili uzorke.')
  code,channels,rate,align,bits=fmt
  if code!=1 or channels not in (1,2) or not 8000<=rate<=96000 or align!=channels*2 or bits!=16 or samples%align:fail('Koristi PCM16 WAV,mono/stereo,8–96kHz.')
  duration=samples/align/rate
  if not 0<duration<=180:fail('Zvuk traje do180 sekundi.')
  return {'duration':duration}
 elif mime=='audio/mpeg':
  if len(data)<3 or not (data[:3]==b'ID3' or data[0]==255 and data[1]&224==224):fail('Sadržaj nije MP3.')
 elif mime=='audio/ogg':
  if len(data)<27 or data[:4]!=b'OggS':fail('Sadržaj nije Ogg.')
 else:fail('Nepodržan format resursa.')
 if size and not (1<=size[0]<=4096 and 1<=size[1]<=4096 and size[0]*size[1]<=16777216):fail('Slika prelazi4096×4096.')
 return dict(zip(('width','height'),size)) if size else {}
def validate(bundle,required,*,complete=False):
 requirements(required)
 if not shape(bundle,('format','items')) or bundle['format']!=FORMAT or not isinstance(bundle['items'],list) or len(bundle['items'])>16:fail('Neispravan paket resursa.')
 seen=set();total=0
 for row in bundle['items']:
  if not shape(row,('id','kind','mime','bytes','sha256','data','credit','license'),('cues',)):fail('Neispravan medijski resurs.')
  key=row['id'];kind=row['kind']
  if not safe(key) or key in seen or key not in required['items'] or required['items'][key]['kind']!=kind or kind not in MIME or row['mime'] not in MIME[kind] or type(row['bytes']) is not int or not 1<=row['bytes']<=MAX_ITEM or not isinstance(row['sha256'],str) or not re.fullmatch('[a-f0-9]{64}',row['sha256']) or not all(isinstance(row[x],str) and row[x].strip() and len(row[x])<=400 for x in ('credit','license')):fail('Resurs treba valjanu vrstu,porijeklo,licencu i integritet.')
  if not isinstance(row['data'],str) or len(row['data'])>((MAX_ITEM+2)//3)*4:fail('Resurs prelazi budžet.')
  try:data=base64.b64decode(row['data'],validate=True)
  except (ValueError,TypeError):fail('Neispravni base64 podaci resursa.')
  if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']:fail('Integritet resursa nije potvrđen.')
  total+=len(data)
  if total>MAX_TOTAL:fail('Resursi prelaze12MiB.')
  info=inspect(data,row['mime']);seen.add(key)
  if 'cues' in row:
   if kind!='audio' or not isinstance(row['cues'],list) or len(row['cues'])>160:fail('Neispravni titlovi.')
   previous=0
   for cue in row['cues']:
    if not shape(cue,('start','end','text')) or any(type(cue[x]) not in (float,int) for x in ('start','end')) or not previous<=cue['start']<cue['end']<=180 or info.get('duration') and cue['end']>info['duration']+.05 or not isinstance(cue['text'],str) or not cue['text'].strip() or len(cue['text'])>400:fail('Titl treba valjano vrijeme i tekst,bez preklapanja.')
    previous=cue['end']
 if complete and set(required['items'])-seen:fail('Nedostaje datoteka deklarisanog resursa.')
 return bundle
