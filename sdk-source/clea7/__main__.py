"""Offline developer CLI: validate, package and execute a bounded flow test."""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from .application import validate
from .package import decode,encode,MAX_PACKAGE
from .schema import UserError
from . import __version__

def read(path):
    path=Path(path)
    if path.stat().st_size>MAX_PACKAGE:raise UserError('Datoteka prelazi 2 MiB.')
    raw=path.read_bytes();value=json.loads(raw)
    return decode(raw)['app'] if isinstance(value,dict) and value.get('format') in ('clea7.package/1','clea7.package/2') else validate(value)

def main():
    parser=argparse.ArgumentParser(prog='python -m clea7',description='BL CLEA7 SDK '+__version__+' — offline tools')
    commands=parser.add_subparsers(dest='command',required=True)
    check=commands.add_parser('validate');check.add_argument('input')
    pack=commands.add_parser('package');pack.add_argument('input');pack.add_argument('output');pack.add_argument('--targets',default=None);pack.add_argument('--publisher',default='')
    test=commands.add_parser('test');test.add_argument('input');test.add_argument('--flow',required=True);test.add_argument('--state',default='{}')
    suite=commands.add_parser('test-suite');suite.add_argument('input');suite.add_argument('suite');suite.add_argument('--mode',choices=['standard','light'],default='standard')
    bil=commands.add_parser('bil');bil.add_argument('action',choices=['check','compile','run','package']);bil.add_argument('input');bil.add_argument('--output');bil.add_argument('--id',default='bil_program');bil.add_argument('--name',default='Moja BIL aplikacija');bil.add_argument('--flow',default='main');bil.add_argument('--target',choices=['auto','application2','application5','application6','application7'],default='auto',help='auto selects the checked ABI; application2 requests lossless lowering; old format labels remain auto aliases');bil.add_argument('--targets',default=None)
    args=parser.parse_args()
    try:
        if args.command=='bil':
            from .bil import request
            path=Path(args.input)
            if path.stat().st_size>131072:raise UserError('BIL izvor prelazi 128 KiB.')
            action='compile' if args.action=='package' else args.action
            result=request({'action':action,'source':path.read_text(encoding='utf-8'),'metadata':{'id':args.id,'name':args.name},'flow':args.flow,'target':args.target})
            if args.action in ('compile','package'):
                if not args.output:raise UserError('Navedi --output za izvoz.')
                app=validate(result['application']);content=encode(app,args.targets.split(',') if args.targets else (('android',) if any(b['adapter']=='android.native/1' for b in app.get('remote',{}).get('backends',{}).values()) else ('browser',) if app['format'] in ('clea7.application/7','clea7.application/8','clea7.application/9') else ('browser','windows','android'))) if args.action=='package' else (json.dumps(app,ensure_ascii=False,indent=2)+'\n').encode()
                with Path(args.output).open('xb') as stream:stream.write(content)
                result={'valid':True,'output':args.output,'format':app['format']}
            print(json.dumps(result,ensure_ascii=True));return 0
        project=read(args.input)
        if args.command=='package':
            output=Path(args.output)
            if output.exists():raise UserError('Izlaz već postoji; odaberi novu datoteku.')
            output.write_bytes(encode(project,args.targets.split(',') if args.targets else None,args.publisher))
            print(json.dumps({'valid':True,'package':str(output),'id':project['id']},ensure_ascii=True))
        elif args.command in ('test','test-suite'):
            node=shutil.which('node')
            if not node:raise UserError('Za SDK izvršni test potreban je Node.js 22+.')
            if args.command=='test-suite':
                suite_path=Path(args.suite)
                if suite_path.stat().st_size>262144:raise UserError('Skup testova prelazi 256 KiB.')
                request={'app':project,'suite':json.loads(suite_path.read_text(encoding='utf-8')),'mode':args.mode}
            else:
                state=json.loads(args.state)
                if not isinstance(state,dict) or len(args.state)>1048576:raise UserError('Neispravan testni ulaz.')
                request={'app':project,'flow':args.flow,'state':state}
            root=Path(__file__).resolve().parents[1]
            body=json.dumps(request,ensure_ascii=False)
            result=subprocess.run([node,'--max-old-space-size=128',str(root/'sdk/test-runner.cjs')],input=body,capture_output=True,text=True,encoding='utf-8',timeout=40,shell=False)
            if result.returncode not in (0,2) or not result.stdout or len(result.stdout)>MAX_PACKAGE:raise UserError('SDK test nije prošao: '+result.stderr[-1000:])
            print(json.dumps(json.loads(result.stdout),ensure_ascii=True))
            if result.returncode:return 1
        else:print(json.dumps({'valid':True,'id':project['id'],'format':project['format']},ensure_ascii=True))
    except (UserError,OSError,ValueError,subprocess.TimeoutExpired) as error:
        print(str(error),file=sys.stderr);return 1
    return 0

if __name__=='__main__':raise SystemExit(main())
