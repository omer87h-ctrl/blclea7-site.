# BIL contract 1 — delivered scope and limits

This is an incremental language implementation in the existing project. It is
not a declaration that all of the owner's long-term IDE/runtime vision is done.

## Implemented paths

- Lexer, formal grammar, parser/AST locations, symbols, inference, static checks,
  semantic checks, source maps and versioned original IR.
- Number/Text/Boolean/List/Record, nullable guards, mutable/constant values,
  arithmetic/logic, if/else, bounded loops, typed functions/results, records,
  closed bundled modules and typed catch/raise.
- Real /5 execution in the existing transaction/queue/vault; literal/show /2 lowering.
- Typed deterministic presentation plans, genuine output/status/progress DOM,
  bounded reduced-motion-aware transitions and source-mapped diagnostics.
- Optional structured proposal API, consent and timeout/fallback; isolated
  SHADOW, reproducible pure events, ABI/package/signature compatibility gates.
- BIL Studio source, highlighting, validation/compile/run, drafts, import/export,
  source/global undo and visual literal/show/visualize editing with source preservation.
- Compiler/executor assets included in browser/HTML, Windows Runtime and Android
  AAR/launcher/source export. Actual platform test results must be read from CI;
  inclusion/syntax checks alone do not establish successful device behavior.

## Deliberate current boundaries

Functions cannot mutate application globals; use a handler. There are no closures,
class inheritance, async language functions, arbitrary native calls, user module
files/URLs or dynamic plugins. `math`, `text`, `collections` are the bundled modules.
Forward/recursive record declarations are unsupported. Nullable narrowing handles
a direct equality/inequality null test, not general data-flow logic. Loop bounds,
number range and normal floating-point behavior remain visible to authors.

Reactive views bind application globals, not transient local values. Captured
progress bounds change when the intent is executed again. Controls currently
expose declared buttons; general BIL-authored input/form/layout/animation-timeline
constructs and typed table/native bindings are not implemented. Existing JSON
projects retain their richer legacy designer/modules. The BIL visual subset is
explicit; unsupported code is preserved rather than regenerated or silently lost.

The Studio's existing JSON view remains available. Structural edits to a BIL
project must go through its source; the generated schema/UI rejects conflicting
JSON/legacy-designer rewrites. Applying BIL does not convert an unrelated existing
project. A separate new project/import is required. Keep downloaded source backups.

A BIL code edit does not implicitly reset a running app's data. Explicit **Pokreni
BIL** reruns main. Ordinary Runtime restart loads persisted state. Compatible
updates are conservative: global types/mutability and the main instruction contract
must remain identical. General state migration, arbitrary presentation rebinding
across source changes and update schema conversion are not implemented.

The optional AI decision contract is usable by a trusted Engine embedding adapter.
There is no built-in automatic connection from that contract to the existing
Windows OpenAI project helper, no model bundled and no verified paid inference.
Injected test-provider responses are marked as test evidence, never a real model.

## Resource limits

Source: 131072 UTF-16 code units in the compiler; file imports/CLI additionally
cap UTF-8 file bytes to 128 KiB. At most 24000 tokens, 8000 AST nodes, expression
nesting 48, blocks 24, expanded type nesting 16 / 2048 nodes and aggregate type
budget. At most 64 stored globals/functions/handlers and 16 parameters per function.
Runtime: 10000 expression/instruction ticks, 2.5 s default wall deadline (maximum
5 s), stack 32, repeat 100, List 1000, 64 fields/Record, Text 64 KiB and further
structural/state byte bounds. Per-dispatch trace 256 entries/64 KiB; 128 views.
These are bounds on the supported interpreter, not total process RAM limits.

## Verification and remaining release work

Run the commands in README and the dedicated BIL tests. Chrome coverage includes
source/visual editing, diagnostics, real rendered values, motion, reduced motion,
source/package/HTML downloads and a separate Runtime window with persistence.
The native checks are extended to Windows real WebView2 and Android API30 emulator,
including actual BIL controls and restart/recreation. The BIL presenter avoids
Element.replaceChildren so the Android API30 system WebView can execute it. Do not claim those passed
unless their corresponding Actions jobs succeeded for the stated code commit.

Physical Android devices, broad OS/browser versions, battery consumption, signed
release distribution, independent security audit, trademark/patent clearance and
claims of superiority are not established. No world-first claim is made.
