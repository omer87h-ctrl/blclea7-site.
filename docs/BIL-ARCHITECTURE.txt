# BLclea Intent Language — architecture and initial repository audit

By Brzo i Lokalno. Development contract: `bil/1`, `bil.ir/1`,
`bil.program/1`, `clea7.application/5`, `clea7.plan/2`, minimum Runtime 0.6.0.

## Audit before implementation

The source baseline was the current `work/clea7-adaptive-workspace` commit
`e30e619841a6d93e6295bc89c7f50e89778bcac0`, not the older main commit
`efab7ed4`. The recursive Git tree contained 177 tracked files. The inventory in
`bil/repository-audit.json` records paths, source blob hashes, dependency mentions
and execution/storage/export boundaries. This inventory is a structural scan;
it is not a claim that all historical code has received an independent security audit.

The existing system already had `clea7.app/1` (the actual legacy name, not `clea7.application/1`) and its tools, application/2
expressions/flows/tables, /3 state machines/animation/components, and /4 review
and material notices. `format.js` and Python `application.py` are parallel
validators. `plan.js` compiles existing steps; `engine.js` executes against a
cloned state and compare-and-batch storage, with guarded native effects.
`runtime.js` supplies the fixed-operation kernel, scoped storage and cache.
The independent library/launcher supplies installation and publisher policies.
Windows, Android AAR/launcher, HTML export and the single-file preview each
have separate asset inclusion lists. They all must ship the new language files.

Baseline verification actually run locally: 85 Python tests, one Windows DPAPI
case skipped; 93 Node groups. Signing fixtures were generated before running the
business/signature group. Existing Chrome/native results for e30e619 were read
from successful run 38639160160. They do not prove new BIL behavior.

## Risks found and decisions

1. Existing application/2 expressions cannot represent lexical functions,
   nullable refinement or typed intents. Do not smuggle new opcodes into old ABI.
2. Existing state checks compare broad JavaScript kinds. BIL adds recursive type
   checks while keeping the existing atomic persistence path.
3. JSON state must remain data. BIL state is checked by its type/schema contract,
   rather than interpreting record fields named `ref` or `op` as old DSL expressions.
4. Native Python checks envelopes and bounds, while the shared execution host
   recompiles BIL source and compares canonical IR before executing it. The SDK
   invokes that same compiler through Node; the packaged Runtime does not need Node.
5. A Python validator passing is insufficient: a real browser and native GUI
   must execute the new controls, exports, persistence and diagnostics.
6. The legacy visual designer must not silently rewrite BIL-generated screens.
   BIL visual controls edit source slices; unsupported constructs remain intact.

## Compiler and execution path

`BIL source -> lexer -> parser -> source-located AST -> symbols/types -> semantic
checks -> BIL IR -> application/5 plan -> existing Engine transaction -> BIL
executor -> capability resolver -> committed state -> renderer`.

`web/workbench/bil-compiler.js` is the original compiler. It uses a handwritten
lexer, Pratt expression parser, lexical scopes, typed signatures and nullable
refinement. It emits STORE, BRANCH, LOOP, CALL, RETURN, INTENT and related
instructions. It does not translate BIL source to JavaScript.

`bil-runtime.js` interprets the checked IR. Functions are pure with respect to
application globals; event handlers perform mutations. It uses the existing
Engine queue and storage transaction, not a second database. A new application
runs main once; reopening preserves committed data. The Studio's explicit
**Pokreni BIL** action reruns main. A failing block does not commit partial state.

The `--target application2` compiler target is deliberately narrow: literal
state declarations and `show`. More expressive programs use /5. Older hosts
reject /5 and its 0.6 runtime requirement. Existing /1–/4 applications keep their
old paths and minimum versions. Signed /5 packages keep the existing P-256
signature algorithm with the newer compatibility requirement.

## Seven executable responsibilities

| Pillar | BIL integration | Observable output |
|---|---|---|
| Core AI Manager | Engine queue, bounded Runner, consent and deadline | Scheduled block, instruction/time limit; independent engines keep running |
| Link Bridge Elite | Source/IR equality, /5 and host contracts | Verified contract kernel event and ABI rejection |
| Expansion Q | Versioned bundled modules and renderer registry | Registered capabilities and rejected candidates |
| Adaptive Recovery | Engine transaction and local try rollback | Commit/failure event, previous persisted values preserved |
| Holo Interaction | Real output/status/progress DOM and bounded WAAPI | Actual rendered bindings and motion/reduced-motion report |
| Fallback Executor | Validate and execute declared alternative | Selected fallback and rejection reasons, no fabricated model answer |
| Vision Q | Instrumented expressions/statements and decisions | Actual evaluated reads, writes, source locations, timings and cache-not-used |

The original kernel cache remains available for existing fixed operations. BIL
instructions currently do not use a result cache; this is explicitly recorded.
There is no new claim about RAM/battery superiority or a world-first cache.

## Reviewable implementation stages

A: compiler and typed Core. B: transactional execution and version gates.
C: typed deterministic resolver. D: real presenters/motion.
E: consent-gated structured provider contract and fallback.
F: source-mapped causal execution. G: source-preserving hybrid Studio.
H: malformed-input, rollback, isolation, regression and platform checks.
The exact delivered subset and integration limits are in BIL-LIMITATIONS.md.
No public website, production deployment or core license is changed by this branch.
