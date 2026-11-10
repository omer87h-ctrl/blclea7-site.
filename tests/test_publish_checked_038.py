"""The new release reuses the checked bounded transfer and extraction boundary."""
import hashlib,json,tempfile,unittest,zipfile
from pathlib import Path
from scripts.publish_checked_037 import unpack
from scripts import publish_checked_038 as candidate

class CurrentReleaseTests(unittest.TestCase):
 def test_actual_install_receipt_matches_the_exact_pinned_build(self):
  root=Path(__file__).resolve().parents[1];receipt=json.loads((root/'release/windows-installed-038.json').read_text())
  self.assertTrue(receipt['passed']);self.assertEqual(receipt['installerSource'],candidate.SOURCE);self.assertEqual(receipt['installerSha256'],candidate.INSTALLER_SHA)
  self.assertTrue(receipt['actualInstallerExecuted'] and receipt['actualUninstallerExecuted'] and receipt['userFilesPreserved'])
  self.assertEqual(candidate.BUILD_RUN,42534855702);self.assertEqual(candidate.ARCHIVE_BYTES,249199952)

 def test_one_ai_build_requires_its_own_installation_proof(self):
  root=Path(__file__).resolve().parents[1];spec=candidate.release_spec('single-ai')
  self.assertEqual(candidate.install_receipt(root,spec)['verificationRun'],42563904883)
  self.assertEqual(spec['installer_bytes'],249209930)
  self.assertNotEqual(spec['tag'],candidate.TAG)
  with self.assertRaises(ValueError):candidate.release_spec('unverified')
  # A successful older installer cannot authorize publication of this binary.
  with self.assertRaises(ValueError):candidate.install_receipt(root,dict(spec,receipt='windows-installed-038.json'))

 def test_parameterized_extraction_still_enforces_exact_bytes_and_safe_paths(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);data=b'MZtest-fixture';archive=root/'tiny.zip'
   with zipfile.ZipFile(archive,'w') as z:z.writestr('dist/'+candidate.INSTALLER,data);z.writestr('metadata.json','{}')
   kwargs={'archive_bytes':archive.stat().st_size,'archive_sha':hashlib.sha256(archive.read_bytes()).hexdigest(),'installer_bytes':len(data),'installer_sha':hashlib.sha256(data).hexdigest()}
   out=root/'out';out.mkdir();self.assertEqual(unpack(archive,out,**kwargs).read_bytes(),data)
   with self.assertRaises(ValueError):unpack(archive,root,**dict(kwargs,installer_sha='0'*64))
   unsafe=root/'unsafe.zip'
   with zipfile.ZipFile(unsafe,'w') as z:z.writestr('../private-file',b'no');z.writestr(candidate.INSTALLER,data)
   with self.assertRaises(ValueError):unpack(unsafe,root,**dict(kwargs,archive_bytes=unsafe.stat().st_size,archive_sha=hashlib.sha256(unsafe.read_bytes()).hexdigest()))

 def test_working_elements_release_requires_its_exact_actual_installer_proof(self):
  root=Path(__file__).resolve().parents[1];spec=candidate.release_spec('integrated-039')
  self.assertEqual(spec['build_run'],42667011893);self.assertEqual(spec['installer_bytes'],249726161)
  proof=candidate.install_receipt(root,spec);self.assertEqual(proof['verificationRun'],42868865644)
  with self.assertRaises(ValueError):candidate.install_receipt(root,dict(spec,receipt='windows-installed-single-ai-038.json'))

if __name__=='__main__':unittest.main()
