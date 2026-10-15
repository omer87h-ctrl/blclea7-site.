"""Anonymous HTTPS checks against the deployed owner domain, with no credentials."""
from pathlib import Path
import hashlib,json,time,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parents[1]
BASE='https://clea7.brzoilokalno.com/'
def read(path):
 request=urllib.request.Request(BASE+path,headers={'User-Agent':'BL-CLEA7-public-delivery-check','Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=20) as response:
  if response.status!=200 or not response.url.startswith(BASE):raise ValueError('Unexpected public status or redirect for '+path)
  return response.read(2*1024*1024)
def check():
 home=read('').decode();assert 'ILDuA90WSVz2FTZdmWleQ0lzbGCLmFndZ6wlT5V74Ow' in home;assert 'studio/workbench/' in home
 page=read('preuzimanja.html').decode();assert 'Preuzmi SDK' in page and '/actions/runs/' not in page
 engine=read('studio/workbench/engine.js');assert engine==(ROOT/'studio/workbench/engine.js').read_bytes(),'Published runtime differs from verified source.'
 assert b'CLEA7Library' in read('studio/launcher/library.js')
 catalog=json.loads(read('releases.json'));assert catalog['source_commit']=='e30e619841a6d93e6295bc89c7f50e89778bcac0'
 verified=[]
 for entry in catalog['published']:
  path=entry['url'];assert path.startswith('downloads/') and '..' not in path and ':' not in path
  data=read(path);assert len(data)==entry['size_bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256'],path
  verified.append({'path':path,'bytes':len(data),'sha256':entry['sha256']})
 report={'format':'clea7.live-delivery-check/1','url':BASE,'anonymous':True,'runtimeMatchesVerifiedSource':True,'downloads':verified,'nativeStatus':catalog['native']['state']}
 target=ROOT/'test-evidence/live-delivery.json';target.parent.mkdir(exist_ok=True);target.write_text(json.dumps(report,indent=2)+'\n');print('PUBLIC_LIVE_DELIVERY '+json.dumps(report))
if __name__=='__main__':
 for attempt in range(4):
  try:check();break
  except (OSError,ValueError,AssertionError) as error:
   if attempt==3:raise SystemExit('PUBLIC_LIVE_CHECK_FAILED '+str(error))
   print('Waiting for deployment/CDN, retry',attempt+1);time.sleep(5)
