# Local gateway contract correction —0.41.1

The SDK/native relay previously compared `health.modelProfile` with a string.
The actual public-ai/1 gateway publishes a profile object with `id`, name,
licence, quantizer, exact weights hash/size and context budget. A ready9B could
therefore appear unavailable to Studio/SDK while web conversation worked.
The relay now reads the canonical object's ID and keeps the prior string form
compatible. Other models, public-mode services, arbitrary ports and unready
services remain rejected. No second model, download or open endpoint is added.

The owner desktop site also retained an old1.5MB ceiling even after public
curation approved exact larger PDF/standalone assets. It now uses the existing
per-file pinned byte limit, verifies the full manifest as before, and serves
`.mjs` with a JavaScript MIME type. Arbitrary large or modified files still fail.
No global size/security budget was raised.

`tests/test_local_gateway_contract.py` starts the actual HTTP gateway and actual
Native Host on temporary loopback ports. It verifies canonical health, SDK chat,
structured Studio tool proposal, real BIL compilation/SHADOW checks and the
owner-authenticated native relay. Only readiness/neural inference are explicit
fixtures; this proves integration, not neural quality. The pinned real PDF worker
loads with its exact bytes/MIME and a changed worker rejects. The Windows owner
checkout proof now constructs the actual complete LocalDesktopSite, rather than
only packaging files, and checks that same module's bytes/MIME.

Executed locally:388 Python tests,386 passed and2 Windows DPAPI skips;3 actual
HTTP/asset integration cases;4 SDK curation/unpacked lifecycle cases. SDK0.41.1
retains116 curated files and original licences. Earlier0.40/0.41 downloads remain
immutable. Engine/application ABI stays Runtime0.40.

The owner HP is off. No actual new9B inference, owner installation/logon,70B
quality equivalence, permanent public endpoint or complete Master acceptance is
claimed. Matching native0.41.1 build/publication is recorded only after it passes.
