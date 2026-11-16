"""Rebuild only the exact reviewed public SDK from its audited source inventory."""
import hashlib,json,zipfile
from pathlib import Path,PurePosixPath

ROOT=Path(__file__).resolve().parents[1]
NAME='BL-CLEA7-Core-SDK-0.42.2-test.zip'
SIZE=5751111
SHA='f4798604330d115f59413d69fd5ca5e139730101ed03c8ee58b1672a1c9b5ddd'

def build(root=ROOT):
    source=root/'sdk-source';output=root/'sense/downloads'/NAME
    inventory=json.loads((source/'SDK-INVENTORY.json').read_text())
    if inventory.get('version')!='0.42.2-test' or len(inventory['files'])!=156:
        raise ValueError('Wrong reviewed SDK inventory')
    files={}
    for row in inventory['files']:
        name=row['path'];p=PurePosixPath(name);path=source/name
        if p.is_absolute() or '..' in p.parts or str(p)!=name or '\\' in name or path.is_symlink() or not path.resolve().is_relative_to(source.resolve()) or name in files:
            raise ValueError('Unsafe or repeated SDK path')
        data=path.read_bytes()
        if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']:
            raise ValueError('SDK source differs from reviewed inventory: '+name)
        files[name]=data
    files['SDK-INVENTORY.json']=(source/'SDK-INVENTORY.json').read_bytes()
    if len(files)!=157 or sum(map(len,files.values()))>20*1024**2:
        raise ValueError('SDK curation budget changed')
    with zipfile.ZipFile(root/'sense/downloads/BL-CLEA7-SDK-0.17.0-test.zip') as original:
        for name in ('LICENSE.txt','MATERIALS-LICENSE.txt'):
            if files[name]!=original.read(name):raise ValueError('Existing licence changed')
    if output.exists():
        if output.stat().st_size!=SIZE or hashlib.sha256(output.read_bytes()).hexdigest()!=SHA:raise ValueError('Immutable SDK already exists with other bytes')
        return False
    output.parent.mkdir(parents=True,exist_ok=True)
    try:
        with output.open('xb') as stream,zipfile.ZipFile(stream,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
            for name,data in sorted(files.items()):
                entry=zipfile.ZipInfo(name,date_time=(2026,11,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED;entry.external_attr=0o100644<<16;archive.writestr(entry,data)
        if output.stat().st_size!=SIZE or hashlib.sha256(output.read_bytes()).hexdigest()!=SHA:raise ValueError('Rebuilt SDK differs from independently tested archive')
    except Exception:
        output.unlink(missing_ok=True);raise
    return True

if __name__=='__main__':
    changed=build();print(json.dumps({'version':'0.42.2-test','bytes':SIZE,'sha256':SHA,'created':changed}))
