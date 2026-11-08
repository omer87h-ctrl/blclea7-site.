"""Read-only accounting for explicitly selected CLEA storage. Never deletes data."""
import os
from pathlib import Path
import shutil


def inspect(root):
    root=Path(root)
    if root.is_symlink() or not root.is_dir():raise ValueError('Odaberi postojeći CLEA direktorij bez simboličke veze.')
    usage=shutil.disk_usage(root);zones={'models':0,'knowledge':0,'cache':0,'projects':0,'packages':0}
    files=0;partial=False
    for entry in root.iterdir():
        name=entry.name
        zone=('models' if name=='models' else 'knowledge' if name.startswith('knowledge-') else
              'cache' if name=='cache' else 'projects' if name=='projects' else
              'packages' if name.startswith(('desktop-','preview-','bin')) else None)
        if zone is None or entry.is_symlink():continue
        stack=[(entry,0)]
        while stack:
            path,depth=stack.pop()
            if depth>12 or files>=20000:partial=True;continue
            if path.is_symlink():continue
            if path.is_file():zones[zone]+=path.stat().st_size;files+=1;continue
            if not path.is_dir():continue
            with os.scandir(path) as children:
                for child in children:
                    if not child.is_symlink():stack.append((Path(child.path),depth+1))
                    if len(stack)>20000:partial=True;break
    reserve=max(10*1024**3,int(usage.total*.05))
    return {'schema':'clea7.storage-budget/1','diskTotalBytes':usage.total,'freeBytes':usage.free,
            'recommendedReserveBytes':reserve,'usableWithoutReserveBytes':max(0,usage.free-reserve),
            'zones':zones,'filesCounted':files,'partial':partial,'deletionPerformed':False,
            'swapModified':False,'ssdReplacesRAM':False}
