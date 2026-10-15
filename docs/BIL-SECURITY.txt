# BIL threat model and security boundaries

Assets: local source/projects, app data, signing identity, optional API credentials,
host capabilities and the integrity of the installed application library.
Untrusted inputs: .bil text, JSON/IR/package bytes, restored data, AI responses.
Trusted computing base: the shipped compiler, interpreter, renderer, existing
Engine/storage/library and native platform adapter. This is not an independent
security certification or a promise of impenetrability.

| Threat | Enforced boundary | Automated evidence |
|---|---|---|
| Source attempts shell/JS/files/network | Own grammar, named BIL calls, closed bundled modules; no eval/Function/source import | Malformed source and forbidden call/import tests |
| IR substituted after compilation | Recompile source, compare canonical checked IR before execution | Tampered opcode rejection; ABI gate tests |
| Unbounded work | Token/AST/type-expansion budgets, instruction/time limits, depth/list/text limits | Deep types/blocks/records, recursion and loop tests |
| Partial writes on failure | Run against clone, verify, atomic scoped compare-and-batch | Handler rollback and persisted-state tests |
| Cross-app storage | Existing ScopedVault and installation guard; no storage API in BIL | Library scope, uninstall/stale-writer and BIL persistence tests |
| Prototype/object access | Safe identifiers, own-field/index checks, value-only data | Unsafe identifier/import tests |
| AI code injection | Exact two-field proposal schema; registered eligible renderer only | Extra-field, unknown-op, wrong-plan rejection |
| Unapproved private-data transmission | No default provider; explicit trusted-host consent, metadata-only contract | No-consent, SHADOW, provider-request content tests |
| AI latency/retries | One bounded attempt, declared fallback; separate engine queues | Timeout and concurrent deterministic execution test |
| Forged stored presentation | Binding/type/range/source-id validation | Invalid restored progress/view rejection |
| Loss of source during visual editing | AST source spans, explicit editable subset, local drafts/conflict checks | Stable-id/source preservation and real editor checks |
| Corrupt/disguised distribution | Existing hashes/signatures/manifest/ABI checks | SDK package and native/export checks |

Native Python validates the /5 envelope, allowed shapes and budgets. It does not
contain a second BIL parser/type checker. All actual BIL execution hosts load the
shared JS compiler and require source/IR equality. A native envelope validation
result alone must not be advertised as successful BIL execution/type checking.
The SDK's BIL check/compile commands run the authoritative compiler.

The VM interprets a finite data instruction set. It does not execute hostile host
JavaScript and does not rely on a Worker as an arbitrary-code sandbox. Per-app OS
process isolation and hard OS memory caps are not implemented. Step/data limits
are interpreter-level safeguards, not platform resource guarantees. A future
untrusted-code/extension mode must add an appropriate OS isolation boundary.

No new telemetry, accounts, paid dependency, model weights, network endpoint,
automatic native effects or automatic uncertain-effect retry is introduced.
Existing signing uses the owner's controlled key; BIL cannot access it. Keys are
never put in BIL source, IR, exports, traces or model contracts by this implementation.
The existing Windows API-key UI remains session-scoped and separate.

Release builds require the owner's signing/distribution process. Development
Windows/APK artifacts are not promoted publicly by this branch. No passwords or
keys should be committed to examples. Package signatures authenticate a key, not
an author's legal identity or an application's safety.
