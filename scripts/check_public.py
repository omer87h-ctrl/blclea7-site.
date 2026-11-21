"""Static public-site, local download and public/private boundary checks."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import hashlib,json,zipfile,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
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
catalog=json.loads((ROOT/'releases.json').read_text());assert catalog['catalogue_baseline']['source_commit']=='980ae86a15fe1ddbb4ec8442fb5bfe4d1f5b9610'
assert catalog['version']==catalog['web_current']['version']==catalog['sdk_current']['version']=='0.44.0-test'
assert catalog['source_commit']==catalog['web_current']['source_commit']==catalog['sdk_current']['source_commit']
download_page=(ROOT/'preuzimanja.html').read_text()
for page in ROOT.glob('*.html'):
 assert 'Web Studio 0.44.0-test · SDK 0.44.0-test · Windows 0.42.2-test · Android 0.42.2-test' in page.read_text(),(page,'stale visible release version')
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

current=catalog['legacy_native_037']
assert current['state']=='published' and current['version']=='0.37.0-test'
assert current['publication_run']==42505458540 and current['production_signed'] is False
for a in current['assets']:
 assert a['url']=='https://github.com/omer87h-ctrl/blclea7-site./releases/download/clea7-0.37.0-test/'+a['name']
 assert len(a['sha256'])==64 and a['size_bytes']>0
 assert a['url'] in download_page or ('downloads/'+a['name']) in download_page
print('PUBLIC_CHECKED_037 current installer, Android and universal package release metadata verified')

windows=catalog['windows_current']
assert windows['state']=='published' and windows['publication_run']==43793066841 and windows['version']=='0.42.2-test'
assert windows['source_commit']=='0db40117ddc96238a1a1d1b54eb4f57e7e18a6e6' and windows['windows_install_run']==43791225579
asset=windows['assets'][0]
assert asset['size_bytes']==253938700 and asset['sha256']=='6c50c1a6efb75a508c8a1f2d5e052eeb8dc40dac65d730ec92848b08f0108ab1'
assert asset['url'] in download_page and asset['sha256'] in download_page
receipt=json.loads((ROOT/'release/windows-installed-scenes-0422.json').read_text())
assert receipt['passed'] and receipt['verificationRun']==43791225579 and receipt['installerSource']==windows['source_commit']
assert receipt['installerSha256']==asset['sha256'] and receipt['installedManifestVerified']=={'verified':True,'product':'studio','files':1048}
assert all(receipt[k] for k in ('actualInstallerExecuted','actualUninstallerExecuted','userFilesPreserved'))
native=json.loads((ROOT/'release/windows-native-0422.json').read_text())
assert native['passed'] and len(native['checks'])==21 and native['sourceCommit']==windows['source_commit']
assert any(x['tag']=='clea7-windows-0.41.1-test' for x in catalog['windows_history'])
assert any(x['tag']=='clea7-windows-0.42.0-test' for x in catalog['windows_history'])
print('PUBLIC_CHECKED_WINDOWS042 exact installed binary,21 native checks and anonymous release link verified')

android=catalog['android_current']
assert android['state']=='published' and android['version']=='0.42.2-test'
assert android['source_commit']=='0db40117ddc96238a1a1d1b54eb4f57e7e18a6e6' and android['verification_run']==43791225576
assert android['publication_run']==43793069538 and android['production_signed'] is False
proof=json.loads((ROOT/'release/android-0422.json').read_text())
assert len(android['assets'])==7 and proof['actualAndroidEmulatorSenseTest'] is True
for asset,expected in zip(android['assets'],proof['publicAssets']):
 assert all(asset[k]==expected[k] for k in ('name','size_bytes','sha256'))
 assert asset['url']=='https://github.com/omer87h-ctrl/blclea7-site./releases/download/clea7-android-0.42.2-test/'+asset['name']
assert android['assets'][0]['url'] in download_page
scene=proof['scene'];required={'package-opened','touchscreen-finger','physics-wall','native-svg','activity-restart'}
assert scene['actualAndroidExecuted'] and set(scene['embeddedChecks'])==required and set(scene['independentChecks'])==required
assert proof['nativeOcrRecognition'] and set(scene['nativeOcrChecks'])=={'local-worker-result','fixture-text-recognized'}
assert proof['nativeOcrSystemPickerTested'] is False and len(proof['ocrAssets']['models'])==2
web_core_changes=[]
for row in proof['ocrAssets']['core']:
 name=Path(row['path']).name;current=ROOT/'studio/workbench'/name
 if hashlib.sha256(current.read_bytes()).hexdigest()!=row['sha256']:
  web_core_changes.append(name);current=ROOT/'release/native-core-0422'/name
 assert current.stat().st_size==row['bytes'] and hashlib.sha256(current.read_bytes()).hexdigest()==row['sha256']
assert set(web_core_changes)=={'bil-compiler.js','bil-runtime.js','clea-core.js'}
assert any(x['version']=='0.40.0-test' for x in catalog['android_history'])
print('PUBLIC_CHECKED_ANDROID0422 historical exact Core/model snapshots retained; new web Core5 is not new native verification')

# Keep the preview unpublished until the owner requests publication.
assert not (ROOT/'proba').exists()
assert 'proba/' not in (ROOT/'index.html').read_text()
assert 'proba/' not in (ROOT/'sitemap.xml').read_text()
assert 'personal_workspace' not in catalog and 'personal_workspace_history' not in catalog
workbench=(ROOT/'studio/workbench/index.html').read_text()
assert 'collaboration.js' not in workbench
assert 'standalone.js?v=' in workbench

proof=json.loads((ROOT/'release/studio-044.json').read_text())
assert proof['sourceCommit']==catalog['source_commit'] and proof['coreVersion']==5
assert proof['python']=={'run':410,'passed':408,'skipped':2,'skipReason':'Windows DPAPI checks on Linux'}
assert proof['actualBrowser']['objectGrammarGroups']==4 and proof['actualBrowser']['freeCompositionGroups']==4
assert proof['hpInferenceVerified'] is False and proof['quality70BVerified'] is False and proof['nativeRebuilt'] is False
sdk=catalog['sdk_current'];data=(ROOT/sdk['url']).read_bytes()
assert len(data)==sdk['size_bytes']==5780401 and hashlib.sha256(data).hexdigest()==sdk['sha256']
with zipfile.ZipFile(ROOT/sdk['url']) as archive:
 assert len(archive.namelist())==160 and 'docs/BIL-OBJECT-GRAMMAR.md' in archive.namelist()
 assert archive.testzip() is None
for row in proof['example']:
 data=(ROOT/row['path']).read_bytes();assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
assert 'objectProgram()' in (ROOT/'studio/workbench/bil-compiler.js').read_text()
assert "case'SELECT'" in (ROOT/'studio/workbench/bil-runtime.js').read_text()
assert 'studio-start-grammar' in (ROOT/'studio/workbench/studio.js').read_text()
print('PUBLIC_CORE5 actual source/SDK/example receipts and preserved public removal verified; no HP/70B/native claim')

mirror=json.loads((ROOT/'sdk-source/SOURCE-STATUS.json').read_text())
assert mirror['version']=='0.44.0-test' and mirror['archiveSha256']==sdk['sha256']
for row in mirror['files']:
 path=ROOT/'sdk-source'/row['path'];data=path.read_bytes()
 assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
print('PUBLIC_SDK_SOURCE current curated CLI source mirror hashes verified')
