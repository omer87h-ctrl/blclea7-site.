"""One-time owner-authorized promotion of exact, previously verified binary copies.

No personal token and no private-repository credential are used. Short-lived file
links arrive in an owner-created issue, are redacted immediately, and are never
logged. Only SHA-256-pinned public release binaries can be accepted.
"""
from pathlib import Path,PurePosixPath
import argparse,base64,hashlib,io,json,os,re,urllib.request,urllib.error,urllib.parse,zipfile
SOURCE='omer87h-ctrl/BL-Clea7-by-brzoilokalno'
TARGET='omer87h-ctrl/blclea7-site.'
COMMIT='72249d92e1d817fe2b5c726e4c18b6b0a83ed74b'
RUN=38800912577
TAG='clea7-0.6.0-72249d9'
ARTIFACTS={
 'studio':{'id':12004167892,'name':'BL-CLEA7-Windows-x64','sha256':'2e5ec6eeab98b6b41b2e4949ccbd746e0e7bf0b5d86b02cfc4540897040a9293','size':357120759,'output':'BL-CLEA7-Studio-Windows-x64.zip'},
 'runtime':{'id':12003239974,'name':'BL-CLEA7-Windows-Runtime-x64','sha256':'20a387caf12fc0e07397584889a0194d950b6957264f71da844fdc75784ecf40','size':338278001,'output':'BL-CLEA7-Runtime-Windows-x64.zip'},
 'android':{'id':12003984759,'name':'BL-CLEA7-Android-Runtime-development','sha256':'0dbd92b370cde0e06b5d3785ba614eb0de63aa78228368299793dc20bb4328b7','size':105146,'output':'BL-CLEA7-Runtime-Android-debug.apk'},
}
class ReleaseError(Exception):pass
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
OPENER=urllib.request.build_opener(NoRedirect())
def valid_url(url,upload=False,download=False):
 p=urllib.parse.urlsplit(url)
 if p.scheme!='https' or p.username or p.password or p.port not in (None,443):raise ReleaseError('Unsafe transport URL.')
 if download:
  if not (p.hostname and (p.hostname.endswith('.blob.core.windows.net') or p.hostname.endswith('.githubusercontent.com') or p.hostname.endswith('.actions.githubusercontent.com'))):raise ReleaseError('Unexpected artifact download host.')
 elif p.hostname!=('uploads.github.com' if upload else 'api.github.com'):raise ReleaseError('Unexpected authenticated API host.')
 return url

def api(path,token,method='GET',body=None,upload=False):
 url=path if path.startswith('https:') else 'https://api.github.com'+path;valid_url(url,upload=upload)
 raw=body if isinstance(body,bytes) else json.dumps(body).encode() if body is not None else None
 headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'BL-CLEA7-approved-release','Authorization':'Bearer '+token}
 if raw is not None:headers['Content-Type']='application/octet-stream' if isinstance(body,bytes) else 'application/json'
 try:
  with OPENER.open(urllib.request.Request(url,data=raw,headers=headers,method=method),timeout=180) as response:return json.load(response)
 except urllib.error.HTTPError as error:raise ReleaseError('GitHub API returned '+str(error.code)+' for '+urllib.parse.urlsplit(url).path) from None

def clean_apk(data):
 with zipfile.ZipFile(io.BytesIO(data)) as archive:
  matches=[]
  for entry in archive.infolist():
   name=PurePosixPath(entry.filename)
   if name.is_absolute() or '..' in name.parts or '\\' in entry.filename or entry.file_size>2*1024*1024:raise ReleaseError('Unsafe Android artifact entry.')
   if entry.filename.endswith('.apk'):matches.append(entry)
  if len(matches)!=1:raise ReleaseError('Android artifact must contain exactly one APK.')
  content=archive.read(matches[0]);
  with zipfile.ZipFile(io.BytesIO(content)) as apk:
   if apk.testzip() is not None or 'AndroidManifest.xml' not in apk.namelist() or 'classes.dex' not in apk.namelist():raise ReleaseError('APK structure is invalid.')
  return content

def asset_record(key,name,data):
 return {'key':key,'name':name,'url':'https://github.com/'+TARGET+'/releases/download/'+TAG+'/'+name,'size_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}

def publish_asset(release,name,data,token):
 existing=next((a for a in release.get('assets',[]) if a['name']==name),None)
 digest='sha256:'+hashlib.sha256(data).hexdigest()
 if existing:
  if existing.get('size')!=len(data) or existing.get('digest')!=digest:raise ReleaseError('Existing release asset differs; refusing overwrite.')
  return existing
 upload=release['upload_url'].split('{',1)[0]+'?name='+urllib.parse.quote(name)
 result=api(upload,token,'POST',data,upload=True)
 if result.get('size')!=len(data) or result.get('digest')!=digest:raise ReleaseError('Uploaded release asset metadata failed integrity check.')
 return result


OWNER = 'omer87h-ctrl'
TITLE = 'CLEA7 approved binary promotion 72249d9'

def transfer_url(url):
 try:
  p=urllib.parse.urlsplit(url)
  if (p.scheme!='https' or p.username or p.password or p.port not in (None,443)
      or not p.hostname or not p.hostname.endswith('.oaiusercontent.com')
      or not p.path.startswith('/files/') or p.fragment):
   raise ValueError()
 except (TypeError,ValueError):raise ReleaseError('Transfer URL is outside the approved temporary file service.') from None
 return url

def descriptor(event):
 issue=event.get('issue',{})
 if (event.get('action')!='opened' or event.get('repository',{}).get('full_name')!=TARGET
     or issue.get('user',{}).get('login')!=OWNER or event.get('sender',{}).get('login')!=OWNER
     or issue.get('title')!=TITLE or issue.get('pull_request')):
  raise ReleaseError('Only the repository owner can authorize this exact release transfer.')
 try:body=json.loads(issue.get('body',''))
 except (TypeError,ValueError):raise ReleaseError('Invalid transfer descriptor.') from None
 if (set(body)!={'format','source_commit','assets'} or body.get('format')!='clea7.binary-transfer/1'
     or body.get('source_commit')!=COMMIT or not isinstance(body.get('assets'),dict)
     or set(body['assets'])!=set(ARTIFACTS)):
  raise ReleaseError('Descriptor must identify exactly the approved commit and three artifacts.')
 for value in body['assets'].values():
  if not isinstance(value,dict) or set(value)!={'url'}:raise ReleaseError('Unexpected transfer fields.')
  transfer_url(value['url'])
 return body

def copy_verified(url,spec,path,opener=OPENER):
 # No GitHub Authorization header reaches the file service. Redirects are refused.
 transfer_url(url);digest=hashlib.sha256();size=0
 try:
  with opener.open(urllib.request.Request(url,headers={'User-Agent':'BL-CLEA7-approved-transfer'}),timeout=180) as response, path.open('wb') as output:
   if response.status!=200:raise ReleaseError('Temporary transfer did not return the file.')
   while True:
    chunk=response.read(min(1024*1024,spec['size']-size+1))
    if not chunk:break
    size+=len(chunk)
    if size>spec['size']:raise ReleaseError('Transfer exceeded approved byte limit.')
    output.write(chunk);digest.update(chunk)
 except (OSError,urllib.error.URLError):
  path.unlink(missing_ok=True)
  raise ReleaseError('Temporary file transfer failed; request fresh resource links.') from None
 if size!=spec['size'] or digest.hexdigest()!=spec['sha256']:
  path.unlink(missing_ok=True);raise ReleaseError('Transferred artifact SHA-256 or size differs from the approved binary.')

def publish(folder,token):
 target=api('/repos/'+TARGET,token)
 if target.get('private') or target.get('full_name')!=TARGET:raise ReleaseError('The target must be the exact public site repository.')
 releases=api('/repos/'+TARGET+'/releases?per_page=100',token)
 release=next((r for r in releases if r.get('tag_name')==TAG),None)
 if release is None:
  release=api('/repos/'+TARGET+'/releases',token,'POST',{'tag_name':TAG,'target_commitish':'main','name':'BL CLEA7 0.6 BIL — verified development release','draft':True,'prerelease':True,'body':'Source '+COMMIT+'; verification run '+str(RUN)+'. BIL compiler, Studio-to-package browser workflow, independent Windows Runtime and Android API30 BIL execution checks passed. The BIL visual subset supports initial primitive values and show/visualize; generic BIL forms/tables/native bindings, automatic model connections and general migrations are not included. Windows x64 ZIPs include the renderer for offline use. Android is the separately installable Runtime, debug signed. Windows executables are unsigned. Preserve the attached use terms and all vendor/material notices. This development release is not a claim of complete Android Studio equivalence, physical-device verification, battery superiority or impenetrable security.'})
 records=[]
 for key,spec in ARTIFACTS.items():
  data=(folder/(key+'.zip')).read_bytes()
  if key=='android':data=clean_apk(data)
  record=asset_record(key,spec['output'],data)
  publish_asset(release,record['name'],data,token);records.append(record)
  print('VERIFIED_PUBLIC_ASSET '+json.dumps(record));del data
 provenance={'format':'clea7.binary-release/1','source_commit':COMMIT,'source_run':RUN,'assets':records,'runtime_signature':'unsigned Windows executable; debug Android APK','verification':'Automated browser/native Windows/Android API30 emulator checks. Physical devices and release signing are separate.','source_artifacts':{k:{a:s[a] for a in ['id','name','size','sha256']} for k,s in ARTIFACTS.items()}}
 terms=(Path(__file__).resolve().parents[1]/'docs/USLOVI.txt').read_bytes()
 publish_asset(release,'USLOVI.txt',terms,token)
 publish_asset(release,'provenance.json',json.dumps(provenance,indent=2).encode(),token)
 publish_asset(release,'SHA256SUMS.txt',''.join(r['sha256']+'  '+r['name']+'\n' for r in records).encode(),token)
 if release['draft']:release=api('/repos/'+TARGET+'/releases/'+str(release['id']),token,'PATCH',{'draft':False,'prerelease':True})
 # Anonymous API verification, without the Actions token.
 with OPENER.open(urllib.request.Request('https://api.github.com/repos/'+TARGET+'/releases/tags/'+TAG,headers={'User-Agent':'BL-CLEA7-public-verification'}),timeout=30) as response:public=json.load(response)
 if public.get('draft') or len(public.get('assets',[]))<6:raise ReleaseError('Anonymous release verification failed.')
 for r in records:
  item=next((a for a in public['assets'] if a['name']==r['name']),{})
  if item.get('size')!=r['size_bytes'] or item.get('digest')!='sha256:'+r['sha256'] or item.get('browser_download_url')!=r['url']:raise ReleaseError('Public release asset identity mismatch.')
 result={'state':'published','repository':TARGET,'tag':TAG,'assets':records,'release_url':public['html_url']}
 (folder/'native-release.json').write_text(json.dumps(result,indent=2)+'\n')
 # The catalog change is reviewed separately; no automatic main-branch mutation.
 print('PUBLIC_RELEASE_STATUS '+json.dumps(result))
 return public['html_url']

def main():
 token=os.environ.get('GITHUB_TOKEN','')
 if not token:raise ReleaseError('The public repository Actions token is required.')
 event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text());body=descriptor(event)
 number=event['issue']['number']
 api('/repos/'+TARGET+'/issues/'+str(number),token,'PATCH',{'body':'Owner-authorized transfer received. Temporary resource links removed. Only the three SHA-256-pinned binaries for '+COMMIT+' may be published.'})
 import tempfile
 with tempfile.TemporaryDirectory(prefix='clea7-approved-',dir=os.environ.get('RUNNER_TEMP')) as temporary:
  folder=Path(temporary)
  # Stage all files before upload so the short-lived source links may expire safely.
  for key,spec in ARTIFACTS.items():
   copy_verified(body['assets'][key]['url'],spec,folder/(key+'.zip'))
   print('APPROVED_BINARY '+key+' '+spec['sha256']+' '+str(spec['size']))
  body.clear()
  url=publish(folder,token)
 api('/repos/'+TARGET+'/issues/'+str(number),token,'PATCH',{'state':'closed','state_reason':'completed','body':'Verified public binary release: '+url+'\nSource: '+COMMIT+'\nTemporary transfer links removed. Website catalog activation is reviewed separately.'})

if __name__=='__main__':
 try:main()
 except (ReleaseError,OSError,ValueError,KeyError,zipfile.BadZipFile) as error:
  # Transport exceptions may contain signed URLs, so log only controlled messages.
  message=str(error) if isinstance(error,ReleaseError) else type(error).__name__
  raise SystemExit('PUBLIC_RELEASE_ERROR '+message)
