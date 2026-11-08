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
    ai=commands.add_parser('ai',help='Postojeći vlasnikov lokalni CLEA AI; bez pokretanja drugog modela.')
    ai_actions=ai.add_subparsers(dest='ai_action',required=True)
    ai_actions.add_parser('status')
    storage=ai_actions.add_parser('storage');storage.add_argument('--root',required=True)
    ask=ai_actions.add_parser('ask');ask.add_argument('question');ask.add_argument('--language',choices=['auto','bs','en'],default='auto');ask.add_argument('--web-query',default=None)
    propose=ai_actions.add_parser('propose',help='Lokalni 9B prijedlog provjeren kroz BIL/Core; obavezan pregled prije upotrebe.')
    propose.add_argument('intent');propose.add_argument('--output',required=True);propose.add_argument('--id',default='ai_proposal');propose.add_argument('--name',default='CLEA AI prijedlog')
    commands.add_parser('doctor',help='Provjeri lokalne verzije i podržane ugovore, bez mrežnog pristupa.')
    android=commands.add_parser('android',help='Stvarni lokalni APK ili nepotpisani AAB build uz postojeći alatni lanac.')
    android.add_argument('action',choices=['apk','aab']);android.add_argument('input');android.add_argument('--output',required=True)
    check=commands.add_parser('validate');check.add_argument('input')
    pack=commands.add_parser('package');pack.add_argument('input');pack.add_argument('output');pack.add_argument('--targets',default=None);pack.add_argument('--publisher',default='')
    test=commands.add_parser('test');test.add_argument('input');test.add_argument('--flow',required=True);test.add_argument('--state',default='{}')
    suite=commands.add_parser('test-suite');suite.add_argument('input');suite.add_argument('suite');suite.add_argument('--mode',choices=['standard','light'],default='standard')
    bil=commands.add_parser('bil');bil.add_argument('action',choices=['check','features','compile','run','verify','package']);bil.add_argument('input');bil.add_argument('--output');bil.add_argument('--id',default='bil_program');bil.add_argument('--name',default='Moja BIL aplikacija');bil.add_argument('--flow',default='main');bil.add_argument('--target',choices=['auto','application2','application5','application6','application7'],default='auto',help='auto selects the checked ABI; application2 requests lossless lowering; old format labels remain auto aliases');bil.add_argument('--targets',default=None)
    projects=commands.add_parser('project',help='Lokalni projekt: new, check, info, build, run i test.')
    project_actions=projects.add_subparsers(dest='project_action',required=True)
    create=project_actions.add_parser('new');create.add_argument('directory');create.add_argument('--template',choices=['quote','derived'],default='quote')
    for action in ('check','info','build','run','test'):
        command=project_actions.add_parser(action);command.add_argument('directory',nargs='?',default='.')
        if action=='build':command.add_argument('--output')
        if action=='run':command.add_argument('--flow',default='main')
        if action in ('run','test'):
            command.add_argument('--cache',choices=['enabled','off'],default='enabled')
            command.add_argument('--diagnostics',choices=['development','production'],default='development')
    args=parser.parse_args()
    try:
        if args.command=='android':
            from .application import build_apk,build_bundle
            output=(build_apk if args.action=='apk' else build_bundle)(Path(__file__).resolve().parents[1],read(args.input),args.output)
            print(json.dumps({'built':True,'artifact':str(output),'signedForPlay':False}));return 0
        if args.command=='ai':
            from . import local_client
            if args.ai_action=='storage':
                from .storage_budget import inspect
                result=inspect(args.root)
            elif args.ai_action=='propose':
                output=Path(args.output)
                if output.exists() or output.is_symlink():raise UserError('Izlaz već postoji; postojeći projekt nije promijenjen.')
                proposal=local_client.propose_bil(args.intent,metadata={'id':args.id,'name':args.name})
                with output.open('x',encoding='utf-8') as stream:stream.write(proposal['source'])
                result={'proposed':True,'output':str(output),'requiresReview':True,'sourceHash':proposal['verification']['receipt']['results']['s6']['sourceHash'],'verificationScope':proposal['executionScope']}
            else:result=local_client.status() if args.ai_action=='status' else local_client.ask(args.question,language=args.language,web_query=args.web_query)
            print(json.dumps(result,ensure_ascii=True));return 1 if result.get('available') is False else 0
        if args.command=='doctor':
            from .doctor import inspect
            result=inspect();print(json.dumps(result,ensure_ascii=True));return 0 if result['ready'] else 1
        if args.command=='project':
            from . import project as projects
            if args.project_action=='new':result=projects.create(args.directory,args.template)
            elif args.project_action=='build':result=projects.build(args.directory,args.output)
            elif args.project_action=='run':result=projects.run(args.directory,args.flow,args.cache,args.diagnostics)
            elif args.project_action=='test':result=projects.test(args.directory,args.cache,args.diagnostics)
            else:result=getattr(projects,args.project_action)(args.directory)
            print(json.dumps(result,ensure_ascii=True));return 1 if result.get('passed') is False else 0
        if args.command=='bil':
            from .bil import request
            path=Path(args.input)
            if path.stat().st_size>131072:raise UserError('BIL izvor prelazi 128 KiB.')
            action='compile' if args.action=='package' else args.action
            result=request({'action':action,'source':path.read_text(encoding='utf-8'),'metadata':{'id':args.id,'name':args.name},'flow':args.flow,'target':args.target})
            if args.action in ('compile','package'):
                if not args.output:raise UserError('Navedi --output za izvoz.')
                app=validate(result['application']);content=encode(app,args.targets.split(',') if args.targets else (('browser','windows','android') if app.get('remote',{}).get('backends') and all(b['adapter']=='sense.local/1' for b in app['remote']['backends'].values()) else ('android',) if any(b['adapter']=='android.native/1' for b in app.get('remote',{}).get('backends',{}).values()) else ('browser',) if app['format'] in ('clea7.application/7','clea7.application/8','clea7.application/9') else ('browser','windows','android'))) if args.action=='package' else (json.dumps(app,ensure_ascii=False,indent=2)+'\n').encode()
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
