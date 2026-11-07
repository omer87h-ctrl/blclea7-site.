"""Prepare a reviewed web deployment from the HP verification receipt.

Never changes DNS, uploads secrets or deploys Pages. Default is preview-only.
Activation additionally requires the operator's explicit real-phone-test record.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PAGES = ("studio/workbench/index.html", "sense/index.html", "razgovor/index.html")


def apply(receipt, *, enable=False, phone_test_record=None, root=ROOT):
    if receipt.get("schema") != "clea7.web-ai/1" or receipt.get("publicHTTPSHealthVerified") is not True:
        raise ValueError("An actual HP HTTPS verification receipt is required.")
    endpoint = receipt.get("endpoint")
    if not isinstance(endpoint, str): raise ValueError("Missing HTTPS endpoint.")
    url = urlsplit(endpoint)
    if (url.scheme != "https" or endpoint != "https://"+str(url.hostname) or url.username
            or url.password or url.port is not None or not re.fullmatch(
                r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", url.hostname or "")):
        raise ValueError("Use the exact verified canonical HTTPS endpoint.")
    identity, key = receipt.get("deploymentId"), receipt.get("turnstileSiteKey")
    if not isinstance(identity, str) or not re.fullmatch(r"[a-f0-9]{32}", identity):
        raise ValueError("Missing exact HP deployment identity.")
    if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{10,200}", key):
        raise ValueError("Missing public site key; never place a secret key here.")
    if enable:
        record = phone_test_record or {}
        if (record.get("schema") != "clea7.owner-phone-test/1" or record.get("deploymentId") != identity
                or record.get("publicConversationPassed") is not True
                or record.get("externalPhoneNetwork") is not True
                or not isinstance(record.get("testedAt"), str) or not record["testedAt"].strip()):
            raise ValueError("Record an actual external-phone conversation before enabling public access.")
    config = {"schema": "clea7.web-ai/1", "enabled": bool(enable), "previewOnly": not enable,
              "endpoint": endpoint, "deploymentId": identity, "turnstileSiteKey": key,
              "publicHTTPSHealthVerified": True, "phoneConversationVerified": bool(enable)}
    edits = {}
    old = json.loads((root/"clea-ai-config.json").read_text())
    for name in PAGES:
        text = (root/name).read_text()
        def csp(match):
            directives = match.group(1).split(";")
            found = False
            for index, directive in enumerate(directives):
                tokens = directive.split()
                if tokens and tokens[0] == "connect-src":
                    tokens = [v for v in tokens if v != old.get("endpoint")]
                    if endpoint not in tokens: tokens.append(endpoint)
                    directives[index] = " ".join(tokens); found = True
            if not found: raise ValueError("Missing explicit connect-src in "+name)
            return 'http-equiv="Content-Security-Policy" content="'+';'.join(directives)+'"'
        text, count = re.subn(r'http-equiv="Content-Security-Policy" content="([^"]+)"', csp, text)
        if count != 1: raise ValueError("Ambiguous CSP in "+name)
        edits[name] = text
    edits["clea-ai-config.json"] = json.dumps(config, indent=2)+"\n"
    for manifest_name in ("release/ai-020.json", "release/web-018.json"):
        value = json.loads((root/manifest_name).read_text())
        for item in value["files"]:
            data = edits[item["path"]].encode() if item["path"] in edits else (root/item["path"]).read_bytes()
            item.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        edits[manifest_name] = json.dumps(value, indent=2, ensure_ascii=False)+"\n"
    # Validate all inputs before writing. Git review/tests precede any publishing.
    for name, text in edits.items(): (root/name).write_text(text)
    return {"files": list(edits), "enabled": enable, "previewOnly": not enable,
            "endpoint": endpoint, "deployed": False,
            "previewQuery": None if enable else "clea-verify="+identity}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--enable", action="store_true")
    parser.add_argument("--phone-test-record", type=Path)
    args = parser.parse_args()
    receipt = json.loads(args.receipt.read_text())
    record = json.loads(args.phone_test_record.read_text()) if args.phone_test_record else None
    print(json.dumps(apply(receipt, enable=args.enable, phone_test_record=record), indent=2))
