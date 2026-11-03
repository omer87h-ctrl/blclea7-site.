"""Actual standalone original-model SDK from the published downloadable ZIP."""
from pathlib import Path
import hashlib,json,shutil,subprocess,tempfile,unittest,zipfile

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'downloads/BL-CLEA-Conversation-SDK-0.20-test.zip'


@unittest.skipUnless(shutil.which('node'),'Node20+ required for actual SDK execution')
class OriginalChatSDKTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        with zipfile.ZipFile(ARCHIVE) as archive:
            for name in archive.namelist():
                self.assertFalse(Path(name).is_absolute());self.assertNotIn('..',Path(name).parts)
            archive.extractall(self.root)

    def run_cli(self,*args,success=True):
        result=subprocess.run(['node','sdk/clea-chat.cjs',*args],cwd=self.root,capture_output=True,text=True,timeout=30)
        self.assertEqual(result.returncode==0,success,result.stdout+result.stderr)
        return json.loads(result.stdout if success else result.stderr)

    def test_every_downloaded_source_is_hashed_and_private_hosts_are_excluded(self):
        with zipfile.ZipFile(ARCHIVE) as archive:
            self.assertIsNone(archive.testzip());names=set(archive.namelist())
            self.assertEqual(len(names),31)
            inventory=json.loads(archive.read('SDK-INVENTORY.json'))
            self.assertEqual(inventory['version'],'0.20.0-test')
            self.assertFalse(inventory['nativeBuildIncluded'])
            self.assertEqual({x['path'] for x in inventory['files']},names-{'SDK-INVENTORY.json'})
            for item in inventory['files']:
                data=archive.read(item['path']);self.assertEqual(len(data),item['bytes']);self.assertEqual(hashlib.sha256(data).hexdigest(),item['sha256'])
            self.assertFalse(names&{'main.py','runtime_main.py','clea7/host.py','identity.dpapi'})
            self.assertFalse(any(n.endswith(('.exe','.apk','.dll','.dpapi')) for n in names))

    def test_independent_cli_validates_the_actual_original_model_and_bil_policy(self):
        valid=self.run_cli('validate');info=self.run_cli('info')
        self.assertTrue(valid['valid']);self.assertTrue(valid['policy']['executed'])
        self.assertGreater(valid['policy']['instructions'],0)
        self.assertEqual(info['model']['parameterCount'],135349)
        self.assertEqual(info['model']['modelFingerprint'],'4a2ecae4216ae50ccbf0d2280331ea1f59bfe2a691aa22bcddd2bfa211e15e76')
        self.assertFalse(info['privacy']['inferenceNetwork']);self.assertFalse(info['privacy']['externalModel'])

    def test_independent_cli_really_generates_and_invokes_core_arithmetic(self):
        answer=self.run_cli('ask','Šta je BIL?','--language','bs','--no-cache')['answer']
        self.assertEqual(answer['mode'],'neural');self.assertGreater(answer['metrics']['steps'],1)
        self.assertIn('BIL je tipizirani CLEA jezik',answer['text'])
        calculation=self.run_cli('ask','23 * 4')['answer']
        self.assertEqual(calculation['mode'],'bil');self.assertEqual(calculation['text'],'Rezultat je 92.')

    def test_corrupted_model_fails_integrity_in_the_real_sdk_process(self):
        model=self.root/'web/workbench/chat/model.json';model.write_bytes(model.read_bytes()+b' ')
        result=self.run_cli('validate',success=False)
        self.assertEqual(result['error']['code'],'SDKIntegrity')


if __name__=='__main__':unittest.main()
