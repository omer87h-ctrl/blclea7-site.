# BL CLEA7 SDK 0.38.0-test — shared Core and dependency cache

Development/test distribution by Brzo i Lokalno. The authoritative BIL compiler,
bounded interpreter, shared Core, project CLI and original dependency/result cache
are included. This archive is not an Android/iOS/Windows installer or a claim of
native platform parity. Python3.12+ and Node22+ are development prerequisites.
No model, telemetry, cloud service or automatic dependency download is required.
Optional `ai status/ask/propose` uses a separately running owner-local9B gateway.
The SDK contains its client, not a model server or weights. `ai propose` requires
review and passes the actual compiler/isolated Runtime before writing a new file.
Sense contracts require Runtime0.37 and a host implementing those capabilities;
this compiler/Core archive does not contain native host binaries/build templates.

From the extracted SDK directory:

```sh
python -m clea7 doctor
python -m clea7 project new MyApp
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
label does not build or certify that platform. Published native0.15 remains distinct.

The RAM working cache stores bounded, app/principal-scoped pure results and exact
relevant dependencies, with transactional publication. It has no automatic disk storage.
Development diagnostics show real hit/miss/admission/eviction counters; production hides
internal event/state detail. Accounted cache bytes are not a hard OS process-memory cap.
See docs/BIL-DERIVE.md, docs/CLEA-CORE.md and docs/WORKING-CACHE.md.

LICENSE.txt and MATERIALS-LICENSE.txt are byte-identical to the pinned public0.17 SDK.
Existing rights and third-party notices remain unchanged. SDK-INVENTORY.json lists the
size/SHA256 of every other file. Archive hashes prove integrity, not author identity or
application safety. This development ZIP itself is unsigned.
