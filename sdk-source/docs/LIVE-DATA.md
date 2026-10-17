# Typed live data (BIL5 / application9)

Original implementation by Brzo i Lokalno. This extends the existing compiler,
VM, Engine, Studio and native broker; it does not replace them. Existing
BIL1–4 / application2–8 source contracts remain supported. No dependency or
licence change. Minimum host: 0.11.0; older hosts must reject application9.

## Contracts

`backend community using "firebase.development/2"` opts in. This adapter is
restricted to official local Auth/Firestore emulators and `demo-clea7-*`
projects. It cannot be configured for the production Brzo database. Credentials
are obtained by the trusted host, never BIL. Windows remote execution remains
gated; authoring, validation, packaging and local Windows apps remain available.

In addition to the seven adapter1 operations:

- `document.add(collection: Text, value: Record)` returns `RemoteDocument`
  (or nullable target), with actual server-assigned `id` and `path`. It is a
  mutation, not automatically retried if outcome is uncertain.
- `query.list(collection: Text, query: RemoteQuery)` returns `List<YourRecord>`.
  Firestore applies filters, ordering, offset and limit. Results are structurally
  checked against the developer's record type; metadata is not silently added.
- `observe.document.get` and `observe.query.list` are explicit approval grants,
  not invocable operations. They authorize repeated read-only operations.

`RemoteFilter` has `field: Text, op: Text, kind: Text, text: Text?, number:
Number?, flag: Boolean?`. Exactly the field corresponding to kind `text`,
`number` or `flag` contains the correctly typed value; the other fields are null.
Kind `null` sets all three to null. Operators: `== != < <= > >= array-contains`.
At most five filters, safe simple field names, no arbitrary expressions/URLs.

`RemoteQuery` has `where: List<RemoteFilter>, orderBy: Text, descending:
Boolean, limit: Number, offset: Number`. Limit 1–50, offset 0–1000, `orderBy`
a safe field, `__name__` or empty for document identity. An implicit document
identity tie-breaker makes ordering stable. This is bounded offset pagination;
it does not yet provide server cursors or automatic unbounded scroll. Production
Firestore index requirements are not validated by development emulators.

```bil
backend community using "firebase.development/2"
record Post { body: Text }
let posts: List<Post> = []
let failure: RemoteFailure? = null
let filters: List<RemoteFilter> = []
let query = new RemoteQuery { where: filters, orderBy: "", descending: false, limit: 20, offset: 0 }
let status = "idle"
on follow {
 subscribe feed from community.query.list("entries", query) into posts catch failure every 2000 then changed else failed stopped stopped
}
on changed(result: List<Post>, context: RemoteUpdate) { status = context.kind }
on failed(problem: RemoteFailure, context: RemoteUpdate) { status = problem.code }
on stopped(result: Boolean, context: RemoteUpdate) { status = "stopped" }
on stop { cancel feed }
```

The full original executable development example is
`sdk/examples/bil/community.bil`; fixture rules in `tests/firebase/firestore.rules`
expect its declared Post/Message shapes. The small grammar example above needs
its own compatible developer rules. One statement per line or semicolon; the
subscribe statement itself stays on one line.

## Lifecycle and isolation

A subscribe instruction stages a read after its surrounding local transaction
commits. Up to four unique subscriptions and eight remote operations, separate
result/error slots and one pending read per subscription. Interval is a literal
1000–60000ms. Results/errors invoke source-owned, immutable typed callbacks:
`RemoteUpdate {subscriptionId, sourceId, backend, operation, sequence, kind}`.
Kinds: update/error/recovered/cancelled. Sequence counts delivered changes.

This first transport is **bounded polling**, not server push, Android FCM or a
persistent socket. Equal snapshots do not create duplicate application events.
Transient failures back off to 30 seconds; a recovery snapshot is delivered even
when equal to the last successful value. Hidden browser documents pause polling.
No background service or battery savings claim is made. Callback/persistence
failure stops the observation rather than falsely marking delivery successful.

Cancellation aborts the outstanding read where supported, invalidates late
responses and queues its typed `Boolean, RemoteUpdate` stopped event. Closing or
changing authenticated principal stops observations without invoking the old
user's callbacks. Principal-scoped Vault isolation remains in effect. A stopped
observation does not automatically erase its result; the app defines cache
retention/revocation policy. The community example clears private messages on
Denied. Backups/restores/resets require observations to be stopped. App updates
with changed remote contracts require close/reapproval; no implicit migration.

Active observations reserve result/error slots. Cancel and await delivery before
restarting an observation whose transport is still in flight. Source order is
preserved for controls within an event. Inputs/queries are captured at start;
changing inputs requires explicit cancellation and restart.

Server rules remain authoritative for membership, ownership and roles. The
fixture demonstrates private groups and immutable messages with member/reader
roles, not a marketplace or hardcoded application inside the engine. It is a
development fixture, not production-wide moderation/retention/abuse policy.

## Trace and seven responsibilities

Core AI Manager coordinates bounded asynchronous work; Link Bridge validates
adapter2 contracts on JS/native boundaries; Expansion Q registers operations
and explicit observe grants; Adaptive Recovery commits local changes before
reads and protects principal epochs; Holo Interaction refreshes real typed UI;
Fallback Executor provides failure/stopped/reconnect paths without retrying
writes; Vision Q records actual subscription state, sequence, source locations,
transport and errors. No model, fabricated output or arbitrary script runs here.
Traces omit document paths, payloads, passwords and tokens. Equality witnesses
are private in-memory values cleared on stop, not a promise of secure RAM erase.

## Verification

Local checks: `node tests/test_live_data.cjs`, existing Node regressions,
`python -m unittest discover -s tests`. The new tests use an explicitly injected
adapter and must not be presented as network/device evidence.

Real-service and browser gates (CI, no production access):

```sh
firebase emulators:exec --config tests/firebase/firebase.json --project demo-clea7-runtime --only auth,firestore 'node scripts/test_remote_emulators.cjs'
```

Includes `tests/test_live_firebase_workflow.cjs` (actual HTTP, three concurrent
Engine contexts) and `tests/test_live_studio_ui.cjs` (blank Studio, capability
controls, export, independent libraries, real chat, actual browser offline/
reconnect and restart). Their results are pending until corresponding Actions
jobs complete. Existing Android/Windows regressions are separate gates; these
browser tests do not prove Android multi-user acceptance. Full benchmark remains
open for media/push, production transport/credentials, broad native capabilities,
rich second app and simultaneous Android end-to-end proof.

Contextual empty-list assignment (for example `messages = []`) is an opt-in
BIL5 operation here. It must not silently enter an older source/IR contract whose
old compiler would reject it. For older language contracts, declare a typed empty
list and copy that value. SDK `--target auto` selects the checked ABI from source;
only application2 is a lowering request, and old format labels remain compatible
auto aliases. SDK help reports the installed package version.

The fixture's `ordinal` is an explicitly authored logical field, not a server
timestamp or global causal sequence. Stable ID tie-breaking does not establish
chronological message order. Production chat still requires trusted timestamps,
cursors, deletion/retention/conflict policy, moderation and remote push. Local
application storage isolation does not create a remote Firebase tenant boundary;
production multi-app tenancy must be enforced by trusted backend rules/claims.
