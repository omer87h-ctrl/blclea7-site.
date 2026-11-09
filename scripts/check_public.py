"""Static public-site, local download and public/private boundary checks."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
 def __init__(self,p):super().__init__();self.links=[];self.ids=[];self.mains=0;self.feed(p.read_text())
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='main':self.mains+=1
  if 'id' in a:self.ids.append(a['id'])
  if tag in ('a','script','img','link'):
   v=a.get('href')or a.get('src')
   if v:self.links.append(v)
count=0
for path in [*ROOT.glob('*.html'),*(ROOT/'studio').rglob('*.html'),*(ROOT/'razgovor').glob('*.html')]:
 page=Page(path);assert len(set(page.ids))==len(page.ids),(path,'duplicate ids');assert page.mains==1,(path,'main landmarks')
 for url in page.links:
  parsed=urlsplit(url)
  if parsed.scheme or parsed.netloc:continue
  target=(path.parent/unquote(parsed.path)).resolve() if parsed.path else path.resolve()
  if target.is_dir():target=target/'index.html'
  assert target.is_relative_to(ROOT) and target.is_file(),(path,'missing local resource',url)
  if parsed.fragment:assert unquote(parsed.fragment) in Page(target).ids,(path,'missing fragment',url)
  count+=1
for p in ROOT.glob('*.html'):
 text=p.read_text();assert 'https://clea7.brzoilokalno.com/' in text and 'rel="canonical"' in text,p
 assert '/actions/runs/' not in text,(p,'private artifact link advertised publicly')
 assert 'Content-Security-Policy' in text,p
assert (ROOT/'CNAME').read_text()=='clea7.brzoilokalno.com\n'
assert 'ILDuA90WSVz2FTZdmWleQ0lzbGCLmFndZ6wlT5V74Ow' in (ROOT/'index.html').read_text()
assert not list(ROOT.rglob('session.json')) and not list(ROOT.rglob('identity.json'))
for forbidden in ['main.py','runtime_main.py','clea7/desktop.py','clea7/host.py','clea7/cloud_ai.py','clea7/ai.py']:
 assert not (ROOT/'sdk-source'/forbidden).exists(),forbidden
catalog=json.loads((ROOT/'releases.json').read_text());assert catalog['source_commit']=='0078c9dd62ce6497d741cebfc254306ad43ab177'
download_page=(ROOT/'preuzimanja.html').read_text()
for page in ROOT.glob('*.html'):
 assert 'Studio i SDK 0.38-test · Android Runtime 0.37-test' in page.read_text(),(page,'stale visible release version')
for entry in catalog['published']:
 p=ROOT/entry['url'];data=p.read_bytes();assert p.is_relative_to(ROOT) and len(data)==entry['size_bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256'],p
 if entry['key'] in ('sdk','preview'):
  assert entry['url'] in download_page and entry['sha256'] in download_page,(p,'stale visible download metadata')
if catalog['native']['state']=='published':
 native=catalog['native'];assert native['repository']=='omer87h-ctrl/blclea7-site.' and native['tag']=='clea7-0.15.0-5baaace'
 assert native['source_commit']=='5baaace802746bd64d972568e034abf252b8db73' and native['version']=='0.15.0'
 assert len(native['assets'])==4 and {a['key'] for a in native['assets']}=={'studio','runtime','android','installer'}
 page=(ROOT/'preuzimanja.html').read_text()
 for a in native['assets']:
  assert a['url']=='https://github.com/'+native['repository']+'/releases/download/'+native['tag']+'/'+a['name']
  assert len(a['sha256'])==64 and a['size_bytes']>0 and a['url'] in page and a['sha256'] in page
with zipfile.ZipFile(ROOT/next(a['url'] for a in catalog['published'] if a['key']=='sdk')) as archive:
 assert archive.testzip() is None
 assert 'clea7/__main__.py' in archive.namelist() and 'web/workbench/diagnostics.js' in archive.namelist()
 assert not any('/__pycache__/' in n or n in ('main.py','runtime_main.py') for n in archive.namelist())
manifest=json.loads((ROOT/'release/web-018.json').read_text())
assert manifest['version']=='0.18.0-test'
for item in manifest['files']:
 data=(ROOT/item['path']).read_bytes();assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256'],item['path']
print('PUBLIC_SITE_STATIC',count,'local references; canonical/domain/verification; downloads hashed; private-host exclusion verified')

ai=json.loads((ROOT/'release/ai-020.json').read_text())
assert ai['version']=='0.20.0-test' and ai['coreVersion']=='0.18.0'
assert ai['modelFingerprint']=='4a2ecae4216ae50ccbf0d2280331ea1f59bfe2a691aa22bcddd2bfa211e15e76'
for item in ai['files']:
 data=(ROOT/item['path']).read_bytes();assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256'],item['path']
model=json.loads((ROOT/'studio/workbench/chat/model.json').read_text())
assert model['training']['externalWeights'] is False and model['training']['parameterCount']==135349
assert 'workspace=clea-chat' in (ROOT/'ai.html').read_text()
standalone=(ROOT/'razgovor/index.html').read_text()
assert 'https://clea7.brzoilokalno.com/razgovor/' in standalone
assert 'Content-Security-Policy' in standalone and '20 CLEA tema' in standalone
assert 'href="razgovor/"' in (ROOT/'ai.html').read_text()
assert 'studio.js' not in standalone and 'clea-chat' in standalone
print('PUBLIC_ORIGINAL_CHAT model, Studio overlay and exact source hashes verified')

current=catalog['native_current']
assert current['state']=='published' and current['version']=='0.37.0-test'
assert current['publication_run']==42505458540 and current['production_signed'] is False
for a in current['assets']:
 assert a['url']=='https://github.com/omer87h-ctrl/blclea7-site./releases/download/clea7-0.37.0-test/'+a['name']
 assert len(a['sha256'])==64 and a['size_bytes']>0
 assert a['url'] in download_page or ('downloads/'+a['name']) in download_page
print('PUBLIC_CHECKED_037 current installer, Android and universal package release metadata verified')

windows=catalog["windows_current"]
assert windows["state"]=="published" and windows["publication_run"]==42560374444
assert windows["source_commit"]=="e274a756db0f367684fde2fe2bb61840a3bf8f27"
asset=windows["assets"][0]
assert asset["size_bytes"]==249142364 and asset["sha256"]=="86634ddb6fa92b23eef0f5a5d7237a62d4f0595e66a1d24357e38b657d60d006"
assert asset["url"] in download_page and asset["sha256"] in download_page
print("PUBLIC_CHECKED_WINDOWS038 exact installed binary and anonymous release link verified")
