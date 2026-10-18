"""Executable guards for the four approved binary roles and transport leases."""
import hashlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from scripts import promote_approved_binaries014 as p

URL = 'https://release-assets.githubusercontent.com/github-production-release-asset/1/approved?sig=example'

def approved():
    return {'format': 'clea7.public-release-approval/1', 'approved': True, 'version': '0.14.0',
            'source_commit': 'a' * 40, 'verification_runs': dict(product=1, native_media=2, live_android=3, services=4),
            'assets': {k: {'name': n, 'size_bytes': 100, 'sha256': 'b' * 64} for k, n in p.OUTPUTS.items()}}

def event():
    return {'action': 'opened', 'repository': {'full_name': p.TARGET}, 'sender': {'login': p.OWNER},
            'issue': {'number': 3, 'user': {'login': p.OWNER}, 'title': p.TITLE, 'body': json.dumps({
                'format': 'clea7.binary-transfer/2', 'source_commit': 'a' * 40,
                'assets': {k: {'url': URL} for k in p.OUTPUTS}})}}

class Download:
    def __init__(self, data): self.data = data
    def open(self, request, timeout):
        assert not request.has_header('Authorization')
        response = io.BytesIO(self.data)
        response.status = 200
        return response

def zipped(path, entries):
    with zipfile.ZipFile(path, 'w') as output:
        for name, content in entries:
            output.writestr(name, content)

class Transfer014Tests(unittest.TestCase):
    def test_unapproved_or_incomplete_manifest_cannot_publish(self):
        self.assertEqual(p.approval(approved())['version'], '0.14.0')
        self.assertEqual(p.tag(approved()), 'clea7-0.14.0-aaaaaaa')
        for edit in (lambda a: a.update(approved=False), lambda a: a.update(source_commit='wrong'),
                     lambda a: a['verification_runs'].pop('native_media'), lambda a: a['assets'].update(sdk={}),
                     lambda a: a['assets']['studio'].update(name='private-source.zip'),
                     lambda a: a['assets']['runtime'].update(size_bytes=True),
                     lambda a: a['assets']['android'].update(sha256='0')):
            data = approved(); edit(data)
            with self.assertRaises(p.ReleaseError): p.approval(data)
        with self.assertRaises(p.ReleaseError): p.approval({'format':'clea7.public-release-approval/1','approved':False,'reason':'pending'})

    def test_owner_commit_roles_and_event_are_required(self):
        self.assertEqual(set(p.descriptor(event(), approved())['assets']), set(p.OUTPUTS))
        for edit in (lambda e: e.update(action='edited'), lambda e: e['sender'].update(login='other'),
                     lambda e: e['issue']['user'].update(login='other'), lambda e: e['repository'].update(full_name='other/repo'),
                     lambda e: e['issue'].update(title='unapproved'), lambda e: e['issue'].update(pull_request={'id': 1})):
            data = event(); edit(data)
            with self.assertRaises(p.ReleaseError): p.descriptor(data, approved())
        for edit in (lambda b: b.update(source_commit='c' * 40), lambda b: b.update(format='clea7.binary-transfer/1'),
                     lambda b: b['assets'].update(sdk={'url': URL}), lambda b: b['assets']['studio'].update(token='never')):
            data = event(); body = json.loads(data['issue']['body']); edit(body); data['issue']['body'] = json.dumps(body)
            with self.assertRaises(p.ReleaseError): p.descriptor(data, approved())

    def test_only_scoped_release_asset_origin_is_accepted(self):
        self.assertEqual(p.transfer_url(URL), URL)
        for url in ('http:' + URL[6:], URL + '#fragment', 'https://release-assets.githubusercontent.com.evil.example/github-production-release-asset/a?sig=x',
                    'https://user:secret@release-assets.githubusercontent.com/github-production-release-asset/a?sig=x',
                    'https://release-assets.githubusercontent.com:444/github-production-release-asset/a?sig=x',
                    'https://release-assets.githubusercontent.com/github-production-release-asset/a',
                    'https://api.github.com/repos/private/assets/1?sig=x', 'https://localhost/github-production-release-asset/a?sig=x'):
            with self.assertRaises(p.ReleaseError): p.transfer_url(url)

    def test_streaming_rejects_corruption_and_excess_before_publish(self):
        data = b'exact approved binary'; spec = {'size_bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'binary'
            p.copy_verified(URL, spec, path, Download(data)); self.assertEqual(path.read_bytes(), data)
            for invalid in (data + b'excess', data[:-1], b'x' * len(data)):
                with self.assertRaises(p.ReleaseError): p.copy_verified(URL, spec, path, Download(invalid))
                self.assertFalse(path.exists())

    def test_android_is_the_direct_apk_not_an_artifact_wrapper(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'app.apk'
            zipped(path, [('AndroidManifest.xml', b'manifest'), ('classes.dex', b'dex')])
            p.validate_binary(path, 'android')
            for entries in ([('app.apk', path.read_bytes())], [('classes.dex', b'dex')], [('../AndroidManifest.xml', b'manifest'), ('classes.dex', b'dex')]):
                zipped(path, entries)
                with self.assertRaises(p.ReleaseError): p.validate_binary(path, 'android')

    def test_windows_archives_require_the_correct_product(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'windows.zip'
            for role, exe in (('studio', 'BL_CLEA7/BL_CLEA7.exe'), ('runtime', 'BL_CLEA7_Runtime/BL_CLEA7_Runtime.exe')):
                zipped(path, [(exe, b'executable')]); p.validate_binary(path, role)
                with self.assertRaises(p.ReleaseError): p.validate_binary(path, 'runtime' if role == 'studio' else 'studio')

    def test_installer_structure_is_checked_without_execution(self):
        # Synthetic test bytes only, not a working installer or build proof.
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'setup.exe'
            data = bytearray(256); data[:2] = b'MZ'; data[60:64] = (128).to_bytes(4,'little')
            data[128:132] = b'PE\x00\x00'; data[132:134] = (0x14c).to_bytes(2,'little'); data[150:152] = (2).to_bytes(2,'little')
            path.write_bytes(data); p.validate_binary(path, 'installer')
            for bad in (b'not-an-executable', data[:80], b'xx' + data[2:]):
                path.write_bytes(bad)
                with self.assertRaises(p.ReleaseError): p.validate_binary(path, 'installer')
            with self.assertRaises(p.ReleaseError): p.validate_binary(path, 'private-sdk')

    def test_existing_public_assets_are_never_overwritten(self):
        data = b'exact'; item = {'name': 'test.zip', 'size': len(data), 'digest': 'sha256:' + hashlib.sha256(data).hexdigest()}
        with patch.object(p.release, 'api', side_effect=AssertionError('no upload')):
            self.assertEqual(p.release.publish_asset({'assets': [item]}, 'test.zip', data, 'not-a-token'), item)
            with self.assertRaises(p.ReleaseError): p.release.publish_asset({'assets': [item]}, 'test.zip', b'wrong', 'not-a-token')

if __name__ == '__main__': unittest.main()
