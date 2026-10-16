# BLclea7 Studio: connected BIL applications (0.7)

## Architectural finding and decision

The 0.6 BIL compiler produced a typed program with value presentations and event
buttons. The richer application/2–4 visual designer was a separate authoring
model. BIL could compute real values but could not itself describe a multi-screen
form or a record table. Renaming the UI or adding templates would not repair that
contract gap.

0.7 extends the existing compiler and transaction engine. It does not replace the
Studio, existing visual graph, state machines, animation timeline, JSON editor,
package library or native hosts. Sources using only bil/1 features continue to
produce identical old compiler results; regression digests cover the three
shipped bil/1 examples. Existing application/1–5 entry points remain available.

New screen or collection-update programs use bil/2, bil.ir/2, bil.program/2 and
clea7.application/6. Their minimum Runtime is 0.7.0. IR and generated application
structure are recompiled from source and compared before browser/native execution.
An older Runtime must reject these packages rather than display a partial app.

## Implemented authoring workflow

- New project offers BIL orders, inventory, contacts and expenses alongside the
  existing project types.
- BIL's no-code builder lets the author name an application, add/remove up to 16
  fields, choose text/numeric/boolean/choice types, required fields and ranges.
- Generated source contains three connected screens and actual create, selection,
  edit, delete, count and incremental numeric-total handlers. It is ordinary
  editable BIL, with no hidden template executor.
- The screen designer uses the checked AST: label edits, drag-and-drop and sibling moves replace
  source spans. Removal preserves remaining source; functions and comments are not
  regenerated. Explicit component keys preserve identity across label edits/moves.
- Authors can add screens, nested rows/cards and components bound to existing typed values and
  handlers. Unsupported constructs remain in code. Schema changes to a running
  stored project still require an explicit compatible data migration; the builder
  creates a new project and does not silently rewrite existing schemas.
- An interactive design preview runs in separate MemoryVault/SHADOW state. Mobile
  and wider previews do not overwrite persistent application data.
- Compatible view additions/removals rebuild only derived presentations from checked UI intent instructions on restart; stored application values are not reinitialized. No AI or external operation is invoked by this reconciliation. The existing code editor, JSON editor, undo/redo, save, backup, package and native
  export workflows remain available. Running an application/6 preview again does
  not reinitialize its stored data. The explicit preview-state removal control
  requires confirmation; export a backup before using it.

## Runtime contract

`bil.ui/1` contains screen identities, labels, source spans and a closed set of
nodes: heading, text, row, card, input, select, toggle, table, button, view. UI
components cannot carry HTML, scripts, native code, arbitrary URLs or event code.
They bind statically checked globals and compiler-created event entry points.

A UI event runs through the existing Engine queue, app scope, installation guard,
BIL instruction/time budgets, view validation and conditional atomic storage
commit. It is not an unrestricted mutation of a global object. A submit event can
carry all current form inputs in one local transaction. Invalid fields or storage
failure roll back the complete event, including navigation, totals and records.
Input-only events retain the active DOM controls to avoid losing keystrokes or
clicks; value views refresh from committed state. Failed form transactions retain
the entered DOM draft so the user can correct it.

Tables search, sort and page their displayed rows (20 per page). Long table cells show a 512-character summary; the editor retains the full value. A checked screen-wide 2,000-element budget rejects overly dense layouts before data commits. A selection
always refers to the original stored list index, including after filtering and
sorting. Presentation search/sort is separate from application execution and is
not represented as a change to application data.

Collections gain immutable `remove(list, index)` and
`replace(list, index, item)`. Types and index bounds are checked. Existing modules
and their closed import policy remain intact.

## Seven responsibilities

1. Core AI Manager: existing serial task queue and bounded cooperative BIL runner;
   this feature does not add or require an AI model.
2. Link Bridge Elite: checked application/6, IR2, UI input and package/host contracts.
3. Expansion Q: the versioned, closed `bil.ui/1` node set and bundled operations.
4. Adaptive Recovery: state cloning, checked view, conditional atomic commit,
   typed rollback and unchanged live state on persistence failure.
5. Holo Interaction: actual accessible form/table DOM, code-linked design preview,
   input, navigation and data display.
6. Fallback Executor: existing deterministic intent alternatives stay active;
   unsupported UI is rejected rather than simulated.
7. Vision Q: actual UI_EVENT/NAVIGATE/collection instruction traces, source spans,
   reads/writes, transaction outcomes and existing REPLAY/SHADOW diagnostics.

## Security, privacy and scope

No new dependency, font, image, model, external API, telemetry or cloud service is
introduced. New compiler, authoring and renderer code is original project code.
Existing licences and author notices are retained. This is an implementation
provenance statement, not an exhaustive legal opinion or novelty/trademark claim.

Labels and user content become text nodes, not HTML. UI events cannot grant host
permissions. application/6 BIL packages still declare no native permissions; the
existing application/2–4 Android module paths are preserved. Local storage remains
subject to browser/OS quotas and device/account access. It is not an encrypted
secret store. API keys must not be put into fields or packages.

Replay captures include local state and controlled input values in bounded session
memory so the event can be reproduced. Execution metadata avoids value logging in
BIL instruction traces. Backups and detailed replay diagnostics can contain
private app data and should only be shared deliberately. No capture is uploaded.
SHADOW uses a copied memory store and no native adapter.

Budgets: 32 screens, 128 UI nodes, 64 user globals/functions/handlers, 16 form-builder
fields, 1,000 list items maximum **subject also to the stricter 6,000-node BIL
value budget**, 10,000 execution ticks, bounded duration and payload sizes. This
is not a claim of unlimited records, Android Studio/Rive feature parity, general
native hardware support, a SQL server or production readiness.

## Verification

- `node tests/test_bil_apps.cjs`: core operations, exact old compiler regression,
  transactional errors, persistence, isolation, replay, shadow, package/type/IR
  attacks and source-preserving visual edits.
- `python -m unittest discover -s tests -p 'test_bil*py' -v`: SDK, native envelope,
  minimum version, signed packages and actual exported source.
- `node tests/test_bil_apps_ui.cjs`: real Chromium authoring, required fields,
  malicious text rendering, filtered-row identity, export/download, separate
  Runtime installation/restart, offline HTML, mobile viewport and independent SDK
  application. Run through the repository workflow with the existing browser tools.
- Windows frozen WebView2 and Android API30 instrumentation add actual forms,
  saved tables and restart/recreation checks; source export builds include /6.

A test being listed here describes its purpose. Actual pass/fail evidence is
reported separately from the executed workflow. Physical Android hardware, manual
Windows installation and release signing require their own evidence.

Runtime diagnostic panels show bounded event metadata and omit duplicate replay captures and input values from the default display. Complete captures remain in the bounded session Engine API for replay and Studio diagnostic export. This avoids repeatedly laying out application source/IR on small Android WebViews. The visual summary reports the actual number of events/instructions retained and any display truncation.
