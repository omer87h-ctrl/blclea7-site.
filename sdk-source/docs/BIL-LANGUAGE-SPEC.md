# BLclea Intent Language (BIL) — language contract 1

By Brzo i Lokalno. This is the implemented development grammar, not a promise of
arbitrary natural-language understanding. Keywords are case-sensitive. Names use
ASCII letters, digits and `_`, begin with a letter and have at most 64 characters.
Prototype-related names are rejected. Text values support Unicode.

## Lexical and block rules

Text uses double quotes and JSON escapes. Decimal numbers have no exponent syntax.
`#` and `//` introduce line comments. Newlines or `;` separate statements. Braces
open on the header line and delimit blocks. Indentation is presentation only.
Intent clauses can continue on following indented or unindented lines because
`using`, `within`, `range` and `fallback` are reserved clause starters. Each clause
may occur once. An ordinary following statement terminates the intent.

```ebnf
program       = separators, { statement, separators } ;
statement     = declaration | assignment | import | record | function
              | handler | button | if | repeat | for | return | try | raise
              | intent | motion | explain | call ;
declaration   = ("let" | "const"), name, [":", type], "=", expression ;
assignment    = lvalue, "=", expression ;
import        = "import", ("math" | "text" | "collections") ;
record        = "record", name, "{", fields, "}" ;
fields        = name, ":", type, { ("," | newline), name, ":", type } ;
function      = "fn", name, "(", [parameters], ")", "->", type, block ;
parameters    = name, ":", type, { ",", name, ":", type } ;
handler       = "on", name, block ;
button        = "button", textLiteral, "runs", name ;
if            = "if", expression, block, ["else", (block | if)] ;
repeat        = "repeat", expression, "as", name, block ;
for           = "for", name, "in", expression, block ;
return        = "return", [expression] ;
try           = "try", block, "catch", name, [":", "Error"], block ;
raise         = "raise", textLiteral, ",", expression ;
intent        = ("show" | "visualize"), name, {clause}
              | "let AI decide how to present", name, {clause} ;
clause        = "using runtime"
              | "within", "[", renderer, {",", renderer}, "]"
              | "range", "[", expression, ",", expression, "]"
              | "fallback", renderer ;
motion        = "move", name, "on change through runtime" ;
explain       = "explain last decision" ;
block         = "{", separators, { statement, separators }, "}" ;
type          = ("Number" | "Text" | "Boolean" | "Void" | "Error"
              | name | "List", "<", type, ">"), ["?"] ;
primary       = numberLiteral | textLiteral | "true" | "false" | "null"
              | name | "(", expression, ")" | listLiteral | recordLiteral
              | "new", name, recordLiteral ;
postfix       = primary, {".", name | "[", expression, "]" | "(", arguments, ")"} ;
lvalue        = name, {".", name | "[", expression, "]"} ;
```

Empty field/argument/item lists are accepted. Empty List literals need an explicit
List annotation. Record literals use `{field: expression}` and named records use
`new Type {field: expression}`. Functions, records, imports, handlers and buttons
are top-level declarations. The handler name `main` is reserved; handlers have at
most 60 characters so generated flow names fit the existing contract.

## Expression precedence

Highest first: call/field/index; unary `+ - ! not`; `* / %`; `+ -`;
`< > <= >=`; `== !=`; `and &&`; `or ||`.
Binary operators associate left. Boolean operators short-circuit. Number operators
do not coerce Text or Boolean. Text + Text concatenates. Equality compares compatible
data values structurally. List indices are checked integers; missing indices raise Bounds.

## One source, two layers

```bil
number = 10
show number
visualize number using runtime
move number on change through runtime
let AI decide how to present number
    using runtime
    within [counter, progress]
    fallback counter
explain last decision
```

`number = 10` introduces an inferred mutable Number at its first assignment.
`let` makes declaration explicit; `const` prevents assignment including nested
record/list mutation. Core calculations are deterministic under the documented
budgets. Intents select registered typed operations. The example needs no model:
progress has no bounds and is ineligible; the declared counter fallback executes.

See BIL-CORE.md for type semantics, BIL-INTENT-RUNTIME.md for decisions and
BIL-LIMITATIONS.md for the exact current scope. The full lexer/parser is the
executable authority for contract 1. Future syntax/IR changes require versioning.


## Version 2: screen and input contracts

The bil/1 grammar and generated IR remain unchanged for existing programs. A
program using screens, navigation or collection remove/replace emits bil/2 and
bil.ir/2, packaged as application/6 (Runtime >= 0.7.0). Contextual `screen`,
`start` and `open` do not reserve old variable names.

```ebnf
screen       = "screen", identifier, string, "{", { ui, end }, "}" ;
start        = "start", identifier ;
navigate     = "open", identifier ;
ui           = (static | group | field | table | button | intent), [key] ;
static       = ("heading" | "text"), string ;
group        = ("row" | "card"), [string], "{", {ui, end}, "}" ;
field        = ("input" | "select" | "toggle"), identifier, "label", string,
               { "required" | "multiline" | "range", "[", number, ",", number, "]"
                 | "options", "[", string, {",", string}, "]" } ;
table        = "table", identifier, "columns", "[", column, {",", column}, "]",
               "select", identifier ;
column       = identifier, [":", string] ;
button       = "button", string, ("runs", identifier | "opens", identifier), ["validate"] ;
key          = "key", identifier ;
```

`key` gives a component an explicit stable identity (48 identifier characters).
Keys must be unique across all screens. A component input binds an existing
mutable primitive global of the matching type; table data is `List<Record>` with
primitive columns and a mutable Number selection. Screens are top-level, while
`open` is an effect and cannot occur inside a pure function. Every target and
handler is resolved before execution. UI blocks do not execute arbitrary BIL
statements; event handlers contain program logic.

`validate` checks required fields and declared bounds before the event commits.
Inputs arriving with a submit event and its handler form one atomic transaction.
Lists use immutable `collections.remove(list, index)` and
`collections.replace(list, index, item)` with static item types and checked bounds.
See [Studio applications](STUDIO-APPLICATIONS-0.7.md) for budgets and security.
