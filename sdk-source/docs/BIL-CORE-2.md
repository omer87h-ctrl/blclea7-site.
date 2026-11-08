# BIL Core/2 additive language and Runtime contract

Original implementation by Brzo i Lokalno, extending the existing BIL compiler
and bounded interpreter. This is an additive development contract, not a claim
that guards, Unicode normalization or collections were first invented here.
No parser generator, external compiler, arbitrary JavaScript evaluation, AI model
or new runtime dependency is introduced by these changes.

## Compatibility and feature negotiation

Existing BIL source retains its complete compilation result, source-map IDs,
application envelope and IR byte for byte. The three published `bil/1` fixture
digests remain test assertions. Existing `text.length` still returns UTF-16 code
units; it is deliberately **not** silently changed to a different unit.

Core/2 uses the existing BRANCH, RAISE and CALL instructions. Programs using new
syntax or operations require a host/compiler implementing Core/2. Their packages
must require Runtime **0.17.0** even when the application is still application/5.
An older source-validating host rejects an unsupported program; the unchanged
envelope does not imply that older hosts implement the new operations.

The compiler exports immutable `CLEA7BIL.CORE_FEATURES` with the supported
statement/operation catalogue. For a source or a compilation result:

```js
const features = CLEA7BIL.featuresFor(sourceOrCompilation);
// {format:'bil.core.features/1', version:1|2,
//  minimumRuntime:'0.6.0'|'0.17.0', used:[sorted feature identifiers]}
```

`featuresFor` recompiles the source rather than trusting a supplied AST or
supplied feature list. A compilation result has a `features` property only when
it uses Core/2, preserving the legacy complete-result serialization. This metadata
is outside the application envelope. Package implementations must derive the
floor from verified source/IR, not accept a user-declared lower floor.
The reported minimum is the **Core feature floor**, not the complete package
minimum. Hosts must take the maximum of this floor and the existing application,
adapter and publisher-signature requirements (for example, application/9 still
requires its own newer host even if no Core/2 call occurs).

Guard branch source-map entries additionally carry `coreFeature:'guard'` for
structural host inspection. The ordinary full source/IR comparison recomputes
that marker and rejects a modified source map. Structural inspection alone is
not equivalent to full source compilation.

## Guard statement

```ebnf
guard_statement = "guard", boolean_expression, "else", "raise",
                  safe_error_code_text, ",", text_expression ;
```

The statement ends with the same newline/semicolon rules as existing statements.
The entire guard occupies one logical source line; an expression does not acquire
implicit multiline continuation. `guard` is contextual: existing variables and
functions named `guard` remain legal.

```bil
import text

fn clean(value: Text?) -> Text {
    guard value != null else raise "Required", "A value is required"
    return text.normalize(text.trim(value))
}

let result = clean("  č  ")
show result
```

The condition must be Boolean and is evaluated once. On success execution
continues; the error message is not evaluated. On failure the Text message is
evaluated and an ordinary typed BIL error is raised with the declared code and
source location. The code obeys the existing safe-identifier rule. Normal `try`
recovery and transactional rollback apply; fatal resource errors remain fatal.

Lowering emits an existing BRANCH whose failure body contains an existing RAISE.
Both have stable, distinct source-map identities. This does not introduce a host
effect or expand the application's permissions.

### Sound and conservative nullable refinement

Direct comparisons `name != null`, `null != name`, `name == null` and `null == name`
refine that name along the successful continuation. The failure-message expression
is checked in the failure context. The original stored schema is unchanged.

The compiler does not infer arbitrary Boolean implications, fields or indexed
access as refined bindings. Writes conservatively invalidate guard refinements,
including writes inside conditional branches and loops. A local declaration can
shadow an outer name without inheriting its refinement. A guard's assumption does
not leak into another handler, function, or enclosing scope.

```bil
let value: Number? = 3
guard value != null else raise "Required", "Missing value"
let first = value + 1
value = null
# A later `value + 1` is a static type error; guard again after a write.
```

## Text operations

All operations require `import text`. They accept BIL data, not regular
expressions, executable replacements or file/network paths.

| Operation | Type | Defined behavior |
|---|---|---|
| `normalize(value)` | Text → Text | Unicode canonical NFC normalization; no case or accent removal |
| `includes(value, part)` | Text × Text → Boolean | Exact, case-sensitive substring test |
| `trim(value)` | Text → Text | Remove ECMAScript-defined leading/trailing whitespace |
| `codePointLength(value)` | Text → Number | ECMAScript Unicode code-point iteration count |
| `sliceCodePoints(value, start, end)` | Text × Number × Number → Text | End-exclusive code-point slice with strict bounds |
| `split(value, separator)` | Text × Text → List<Text> | Literal separator; empty separator iterates code points |
| `join(values, separator)` | List<Text> × Text → Text | Ordered join, checking the output budget before allocation |

`text.codePointLength("A😀č")` is 3 while legacy `text.length("A😀č")` is 4.
Code points are not grapheme clusters: a multi-code-point family emoji or combining
sequence may still occupy more than one code point. No linguistic or visual
character-count claim is made. NFC behavior relies on the platform's standard
Unicode implementation; this contract does not bundle its own Unicode database.

Slices require finite integers satisfying `0 <= start <= end <= length`. Negative,
fractional, reversed and out-of-bounds indices raise `Bounds` at the call location.
There is no implicit clipping or wraparound. Splits exceeding 1,000 items fail with
fatal `Budget`; they never silently truncate. An empty input split by an empty
separator produces an empty List<Text>.

The existing text budget is 65,536 UTF-16 code units, not a measurement of UTF-8
bytes or total Runtime memory. Larger joins fail before constructing their result.
Other existing value/node/aggregate budgets also remain in force.

## Collection operations

All operations require `import collections` and preserve value semantics.

| Operation | Type | Defined behavior |
|---|---|---|
| `contains(values, item)` | List<T> × T → Boolean | Structural data equality |
| `slice(values, start, end)` | List<T> × Number × Number → List<T> | End-exclusive strict-bounds copied slice |
| `concat(first, second)` | List<T> × List<T> → List<T> | Ordered copied concatenation, maximum 1,000 items |
| `unique(values)` | List<T> → List<T> | Keep the first structurally equal occurrence in input order |

Structural equality compares array order and canonical, sorted Record field
names; Record literal field order does not change equality. Operations accept no
callbacks or arbitrary key functions. They do not mutate either input.

A new operation can infer an empty literal's item type from a known peer in
`contains([], 7)` and `concat([], numbers)`. `unique([])` and `concat([], [])`
cannot establish an item type and are rejected; use an explicitly typed List.
`text.join([], ",")` has its fixed List<Text> context and is valid.

## Diagnostics, privacy and testing

Wrong arity/type is rejected before execution. Runtime bounds and budget failures
carry the actual source location. Guard conditions, branches, writes and failures
use existing Vision Q traces; private argument/result values are not added to
instruction traces by these features. An explicit application message can contain
private text, so applications still need their own handling/retention policy.

`tests/test_bil_core2.cjs` runs the real compiler, source revalidation, interpreter
and Engine. It covers legacy digests, feature-floor metadata, contextual syntax,
nullable refinement/invalidation, rollback, independent Engine state, Unicode,
collection type/value semantics, resource limits, visual source preservation and
IR/source-map integrity. These tests do not prove hardware behavior, external AI
inference, professional CV accuracy, global novelty or superior performance.
