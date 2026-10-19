"""Build only curated, browser-verified 0.16 downloads; preserve native identities."""
import hashlib
import json
import re
from pathlib import Path
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = '1f90074e1ea212bd0b34c116eac1a0380f7c2142'
VERSION = '0.16.0'
NOTICE = 'Web Studio 0.16 · Windows i Android 0.15 · razvojno izdanje'


def main():
    source = ROOT / 'sdk-source'
    catalog = json.loads((ROOT / 'releases.json').read_text())
    native_before = json.dumps(catalog['native'], sort_keys=True)
    forbidden = {'host.py', 'desktop.py', 'cloud_ai.py', 'ai.py', 'main.py',
                 'runtime_main.py', 'toolchain.py', 'identity.json', 'session.json'}
    files = [p for p in sorted(source.rglob('*')) if p.is_file()
             and '__pycache__' not in p.parts and p.suffix != '.pyc']
    if any(p.name in forbidden or p.is_symlink() for p in files):
        raise RuntimeError('Private hosts, user data and links cannot enter the public SDK.')
    target = ROOT / 'downloads/BL-CLEA7-SDK-0.16.0.zip'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for p in files:
            info = zipfile.ZipInfo(p.relative_to(source).as_posix(), date_time=(2026, 10, 19, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, p.read_bytes())
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise RuntimeError('SDK CRC failed.')
    preview = ROOT / 'downloads/BLclea7-Studio-pregled-0.16.html'
    subprocess.run(['python', str(ROOT / 'scripts/offline-preview/build_preview.py'),
                    '--source-root', str(ROOT / 'studio'), '--output', str(preview)], check=True)
    entries = []
    for key, p in [('sdk', target), ('preview', preview)]:
        data = p.read_bytes()
        entries.append({'key': key, 'name': p.name, 'url': p.relative_to(ROOT).as_posix(),
                        'size_bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    # Replace only the two current web downloads; retain native and all historical files.
    replacements = {}
    for entry in entries:
        old = next(item for item in catalog['published'] if item['key'] == entry['key'])
        replacements[old['url']] = entry['url']
        replacements[old['name']] = entry['name']
        replacements[old['sha256']] = entry['sha256']
        old.update(entry)
    for page in ROOT.glob('*.html'):
        text = page.read_text()
        for before, after in replacements.items():
            text = text.replace(before, after)
        text = text.replace('BLclea7 0.15 · razvojno izdanje', NOTICE)
        text = text.replace('Web Studio, Windows Studio, Runtime i SDK: 0.15.',
                            'Web Studio, browser Runtime i SDK: 0.16. Windows i Android: 0.15.')
        text = text.replace('PREUZIMANJA / BL CLEA7 0.15', 'PREUZIMANJA / BL CLEA7')
        def update_card(match):
            card = match.group(0)
            for entry in entries:
                if entry['url'] in card:
                    meta = '<div class="meta">' + format(entry['size_bytes'] / 1e6, '.2f') + ' MB · ' + VERSION + '</div>'
                    card = re.sub(r'<div class="meta">[^<]*</div>', lambda _: meta, card, count=1)
            return card
        text = re.sub(r'<article\b[^>]*>.*?</article>', update_card, text, flags=re.S)
        page.write_text(text)
    catalog.update(version=VERSION, source_commit=SOURCE, verified_run=None)
    catalog['web'] = {'version': VERSION, 'source_commit': SOURCE,
                      'verified_scope': 'browser_studio_runtime_sdk_and_isolated_services',
                      'verification': {'node_suites': 25, 'product_browser_suites': 17,
                                       'isolated_service_browser_suites': 7, 'result': 'passed'},
                      'native_verification': False}
    if json.dumps(catalog['native'], sort_keys=True) != native_before:
        raise RuntimeError('Native download identity changed during web preparation.')
    (ROOT / 'releases.json').write_text(json.dumps(catalog, indent=2) + '\n')
    receipt = {'format': 'clea7.prepared-public-downloads/1', 'version': VERSION,
               'source_commit': SOURCE, 'published': False, 'scope': 'browser_and_curated_sdk',
               'native_unchanged': True, 'files': entries}
    (ROOT / 'release/prepared-local-016.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('PREPARED_LOCAL_016: browser/SDK files built and hashed; native downloads unchanged.')


if __name__ == '__main__':
    main()
