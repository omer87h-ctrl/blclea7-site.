"""Protect published asset bytes across Linux and Windows Git checkouts."""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def git_attribute(path, attribute):
    result = subprocess.check_output(
        ["git", "check-attr", attribute, "--", path],
        cwd=ROOT,
        text=True,
    ).strip()
    return result.rsplit(": ", 1)[-1]


class WindowsAssetCheckoutTests(unittest.TestCase):
    def test_immutable_pdf_assets_keep_lf(self):
        manifest = json.loads(
            (ROOT / "release" / "ai-host-assets.json").read_text(encoding="utf-8")
        )
        listed = {row["path"] for row in manifest["files"]}
        required = {
            "sense/vendor/pdfjs/pdf.mjs",
            "sense/vendor/pdfjs/pdf.worker.mjs",
            "sense/vendor/pdfjs/LICENSE",
        }
        self.assertTrue(required <= listed)
        for path in sorted(required):
            with self.subTest(path=path):
                self.assertEqual(git_attribute(path, "eol"), "lf")

    def test_archived_sdk_files_remain_binary(self):
        manifest = json.loads(
            (ROOT / "release" / "ai-host-assets.json").read_text(encoding="utf-8")
        )
        archives = [row["path"] for row in manifest["files"] if row["path"].endswith(".zip")]
        self.assertTrue(archives)
        for path in archives:
            with self.subTest(path=path):
                self.assertEqual(git_attribute(path, "text"), "unset")


if __name__ == "__main__":
    unittest.main()
