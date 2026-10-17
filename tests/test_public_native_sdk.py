"""Execute the independently extractable public SDK; no private host imports."""
import json,subprocess,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SDK=ROOT/'sdk-source'
class PublicNativeSDK(unittest.TestCase):
 def call(self,*args):
  result=subprocess.run([sys.executable,'-m','clea7',*args],cwd=SDK,capture_output=True,text=True);self.assertEqual(result.returncode,0,result.stderr);return json.loads(result.stdout)
 def test_independent_language_and_native_package(self):
  source='sdk/examples/bil/native-media.bil';checked=self.call('bil','check',source);self.assertEqual(checked['language'],'bil/5')
  with tempfile.TemporaryDirectory() as folder:
   output=Path(folder)/'native.clea7';self.call('bil','package',source,'--output',str(output));package=json.loads(output.read_text());self.assertEqual(package['manifest']['targets'],['android']);self.assertEqual(package['manifest']['runtime'],'0.13.0');self.assertEqual(package['manifest']['permissions'],['camera','location','notifications']);self.call('validate',str(output))
 def test_private_native_implementation_and_credentials_are_excluded(self):
  self.assertEqual(list(SDK.rglob('*.java')),[])
  for name in ['host.py','desktop.py','cloud_ai.py']:self.assertFalse((SDK/'clea7'/name).exists())
  self.assertFalse(list(SDK.rglob('*.jks')))
