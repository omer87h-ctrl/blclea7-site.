"""Finite transfer of the exact owner-approved, already-tested 0.37 installer.

No repository source, models, local files or arbitrary URL artifacts are accepted.
The temporary URL transports an approved public binary; it is never logged.
"""
import hashlib,json,os,stat,subprocess,tempfile,zipfile
from pathlib import Path,PurePosixPath
from urllib.parse import urlsplit
from urllib.request import Request,build_opener,HTTPRedirectHandler

REPO='omer87h-ctrl/blclea7-site.'
TAG='clea7-0.37.0-test'
ARCHIVE_BYTES=249151144
ARCHIVE_SHA='6a0819c78ede2b97bcc86b8337805310ac603aeed4415f77f9f9868531c87af6'
INSTALLER='BLclea7-Setup-Windows-x64.exe'
INSTALLER_BYTES=249093574
INSTALLER_SHA='3384072fec6a8c982bc74c24d217a82176a9c72c97eef2be1b678293b0aed531'
SMALL={
 'BL-CLEA7-Runtime-Android-0.37-debug.apk':(251702,'91d840360bb8b84ec2d8a6255a9076d9eabb77d638c1af4d95a4a684e3350372'),
 'BL-CLEA-Sense-CV-0.37-debug.apk':(256540,'bc0b1c3545ed11c73363d3a0ec2b2687810115aca2499c4d1c6e311f9f85c221'),
 'BL-CLEA-Sense-CV-0.37.clea7':(33632,'480f78279457d506ee11a5cc744244446f40469b54876033630147f7a3ee9882'),
}

def validate_url(value):
 u=urlsplit(value)
 if (u.scheme!='https' or not u.hostname or not u.hostname.endswith('.oaiusercontent.com')
     or u.username or u.password or u.port or u.fragment or not u.path.startswith('/files/')
     or not u.path.endswith('/raw') or not u.query or len(value)>6000):
  raise ValueError('Expected a bounded HTTPS transfer of the approved binary.')
 return value

def verify(path,size,digest):
 if path.is_symlink() or path.stat().st_size!=size:raise ValueError('Artifact size mismatch.')
 sha=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):sha.update(block)
 if sha.hexdigest()!=digest:raise ValueError('Artifact SHA256 mismatch.')

class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None

def download(value,path,*,archive_bytes=ARCHIVE_BYTES,archive_sha=ARCHIVE_SHA):
 value=validate_url(value)
 with build_opener(NoRedirect()).open(Request(value,headers={'User-Agent':'CLEA-approved-binary-transfer/0.37'}),timeout=45) as response,path.open('xb') as output:
  if response.status!=200:raise ValueError('Transfer unavailable.')
  size=0
  while block:=response.read(1024*1024):
   size+=len(block)
   if size>archive_bytes:raise ValueError('Transfer exceeds approved size.')
   output.write(block)
 verify(path,archive_bytes,archive_sha)

def unpack(path,destination,*,archive_bytes=ARCHIVE_BYTES,archive_sha=ARCHIVE_SHA,installer_bytes=INSTALLER_BYTES,installer_sha=INSTALLER_SHA):
 verify(path,archive_bytes,archive_sha)
 with zipfile.ZipFile(path) as archive:
  entries=archive.infolist();names=[e.filename for e in entries]
  if len(names)!=len(set(names)):raise ValueError('Duplicate archive entry.')
  for entry in entries:
   p=PurePosixPath(entry.filename)
   if p.is_absolute() or '..' in p.parts or '\\' in entry.filename or stat.S_ISLNK(entry.external_attr>>16):
    raise ValueError('Unexpected archive path.')
  selected=[e for e in entries if PurePosixPath(e.filename).name==INSTALLER]
  if len(selected)!=1 or selected[0].file_size!=installer_bytes:raise ValueError('Approved installer is missing.')
  result=destination/INSTALLER
  with archive.open(selected[0]) as source,result.open('xb') as output:
   total=0
   while block:=source.read(1024*1024):
    total+=len(block)
    if total>installer_bytes:raise ValueError('Unexpected expanded installer size.')
    output.write(block)
 verify(result,installer_bytes,installer_sha)
 return result

def main():
 if (os.environ.get('GITHUB_REPOSITORY')!=REPO or os.environ.get('GITHUB_ACTOR')!='omer87h-ctrl'
     or os.environ.get('GITHUB_EVENT_NAME')!='workflow_dispatch'):
  raise ValueError('Explicit owner release dispatch required.')
 value=validate_url(os.environ.get('CLEA_APPROVED_TRANSFER_URL',''))
 root=Path(__file__).resolve().parents[1]
 for name,(size,sha) in SMALL.items():verify(root/'downloads'/name,size,sha)
 with tempfile.TemporaryDirectory(prefix='clea-approved-037-') as folder:
  folder=Path(folder);archive=folder/'approved.zip';download(value,archive);installer=unpack(archive,folder)
  sums=folder/'SHA256SUMS.txt'
  sums.write_text(INSTALLER_SHA+'  '+INSTALLER+'\n'+''.join(sha+'  '+name+'\n' for name,(_,sha) in SMALL.items()))
  provenance=folder/'provenance.json'
  provenance.write_text(json.dumps({'format':'clea7.checked-public-binaries/1','version':'0.37.0-test',
   'windows':{'buildRun':42497146663,'installAndUninstallRun':42498727971,'source':'1a98860fdf85269f1871a0eb408df42084f8b981','sha256':INSTALLER_SHA},
   'android':{'run':42496596996,'source':'f73808d3e21056b4a80585c9725a68090b6da413'},
   'productionSigned':False,'containsModel':False,'physicalAssistiveEvaluation':False,
   'webTouchGuidanceIncludedInTheseBinaries':False},indent=2)+'\n')
  subprocess.run(['gh','release','create',TAG,str(installer),*(str(root/'downloads'/name) for name in SMALL),str(sums),str(provenance),
   '--repo',REPO,'--target',os.environ['GITHUB_SHA'],'--prerelease','--title','BL CLEA7 0.37 — checked Studio, Runtime and Sense CV',
   '--notes-file',str(root/'release/037-NOTES.md')],check=True)
 print('Published only the exact checked development binaries; no model/source transfer.')

if __name__=='__main__':
 try:main()
 except Exception as error:
  # Network exceptions can contain the signed URL. Never include exception text.
  print('Approved publication failed: '+type(error).__name__);raise SystemExit(1)
