BL CLEA7 Studio and independent Runtime0.39 — by Brzo i Lokalno.

The existing BIL designer now adds nine working compositions to an existing
project: bound text/multiline/number/toggle/select fields, bounded progress,
animated gesture shape, existing-screen navigation and a button with real
behavior. Typed data and events are created together. Existing code, application
identity, stored values and Undo are preserved. Studio also authors executable
tests and checks selected tests before an AI change is applied.

Exact source9092f01f2034454f692c634066f9ed0bd39d0de9 passed actual frozen
WebView2 Studio and independent Runtime checks, including execution of an added
progress control while preserving existing saved data. Build42667011893 and
actual install/uninstall42868865644 verify the exact published binary. User-file
sentinels survived uninstall. The app-local WebView2 renderer is included.

This is a development installer without a production signing certificate. Android
development tools remain an optional official download after user consent; model
weights and private data are not bundled. Owner-local9B inference needs the owner
HP to be running. Model-generated arbitrary applications,70B equivalence and
physical assistive-user evaluation are not certified by these build tests.
