# BL CLEA7 SDK 0.48.0-test — shared Core and dependency cache

Development/test distribution by Brzo i Lokalno.
Runtime0.48 adds the typed clea7500.private/1 extension contract. Its private host,
models, paired credentials and owner data are NOT included in this curated SDK. The authoritative BIL compiler,
bounded interpreter, shared Core, project CLI and original dependency/result cache
are included. This archive is not an Android/iOS/Windows installer or a claim of
native platform parity. Python3.12+ and Node22+ are development prerequisites.
No conversational model, telemetry, cloud service or automatic dependency download is required.
The licensed local OCR models retain their provenance.
Optional `ai status/ask/propose` uses a separately running owner-local9B gateway.
The SDK contains its client, not a model server or weights. `ai propose` requires
review and passes the actual compiler/isolated Runtime before writing a new file.
Sense contracts require Runtime0.37 and a host implementing those capabilities;
this compiler/Core archive does not contain native host binaries/build templates.
Runtime0.42 adds bounded2D scenes, clock/pad/camera and local OCR with review.
Project-scoped incremental compilation and source/IR compatibility are documented
in docs/BIL-INCREMENTAL-COMPILER.md; examples are in sdk/examples/bil.

Core5 adds the original sentence-object grammar. See docs/BIL-OBJECT-GRAMMAR.md.
It requires Runtime0.44 and includes real remembered fields, reactive relations,
owned actions, typed lazy SELECT and the shared Studio object tools.
Runtime0.45 adds explicit custom views (pogled) over the same owned state: arbitrary
layouts, vectors, animation, camera, clocks, controls and navigation, not a fixed
business form. See docs/BIL-OBJECT-VIEWS.md and signal-lab.bil.

Runtime0.46 adds bounded data-only media, sprites, captioned sound and measured PCM.
Runtime0.47 adds the original WebGL2 CLEA Depth host, real3D geometry, shadow maps,
monocular parallax, Draw-contour extrusion and shared AI/Draw tool schema revision5.
See docs/CLEA-DEPTH.md and CLEA-RESOURCES.md. Browser evidence is separate from
physical-device, native, neural-training or general70B-quality acceptance.

From the extracted SDK directory:

```sh
python -m clea7 doctor
python -m clea7 project new MyApp
python -m clea7 project new MyObjects --template objects
python -m clea7 project test MyObjects
python -m clea7 project check MyApp
python -m clea7 project run MyApp --flow calculate
python -m clea7 project test MyApp
python -m clea7 project build MyApp --output dist/MyApp.clea7
python -m clea7 validate MyApp/dist/MyApp.clea7
python -m clea7 project check sdk/examples/universal-quote
python -m clea7 project test sdk/examples/universal-quote
```

Existing flat-file commands remain available: bil check/features/compile/run/package,
validate/package/test/test-suite. Project creation/build refuses destructive overwrite.
Project dependencies are currently empty; unsupported external dependencies are rejected.

`derive` and new Core3 operations require Runtime0.18. Older sources keep their actual
feature minimum. The Runtime validates source/IR and package integrity; adding a target
label does not build or certify that platform. Native builds and signatures require their own evidence. Browser Sense document import
uses the included Apache-2.0 PDF.js client/worker; local-TTS document reading and
reviewed behavioral checks are documented in docs/SENSE-DOCUMENT-IMPORT.md and
docs/STUDIO-TESTS-039.md. No OCR or neural weight training is implied.

The RAM working cache stores bounded, app/principal-scoped pure results and exact
relevant dependencies, with transactional publication. It has no automatic disk storage.
Development diagnostics show real hit/miss/admission/eviction counters; production hides
internal event/state detail. Accounted cache bytes are not a hard OS process-memory cap.
See docs/BIL-DERIVE.md, docs/CLEA-CORE.md and docs/WORKING-CACHE.md.

LICENSE.txt and MATERIALS-LICENSE.txt are byte-identical to the pinned public0.17 SDK.
Existing rights and third-party notices remain unchanged. SDK-INVENTORY.json lists the
size/SHA256 of every other file. Archive hashes prove integrity, not author identity or
application safety. This development ZIP itself is unsigned.
