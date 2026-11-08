"""Safe local SDK diagnostics: versions and contracts, never environment secrets."""
import platform
import shutil
from . import __version__
from .bil import request
from .schema import UserError

def inspect():
    value={'format':'clea7.sdk.doctor/1','sdkVersion':__version__,
           'status':'development','python':platform.python_version(),
           'minimumPython':'3.12.0','pythonSupported':tuple(map(int,platform.python_version_tuple()[:2]))>=(3,12),
           'nodeAvailable':shutil.which('node') is not None,
           'networkUsed':False,'modelsBundled':False}
    if not value['nodeAvailable']:
        value.update(ready=False,problem='Node.js 22+ je potreban za BIL razvojne komande. Nije automatski preuzet.')
        return value
    try:
        checked=request({'action':'doctor'})
        value.update(node=checked['node'],minimumNode=checked['minimumNode'],
                     nodeSupported=checked['nodeSupported'],compiler=checked['compiler'])
        value['ready']=value['pythonSupported'] and value['nodeSupported']
    except UserError:
        value.update(ready=False,problem='Lokalni kompajler nije uspješno provjeren. Provjeri SDK datoteke i Node.js verziju.')
    return value
