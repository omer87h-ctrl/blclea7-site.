"""Reproduce the public application SDK; exclude private native host and user data."""
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
def main():
 source=ROOT/'sdk-source';target=ROOT/'downloads/BL-CLEA7-SDK-0.6.0.zip'
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
  for p in sorted(source.rglob('*')):
   if p.is_file() and '__pycache__' not in p.parts:
    info=zipfile.ZipInfo(p.relative_to(source).as_posix(),date_time=(2026,10,15,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;archive.writestr(info,p.read_bytes())
 data=target.read_bytes();catalog=json.loads((ROOT/'releases.json').read_text());entry=next(a for a in catalog['published'] if a['key']=='sdk');entry.update(size_bytes=len(data),sha256=hashlib.sha256(data).hexdigest());(ROOT/'releases.json').write_text(json.dumps(catalog,indent=2)+'\n');print('PUBLIC_SDK',len(data),entry['sha256'])
if __name__=='__main__':main()
