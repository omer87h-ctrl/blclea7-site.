"""Local project workflow using the existing compiler, Engine and package format.

Project paths are explicit, bounded and confined to the selected directory. No
models, package downloads, cloud accounts or arbitrary build scripts are run.
"""
from __future__ import annotations
import json
import os
import re
import shutil
import subprocess
from pathlib import Path, PurePosixPath
from .schema import UserError

FORMAT = 'clea7.project/1'
MANIFEST = 'project.json'
ROOT = Path(__file__).resolve().parents[1]
MAX_SOURCE = 131072

QUOTE = '''# Original offline CLEA quote project. No backend or account is required.
let quantity = 2
let price = 20
let total = 0

screen quote "Moja ponuda" {
    input quantity label "Količina"
    input price label "Cijena"
    button "Izračunaj" runs calculate
    button "Dodaj količinu" runs increase
    show total
}

on calculate {
    total = quantity * price
}
on increase {
    quantity = quantity + 1
}
'''
DERIVED = '''# Original reactive quote project; requires CLEA Core 0.18.
let quantity = 2
let price = 20
derive total = quantity * price

screen quote "Moja ponuda" {
    input quantity label "Količina"
    input price label "Cijena"
    button "Dodaj količinu" runs increase
    show total
}
on increase {
    quantity = quantity + 1
}
'''


def _pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise UserError('JSON sadrži ponovljeno svojstvo: ' + str(key))
        result[key] = value
    return result


def _json(text):
    try:
        return json.loads(text, object_pairs_hook=_pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('non-finite JSON')))
    except (ValueError, TypeError) as error:
        raise UserError('Datoteka nije podržan JSON.') from error


def _root(value):
    path = Path(value).absolute()
    if path.is_symlink() or not path.is_dir():
        raise UserError('Projekt treba biti postojeći direktorij, bez simboličke veze.')
    return path.resolve(strict=True)


def _relative(value, role):
    if not isinstance(value, str) or not value or len(value) > 240 or '\\' in value:
        raise UserError(role + ': koristi relativnu projektnu putanju.')
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in ('', '.', '..') for part in value.split('/')) or len(path.parts) > 8 or any(not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_. -]{0,79}', part) for part in path.parts):
        raise UserError(role + ': putanja izlazi iz dozvoljenog projektnog prostora.')
    return path


def _within(root, value, role, exists=True):
    relative = _relative(value, role)
    path = root
    for part in relative.parts:
        path = path / part
        if path.is_symlink():
            raise UserError(role + ': simboličke veze nisu dozvoljene.')
    if not path.resolve(strict=False).is_relative_to(root):
        raise UserError(role + ': putanja izlazi iz projekta.')
    if exists and not path.is_file():
        raise UserError(role + ': datoteka nije pronađena.')
    return path


def _read(path, limit, role):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > limit:
        raise UserError(role + ': datoteka nedostaje, nije obična datoteka ili prelazi budžet.')
    try:
        value = path.read_text(encoding='utf-8')
    except UnicodeError as error:
        raise UserError(role + ': očekivan je UTF-8 tekst.') from error
    if len(value.encode('utf-8')) > limit:
        raise UserError(role + ': datoteka prelazi budžet.')
    return value


def load(value='.'):
    root = _root(value)
    path = _within(root, MANIFEST, 'Manifest')
    manifest = _json(_read(path, 16384, 'Manifest'))
    required = {'format', 'id', 'name', 'entry', 'targets', 'tests', 'dependencies'}
    if not isinstance(manifest, dict) or set(manifest) - (required | {'version'}) or not required <= set(manifest) or manifest['format'] != FORMAT:
        raise UserError('Očekivan je project.json ugovor clea7.project/1 s poznatim svojstvima.')
    if not isinstance(manifest['id'], str) or not re.fullmatch(r'[a-z][a-z0-9_]{1,63}', manifest['id']) or manifest['id'] in ('constructor', 'prototype'):
        raise UserError('Projekt treba siguran id od 2 do 64 mala slova, brojeve ili donju crtu.')
    if not isinstance(manifest['name'], str) or not manifest['name'].strip() or len(manifest['name']) > 100:
        raise UserError('Naziv projekta treba imati 1–100 znakova.')
    if type(manifest.get('version', 1)) is not int or not 1 <= manifest.get('version', 1) <= 1000000:
        raise UserError('Verzija aplikacije treba biti pozitivan cijeli broj.')
    targets = manifest['targets']
    if not isinstance(targets, list) or not targets or any(not isinstance(x, str) or x not in ('browser', 'windows', 'android') for x in targets) or len(targets) != len(set(targets)):
        raise UserError('Ovaj ugovor prihvata samo deklarisane browser/windows/android ciljeve; ostali hostovi nisu potvrđeni.')
    if manifest['dependencies'] != []:
        raise UserError('Vanjske projektne zavisnosti nisu implementirane; dependencies mora biti prazna lista.')
    entry = _within(root, manifest['entry'], 'BIL izvor')
    tests = _within(root, manifest['tests'], 'Testovi')
    if entry.suffix != '.bil' or tests.suffix != '.json':
        raise UserError('Projekt koristi .bil izvor i .json testove.')
    source = _read(entry, MAX_SOURCE, 'BIL izvor')
    suite = _json(_read(tests, 262144, 'Testovi'))
    return {'root': root, 'manifest': manifest, 'source': source, 'tests': suite}


def _bridge(payload):
    node = shutil.which('node')
    if not node:
        raise UserError('Projektni SDK zahtijeva Node.js 22+ za postojeći BIL kompajler.')
    body = json.dumps(payload, ensure_ascii=False, allow_nan=False)
    if len(body.encode('utf-8')) > 1048576:
        raise UserError('Projektni zahtjev prelazi 1 MiB.')
    result = subprocess.run([node, '--max-old-space-size=128', str(ROOT / 'sdk/bil-cli.cjs')], input=body, capture_output=True, text=True, encoding='utf-8', timeout=25, shell=False)
    if result.returncode not in (0, 2) or not result.stdout or len(result.stdout.encode('utf-8')) > 4 * 1024 * 1024:
        raise UserError(result.stderr[-2000:] or 'Projektna BIL provjera nije prošla.')
    report = _json(result.stdout)
    if result.returncode == 2 and (not isinstance(report, dict) or report.get('passed') is not False):
        raise UserError('SDK je vratio neispravan testni status.')
    return report


def _request(project, action, **options):
    manifest = project['manifest']
    return _bridge({'action': action, 'source': project['source'], 'metadata': {'id': manifest['id'], 'name': manifest['name'], 'version': manifest.get('version', 1)}, **options})


def create(value, template='quote'):
    if template not in ('quote', 'derived'):
        raise UserError('Podržani projektni primjeri su quote i derived.')
    target = Path(value).absolute()
    if target.exists() or target.is_symlink():
        raise UserError('Projekt već postoji; postojeće datoteke nisu promijenjene.')
    if not target.parent.is_dir() or target.parent.is_symlink():
        raise UserError('Roditeljski direktorij treba postojati i ne smije biti simbolička veza.')
    app_id = re.sub(r'[^a-z0-9_]+', '_', target.name.lower()).strip('_')[:60]
    if not app_id or not app_id[0].isalpha() or len(app_id) < 2 or app_id in ('constructor', 'prototype'):
        app_id = 'app_' + app_id
    manifest = {'format': FORMAT, 'id': app_id, 'name': target.name[:100], 'version': 1, 'entry': 'app.bil', 'targets': ['browser'], 'tests': 'tests.json', 'dependencies': []}
    steps = ([{'flow': 'calculate', 'expect': {'values': {'total': 40}, 'screen': 'quote'}}, {'flow': 'increase', 'expect': {'values': {'quantity': 3}}}, {'flow': 'calculate', 'expect': {'values': {'total': 60}}}, {'restart': True, 'expect': {'values': {'quantity': 3, 'total': 60}, 'screen': 'quote'}}] if template == 'quote' else [{'flow': 'increase', 'expect': {'values': {'quantity': 3, 'total': 60}, 'screen': 'quote'}}, {'restart': True, 'expect': {'values': {'quantity': 3, 'total': 60}, 'screen': 'quote'}}])
    suite = {'format': 'clea7.project-tests/1', 'cases': [{'name': 'Stvarni izračun i ponovno otvaranje', 'steps': steps}]}
    files = {MANIFEST: json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', 'app.bil': QUOTE if template == 'quote' else DERIVED, 'tests.json': json.dumps(suite, ensure_ascii=False, indent=2) + '\n', 'README.md': '# ' + manifest['name'] + '\n\nOriginalni lokalni CLEA projekt.\n\npython -m clea7 project check .\npython -m clea7 project run .\npython -m clea7 project test .\npython -m clea7 project build . --output dist/' + app_id + '.clea7\n\nZa Python modul treba biti instaliran ili dostupan CLEA SDK. Nema automatskog preuzimanja zavisnosti.\n'}
    created = []
    try:
        target.mkdir()
        for name, content in files.items():
            file = target / name
            with file.open('x', encoding='utf-8') as output:
                created.append(file)
                output.write(content)
    except BaseException:
        for file in reversed(created):
            file.unlink(missing_ok=True)
        try:
            target.rmdir()
        except OSError:
            pass
        raise
    return {'created': True, 'format': FORMAT, 'path': str(target), 'files': list(files), 'template': template, 'targets': ['browser']}


def check(value='.'):
    project = load(value)
    result = _request(project, 'check-project', tests=project['tests'])
    # Validate the suite without executing a user's event or private data.
    return {**result, 'project': project['manifest']['id'], 'files': [MANIFEST, project['manifest']['entry'], project['manifest']['tests']], 'testsLoaded': True}


def info(value='.'):
    project = load(value)
    result = _request(project, 'info', targets=project['manifest']['targets'])
    return {**result, 'project': project['manifest']['id'], 'projectFormat': FORMAT, 'entry': project['manifest']['entry'], 'targets': project['manifest']['targets'], 'dependencies': []}


def build(value='.', output=None):
    from .application import validate
    from .package import encode, decode
    project = load(value)
    manifest = project['manifest']
    app = validate(_request(project, 'compile')['application'])
    payload = encode(app, manifest['targets'])
    parsed = decode(payload)
    name = output or 'dist/' + manifest['id'] + '.clea7'
    destination = _within(project['root'], name, 'Izlaz', exists=False)
    if destination.suffix != '.clea7':
        raise UserError('Izlaz treba imati nastavak .clea7.')
    if destination.exists():
        raise UserError('Izlaz već postoji; prethodni paket nije prepisan.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    _within(project['root'], name, 'Izlaz', exists=False)
    created = False
    try:
        with destination.open('xb') as stream:
            created = True
            stream.write(payload)
    except BaseException:
        if created:
            destination.unlink(missing_ok=True)
        raise
    import hashlib
    return {'built': True, 'project': manifest['id'], 'output': str(destination), 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest(), 'format': parsed['package']['format'], 'runtime': parsed['manifest']['runtime'], 'targets': parsed['manifest']['targets']}


def run(value='.', flow='main', cache='enabled', diagnostics='development'):
    return _request(load(value), 'run', flow=flow, cache=cache, diagnostics=diagnostics)


def test(value='.', cache='enabled', diagnostics='development'):
    project = load(value)
    result = _request(project, 'test', tests=project['tests'], cache=cache, diagnostics=diagnostics)
    if diagnostics == 'production':
        return {'format': 'clea7.project-test-report/1', 'passed': result['passed'], 'application': result['application'], 'mode': 'production', 'caseCount': len(result['cases']), 'diagnosticsAvailable': False}
    return result
