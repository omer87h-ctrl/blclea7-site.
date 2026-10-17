# BIL native capability contract — Runtime 0.13

Original implementation by Brzo i Lokalno. Extends the existing BIL5/application9
request model with versioned `android.native/1`; older formats/adapters retain
existing semantics and minimum hosts. It is not a generated Kotlin/JavaScript app.

```bil
backend phone using "android.native/1"
let photograph: NativeMedia? = null
let failure: RemoteFailure? = null
on capture {
    request phone.camera.capture() into photograph catch failure
}
screen home "My application" {
    image photograph label "My photograph" key photograph
    button "Capture" runs capture key capture
}
```

Run `python -m clea7 bil check sdk/examples/bil/native-media.bil`, then
`python -m clea7 bil package sdk/examples/bil/native-media.bil --output Native.clea7`.
Default native target is Android; packages require host0.13. Browser/Windows native
execution is rejected. Windows Studio can author/export these apps; building APKs
uses the actual Android SDK/JDK/Gradle toolchain. Source-exported native-only apps
contain Runtime and do not require Firebase, INTERNET permission or the debug-only
Firebase transport. Production signing remains owner controlled.

## Typed operations

| Operation | Input | Successful result | Android permission |
|---|---|---|---|
| camera.capture | none | NativeMedia | camera |
| media.pick | none; visible Android document picker | NativeMedia | explicit system selection |
| media.list | none | List\<NativeMedia\> | none |
| media.inspect | Text opaque handle | NativeMedia | none |
| media.remove | Text opaque handle | Boolean true | none |
| location.current | none | NativeLocation | location |
| notification.post | NativeNotification | NativeReceipt | notifications on API33+ |

NativeMedia contains `{handle,mime,width,height,bytes}`; it never exposes a file
path or accepts a user-supplied URL. NativeLocation contains bounded latitude,
longitude,accuracy,timestamp. NativeNotification contains title,body,id and the
receipt verifies the actual posted OS notification and matching id. This is a
**local notification**, not remote push. OS/platform availability and user denial
are real failures, not fabricated results.

## Scheduling, state and security

The existing Core AI Manager/VM stages requests after a local transaction commits.
Link Bridge Elite validates types, application identity and native operation data.
Expansion Q lists installed native capabilities. Adaptive Recovery retains effect
outcomes and does not repeat uncertain external actions. Holo Interaction renders
actual private JPEGs and bound controls. Fallback Executor uses typed error events
and existing explicit alternatives. Vision Q records actual operation/source IDs,
completion handlers and timing; image bytes/handles and private provider messages
are omitted from automatic traces. These responsibilities reuse executable code;
no AI model, external service, telemetry or decorative extra subsystem is added.

At most8 external requests,16 callback continuations and the existing queue/VM
budgets apply. Hardware does not block unrelated deterministic events. Abort,
close and authenticated-principal transitions reject late delivery. SHADOW and
REPLAY cannot access native hardware. Native side effects cannot be rolled back
with local state and may be uncertain after interruption. Do not auto-retry them.

Android adds native consent for exact named operations and OS permission prompts.
The selected launcher application cannot be replaced by a caller's app ID. The
native media scope comes from host-owned authenticated sessions, never a BIL
value or supplied user ID. Different applications/accounts get separate directories.
An untrusted handle cannot select a filesystem path. Served images check the
current scope and integrity and use `Cache-Control: no-store`. Imported JPEG/PNG/
WebP raster images are pixel/byte bounded, downsampled and re-encoded as JPEG;
source EXIF is not copied. Data stays in app-private storage. SVG/scripts/arbitrary
files do not become native executable content.

Limits:5MiB per JPEG,32MiB per application across accounts,50 media objects in one
account scope. Integrity checks reject damaged data. Media listing permits recovery
of previous handles, including after a missed callback. Storage capacity is checked
before creation; existing content is never silently evicted. `media.remove` is an
explicit irreversible file operation. Runtime uninstall native-file cleanup and
file backup/export need separate end-to-end verification; state backup does not
copy JPEG bytes. Other media categories, remote object storage, production backend
credentials, remote push and the full multi-user/rich-app benchmark remain open.

## Studio and verification

The existing capability form authors native requests and typed continuations.
Image controls bind to NativeMedia. Code, component operations, undo/redo and
exports all use compiler-checked source. Groups/components can be duplicated with
fresh stable keys and moved to another screen/row/card; self-containment is
rejected and unrelated source/algorithms are retained.

- `node tests/test_native_media.cjs`: injected-bridge compiler/VM/coordinator,
  capability, cancellation, transactional persistence, source/visual and package
  checks. **Not Android/hardware evidence.**
- `python -m unittest discover -s tests -p test_native_contract.py -v`: SDK,
  envelopes, signatures and native-only source export checks.
- `tests/test_native_studio_ui.cjs`: actual Chrome Studio authoring from blank and
  actual download; it does not simulate hardware in Chrome.
- `android-native.yml`: actual Studio-exported app and same package independently
  installed into Android Runtime, API30/API35, Camera2, private JPEG access,
  restart, inspect/list/remove, document-picker cancellation, local OS notification
  and emulator GPS. Record results against exact source before claiming a pass.
- Physical phones, successful document-picker selection, cold force-stop,
  release signing and cross-account media tests require explicit additional proof.
