"""Promotion boundary fixtures; these tests are not native execution proof."""
import copy,hashlib,io,json,tempfile,unittest,zipfile
from pathlib import Path
from scripts import publish_checked_android_0422 as android
from scripts import publish_checked_038 as windows

def fixture():
    checks=list(android.REQUIRED);ocr=list(android.OCR_REQUIRED)
    native='CLEA7_SCENE_ANDROID_CHECKS '+json.dumps(checks)
    runtime=native+'\nCLEA7_ANDROID_OCR_CHECKS '+json.dumps(ocr)
    proof={'source':android.SOURCE,'draw':dict.fromkeys(('actualAndroidExecuted','embeddedRuntimePassed','independentRuntimePassed','activityRestartPassed'),True),
           'scene':{'embeddedChecks':checks,'independentChecks':checks,'nativeOcrChecks':ocr,'logSha256':{'embedded':hashlib.sha256(native.encode()).hexdigest(),'independent':hashlib.sha256(runtime.encode()).hexdigest()}}}
    for key in ('actualGradleBuild','actualAndroidEmulatorSenseTest','independentRuntimeInstallAndSenseTest','actualAndroidEmulatorDrawTest','actualAndroidEmulatorSceneTest','independentRuntimeSceneTest','nativeOcrRecognition'):proof[key]=True
    return proof,native,runtime

def check(proof,native,runtime):
    stream=io.BytesIO()
    with zipfile.ZipFile(stream,'w') as z:
        z.writestr('android-037/report.json',json.dumps(proof));z.writestr('android-042/native-scene.txt',native);z.writestr('android-042/runtime-scene.txt',runtime)
    with zipfile.ZipFile(stream) as z:return android.validate_evidence(z)

class NativePromotionTests(unittest.TestCase):
    def test_success_flags_without_completed_native_observations_are_rejected(self):
        proof,native,runtime=fixture();self.assertEqual(check(proof,native,runtime)['source'],android.SOURCE)
        for text in ('CLEA7_SCENE_ANDROID_FAILURE timeout','CLEA7_SCENE_ANDROID_CHECKS []'):
            bad=copy.deepcopy(proof);bad['scene']['logSha256']['independent']=hashlib.sha256(text.encode()).hexdigest()
            with self.assertRaises(ValueError):check(bad,native,text)

    def test_missing_ocr_and_altered_native_log_fail_closed(self):
        proof,native,runtime=fixture()
        with self.assertRaises(ValueError):check(proof,native,runtime+' altered')
        bad=copy.deepcopy(proof);bad['scene']['logSha256']['independent']=hashlib.sha256(native.encode()).hexdigest()
        with self.assertRaisesRegex(ValueError,'observed'):check(bad,native,native)

    def test_other_source_cannot_authorize_this_release(self):
        proof,native,runtime=fixture();proof['source']='0'*40
        with self.assertRaises(ValueError):check(proof,native,runtime)

    def test_old_installer_proof_cannot_authorize_the_new_binary(self):
        root=Path(__file__).resolve().parents[1];spec=windows.release_spec('scenes-0422')
        self.assertEqual(windows.install_receipt(root,spec)['verificationRun'],43791225579)
        with self.assertRaises(ValueError):windows.install_receipt(root,dict(spec,receipt='windows-installed-scenes-042.json'))

if __name__=='__main__':unittest.main()
