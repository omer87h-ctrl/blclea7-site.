"""Endpoint-promotion policy; fixture receipts never prove a live phone test."""
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from scripts.configure_ai_endpoint import apply, ROOT, PAGES


class EndpointConfigTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in (*PAGES, "clea-ai-config.json", "release/ai-020.json", "release/web-018.json"):
            path = self.root/name; path.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(ROOT/name, path)
        for manifest in ("release/ai-020.json", "release/web-018.json"):
            for item in json.loads((self.root/manifest).read_text())["files"]:
                path = self.root/item["path"]
                if not path.exists(): path.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(ROOT/item["path"], path)
        self.receipt = {"schema": "clea7.web-ai/1", "endpoint": "https://ai.clea7.example", "deploymentId": "a"*32,
                        "turnstileSiteKey": "public-fixture-key", "publicHTTPSHealthVerified": True}

    def test_preview_csp_and_manifest_match_without_enabling_public_chat(self):
        result = apply(self.receipt, root=self.root)
        self.assertFalse(result["enabled"]); self.assertFalse(result["deployed"])
        self.assertTrue(json.loads((self.root/"clea-ai-config.json").read_text())["previewOnly"])
        for name in PAGES:
            text = (self.root/name).read_text()
            self.assertEqual(text.count("https://ai.clea7.example"), 1)
            self.assertNotIn("connect-src *", text)

    def test_requires_explicit_matching_phone_record_for_activation(self):
        for record in (None, {}, {"deploymentId": "0"*32}):
            with self.assertRaises(ValueError): apply(self.receipt, enable=True, phone_test_record=record, root=self.root)
        record = {"schema": "clea7.owner-phone-test/1", "deploymentId": "a"*32, "publicConversationPassed": True,
                  "externalPhoneNetwork": True, "testedAt": "fixture-not-a-real-phone-test"}
        self.assertTrue(apply(self.receipt, enable=True, phone_test_record=record, root=self.root)["enabled"])

    def test_rejects_http_credentials_paths_identity_and_missing_verification(self):
        for key,value in (("endpoint","http://ai.clea7.example"),("endpoint","https://user@ai.example"),
                          ("endpoint","https://ai.example/path"),("endpoint","https://127.0.0.1"),
                          ("deploymentId","abc"),("publicHTTPSHealthVerified",False)):
            changed = copy.deepcopy(self.receipt);changed[key]=value
            with self.subTest(key=key,value=value), self.assertRaises(ValueError): apply(changed,root=self.root)


if __name__ == "__main__": unittest.main()
