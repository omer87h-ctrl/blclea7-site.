"""Prepare curated public downloads on a review branch; never publish a release."""
import hashlib,json,subprocess,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE='7484805dd18089855b72caebdc8be400dd6f53ed'
def main():
 source=ROOT/'sdk-source'
 subprocess.run(['python','-m','clea7','bil','package','sdk/examples/bil/motion-scene.bil','--output',str(ROOT/'downloads/primjer-svjetlosna-putanja.clea7'),'--id','motion_scene'],cwd=source,check=True)
 subprocess.run(['python','-m','clea7','validate',str(ROOT/'downloads/primjer-svjetlosna-putanja.clea7')],cwd=source,check=True)
 subprocess.run(['python','-m','clea7','test',str(ROOT/'downloads/primjer-svjetlosna-putanja.clea7'),'--flow','bil_advance'],cwd=source,check=True)
 target=ROOT/'downloads/BL-CLEA7-SDK-0.14.0.zip'
 forbidden={'host.py','desktop.py','cloud_ai.py','ai.py','main.py','runtime_main.py','toolchain.py','identity.json','session.json'}
 files=[p for p in sorted(source.rglob('*')) if p.is_file() and '__pycache__' not in p.parts]
 if any(p.name in forbidden for p in files):raise RuntimeError('Private host or user data cannot enter public SDK.')
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
  for p in files:
   info=zipfile.ZipInfo(p.relative_to(source).as_posix(),date_time=(2026,10,18,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;archive.writestr(info,p.read_bytes())
 with zipfile.ZipFile(target) as archive:
  if archive.testzip() is not None:raise RuntimeError('SDK CRC failed.')
 preview=ROOT/'downloads/BLclea7-Studio-pregled-0.14.html'
 subprocess.run(['python',str(ROOT/'scripts/offline-preview/build_preview.py'),'--source-root',str(ROOT/'studio'),'--output',str(preview)],check=True)
 entries=[]
 for key,p in [('sdk',target),('preview',preview),('visual-example',ROOT/'downloads/primjer-svjetlosna-putanja.clea7')]:
  data=p.read_bytes();entries.append({'key':key,'name':p.name,'url':p.relative_to(ROOT).as_posix(),'size_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 receipt={'format':'clea7.prepared-public-downloads/1','version':'0.14.0','source_commit':SOURCE,'published':False,'files':entries}
 (ROOT/'release/prepared-local-014.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print('PREPARED_LOCAL_DOWNLOADS '+json.dumps(receipt))
if __name__=='__main__':main()
