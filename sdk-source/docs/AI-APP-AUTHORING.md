# Actual local model application authoring

The existing9B is an optional language component. It returns BIL data; it cannot
register trusted tools, grant device permissions, run shell commands or change
Studio files. Qwen authorship/licensing remains separate from the CLEA product.

`bil.author/1` has `create` and `change` modes. A create request sends the explicit
intent and no existing project/history. A change requires `sourceApproved:true`
and an exact bounded BIL source; running app state, CV values, files and unrelated
conversation are excluded. Source is never silently truncated. Authoring and
normal chat share one generation gate and the verified installed model.

The HP service supplies the actual BIL grammar and approved SSD references,
counts the complete template with the installed tokenizer, disables hidden
thinking consistently and reserves at most1536 output tokens within the existing
4096-token context. Normal chat stays512. An oversized request is rejected.
This is a bounded model context; SSD capacity does not expand RAM or reasoning.

`workbench/ai-authoring.js` coordinates inference, real compiler feedback and up
to three attempts. The original seven-pillar verifier checks types, source hash,
isolated initialization and any explicit handler expectations. A successful
initialization is never advertised as proof of every application behavior.

The Studio presents actual screens, source and check scope. Reviewed apply uses
the existing history transaction, recompiles and rejects a changed project or
unsaved draft. Undo restores the previous project. Standalone chat transfers only
explicitly selected source within the same browser session; Studio verifies it
again. This handoff does not claim a new model inference occurred.

The native Studio uses the existing owner-scoped bridge and SDK local client.
An installed application token cannot use it. Remote HTTP keeps its admission,
origin, rate and single-generation controls; source is not persisted for training.
The manual HP launcher reuses only the exact verified installed9B/model path
with one slot and has no right to terminate a borrowed owner process.

```console
python -m clea7 ai status
python -m clea7 ai propose "Napravi BIL aplikaciju s unosom imena i pregledom." --output nova.bil
python -m clea7 bil check nova.bil
python -m clea7 bil run nova.bil
```

Generation requires an explicitly running updated owner9B service. Compilation
and deterministic Core work offline without a model. There is no paid API or new
model download in these commands. Occupied output paths are rejected before any
inference. Review and exercise the application before distributing its package.

TECH mode prepares an explicitly labelled AI draft, separates prior conversation,
retains actual sources and offers review/copy/download. It never creates users or
posts to TECH. The original TECH repository is unchanged under the master scope.

Limits remain: model errors,4k context, bounded source/output, registered BIL/host
capabilities, device-dependent local voices and no70B quality equivalence. Human
assistive evaluation, release signing and permanent public hosting need their own
actual evidence. Fixture transport tests and actual HP tests are recorded apart.
