"""Anonymous HTTPS checks against the deployed owner domain, with no credentials."""
from pathlib import Path
import hashlib,json,time,urllib.request,urllib.error,urllib.parse
ROOT=Path(__file__).resolve().parents[1]
BASE='https://clea7.brzoilokalno.com/'
REPO='omer87h-ctrl/blclea7-site.'
TAG='clea7-0.6.0-72249d9'
def native_checks(native):
 url='https://api.github.com/repos/'+REPO+'/releases/tags/'+TAG
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BL-CLEA7-anonymous-download-check'}),timeout=30) as response:
  release=json.load(response)
 assert not release.get('draft') and release['tag_name']==TAG
 assert len(native['assets'])==3 and {a['key'] for a in native['assets']}=={'studio','runtime','android'}
 verified=[]
 for item in native['assets']:
  asset=next(a for a in release['assets'] if a['name']==item['name'])
  assert asset['digest']=='sha256:'+item['sha256'] and asset['size']==item['size_bytes']
  expected='https://github.com/'+REPO+'/releases/download/'+TAG+'/'+item['name']
  assert asset['browser_download_url']==item['url']==expected
  request=urllib.request.Request(expected,headers={'User-Agent':'BL-CLEA7-anonymous-download-check','Range':'bytes=0-4095'})
  with urllib.request.urlopen(request,timeout=30) as response:
   final=urllib.parse.urlsplit(response.url)
   assert final.scheme=='https' and final.hostname and (final.hostname=='github.com' or final.hostname.endswith('.githubusercontent.com'))
   assert response.status in (200,206)
   if response.status==206:assert response.headers['Content-Range'].startswith('bytes 0-') and response.headers['Content-Range'].endswith('/'+str(item['size_bytes']))
   else:assert int(response.headers['Content-Length'])==item['size_bytes']
   head=response.read(4096);assert head.startswith(b'PK\x03\x04')
  verified.append({'key':item['key'],'bytes':item['size_bytes'],'sha256':item['sha256'],'anonymousDownloadProbeBytes':len(head),'releaseDigestMatches':True})
 return verified
def read(path):
 request=urllib.request.Request(BASE+path,headers={'User-Agent':'BL-CLEA7-public-delivery-check','Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=20) as response:
  if response.status!=200 or not response.url.startswith(BASE):raise ValueError('Unexpected public status or redirect for '+path)
  return response.read(2*1024*1024)
def check():
 home=read('').decode();assert 'ILDuA90WSVz2FTZdmWleQ0lzbGCLmFndZ6wlT5V74Ow' in home;assert 'studio/workbench/' in home
 verified_pages=[]
 for name in ['index.html','proizvodi.html','vizija.html','dokumentacija.html','preuzimanja.html','ai.html','privatnost.html','bil.html']:
  assert read(name)==(ROOT/name).read_bytes(),'Published page is not yet current: '+name
  verified_pages.append(name)
 page=read('preuzimanja.html').decode();assert 'Preuzmi SDK' in page and '/actions/runs/' not in page
 assert b'BIL' in read('bil.html')
 compiler=read('studio/workbench/bil-compiler.js');assert compiler==(ROOT/'studio/workbench/bil-compiler.js').read_bytes(),'Published BIL compiler differs.'
 engine=read('studio/workbench/engine.js');assert engine==(ROOT/'studio/workbench/engine.js').read_bytes(),'Published runtime differs from verified source.'
 assert b'CLEA7Library' in read('studio/launcher/library.js')
 catalog=json.loads(read('releases.json'));assert catalog['source_commit']=='72249d92e1d817fe2b5c726e4c18b6b0a83ed74b'
 verified=[]
 for entry in catalog['published']:
  path=entry['url'];assert path.startswith('downloads/') and '..' not in path and ':' not in path
  data=read(path);assert len(data)==entry['size_bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256'],path
  verified.append({'path':path,'bytes':len(data),'sha256':entry['sha256']})
 expected=json.loads((ROOT/'releases.json').read_text())
 if expected['native']['state']=='published':assert catalog['native']==expected['native'],'Published catalog is not yet current.'
 native=native_checks(catalog['native']) if catalog['native']['state']=='published' else []
 report={'format':'clea7.live-delivery-check/1','url':BASE,'anonymous':True,'runtimeMatchesVerifiedSource':True,'publicPagesMatchVerifiedSource':verified_pages,'downloads':verified,'nativeStatus':catalog['native']['state'],'nativeDownloads':native}
 target=ROOT/'test-evidence/live-delivery.json';target.parent.mkdir(exist_ok=True);target.write_text(json.dumps(report,indent=2)+'\n');print('PUBLIC_LIVE_DELIVERY '+json.dumps(report))
if __name__=='__main__':
 for attempt in range(4):
  try:check();break
  except (OSError,ValueError,AssertionError) as error:
   if attempt==3:raise SystemExit('PUBLIC_LIVE_CHECK_FAILED '+str(error))
   print('Waiting for deployment/CDN, retry',attempt+1);time.sleep(5)
