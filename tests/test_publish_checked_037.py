import hashlib,tempfile,unittest
from pathlib import Path
from scripts.publish_checked_037 import validate_url,verify,SMALL

class PublicationBoundaryTests(unittest.TestCase):
 def test_transfer_accepts_only_bounded_https_file_service_url(self):
  good='https://sdmntpreastus.oaiusercontent.com/files/example/raw?signature=fixture'
  self.assertEqual(validate_url(good),good)
  for url in ['http://sdmntpreastus.oaiusercontent.com/files/x/raw?q=1','https://evil.example/files/x/raw?q=1',
   'https://oaiusercontent.com.evil.example/files/x/raw?q=1','https://u:p@sdmntpreastus.oaiusercontent.com/files/x/raw?q=1',
   'https://sdmntpreastus.oaiusercontent.com:444/files/x/raw?q=1',good+'#secret',
   'https://sdmntpreastus.oaiusercontent.com/other/raw?q=1',good+'x'*6001]:
   with self.subTest(url=url[:90]),self.assertRaises(ValueError):validate_url(url)

 def test_integrity_rejects_same_size_corruption_and_links(self):
  with tempfile.TemporaryDirectory() as folder:
   p=Path(folder)/'artifact';p.write_bytes(b'good');digest=hashlib.sha256(b'good').hexdigest();verify(p,4,digest)
   p.write_bytes(b'evil')
   with self.assertRaises(ValueError):verify(p,4,digest)
   with self.assertRaises(ValueError):verify(p,5,digest)
   link=Path(folder)/'link';link.symlink_to(p)
   with self.assertRaises(ValueError):verify(link,4,hashlib.sha256(b'evil').hexdigest())

 def test_only_exact_previously_tested_small_artifacts_are_shipped(self):
  root=Path(__file__).resolve().parents[1]
  self.assertEqual(len(SMALL),3)
  for name,(size,digest) in SMALL.items():verify(root/'downloads'/name,size,digest)

if __name__=='__main__':unittest.main()
