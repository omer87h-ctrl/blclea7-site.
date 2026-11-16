# Studio source history and saved application data

Explicit Studio Undo/Redo now applies one coherent change to source and its
local saved BIL schema. It preserves values of retained fields, including edits
made after a source change. Fields removed by Undo are archived atomically
alongside the active snapshot, rather than deleted or left as incompatible
orphan fields. Redo restores archived values only for the exact matching pair
of source SHA-256 hashes and compatible declared types. The ordinary Runtime
still rejects incompatible packages; this is not a general implicit migration.

The archive is private local Studio storage, scoped to the same application ID.
It is not added to exported `.clea7` files, telemetry, model prompts or public
evidence. Remote/account-scoped applications require an explicit migration;
this helper does not copy their data into an unscoped archive.

One project permits at most32 archive entries and8MiB of serialized UTF-8 data.
The helper refuses further removal when full and never silently prunes entries.
Under Android and export, users can download the archive, then explicitly remove
that downloaded archive. A digest and storage compare-and-swap prevent removal
of changed entries; active application state remains untouched. A user must
protect the downloaded JSON as they would any private application-data backup.

Runtime opening is coordinated by project and generation. Concurrent identical
opens share one promise; obsolete opens cannot replace the current UI. Closing
an already-closed Engine is idempotent and cannot unmount a newer Engine.

Verification: `node tests/test_schema_history.cjs` exercises the actual compiler,
Core, Vault, preservation of later edits, changed retired values, conflict and
type rejection, bounded archives, export and guarded clearing.
`python tests/browser_studio_operator.py --output test-evidence/operator-history`
executes reviewed source changes, real controls, Undo/Redo, restart, export and
independent Runtime. This finite command-tool flow is not neural inference.
