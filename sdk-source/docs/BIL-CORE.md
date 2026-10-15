# BIL Core

BIL Core and Intent are one language. Check before executing:

```sh
python -m clea7 bil check sdk/examples/bil/core.bil
python -m clea7 bil run sdk/examples/bil/core.bil
```

The included typed Item/function/List example computes 42 using the interpreter.
It does not call JavaScript stored in a project.

## Types, values and mutability

Number is finite IEEE-754 with absolute value at most 10^15; it is not a fixed-point
currency type. Text is a Unicode string with UTF-16 indexing/length. Boolean is
true/false. List<T> is homogeneous and bounded. Records have known, exact fields;
named records are explicitly constructed. T? admits T or null. Void is only for
function results. Error is the typed `{code: Text, message: Text}` catch value.

Types are inferred from expressions or supplied with `: Type`. Null alone and
an empty unannotated List do not infer a useful stored type. Null checks refine a
value inside the appropriate branch. Compound Boolean refinements are not implemented;
use a nested `if`. Incompatible assignment is rejected before a Runtime is created.

```bil
let value: Number? = null
let answer = 0
if value != null {
    answer = value + 1
} else {
    answer = 10
}
show answer
```

Assignments, arguments and expression values have copy semantics. Updating a
mutable copy does not mutate a constant through an alias. There are no user getters,
prototype access, pointers or host object references. Field/index writes must address
an existing field/item. Introduced block locals do not become application state.

## Functions, loops and errors

Functions have explicit parameter/result types, lexical application reads and local
variables. They cannot mutate globals, create views or issue AI requests. Handlers
perform application mutations. Non-Void functions must return on every path.
Recursion is bounded to 32 calls; it is not native arbitrary code execution.

```bil
fn twice(value: Number) -> Number {
    return value * 2
}
let total = 0
repeat 3 as index {
    total = total + twice(index)
}
show total
```

`repeat` requires 0–100 integer iterations; `for` visits a bounded List.
Calls/expressions/iterations share an instruction and wall-time budget. The VM
yields after bounded tick intervals, including expression-heavy work, to the host. Budget/closed-runtime faults are fatal to that
transaction and cannot be swallowed by catch. Other typed faults include Bounds,
ZeroDivision, Type, Range and explicitly raised user codes.

```bil
let number = 1
let reason = ""
try {
    number = 9
    number = number / 0
} catch fault: Error {
    reason = fault.code
}
show number
show reason
```

This rolls the local try state back to 1 before catch. A failure escaping a handler
causes the existing Engine transaction not to commit. There are no BIL external
effects to retry or undo in contract 1. Existing native effect journals are preserved.

## Controlled bundled modules

Only `import math`, `import text` and `import collections` are available. They
resolve to original fixed operations, not paths/URLs or arbitrary host imports.

| Module | Typed operations |
|---|---|
| math | abs(Number), min(Number, Number), max, clamp(Number, low, high) |
| text | upper(Text), lower(Text), length(Text), concat(Text, Text) |
| collections | length(List<T>), append(List<T>, T), at(List<T>, Number) |

Appending returns a new List. Native modules remain available to existing DSL
applications; they are not silently exposed as BIL function calls. The current
BIL standard library does not include tables, networking, files or hardware.
