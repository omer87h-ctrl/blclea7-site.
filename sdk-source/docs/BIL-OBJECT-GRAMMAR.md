# BIL sentence grammar 1 — Core5 / Runtime0.44

Implemented in the existing authoritative compiler and checked VM. This is an
opt-in grammar profile, not a replacement framework, a second evaluator or a
claim that the constituent concepts are globally unprecedented. Old BIL source
and its published compiler digests retain their old results.

```bil
BIL "Moj rad".

zadatak pamti naslov kao tekst "Pripremi ponudu".
zadatak pamti zavrsen kao logiku ne.
zadatak izvodi status iz zavrsen:
    ne daje "U toku";
    da daje "Završeno".
zadatak prikazuje naslov kao "Naziv zadatka".
zadatak nudi "Završi" kao zavrsavanje.
zavrsavanje nad zadatak postavlja zavrsen na da.
```

## Implemented grammar

```ebnf
program = "BIL", STRING, ".", { sentence } ;
sentence = remember | derive | offer | change | label ;
remember = OBJECT, "pamti", FIELD, "kao", TYPE, LITERAL, "." ;
derive = OBJECT, "izvodi", FIELD, "iz", EXPRESSION,
         [ ":", BOOLEAN, "daje", EXPRESSION, ";",
                BOOLEAN, "daje", EXPRESSION ], "." ;
offer = OBJECT, "nudi", STRING, "kao", ACTION, "." ;
change = ACTION, "nad", OBJECT, "postavlja", FIELD, "na", EXPRESSION, "." ;
label = OBJECT, "prikazuje", FIELD, "kao", STRING, "." ;
TYPE = "broj" | "tekst" | "logiku" ;
BOOLEAN = "da" | "ne" ;
reference = FIELD | OBJECT, ".", FIELD ;
```

Names, JSON-escaped double-quoted text, decimal numbers and comments use the
existing lexer. Sentence punctuation is mandatory. Indentation is presentation
only. Boolean choices require both distinct branches, in either order, with
the same result type and a Boolean selector. Only the selected branch executes.

Operators, high to low: parentheses; unary `minus`/`-` and `nije`;
`puta`, `kroz`, `ostatak`; `plus`, `minus`; `manje`, `vece`;
`jednako`, `razlicito`; `i`; `ili`. Binary operators associate left. Existing
numeric, Text concatenation, short-circuit, type and resource rules apply.
Unqualified references belong to the sentence's object; cross-object references
are explicit. Programs can be blank after the header. Remembered values start
as primitive literals. Derived fields can read later declarations; a bounded
dependency graph resolves order and rejects cycles before the existing checker.

## Actual semantics

An object owns typed remembered fields, readonly computed fields and named
actions. One action belongs to exactly one object. Multiple change sentences
for that action execute in sentence order as one existing Engine transaction.
An action can write only that owner's remembered fields. A missing/mismatched
offered action, duplicate field or unknown reference fails compilation.

The compiler emits normal declarations, derived values, handlers and UI nodes
with locations in the original sentence source. No source-to-source rewriting,
eval, shell, external AI or hidden permissions occur. Each object has a readonly
aggregate Record in state; private implementation slots have stable checked
identities. `bil.objects/1` metadata binds public names, slot identities and
action ownership. Source/IR canonical validation protects the full contract.

The actual new `SELECT` expression is typed, lazy and instruction-budgeted.
Derivations use the same conservative dependency analysis and transactional
working cache as other BIL code. Restart reconciles outputs against saved
remembered inputs; it does not rerun initializers over saved values.

Core5 reports `object.sentences` and Runtime minimum0.44.0. The IR/application
envelopes remain the existing checked `bil.ir/2` / application6; a version label
alone cannot make a0.42.2 native host accept this grammar. Native Python validates
the bounded object/SELECT envelope; the execution host owns full source checking.

## Studio, Draw, AI tools and export

`python -m clea7 project new MyApp --template objects` creates a real editable
project and behavioral/restart suite; check/run/test/build/validate use the same
compiler. The existing Studio start chooser selects sentence grammar for a new blank app;
the classic profile remains available for existing advanced BIL constructs.
Draw uses four actual shared operator tools: `object.remember`, `object.derive`,
`object.action`, `object.label`. Their visual form and AI proposal contract use
the same checked source transformation. Fields become real typed inputs/toggles,
derived values become outputs, and offered actions become actual buttons.
The preview runs a real SHADOW Engine with separate temporary state; running
uses the normal persistent Runtime. Standalone HTML embeds this exact compiler
and VM. Source import/export and checked CLEA7 packaging retain the original BIL.

`project.create` accepts optional `grammar:"objects"`; old calls default to
classic and retain their behavior. The new tools require a sentence project.
Generic classic structural tools reject sentence source instead of corrupting it.
Approved model context includes object structure and field labels, not initial or
runtime values. This is not a real neural generation or70B quality certificate.

## Exact limits and remaining grammar scope

At most24 objects,32 fields per object, and the existing total symbol/AST/value/
instruction limits. Source/session caching remains correct; this first profile
parses the object graph as a unit instead of claiming per-sentence incremental
reuse. Object layout is currently generated. Arbitrary custom SVG, scene clocks,
loops/functions, external adapters and module imports remain available in classic
BIL; they have no sentence forms in this profile yet. Do not advertise these
missing forms as implemented or silently convert a sentence project to classic.

## Evidence

- `node tests/test_bil_objects.cjs`:12 real compiler/VM/Engine/operator groups,
  including preserved old digests, cross-object dependencies, exhaustive/lazy
  choices, source diagnostics, rollback, restart and old-host rejection.
- `python -m unittest tests.test_bil_objects`: real SDK/native envelope and
  data-only approved model contract checks; no neural response fixture.
- `python tests/browser_object_grammar.py --output test-evidence/objects`:
  actual visual authoring, real preview/input/action, full browser shutdown and
  persisted reopen, real HTML download and independent full restart.

Physical accessibility, a rebuilt native0.44 host and a live model creating this
app are separate acceptance gates. No model weights are trained by this change.
