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
for path in [*ROOT.glob('*.html'),*(ROOT/'studio').rglob('*.html')]:
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
catalog=json.loads((ROOT/'releases.json').read_text());assert catalog['source_commit']=='72249d92e1d817fe2b5c726e4c18b6b0a83ed74b'
for entry in catalog['published']:
 p=ROOT/entry['url'];data=p.read_bytes();assert p.is_relative_to(ROOT) and len(data)==entry['size_bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256'],p
if catalog['native']['state']=='published':
 native=catalog['native'];assert native['repository']=='omer87h-ctrl/blclea7-site.' and native['tag']=='clea7-0.6.0-72249d9'
 assert len(native['assets'])==3 and {a['key'] for a in native['assets']}=={'studio','runtime','android'}
 page=(ROOT/'preuzimanja.html').read_text()
 for a in native['assets']:
  assert a['url']=='https://github.com/'+native['repository']+'/releases/download/'+native['tag']+'/'+a['name']
  assert len(a['sha256'])==64 and a['size_bytes']>0 and a['url'] in page and a['sha256'] in page
with zipfile.ZipFile(ROOT/'downloads/BL-CLEA7-SDK-0.6.0.zip') as archive:
 assert archive.testzip() is None
 assert 'clea7/__main__.py' in archive.namelist() and 'web/workbench/diagnostics.js' in archive.namelist()
 assert not any('/__pycache__/' in n or n in ('main.py','runtime_main.py') for n in archive.namelist())
print('PUBLIC_SITE_STATIC',count,'local references; canonical/domain/verification; downloads hashed; private-host exclusion verified')
