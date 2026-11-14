"""Finite promotion of exactly verified Android0.40 Studio-authored applications."""
import hashlib,json,os,subprocess,tempfile,zipfile
from pathlib import Path
from .publish_checked_037 import REPO,download,verify
TAG='clea7-android-0.40-test'
SOURCE='9c319ff92c9e8df223aff7274b922cce5baef616'
ARCHIVE_BYTES=1013038
ARCHIVE_SHA='6a9e20f5ab01f4846481f188f3074ce438d94ec370f5cd1fbed1f114d59ea599'
ASSETS={'android-037/apk/application-debug.apk': ('BL-CLEA-Sense-CV-0.40-debug.apk', 261708, '2df81e89282499bb0b360d54b9335e83ac0e5b58011fc952c87a3990a1269c01'), 'android-037/aab/application-release-unsigned.aab': ('BL-CLEA-Sense-CV-0.40-unsigned.aab', 222707, 'f9590586ffd33ab854e77860ee3dc7c70eb8e5bb62b836e54cb5d010e4b5e796'), 'android-037/runtime/BL-CLEA7-Runtime-debug.apk': ('BL-CLEA7-Runtime-Android-0.40-debug.apk', 256862, '34f956180424b3a2b4d367c1b1cce833bb2e9acce23c4cb27551d87a2e18d184'), 'sense-bil-037/sense-cv.clea7': ('BL-CLEA-Sense-CV-0.40.clea7', 54193, '0fe0aba9c273df76d38e2b0d858df62524d748136554153bc05d555a3bf9a3cc'), 'android-040/BL-CLEA7-Draw-0.40-debug.apk': ('BL-CLEA7-Draw-0.40-debug.apk', 264752, '587dc0f5c932293ca3c7c2e45c5414750b291d244c0d4bba7b13417c0f092b9c'), 'draw-040/draw-door.clea7': ('BL-CLEA7-Draw-0.40.clea7', 59740, 'a5d79446c93957a155caa569f4abadaca7bdf5b4c46bc26e0945fa3f6f11d627')}

def extract(archive,destination):
 verify(archive,ARCHIVE_BYTES,ARCHIVE_SHA)
 with zipfile.ZipFile(archive) as bundle:
  if len(bundle.namelist())!=len(set(bundle.namelist())):raise ValueError('Duplicate artifact entry.')
  proof=json.loads(bundle.read('android-037/report.json'))
  if proof.get('source')!=SOURCE or not all(proof.get(k) is True for k in ('actualGradleBuild','actualAndroidEmulatorSenseTest','independentRuntimeInstallAndSenseTest','actualAndroidEmulatorDrawTest')):raise ValueError('Matching native build and emulator receipt required.')
  if not all(proof.get('draw',{}).get(k) is True for k in ('actualAndroidExecuted','embeddedRuntimePassed','independentRuntimePassed','activityRestartPassed')):raise ValueError('Actual embedded and independent Draw proof is required.')
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
 with tempfile.TemporaryDirectory(prefix='clea-android040-') as temp:
  folder=Path(temp);archive=folder/'approved.zip';download(os.environ.get('CLEA_APPROVED_TRANSFER_URL',''),archive,archive_bytes=ARCHIVE_BYTES,archive_sha=ARCHIVE_SHA)
  files=extract(archive,folder);sums=folder/'SHA256SUMS.txt';sums.write_text(''.join(sha+'  '+name+'\n' for name,_,sha in ASSETS.values()))
  subprocess.run(['gh','release','create',TAG,*(str(p) for p in files),str(sums),str(root/'release/android-040.json'),'--repo',REPO,'--target',os.environ['GITHUB_SHA'],'--prerelease','--title','BL CLEA7 Android0.40 — functional Draw and shared Runtime','--notes-file',str(root/'release/040-ANDROID-NOTES.md')],check=True)
 print('Published exact checked Android0.40 artifacts; no model/private source.')

if __name__=='__main__':
 try:main()
 except Exception as error:
  print('Checked Android publication failed: '+type(error).__name__);raise SystemExit(1)
