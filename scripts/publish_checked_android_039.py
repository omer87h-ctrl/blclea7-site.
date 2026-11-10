"""Publish only the four exact Android artifacts verified in the owner CLEA build."""
import hashlib,json,os,subprocess,tempfile,zipfile
from pathlib import Path
from .publish_checked_037 import REPO,download,verify

TAG='clea7-android-0.39-test'
SOURCE='a489e7abdbd6766f677a8b9279ea97b3e3b78fce'
ARCHIVE_BYTES=727028
ARCHIVE_SHA='26c029fada0fe2dee88062de67682c3de5baed3a7c869003aff6a727ca1924bf'
ASSETS={
 'android-037/apk/application-debug.apk':('BL-CLEA-Sense-CV-0.39-debug.apk',257028,'eda796c887879033f62d7e2a9811d7d17bf86dca8711fb7d8247e4eb1efc2041'),
 'android-037/aab/application-release-unsigned.aab':('BL-CLEA-Sense-CV-0.39-unsigned.aab',219020,'efbeb930ccf25447f46fb670c871abb3fa619db28233b61d70d3eb2d81fcac5b'),
 'android-037/runtime/BL-CLEA7-Runtime-debug.apk':('BL-CLEA7-Runtime-Android-0.39-debug.apk',252190,'ca204dcf78f4b2e976f81451cdc74f60084dad54d5c55160a5e44bf6657019c0'),
 'sense-bil-037/sense-cv.clea7':('BL-CLEA-Sense-CV-0.39.clea7',54193,'115ae1d51dae72879df930730d66663423e9aeae8fa5f440667448ad14a0615d')}

def extract(archive,destination):
 verify(archive,ARCHIVE_BYTES,ARCHIVE_SHA)
 with zipfile.ZipFile(archive) as bundle:
  if len(bundle.namelist())!=len(set(bundle.namelist())):raise ValueError('Duplicate artifact entry.')
  proof=json.loads(bundle.read('android-037/report.json'))
  if proof.get('source')!=SOURCE or not all(proof.get(k) is True for k in ('actualGradleBuild','actualAndroidEmulatorSenseTest','independentRuntimeInstallAndSenseTest')):raise ValueError('Matching native build and emulator receipt required.')
  files=[]
  for path,(name,size,digest) in ASSETS.items():
   row=bundle.getinfo(path)
   if row.file_size!=size:raise ValueError('Artifact size changed.')
   data=bundle.read(path)
   if len(data)!=size or hashlib.sha256(data).hexdigest()!=digest:raise ValueError('Artifact integrity failed.')
   output=destination/name;output.write_bytes(data);files.append(output)
 return files

def main():
 if os.environ.get('GITHUB_REPOSITORY')!=REPO or os.environ.get('GITHUB_ACTOR')!='omer87h-ctrl' or os.environ.get('GITHUB_EVENT_NAME')!='workflow_dispatch':raise ValueError('Explicit owner dispatch required.')
 root=Path(__file__).resolve().parents[1]
 with tempfile.TemporaryDirectory(prefix='clea-android039-') as temp:
  folder=Path(temp);archive=folder/'approved.zip';download(os.environ.get('CLEA_APPROVED_TRANSFER_URL',''),archive,archive_bytes=ARCHIVE_BYTES,archive_sha=ARCHIVE_SHA)
  files=extract(archive,folder);sums=folder/'SHA256SUMS.txt';sums.write_text(''.join(sha+'  '+name+'\n' for name,_,sha in ASSETS.values()))
  # gh creates a draft before uploading. Resume only our exact empty draft after
  # the earlier local upload lacked uploads.github.com credentials.
  releases=json.loads(subprocess.check_output(['gh','api','repos/'+REPO+'/releases?per_page=100'],text=True))
  existing=next((r for r in releases if r['tag_name']==TAG),None)
  if existing:
   if not existing['draft'] or existing['assets']:raise ValueError('Refuse to replace a published or nonempty release.')
   subprocess.run(['gh','release','upload',TAG,*(str(p) for p in files),str(sums),str(root/'release/android-039.json'),'--repo',REPO],check=True)
   subprocess.run(['gh','api','-X','PATCH','repos/'+REPO+'/releases/'+str(existing['id']),'-F','draft=false','-F','prerelease=true'],check=True,stdout=subprocess.DEVNULL)
  else:
   subprocess.run(['gh','release','create',TAG,*(str(p) for p in files),str(sums),str(root/'release/android-039.json'),'--repo',REPO,'--target',os.environ['GITHUB_SHA'],'--prerelease','--title','BL CLEA7 Android0.39 — verified BIL app and independent Runtime','--notes-file',str(root/'release/039-ANDROID-NOTES.md')],check=True)
 print('Published exact verified Android development artifacts; no model/private source.')

if __name__=='__main__':
 try:main()
 except Exception as error:
  print('Checked Android publication failed: '+type(error).__name__);raise SystemExit(1)
