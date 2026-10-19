"""Execute the advertised SDK archive independently; no service/device claims."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]


class PublicSharedImageSDKTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='clea7-public-image-sdk-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        catalog = json.loads((ROOT / 'releases.json').read_text())
        archive = ROOT / next(item['url'] for item in catalog['published'] if item['key'] == 'sdk')
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(self.root)

    def call(self, *args):
        return subprocess.run([sys.executable, '-m', 'clea7', *args], cwd=self.root,
                              text=True, capture_output=True, timeout=30)

    def package(self):
        result = self.call('bil', 'package', 'sdk/examples/bil/shared-images.bil',
                           '--output', 'images.clea7', '--id', 'independent_images')
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads((self.root / 'images.clea7').read_text())

    def test_advertised_archive_compiles_real_image_contract_from_bil(self):
        package = self.package()
        self.assertEqual(package['manifest']['runtime'], '0.16.0')
        self.assertEqual(package['manifest']['abi'], 'clea7.application/9')
        backend = package['manifest']['remote']['backends']['community']
        self.assertEqual(backend['adapter'], 'firebase.development/4')
        self.assertIn('image.upload', backend['operations'])
        self.assertEqual(self.call('validate', 'images.clea7').returncode, 0)

    def test_old_native_runtime_cannot_accept_understated_image_contract(self):
        package = self.package()
        package['manifest']['runtime'] = '0.15.0'
        (self.root / 'understated.clea7').write_text(json.dumps(package))
        self.assertNotEqual(self.call('validate', 'understated.clea7').returncode, 0)

    def test_sdk_distributes_the_same_image_host_and_compiler_as_public_runtime(self):
        for name in ('image-store.js', 'firebase-development.js', 'bil-compiler.js', 'bil-runtime.js', 'remote.js'):
            self.assertEqual((self.root / 'web/workbench' / name).read_bytes(),
                             (ROOT / 'studio/workbench' / name).read_bytes())

    def test_web_release_preserves_verified_native_download_identity(self):
        catalog = json.loads((ROOT / 'releases.json').read_text())
        self.assertEqual(catalog['version'], '0.16.0')
        self.assertEqual(catalog['native']['version'], '0.15.0')
        self.assertEqual(catalog['native']['source_commit'], '5baaace802746bd64d972568e034abf252b8db73')
        self.assertEqual(catalog['native']['tag'], 'clea7-0.15.0-5baaace')
        self.assertFalse(catalog['web']['native_verification'])


if __name__ == '__main__':
    unittest.main()
