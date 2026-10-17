# Identified remote query results

Original implementation by Brzo i Lokalno. This extends the existing BIL5,
application/9 and typed asynchronous execution model. It does not replace the
language, Studio or Runtime, or add a copied application to the engine.

## Versioned capability

`backend community using "firebase.development/3"` registers the existing adapter2
operations plus `query.documents` and its separate `observe.query.documents`
approval. Application packages using adapter3 require Runtime **0.12.0** on
browser and Android, including signed packages. Older hosts must reject them.
No new bytecode instruction or application ABI is needed: this is a versioned
external-operation contract, not a silent change to adapter2's semantics.

`query.list` still returns exactly the developer's records. Existing adapter1/2
applications retain their existing minimum versions and behavior. Adapter1/2
cannot request or approve the new identified operation.

## Typed data and authoring

```bil
backend community using "firebase.development/3"
record Post { body: Text }
record PostDocument { id: Text, path: Text, value: Post }
let documents: List<PostDocument> = []
let failure: RemoteFailure? = null
let filters: List<RemoteFilter> = []
let query = new RemoteQuery { where: filters, orderBy: "", descending: false, limit: 20, offset: 0 }
on search {
    request community.query.documents("entries", query) into documents catch failure
}
```

The result must be a non-null `List` of named records with exactly three fields:
`id: Text`, `path: Text`, and `value: YourRecord`. The record name is chosen by
the developer; its payload record can have its own `id`, `path` or `value` fields
without colliding with server metadata. No credentials or URLs are supplied by
BIL. Query filters, ordering and bounds are the existing typed `RemoteQuery`.

The Studio's remote operation selector authors this operation and typed
completion handlers through the same compiler. Select adapter3, an existing
envelope record and a result such as `List<PostDocument>`. Supported edits
preserve existing handlers, source text, comments and undo/draft behavior.
Incompatible existing backend declarations are rejected, never silently upgraded.

`sdk/examples/bil/document-identities.bil` is an independently packageable original
application with selection, owner-authorized editing, removal and observations.
The payload fields in that example match the isolated test rules. The shorter
example above needs compatible developer-authored backend rules.

## Trust and lifecycle

The trusted adapter reads identities from actual server document names, requires
the exact configured project/database and requested direct-parent collection,
validates safe IDs and rejects duplicate identities. The Runtime independently
checks returned types, paths, duplicate identities and the authored result limit
before persisting or delivering data. A malformed result is an error; partial
results are not committed. Resource limits also include metadata envelopes.

The returned `path` identifies a document; it grants no access. Every subsequent
read, write or deletion still requires an explicitly approved operation, current
authentication and server authorization. The example never treats UI selection
or a public record ID as permission to change someone else's data.

Subscriptions use the existing typed bounded polling lifecycle, principal/epoch
isolation, source-mapped callbacks, explicit cancellation and read recovery. They
are not server push. Mutations with uncertain outcomes are never retried
automatically. Traces omit document paths, payloads, passwords and tokens.

Android uses the native approved broker and debug-only fixed loopback emulator
configuration. This does not introduce production Firebase access, Windows
remote execution, image storage, background push, new dependencies or telemetry.

## Verification and remaining work

Local executable checks:

```sh
node tests/test_document_identities.cjs
python -m unittest tests.test_document_identity_contract -v
python -m clea7 bil package sdk/examples/bil/document-identities.bil --id original_posts --targets browser,android --output Posts.clea7
```

The Node units explicitly inject adapters/HTTP and do not prove network behavior.
The Python checks verify cross-language envelopes, signing, downgrade rejection
and compatibility, not native GUI execution.

`tests/test_document_identities_firebase.cjs` requires actual official isolated
Auth/Firestore services; it exercises two users, query IDs, owner edit/removal,
unauthorized mutations, observation and restart/relogin. The existing real Studio
browser workflow additionally authors an identity operation, exports its package
and displays its results in an independent Runtime. The simultaneous Android
driver runs that exact Studio-exported operation through native adapter3 on both
emulators. Final source48d4441a37ee21404671cc9ba214b72416634b1e passed these checks: service/browser run39049504869, native run39049506553 and full product run39049506563. See the continuation file and acceptance artifact manifest for exact jobs, hashes and platform limits.

This resolves document identity, not trusted server timestamps/cursors, long-lived
journal compaction, production sessions/tenant rules, native media handles,
private object storage, remote push, rich multi-file composition or the complete
social and non-business application acceptance benchmarks. The overall platform
remains incomplete until those existing requirements are implemented and verified.
