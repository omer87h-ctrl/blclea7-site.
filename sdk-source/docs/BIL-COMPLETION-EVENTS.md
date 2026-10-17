# Typed remote completion events

Original BLclea Intent Language, by Brzo i Lokalno. Opt-in development contract:
`bil/4`, `bil.ir/4`, `bil.program/4`, `clea7.application/8`, minimum Runtime
**0.10.0**. Existing BIL1–3 and application2–7 remain accepted with their original
contracts. The seven existing backend operations and explicit host grants remain
`bil.remote/1`; this feature adds no network endpoint or native privilege.

## Grammar and static types

```text
request-statement = "request" backend "." group "." operation
                    "(" [expression {"," expression}] ")"
                    "into" result-global "catch" failure-global
                    ["then" success-handler "else" failure-handler] ;
completion-handler = "on" identifier "(" identifier ":" result-type ","
                     identifier ":" "RemoteCompletion" ")" block ;
```

`RemoteCompletion` is `{ requestId: Text, sourceId: Text, backend: Text,
operation: Text }`. Success receives exactly the checked destination type,
including nullability; failure receives non-null `RemoteFailure`. Both parameters
are immutable, local to that handler, and cannot shadow application symbols.
Both handlers must exist; orphan parameterized handlers and incompatible types
are compile errors. Ordinary `on name {}` events remain unchanged. Typed handlers
cannot be buttons or public Runtime dispatch entry points. All source locations,
stable instruction identities, signatures and links belong to the checked IR.
Canonical source recompilation rejects substituted handlers or signatures.

```bil
backend community using "firebase.development/1"
let session: RemoteSession? = null
let failure: RemoteFailure? = null
let status = "Not signed in"

on login {
    request community.auth.signIn() into session catch failure then signed_in else failed
}
on signed_in(identity: RemoteSession?, context: RemoteCompletion) {
    if identity != null { status = "Signed in" }
}
on failed(problem: RemoteFailure, context: RemoteCompletion) {
    status = problem.code
}
screen home "My application" {
    show status key status
    button "Sign in" runs login key signin
}
```

Run this only with the explicitly approved isolated Firebase development backend.
The host owns credential entry and trusted principal selection. Public session
records and handler arguments cannot authenticate or select a storage namespace.

## Atomic delivery, chaining and lifecycle

Requests still stage only in a successfully committed local event. The coordinator
does not block unrelated local actions while credentials or network are pending.
It validates the actual response, redacts failures and releases that finished
request's result slots before entering the completion queue. A callback can then
stage a subsequent request using the same result/failure slots. Request identities
remain unique; simultaneous overlapping pending requests are still rejected.

Result/error assignment, callback execution, its state changes and any newly
staged request journals commit in **one** local transaction. A callback exception,
resource limit, validation failure or failed persistence leaves the previous
local state intact and dispatches no newly staged network work. The original
server outcome remains honestly `confirmed`/`failed`/`uncertain`, with local
delivery marked `not-committed` where applicable. No automatic callback or remote
mutation retry occurs. A server mutation is not rolled back by a local failure.

A root request has causal depth0. Requests staged by its handlers add one depth;
depths0–16 are allowed, then a resource fault prevents an infinite asynchronous
cycle. Existing eight-active-request and 32-event queue budgets still apply.
SHADOW and REPLAY cannot invoke external requests or typed external completions.
Close, uninstall guards, identity epoch changes and revoked Vault views reject
late delivery. Authentication transitions occur before their trusted callback and
continue to clear the old principal's UI, state, cache and diagnostic copies.

Vision Q records actual request identity, originating source ID/location, selected
handler, depth and checked instruction reads/writes. Argument and response bodies,
passwords and tokens are omitted from automatic traces.

## Studio, SDK and verification

The backend authoring panel adds optional success/failure selectors. Choose two
existing events containing application logic. Studio inserts typed parameters and
the request continuation clause using lexer/source positions. Comments, handler
bodies and unrelated source remain intact. An existing UI binding that would
invoke a typed handler is rejected; source is not silently deleted. Code edits,
undo/redo, draft saving and export use the existing shared BIL pipeline.

The complete source example is `sdk/examples/bil/async-profile.bil`. It chains
authentication into a profile read and includes profile save, failure, logout and
restart handling. Its public profile fields match the isolated emulator fixture
in `tests/firebase/firestore.rules`. Compile without making a network request:

```sh
node sdk/bil-cli.cjs check sdk/examples/bil/async-profile.bil
node sdk/bil-cli.cjs compile sdk/examples/bil/async-profile.bil --output profile.application.json
python -m clea7 package profile.application.json profile.clea7 --targets browser,android
```

Use a fresh output filename. Import the `.bil` source into Studio or install the
package in a supported Runtime, start the isolated services documented in
`FIREBASE-DEVELOPMENT.md`, and approve the exact backend grants. Android uses the
documented debug build and `adb reverse` setup. No emulator, credential or server
is silently installed by these commands. The SDK example's automated VM lifecycle
test injects an adapter and is labelled a unit test, separately from actual
Firebase/browser/native evidence.

`node tests/test_bil_completion.cjs` exercises the compiler, VM and transactional
Engine against an explicitly injected adapter; this is **not** network evidence.
`python -m unittest discover -s tests -p test_completion_contract.py -v` verifies
SDK/native envelopes, exports, signatures, grants and minimum Runtime rejection.
The real-browser suite authors completion logic in Studio, calls the isolated
Firebase services, checks actual success/disconnection handlers, exports app8 and
installs it in the independent browser Runtime. Android workflow builds that
exact Studio export and executes callbacks with the native broker on two API30
AVDs and the independent Runtime. CI outcomes must be recorded against the exact
source before calling those platform checks passed.

This contract does not add subscriptions, live query feeds, private chat, media,
push, production endpoints or durable credentials. Windows remote execution
remains gated. Full multi-user platform acceptance remains open.

## Accepted development evidence

Executable source `5f59940e26102328b3ddbdd39b6773b6e06996fc`: full run39030492936
(verify117389843491,Windows117390225730,Android117390225778), actual Firebase/
browser39030492874/job117389811760 and native39030492866/job117389849167 allpassed.
The actual Studio-exported app8 ran on two distinct sequential API30 AVDs and the
independent Android Runtime; physical phones and production services are untested.
Private artifact quota prevented new archive storage. These passing tests do not
mean0.10 binaries are publicly downloadable or the whole platform is complete.
