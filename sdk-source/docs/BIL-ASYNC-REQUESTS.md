# BIL asynchronous requests — development contract

BLclea Intent Language by Brzo i Lokalno. Development contract: `bil/3`,
`bil.ir/3`, `bil.program/3`, `clea7.application/7`, minimum Runtime **0.8.0** for browser packages and **0.9.0** for Android debug targets.
The browser foundation passed 24 actual Firebase emulator/BIL/Studio browser
groups at source `1c390dd16a7afe18c6da0cf49e766f1341bd71b3`, run
`38955142368`. That historical source does not establish Android /7. The later Runtime0.9 native
extension passed actual Studio-exported APK and independent Runtime tests on two
API30 AVDs at b440e82c723a (run38999992131). Full platform acceptance remains open.
See the exact evidence and passing old-platform native regression in
[`GENERAL-PLATFORM-WORK-LOG.md`](GENERAL-PLATFORM-WORK-LOG.md) and
[`acceptance/general-platform.json`](acceptance/general-platform.json).

This extends the existing compiler, interpreter, Engine and Studio. It does not
replace BIL with generated JavaScript or Kotlin applications. Old BIL programs
keep their previous ABI; an older Runtime must reject /7. The /7 development targets are browser and Android debug with the native broker
documented in [ANDROID-BACKEND.md](ANDROID-BACKEND.md). Android targets require
minimum Runtime0.9; old browser-only packets retain0.8. Windows remote execution
remains unsupported. Existing Android2–6 contracts remain available.

## Grammar and authoring

These productions extend the existing newline/semicolon-delimited BIL grammar:

```text
backend-declaration = "backend" identifier "using" string-literal ;
request-statement = "request" identifier "." identifier "." identifier
                    "(" [ expression { "," expression } ] ")"
                    "into" identifier "catch" identifier ;
```

Backend declarations are top-level declarations. The only registered adapter is
`"firebase.development/1"`; at most four unique backend aliases are allowed.
Aliases cannot conflict with application globals, handlers, functions or imports.

Requests are allowed **only inside `on` event handlers**, including their supported
control-flow blocks. They are rejected in main initialization and pure functions.
The compiler resolves the declared backend, exact operation, argument count/types,
result type, error type and source location before lowering a `REQUEST` instruction.
Unknown operations, arbitrary URLs and dynamic operation names are not allowed.

`into` and `catch` name distinct, existing **mutable application globals**. They
are not new local declarations or callback parameters. `catch` here names a
typed failure destination; it is not the existing synchronous `try/catch` block.
No `async fn`, `await`, user-defined completion function or subscription syntax
is introduced by this slice.

## Types and registered operations

When a backend is declared, the compiler supplies these public record types:

```text
RemoteSession = { uid: Text, email: Text }
RemoteFailure = { code: Text, message: Text, uncertain: Boolean }
```

`RemoteSession` exposes public identity only. It never contains a password, bearer
token, refresh token, service-account key or proof of current authentication.
Copying this record or restoring it from a backup does not authenticate a user.

| Operation | BIL arguments | Result destination | Meaning |
| --- | --- | --- | --- |
| `auth.register()` | None | `RemoteSession?` recommended | Trusted host obtains test credentials and calls Auth emulator registration. |
| `auth.signIn()` | None | `RemoteSession?` recommended | Trusted host obtains test credentials and calls Auth emulator sign-in. |
| `auth.session()` | None | `RemoteSession?` required | Reports the current host adapter's in-memory public session, or `null`. |
| `auth.signOut()` | None | `Boolean` | Invalidates this adapter's session and pending credential context; success is `true`. |
| `document.get(path)` | `Text` | A nullable, author-defined `Record` | Fetches one document, or `null` when absent; response must match the declared type exactly. |
| `document.set(path, value)` | `Text`, typed `Record` | `Boolean` | Writes one document; success is `true`. Server rules still decide access. |
| `document.delete(path)` | `Text` | `Boolean` | Deletes one document subject to server rules; success is `true`. |

All error destinations have type `RemoteFailure?`. Register/sign-in also permit
a statically compatible non-null public session destination, but nullable state
is recommended and session lookup requires it. A successful mutation cannot return
`false`, a string or a fabricated `{ok: true}` wrapper as its typed success value.

Document **root values must be Records**, not Lists. Supported record fields may
contain bounded lists, nested records, finite numbers, text, booleans and null.
Firestore timestamps, references, geopoints, arbitrary binary payloads and opaque
SDK objects are not silently converted into BIL values. Unknown or mismatched
fields fail the declared result contract rather than weakening its type.

Document paths contain 2–12 alternating collection/document segments, with each
segment matching `[A-Za-z0-9_-]{1,128}`. Empty segments, traversal, encoded URLs,
query fragments and arbitrary filesystem paths are rejected. Query/list,
subscription, Storage/media, messaging and push operations are not registered.

## Execution semantics: stage now, receive later

```bil
backend community using "firebase.development/1"
let session: RemoteSession? = null
let failure: RemoteFailure? = null
let localCount = 0

on check_session {
    request community.auth.session() into session catch failure
    localCount = localCount + 1
}
```

The request is staged in the current local transaction. Its arguments are checked
and captured as bounded BIL data. The previous failure target is cleared to
`null`; the result destination is **not** populated yet. The next statement runs
against the current local state, not a future result. Do not put `if session !=
null` immediately after a sign-in request and assume the request has finished.

The Engine validates the complete event, checks capabilities and conditionally
commits its state and queued-effect journal. If that local transaction fails,
the staged request is not dispatched. Only after a successful commit does the
coordinator start the external operation. It does not hold the local event queue
while waiting for credential input or the network, so independent deterministic
events can proceed.

Completion is an **Engine-managed event** that re-enters the existing bounded
queue. The result is checked against the compiled type and the app/context
generation is rechecked around lifecycle guards and local persistence. On success,
the Engine atomically assigns the result destination and clears the failure
destination. On failure, it assigns the typed failure and preserves the old result.
The committed UI refreshes from the real application state. There is no fabricated
success path or implicit BIL callback function.

Existing Engine queue capacity is 32 events. At most eight requests can be active,
and one BIL event may stage at most eight requests. Overlapping requests cannot
share either result or error slots. A duplicate coordinator request identity,
unknown operation or exceeded budget rejects clearly. Using one failure slot for
several concurrently pending requests is therefore intentionally invalid; await
completion through UI workflow or use distinct typed destinations.

Closing the Runtime closes the per-app adapter and invalidates request generation.
Session changes abort stale adapter work. Late completions must not commit into
a closed, uninstalled, changed-generation or different application context. A
failed completion commit is separately recorded; it does not imply the server
operation was undone.

## Checked IR and capability grants

A lowered instruction carries `op: "REQUEST"`, stable source identity/location,
backend alias, registered operation, checked argument expressions, result/error
global names and the compiled result type. The coordinator creates a fresh runtime
request ID; source identity and request identity serve different purposes.

Compiler-generated IR/application metadata list exactly the referenced operations
for each backend, sorted deterministically:

```json
{
  "format": "bil.remote/1",
  "backends": {
    "community": {
      "adapter": "firebase.development/1",
      "operations": ["auth.register", "auth.session"]
    }
  }
}
```

`ir.remote` and `project.remote` are source-owned. Recompilation and canonical
source/IR/application comparison reject altered grants, instructions or generated
project structure. The application package manifest carries the corresponding
remote contract and minimum Runtime. A native `permissions` array is not a
substitute for backend grants and is not silently widened by remote declarations.

The trusted host must approve the exact declared operation set for each backend.
Missing or extra grants, duplicate grant entries, unknown backends and an adapter
identity mismatch are rejected. Imported source cannot grant itself a network
endpoint, a host credential store, a service-account identity or new native powers.

## Host configuration and credential boundary

The development binding is host configuration, not BIL source:

```json
{
  "community": {
    "adapter": "firebase.development/1",
    "projectId": "demo-clea7-runtime",
    "authOrigin": "http://127.0.0.1:9099",
    "firestoreOrigin": "http://127.0.0.1:8080"
  }
}
```

The app coordinator accepts only `demo-clea7-*` project identities and documented
HTTP loopback Auth/Firestore ports. `localhost` and `127.0.0.1` are the approved
hostnames. Other production hosts, alternative ports, endpoint paths, query/hash
configuration, user/password URLs and unknown binding fields fail closed. The
adapter transport rejects redirects and omits ambient browser credentials. Studio/
Windows CSP connect exceptions are limited to the explicit loopback services;
they do not authorize arbitrary application networking.

The Studio asks for backend configuration and each declared operation separately
before running the remote app. It may save those bindings/grants in local host
storage. Registration/sign-in opens a trusted host dialog; BIL cannot read its
password control. The dialog is canceled/cleared when closed or aborted. Credential
entry has a **120-second** deadline; a network request has a separate **8-second**
deadline. Passwords and tokens do not enter BIL state, IR, packages, request traces
or the saved backend configuration.

The Auth adapter keeps its session and refresh material in memory. In-session
token refresh is an adapter detail; durable login is not implemented. Closing the
adapter clears that session. On application restart, Engine clears public session
targets associated with authentication requests instead of restoring saved state
as authentication truth. Users sign in again. Server documents persist independently
of that local session lifecycle while the development service retains them. The
actual tests restart applications, not the Firebase emulator process. Emulator
data is ephemeral by default without an explicit export/import persistence policy.

No service-account key, production Firebase account or production Brzo i Lokalno
project is needed. Local Firebase emulator tooling is a development dependency.
Production Firebase pricing/terms, regions, billing, security deployment and privacy
obligations require a separate owner/developer decision; this contract does not
offer unlimited free production hosting.

## Journal, failures and privacy

The scoped effect journal records lifecycle metadata such as request identity,
operation, source location and status: `queued`, `dispatched`, `confirmed`,
`failed`, `uncertain` (and cancellation where known). A separate local completion
marker distinguishes `committed` from `not-committed`. A confirmed server action
with a failed local write must remain honestly visible as that combination.

Interrupted queued/dispatched work is conservatively classified uncertain on
recovery. No request is automatically retried. This design does **not** promise
exactly-once server execution, remote rollback, automatic conflict resolution or
safe replay of a potentially completed mutation. Check server state before
deliberately retrying an uncertain write.

Public failures use a fixed redacted vocabulary: `Denied`, `Unavailable`,
`Cancelled`, `Timeout`, `Invalid`, `Authentication`, `NotFound`, `Conflict`,
`Budget`, `Persistence`, `Uncertain`. Arbitrary backend/provider error strings are
not copied into user state or default diagnostics. `uncertain` is real execution
metadata, not a reason to fabricate success or assume failure erased a server write.

Remote-app Engine events retain source identity, status, timings and changed/read
keys rather than private request/response bodies or raw UI trigger values.
For remote applications, automatic replay captures are disabled for all Engine
events, including locally deterministic ones, so ordinary captures cannot quietly
retain remote private data. Remote effects are blocked in SHADOW and REPLAY.
Explicit state/debug inspection, local backups and copied SHADOW state can still
contain application values; they remain local and are **not** a secret vault.
Developers must avoid sharing private captures. There is no new telemetry.

Local data is scoped by application, **not by authenticated user**. Sign-out
revokes the broker session and pending operations, but is not secure deletion of
every fetched value, debug snapshot, SHADOW copy or backup. A production multi-user
host still needs authenticated-user-scoped state/cache and tested account-switch/
logout cleanup. The approved emulator HTTP policy is not a production TLS strategy.

## Public host APIs

These JavaScript APIs belong to the trusted CLEA7 host implementation, not an
unrestricted import surface exposed to BIL:

- `CLEA7RemoteStudio.addRequest(source, options)` performs checked,
  source-preserving authoring of a request, missing typed destinations and optional
  button. Existing source is retained and the result is recompiled.
- `CLEA7RemoteStudio.configure(project, vault)` obtains/revalidates backend binding
  and exact grants through host UI. It does not collect or persist passwords.
- `CLEA7Remote.validateBinding(binding)` enforces the development endpoint shape.
- `CLEA7Remote.create(project, {bindings, grants, credentials})` creates the scoped
  coordinator; `credentials` is the trusted host prompt function.
- Coordinator `authorize`, `submit`, `status`, `pending` and `close` are used by
  the Engine lifecycle. They do not enable arbitrary scripts or dynamic plugins.
- `Engine.dispatch` commits a local event; it does not wait for remote completion.
  Trusted tests may use `Engine.waitRemote()` before asserting completed state.
  This test API is not BIL `await` syntax or a production wait-forever contract.

## Minimal executable BIL application

Start a new BIL project, replace its source with this original program, compile
and apply, then run. The example uses all seven registered operations and the
checked test rules. Firebase emulators must already be running locally.

```bil
backend community using "firebase.development/1"
record Profile { displayName: Text, bio: Text }
let session: RemoteSession? = null
let failure: RemoteFailure? = null
let profile: Profile? = null
let done = false
let displayName = "Amina"
let bio = "Original development profile"
let localCount = 0

screen home "My original app" {
    heading "Independent community experiment" key title
    input displayName label "Display name" required key display
    input bio label "About" key biography
    show localCount key count
    button "Register test user" runs register key register
    button "Sign in" runs signin key signin
    button "Check session" runs inspect key inspect
    button "Save my profile" runs save key save
    button "Read my profile" runs read key read
    button "Delete my profile" runs remove_profile key remove
    button "Sign out" runs signout key signout
    button "Independent local action" runs increment key increment
}

on register {
    request community.auth.register() into session catch failure
}
on signin {
    request community.auth.signIn() into session catch failure
}
on inspect {
    request community.auth.session() into session catch failure
}
on save {
    if session != null {
        request community.document.set("profiles/" + session.uid, new Profile { displayName: displayName, bio: bio }) into done catch failure
    }
}
on read {
    if session != null {
        request community.document.get("profiles/" + session.uid) into profile catch failure
    }
}
on remove_profile {
    if session != null {
        request community.document.delete("profiles/" + session.uid) into done catch failure
    }
}
on signout {
    request community.auth.signOut() into done catch failure
}
on increment {
    localCount = localCount + 1
}
```

Approve the exact generated backend grant set in the host dialog, then register
with **test-only** credentials. Wait for the actual request to finish before
saving/reading. The local action remains usable while credentials/network are
pending. Use explicit state/debug inspection for the nullable `session`, `profile`
and `failure` values; this example does not claim a finished profile/feed/chat UI.
It is a generic language/API example, not the mandatory community-app acceptance
proof. Studio's backend authoring form can add the same checked request operations
to a blank source project without copying this full example.

## Seven executable responsibilities

| Pillar | Actual request-slice responsibility | Required verification |
| --- | --- | --- |
| Core AI Manager | Bounded local queue/outbox scheduling; no AI model required | Pending credentials/network do not block deterministic Engine events |
| Link Bridge Elite | Typed REQUEST/result/failure envelopes and app/host identities | Canonical source/IR, cross-app coordinator and output-type checks |
| Expansion Q | Closed versioned backend registry and exact operation grants | Unknown operation/adapter and grant escalation rejection |
| Adaptive Recovery | Atomic local staging, completion guards, effect journal and honest uncertainty | Commit/close/restart/failure cases; no automatic mutation retry |
| Holo Interaction | Authoring/consent/credential dialogs and real state-driven UI | Actual browser input/run/error/independent Runtime workflow |
| Fallback Executor | Existing explicitly permitted local alternatives and fail-closed unavailable backend | No invented account/document/network success |
| Vision Q | Source-mapped real request lifecycle and redacted metadata | Source locations/statuses without passwords, tokens or response bodies |

## Verification commands and explicit omissions

Local tests with injected adapters/transports are labelled as such:

```sh
node tests/test_bil_remote.cjs
node tests/test_remote_engine.cjs
node tests/test_firebase_adapter.cjs
node tests/test_remote_authoring.cjs
node tests/test_remote_package.cjs
python -m unittest discover -s tests -p 'test_remote_contract.py' -v
```

The actual-service/browser suite is executed by
`.github/workflows/general-platform.yml` on `work/general-platform-08`, using
Node22, Java21, `firebase-tools@14.18.0` and `playwright@1.56.1`:

```sh
firebase emulators:exec --config tests/firebase/firebase.json --project demo-clea7-runtime --only auth,firestore 'node scripts/test_remote_emulators.cjs'
```

The runner also serves `web/` at the documented test origin. The orchestrator
runs `test_firebase_emulator.cjs`, `test_remote_firebase_workflow.cjs` and
`test_remote_studio_ui.cjs`. These three suites passed 8 groups each (24 total) on the exact source recorded
above; only that scoped browser foundation is accepted. Existing application/5–/6 regression,
source digests and native capability-rejection tests remain required. Full
browser/Windows/Android regression run `38955142402` also passed at the same
source: 112 old Chrome groups,199 Node groups,107 Python cases (Linux106+skip,
Windows107), actual frozen Windows GUI/Runtime restart and actual API30 legacy
native/module/library checks. These are old-contract compatibility checks, not
application/7 Android support or remote push proof.

Still absent: production backend adapter, remote query/subscriptions, role/approval
service, private chat, image/file upload lifecycle, remote push, durable login,
general async functions, automatic conflict/idempotency recovery and the full
two-Android community proof. Android /7 auth/document debug transport is now
separately verified; this does not establish the full social application. The separate non-business gesture/animation app
also remains an acceptance gate. No claim of Android Studio/Rive parity or
production readiness follows from these request APIs.
