"""Promote only exact native Android binaries with completed observed scene/OCR proof."""
import hashlib,json,os,subprocess,tempfile,zipfile
from pathlib import Path
from .publish_checked_037 import REPO,download,verify
TAG='clea7-android-0.42.2-test'
SOURCE='0db40117ddc96238a1a1d1b54eb4f57e7e18a6e6'
ARCHIVE_BYTES=6428594
ARCHIVE_SHA='054d67fac87cc3f72d870700d2cf97e4b76839aa399387a7a93c270f084f3b99'
ASSETS={'android-037/runtime/BL-CLEA7-Runtime-debug.apk': ('BL-CLEA7-Runtime-Android-0.42.2-debug.apk', 5195655, 'd49dc44c77d3561c9221a1a3d3fd349f4dedab6fb8c0d4e50ba0863dde1ead58'), 'android-037/apk/application-debug.apk': ('BL-CLEA-Sense-CV-0.42.2-debug.apk', 276969, 'af4a88d502fdd8e6e2044232678cdfaed4fc18fd0da472d386bb1165d67364e9'), 'android-037/aab/application-release-unsigned.aab': ('BL-CLEA-Sense-CV-0.42.2-unsigned.aab', 235919, 'ece42356f3f3be0501addd823e0309e962d72324df056ba1a77020657d8d4e11'), 'android-040/BL-CLEA7-Draw-0.40-debug.apk': ('BL-CLEA7-Draw-0.42.2-debug.apk', 280013, 'b892e15a6d7d07a6b64749eaf3a7b0fda787d58d738dbeeb417522b323e0dfb9'), 'android-042/scene-native/android/app/build/outputs/apk/debug/app-debug.apk': ('BL-CLEA7-Scene-0.42.2-debug.apk', 277313, '2e57bd1be52255cb998ebb1d69e7af3fb355cc1e0ab28ea24dba2e412fec54cf'), 'sense-bil-037/sense-cv.clea7': ('BL-CLEA-Sense-CV-0.42.2.clea7', 54193, 'bfdc60224fc199c2056438f99ba9df6603254c353f91c54c9a7df7b40afa8a5d'), 'draw-040/draw-door.clea7': ('BL-CLEA7-Draw-0.42.2.clea7', 59740, '2b475978577db1670c09308d8fa90055f9ccb9f5028ddf6736113f452bd5b102')}
REQUIRED=frozenset(('package-opened','touchscreen-finger','physics-wall','native-svg','activity-restart'))
OCR_REQUIRED=frozenset(('local-worker-result','fixture-text-recognized'))

def completed(text,marker,required):
 if len(text.encode())>32768 or 'CLEA7_SCENE_ANDROID_FAILURE' in text:raise ValueError('Native execution failed')
 rows=[line.split(marker,1)[1].strip() for line in text.splitlines() if marker in line]
 if len(rows)!=1:raise ValueError('One completed observed result is required')
 value=json.loads(rows[0])
 if not isinstance(value,list) or len(value)!=len(required) or any(not isinstance(x,str) for x in value) or set(value)!=required:raise ValueError('Incomplete observed native result')
 return value

def validate_evidence(bundle):
 proof=json.loads(bundle.read('android-037/report.json'))
 flags=('actualGradleBuild','actualAndroidEmulatorSenseTest','independentRuntimeInstallAndSenseTest','actualAndroidEmulatorDrawTest','actualAndroidEmulatorSceneTest','independentRuntimeSceneTest','nativeOcrRecognition')
 if proof.get('source')!=SOURCE or not all(proof.get(k) is True for k in flags):raise ValueError('Matching actual build and native evidence required')
 if not all(proof.get('draw',{}).get(k) is True for k in ('actualAndroidExecuted','embeddedRuntimePassed','independentRuntimePassed','activityRestartPassed')):raise ValueError('Completed Draw execution required')
 scene=proof.get('scene',{})
 for host,field in (('native','embeddedChecks'),('runtime','independentChecks')):
  raw=bundle.read('android-042/'+host+'-scene.txt');text=raw.decode()
  if hashlib.sha256(raw).hexdigest()!=scene.get('logSha256',{}).get('embedded' if host=='native' else 'independent'):raise ValueError('Native log integrity failed')
  if completed(text,'CLEA7_SCENE_ANDROID_CHECKS ',REQUIRED)!=scene.get(field):raise ValueError('Receipt differs from actual scene observations')
  if host=='runtime' and completed(text,'CLEA7_ANDROID_OCR_CHECKS ',OCR_REQUIRED)!=scene.get('nativeOcrChecks'):raise ValueError('Receipt differs from actual OCR observations')
 return proof

def extract(archive,destination):
 verify(archive,ARCHIVE_BYTES,ARCHIVE_SHA)
 with zipfile.ZipFile(archive) as bundle:
  if len(bundle.namelist())!=len(set(bundle.namelist())):raise ValueError('Duplicate artifact entry')
  validate_evidence(bundle)
  files=[]
  for path,(name,size,digest) in ASSETS.items():
   if bundle.getinfo(path).file_size!=size:raise ValueError('Artifact size changed')
   data=bundle.read(path)
   if len(data)!=size or hashlib.sha256(data).hexdigest()!=digest:raise ValueError('Artifact integrity failed')
   output=destination/name
   with output.open('xb') as stream:stream.write(data)
   files.append(output)
 return files

def main():
 if os.environ.get('GITHUB_REPOSITORY')!=REPO or os.environ.get('GITHUB_ACTOR')!='omer87h-ctrl' or os.environ.get('GITHUB_EVENT_NAME')!='workflow_dispatch':raise ValueError('Explicit owner dispatch required')
 root=Path(__file__).resolve().parents[1]
 receipt=json.loads((root/'release/android-0422.json').read_text())
 if receipt.get('source')!=SOURCE or receipt.get('verificationRun')!=43791225576 or receipt.get('nativeOcrRecognition') is not True:raise ValueError('Exact checked public receipt required')
 with tempfile.TemporaryDirectory(prefix='clea-android0422-') as temp:
  folder=Path(temp);archive=folder/'approved.zip';download(os.environ.get('CLEA_APPROVED_TRANSFER_URL',''),archive,archive_bytes=ARCHIVE_BYTES,archive_sha=ARCHIVE_SHA)
  files=extract(archive,folder);sums=folder/'SHA256SUMS.txt';sums.write_text(''.join(sha+'  '+name+'\n' for name,_,sha in ASSETS.values()))
  subprocess.run(['gh','release','create',TAG,*(str(p)for p in files),str(sums),str(root/'release/android-0422.json'),'--repo',REPO,'--target',os.environ['GITHUB_SHA'],'--prerelease','--title','BL CLEA7 Android0.42.2 — shared Core, local OCR, Sense and Draw','--notes-file',str(root/'release/0422-ANDROID-NOTES.md')],check=True)
 print('Published exact checked Android binaries; QA APKs, private source and logs excluded')

if __name__=='__main__':
 try:main()
 except Exception as error:
  print('Checked Android publication failed: '+type(error).__name__);raise SystemExit(1)
