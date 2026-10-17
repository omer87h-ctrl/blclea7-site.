# Firebase development adapter: genuine emulator-only remote operations

This is the first remote capability slice, not the full multi-user platform.
`firebase.development/1` connects the trusted Runtime host to actual Firebase Auth
and Firestore emulators. It does not use the Brzo i Lokalno production project,
accounts, database or files. No Firebase credentials or service account is needed.

## Current contract

A trusted embedding creates one adapter per application/backend binding:

```js
const backend = CLEA7FirebaseDevelopment.create({
  application: 'community_project',
  projectId: 'demo-clea7-runtime',
  authOrigin: 'http://127.0.0.1:9099',
  firestoreOrigin: 'http://127.0.0.1:8080',
  credentials: async (operation, {signal, application}) => {
    // Trusted host dialog, not BIL source or operation arguments.
    // Obtain deliberate user input; honor cancellation. Never log it.
    return {email: enteredEmail, password: enteredPassword};
  }
});

const user = await backend.execute({operation: 'auth.signIn', args: []});
await backend.execute({
  operation: 'document.set', args: ['private/' + user.uid, {note: 'Saved remotely'}]
});
const saved = await backend.execute({
  operation: 'document.get', args: ['private/' + user.uid]
});
backend.close();
```

The example shows an embedding API. Application authors use BIL requests and
Studio capability bindings; this does not grant arbitrary JavaScript to packages.
The Runtime coordinator must separately grant each declared backend operation and
must refuse external effects in SHADOW and REPLAY before invoking the adapter.
Loading this file alone does not wire a Studio, CSP, APK or capability broker.

| Operation | Arguments | Public result |
|---|---|---|
| `auth.session` | none | `{uid: Text, email: Text}` or `null` |
| `auth.register` | none | `{uid: Text, email: Text}` |
| `auth.signIn` | none | `{uid: Text, email: Text}` |
| `auth.signOut` | none | `true` |
| `document.get` | document path | raw decoded Record, or `null` if absent |
| `document.set` | document path, Record | `true` after server confirmation |
| `document.delete` | document path | `true` after server confirmation |

Document paths use 2–12 collection/document segments, an even segment count, and
letters, digits, `_` or `-` in each segment. URLs, traversal and encoded separators
are rejected. Only bounded BIL JSON values are supported: finite numbers within
±10^15, text, booleans, null, lists and records with safe field names. Unsupported
Firestore timestamps, references, bytes and special values fail explicitly.
Writes replace a complete document; partial update/merge and transactions are not
exposed in this version. Missing and permission-denied are different outcomes.

`publicStatus()` returns development/closed/authentication flags and the public
session. ID tokens, refresh tokens and passwords remain in a closure. They are
never returned to BIL. The adapter does not persist credentials or sessions.
**Reopening requires sign-in; previously committed Firestore data remains on the
server.** Signing out or closing cancels active work and invalidates late results.
The Auth Emulator itself stores local test account records: do not use real
passwords or personal information in this development environment.

## Security boundaries

- Only explicit HTTP/HTTPS loopback origins on `127.0.0.1` or `localhost`, with a
  port, are accepted. Production Firebase origins, private network addresses,
  credentials in URLs, arbitrary paths and service-account configuration fail.
- Project IDs must start `demo-clea7-`. This restriction is additional to, not a
  replacement for, correctly starting Firebase in demo mode.
- Network fetch uses redirect rejection, omitted ambient credentials, no-store
  requests and no-referrer. A trusted host may supply a transport implementation;
  packages cannot configure transports or origin URLs through BIL.
- Credentials come only from a trusted host callback. Authentication operations
  accept no BIL arguments. Callback and remote errors are sanitized.
- Response budget: 512 KiB. Document budget: 256 KiB/3,000 nodes, depth 16,
  1,000 list items, 64 fields/Record, 64 KiB/Text. At most eight active operations.
- Network deadlines are 100–15,000 ms (default 8,000 ms). Trusted credential
  collection has a separate 120,000 ms default deadline, configurable by the
  trusted embedding through `credentialTimeoutMs` (100–120,000 ms). The network
  deadline starts after credential entry returns. Both phases remain cancellable;
  cancellation cannot reverse an already-sent server write.
- Errors expose `code`, a generic `message`, and `uncertain`. Network interruption,
  timeout, malformed confirmation or auth rotation after a write was dispatched
  is not reported as success. There is no automatic write retry or queued offline
  write, because duplicate/uncertain effects need an explicit recovery policy.
- Authorization belongs to Firestore rules. The adapter does not manufacture
  admin privileges or use an Admin SDK. The checked-in rules are a deliberately
  small developer fixture, not a universal social-application security policy.

The fixture allows authenticated public-profile reads, owner-only profile writes
with validated `displayName`/`bio`, and owner-only private document reads/writes at
`private/{uid}`. Collection listing and every other path are denied. Two apps
sharing the same backend and user identity share that backend's server policy;
this fixture does not establish server isolation between unrelated applications.
Use separate backend bindings/projects or an explicitly designed application
namespace and tested server rules before sharing a service among applications.

The browser adapter still rejects `10.0.2.2`. Runtime0.9 adds a native debug
operation broker using fixed device loopback and explicit `adb reverse` for9099/8080;
see [ANDROID-BACKEND.md](ANDROID-BACKEND.md). Direct WebView networking remains
blocked. Do not enable general cleartext access or weaken production CSP.

## Reproducible actual Firebase integration test

Use Java 21+, Node 22+ and pinned Firebase CLI 14.18.0. From the repository root:

```sh
npm install --prefix /tmp/clea7-firebase --no-audit --no-fund firebase-tools@14.18.0
/tmp/clea7-firebase/node_modules/.bin/firebase emulators:exec \
  --config tests/firebase/firebase.json \
  --project demo-clea7-runtime --only auth,firestore \
  'node tests/test_firebase_emulator.cjs && node tests/test_remote_firebase_workflow.cjs'
```

The CLI downloads its emulator tools; it does not download an AI model. It runs
isolated Auth/Firestore emulators, loads `tests/firebase/firestore.rules`, executes
tests and shuts down the services. Use test accounts only. No `firebase login`,
service-account key, production deployment, production project or paid service is
required. The test refuses to run without loopback emulator environment variables
and a matching `demo-clea7-*` project. Do not use `firebase deploy` for this test.

The adapter integration test uses two independent adapter sessions, actual account
registration, owner writes, second-user public reads, unauthorized cross-user
write/read/delete attempts rejected by actual Firestore rules, anonymous REST
rule checks, close/sign-in/reopen persistence, deletion/sign-out, and an unreachable
emulator error. Evidence is written to `test-evidence/firebase-emulator.json` only
after all assertions pass. It never records passwords or tokens.

`tests/test_remote_firebase_workflow.cjs` additionally compiles an original blank
BIL source into application/7 and executes its typed requests through two actual
Engine/coordinator contexts. It verifies typed inputs, public/private server data,
local-event responsiveness during credential entry, cancellation, restart/sign-in,
server-rule failures, diagnostic redaction and SHADOW/REPLAY rejection. This is an
engine integration proof; it does not establish Studio authoring UI or two-device
Android acceptance. Its successful-run evidence is
`test-evidence/remote-firebase-workflow.json`.

Separate unit checks use **mock transport** deliberately:

```sh
node tests/test_firebase_adapter.cjs
```

Those verify configuration rejection, serialization, lifecycle races, deadlines,
private-value redaction and failure handling. They are not evidence that Firebase
network communication or server rules work. Do not report the integration test as
passed unless it was actually executed in the stated environment.

## Explicitly unfinished

This slice has no subscriptions or realtime synchronization, image/file storage,
chat, roles, approval workflows, offline write queue, push notifications, persistent
Auth session, production Firebase adapter or production service configuration.
The later native0.9 auth/document foundation passed on two distinct AVDs and in
the independent Runtime; the full two-device social application is still absent. It is not the user's end-to-end social application.
Firebase Emulator Suite does not emulate FCM. Local OS notifications and real
background push need separate acceptance evidence. Production Firebase pricing,
Storage billing requirements, quotas, terms and data processing choices must be
reviewed separately; emulator operation does not establish free production service.

## Dependencies and origin

The adapter and tests are original CLEA7 code using Fetch, JSON and public
Firebase emulator REST protocols. No Firebase SDK/library is copied or bundled in
this adapter. Firebase CLI (`firebase-tools`, MIT) and its separately distributed
emulator components are development/test tools; their notices and current terms
remain applicable. Existing CLEA7 licensing is unchanged.
