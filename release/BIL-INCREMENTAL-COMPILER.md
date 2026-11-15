# Project-scoped incremental BIL compilation

`CLEA7Core.createCompiler({scope:projectId})` creates a bounded8MiB RAM session.
The actual BIL editor uses this shared compiler. `.compile(source,metadata)`,
`.statistics()`, `.clear()` and `.close()` are implemented. CLI/package acceptance
still performs the authoritative full source/IR validation.

The lexer still checks the entire input. Unchanged top-level parse units are reused
only with matching source, token boundaries/lookahead and identifier counters.
Pure function type checks and IR are reused only with the same checked symbol,
record, import, signature and derivation context. Globals, handlers, UI, permissions
and dependency graphs are checked afresh. Source maps are rebased, budgets restored,
failed results never published and caller mutation cannot poison retained results.
No source, conversation or credentials are written by this cache to disk/telemetry.

Measurements must distinguish repeated identical-source hits from edited-source
compilation. The retained copies have a cost; this is not a claim of universal
speedup. `tests/test_bil_incremental.cjs` compares complete AST/IR/application/source
maps and diagnostics against cold compilation, including all executable SDK examples.
The benchmark receipt records actual machine, input size, trial count and timings;
it is not a benchmark on the owner's HP.
