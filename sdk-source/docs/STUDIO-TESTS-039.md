# Studio behavioral tests

Open a BIL project, then **Pokreni i testiraj**. Add a named test step with an
ordinary event or restart and an expected BIL value, screen or error substring.
Steps in a test share an isolated MemoryVault. Each named test starts fresh.
The existing compiler, Core and seven-pillar SHADOW verification run the source;
live application data and external adapters are not modified or simulated.

Export uses the existing `clea7.project-tests/1` format. The identical JSON runs
through `python -m clea7 project test` when placed at a project's `tests` path.
The Studio limits suites to64KiB,20 cases,20 steps per case and100 total steps.
Expected errors check real exceptions and rollback; a matching error is required.

Choose which named test an AI change must preserve. Its checks stay local and
are not silently included in the model request. The model's proposal runs those
checks and they run again before applying. Editing the tests invalidates the UI's
pending approval; editing source invalidates stale success evidence. Compiler
recovery remains bounded. Neural generation quality and physical device behavior
require their own actual evidence.

Browser verification authored a BIL app, exercised sequential state changes,
restart, navigation, failure and isolation, and ran the exported suite unchanged
in the independent public SDK. This is not a claim of arbitrary-app correctness.
