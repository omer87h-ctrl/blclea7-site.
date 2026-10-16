"""Exercise the curated public SDK independently of the private native host."""
import hashlib,json,subprocess,sys,tempfile,unittest,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SDK=ROOT/'sdk-source'

def cli(*args):
    return subprocess.run([sys.executable,'-m','clea7',*args],cwd=SDK,
                          text=True,capture_output=True,timeout=30)

class PublicBILSDKTests(unittest.TestCase):
    def test_real_core_record_and_function_program(self):
        result=cli('bil','run','sdk/examples/bil/core.bil')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(json.loads(result.stdout)['state']['total'],42)

    def test_public_source_compiles_packages_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'example.clea7'
            args=('bil','package','sdk/examples/bil/counter.bil','--output',str(output),'--id','public_bil_test')
            result=cli(*args);self.assertEqual(result.returncode,0,result.stderr)
            value=json.loads(output.read_text())
            self.assertEqual(value['manifest']['abi'],'clea7.application/5')
            self.assertEqual(value['manifest']['runtime'],'0.6.0')
            before=output.read_bytes()
            self.assertNotEqual(cli(*args).returncode,0)
            self.assertEqual(output.read_bytes(),before)

    def test_invalid_type_does_not_create_a_package(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'wrong.bil';output=Path(folder)/'wrong.clea7'
            source.write_text('let amount = 10\namount = "wrong"\n')
            result=cli('bil','package',str(source),'--output',str(output))
            self.assertNotEqual(result.returncode,0)
            self.assertIn('BIL_TYPE',result.stderr)
            self.assertFalse(output.exists())

    def test_tampered_ir_is_rejected_by_the_actual_public_executor(self):
        app=json.loads((SDK/'sdk/examples/bil/counter.application.json').read_text())
        app['bil']['ir']['main'][0]['op']='HOST_SHELL'
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'tampered.json';source.write_text(json.dumps(app))
            result=cli('test',str(source),'--flow','bil_increase')
            self.assertNotEqual(result.returncode,0)

    def test_record_app_compiles_independently_with_current_contract(self):
        result=cli('bil','check','sdk/examples/bil/orders.bil')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(json.loads(result.stdout)['ir'],'bil.ir/2')
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'orders.clea7'
            result=cli('bil','package','sdk/examples/bil/orders.bil','--output',str(output),'--id','public_orders')
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(json.loads(output.read_text())['manifest']['runtime'],'0.7.0')

    def test_archive_contains_language_but_no_private_host_or_generated_cache(self):
        with zipfile.ZipFile(ROOT/'downloads/BL-CLEA7-SDK-0.7.0.zip') as z:
            self.assertIsNone(z.testzip())
            names=set(z.namelist())
            self.assertTrue({'clea7/bil.py','sdk/bil-cli.cjs','web/workbench/bil-compiler.js',
                             'web/workbench/bil-runtime.js','docs/BIL-LANGUAGE-SPEC.md'}<=names)
            self.assertFalse(any('__pycache__' in n or n.endswith('.pyc') for n in names))
            self.assertFalse({'main.py','runtime_main.py','clea7/host.py','clea7/desktop.py',
                              'clea7/cloud_ai.py','clea7/ai.py'}&names)
            self.assertEqual(z.read('LICENSE.txt'),(ROOT/'docs/USLOVI.txt').read_bytes())

    def test_existing_json_application_still_executes(self):
        result=cli('test','sdk/examples/units.application.json','--flow','convert','--state','{"kilometres":2.5}')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('2500',result.stdout)

if __name__=='__main__':unittest.main()
