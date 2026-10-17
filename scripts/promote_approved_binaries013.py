"""Owner-authorized, hash-pinned release transfer without a personal access token.

The approved manifest is committed only after the private platform gates pass.
Signed transport links authorize the approved binary alone, carry no repository
API token and are removed from the triggering issue before download begins.
"""
import hashlib
import json
import os
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from scripts import promote_approved_binaries09 as release

TARGET = 'omer87h-ctrl/blclea7-site.'
OWNER = 'omer87h-ctrl'
TITLE = 'CLEA7 approved binary promotion 0.13'
VERSION = '0.13.0'
OUTPUTS = {'studio': 'BL-CLEA7-Studio-Windows-x64.zip',
           'runtime': 'BL-CLEA7-Runtime-Windows-x64.zip',
           'android': 'BL-CLEA7-Runtime-Android-debug.apk'}
GATES = {'product', 'native_media', 'live_android', 'services'}
MANIFEST = Path(__file__).resolve().parents[1] / 'release/approved-public-013.json'
ReleaseError = release.ReleaseError

def approval(value):
    if not isinstance(value, dict) or set(value) != {'format', 'approved', 'version', 'source_commit', 'verification_runs', 'assets'}:
        raise ReleaseError('A reviewed exact release manifest is required.')
    if value['format'] != 'clea7.public-release-approval/1' or value['approved'] is not True or value['version'] != VERSION or not re.fullmatch('[0-9a-f]{40}', value.get('source_commit', '')):
        raise ReleaseError('Release approval is pending or invalid.')
    if not isinstance(value['verification_runs'], dict) or set(value['verification_runs']) != GATES or any(type(n) is not int or n < 1 for n in value['verification_runs'].values()):
        raise ReleaseError('All four source verification gates must be recorded.')
    if not isinstance(value['assets'], dict) or set(value['assets']) != set(OUTPUTS):
        raise ReleaseError('Only three approved public binaries are allowed.')
    for key, spec in value['assets'].items():
        if not isinstance(spec, dict) or set(spec) != {'name', 'size_bytes', 'sha256'} or spec['name'] != OUTPUTS[key] or type(spec['size_bytes']) is not int or not 1 <= spec['size_bytes'] <= 1024 ** 3 or not re.fullmatch('[0-9a-f]{64}', spec.get('sha256', '')):
            raise ReleaseError('Invalid binary name, digest or size.')
    return value

def tag(value):
    return 'clea7-' + VERSION + '-' + value['source_commit'][:7]

def transfer_url(url):
    try:
        p = urllib.parse.urlsplit(url)
        if p.scheme != 'https' or p.hostname != 'release-assets.githubusercontent.com' or p.username or p.password or p.port not in (None, 443) or not p.path.startswith('/github-production-release-asset/') or not p.query or p.fragment:
            raise ValueError()
    except (TypeError, ValueError):
        raise ReleaseError('Unexpected binary transport origin.') from None
    return url

def descriptor(event, approved):
    approval(approved)
    issue = event.get('issue', {})
    if event.get('action') != 'opened' or event.get('repository', {}).get('full_name') != TARGET or event.get('sender', {}).get('login') != OWNER or issue.get('user', {}).get('login') != OWNER or issue.get('title') != TITLE or issue.get('pull_request') or type(issue.get('number')) is not int:
        raise ReleaseError('Only the repository owner can authorize this release.')
    try:
        body = json.loads(issue.get('body', ''))
    except (TypeError, ValueError):
        raise ReleaseError('Invalid binary transfer descriptor.') from None
    if not isinstance(body, dict) or set(body) != {'format', 'source_commit', 'assets'} or body['format'] != 'clea7.binary-transfer/2' or body['source_commit'] != approved['source_commit'] or not isinstance(body['assets'], dict) or set(body['assets']) != set(OUTPUTS):
        raise ReleaseError('Only the approved source and three binary roles are accepted.')
    for spec in body['assets'].values():
        if not isinstance(spec, dict) or set(spec) != {'url'}:
            raise ReleaseError('Unexpected transport fields.')
        transfer_url(spec['url'])
    return body

def copy_verified(url, spec, path, opener=release.OPENER):
    transfer_url(url)
    digest, size = hashlib.sha256(), 0
    try:
        # No Authorization header, no cookies, no redirected download.
        with opener.open(urllib.request.Request(url, headers={'User-Agent': 'CLEA7-approved-public-binary'}), timeout=180) as response, path.open('wb') as output:
            if response.status != 200:
                raise ReleaseError('Binary transport did not return a file.')
            while True:
                chunk = response.read(min(1024 * 1024, spec['size_bytes'] - size + 1))
                if not chunk:
                    break
                size += len(chunk)
                if size > spec['size_bytes']:
                    raise ReleaseError('Binary exceeds its approved size.')
                digest.update(chunk)
                output.write(chunk)
        if size != spec['size_bytes'] or digest.hexdigest() != spec['sha256']:
            raise ReleaseError('Binary digest or byte length differs from approval.')
    except (OSError, urllib.error.URLError):
        path.unlink(missing_ok=True)
        raise ReleaseError('Binary transport expired or was unavailable.') from None
    except ReleaseError:
        path.unlink(missing_ok=True)
        raise

def validate_binary(path, role):
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if not 1 <= len(entries) <= 20000 or len({e.filename for e in entries}) != len(entries) or sum(e.file_size for e in entries) > 3 * 1024 ** 3:
            raise ReleaseError('Invalid or excessive binary archive.')
        for entry in entries:
            name = PurePosixPath(entry.filename)
            if name.is_absolute() or '..' in name.parts or '\\' in entry.filename or (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise ReleaseError('Unsafe binary archive entry.')
        names = set(archive.namelist())
        required = {'AndroidManifest.xml', 'classes.dex'} if role == 'android' else {
            ('BL_CLEA7/BL_CLEA7.exe' if role == 'studio' else 'BL_CLEA7_Runtime/BL_CLEA7_Runtime.exe')}
        if not required <= names or archive.testzip() is not None:
            raise ReleaseError('Binary structure or CRC verification failed.')

def publish(folder, approved, token):
    approval(approved)
    target = release.api('/repos/' + TARGET, token)
    if target.get('private') is not False or target.get('full_name') != TARGET:
        raise ReleaseError('Exact public destination required.')
    release_tag = tag(approved)
    releases = release.api('/repos/' + TARGET + '/releases?per_page=100', token)
    output = next((r for r in releases if r.get('tag_name') == release_tag), None)
    if output is None:
        output = release.api('/repos/' + TARGET + '/releases', token, 'POST', {
            'tag_name': release_tag, 'target_commitish': 'main', 'name': 'BL CLEA7 0.13 — Studio and Runtime development packages',
            'draft': True, 'prerelease': True,
            'body': 'Verified source ' + approved['source_commit'] + '. Verification runs: ' + json.dumps(approved['verification_runs'], sort_keys=True) + '. Windows ZIP packages include their app-local renderer. Android native media is private to the application and active account; photographs are separate from the state backup. Camera, location and local notifications use Android capability consent. This development build is unsigned on Windows and debug signed on Android. Native media is an Android capability. Production remote image services, remote push, physical-device coverage and owner-controlled release signing require separate validation. Existing terms and third-party notices apply.'})
    records = []
    for role, spec in approved['assets'].items():
        data = (folder / spec['name']).read_bytes()
        if len(data) != spec['size_bytes'] or hashlib.sha256(data).hexdigest() != spec['sha256']:
            raise ReleaseError('Staged binary changed before publication.')
        release.publish_asset(output, spec['name'], data, token)
        records.append({'key': role, **spec, 'url': 'https://github.com/' + TARGET + '/releases/download/' + release_tag + '/' + spec['name']})
        del data
    provenance = {'format': 'clea7.binary-release/2', 'version': VERSION, 'source_commit': approved['source_commit'], 'verification_runs': approved['verification_runs'], 'assets': records}
    release.publish_asset(output, 'provenance.json', (json.dumps(provenance, indent=2) + '\n').encode(), token)
    release.publish_asset(output, 'SHA256SUMS.txt', ''.join(r['sha256'] + '  ' + r['name'] + '\n' for r in records).encode(), token)
    release.publish_asset(output, 'USLOVI.txt', (Path(__file__).resolve().parents[1] / 'docs/USLOVI.txt').read_bytes(), token)
    if output['draft']:
        release.api('/repos/' + TARGET + '/releases/' + str(output['id']), token, 'PATCH', {'draft': False, 'prerelease': True})
    # Metadata verification deliberately carries no private or public API credential.
    url = 'https://api.github.com/repos/' + TARGET + '/releases/tags/' + release_tag
    with release.OPENER.open(urllib.request.Request(url, headers={'User-Agent': 'CLEA7-public-verification'}), timeout=30) as response:
        public = json.load(response)
    if public.get('draft') is not False or public.get('prerelease') is not True:
        raise ReleaseError('Anonymous release verification failed.')
    for record in records:
        item = next((a for a in public.get('assets', []) if a['name'] == record['name']), {})
        if item.get('size') != record['size_bytes'] or item.get('digest') != 'sha256:' + record['sha256'] or item.get('browser_download_url') != record['url']:
            raise ReleaseError('Public binary identity failed verification.')
    result = {'state': 'published', 'version': VERSION, 'source_commit': approved['source_commit'], 'repository': TARGET, 'tag': release_tag, 'assets': records, 'release_url': public['html_url']}
    print('PUBLIC_RELEASE_STATUS ' + json.dumps(result))
    return public['html_url']

def main():
    token = os.environ.get('GITHUB_TOKEN', '')
    if not token or os.environ.get('GITHUB_REPOSITORY') != TARGET or os.environ.get('GITHUB_ACTOR') != OWNER:
        raise ReleaseError('Owner-scoped public release job required.')
    approved = approval(json.loads(MANIFEST.read_text()))
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    body = descriptor(event, approved)
    issue_path = '/repos/' + TARGET + '/issues/' + str(event['issue']['number'])
    release.api(issue_path, token, 'PATCH', {'body': 'Approved binary transfer received. Temporary links removed. Source: ' + approved['source_commit']})
    with tempfile.TemporaryDirectory(prefix='clea7-approved-', dir=os.environ.get('RUNNER_TEMP')) as temporary:
        folder = Path(temporary)
        for role, spec in approved['assets'].items():
            path = folder / spec['name']
            copy_verified(body['assets'][role]['url'], spec, path)
            validate_binary(path, role)
            print('APPROVED_BINARY ' + role + ' ' + spec['sha256'] + ' ' + str(spec['size_bytes']))
        body.clear()
        url = publish(folder, approved, token)
    release.api(issue_path, token, 'PATCH', {'state': 'closed', 'state_reason': 'completed', 'body': 'Verified public binary release: ' + url + '\nSource: ' + approved['source_commit'] + '\nTemporary links removed.'})

if __name__ == '__main__':
    try:
        main()
    except (ReleaseError, OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        raise SystemExit('PUBLIC_RELEASE_ERROR ' + (str(error) if isinstance(error, ReleaseError) else type(error).__name__))
