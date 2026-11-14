# Typed card collections — BIL UI3 / Runtime0.40

Original BL CLEA implementation by Brzo i Lokalno. This adds data-driven,
repeating cards to the existing language/compiler/Core/Studio/Runtime. It does
not replace the language, create a separate app generator or require a model.

## Executable syntax

See `sdk/examples/bil/cards-learning.bil` for an original, offline two-screen
learning application with answers and once-only scoring. The collection grammar
is one statement, followed by the existing optional key/style/motion clauses:

```ebnf
cards = "cards", name, "label", text, "fields", "[", column,
        { ",", column }, "]", "identity", name, "select", name,
        [ "image", name ], "action", text, "runs", name,
        [ "empty", text ];
column = name, [ ":", text ];
```

```bil
record Lesson { id: Text, title: Text, detail: Text }
let lessons: List<Lesson> = []
let selected = ""
let detail = ""
on open_lesson {
    for lesson in lessons {
        if lesson.id == selected { detail = lesson.detail }
    }
}
screen home "Učenje" {
    cards lessons label "Moje lekcije" fields [title: "Naziv", detail: "Sadržaj"] identity id select selected action "Otvori" runs open_lesson empty "Nema lekcija." key lesson_cards
    show detail
}
```

No example data are fabricated at runtime. The app defines its local or remote
collection and ordinary handler. A card action resolves its stable Text identity
against current committed data, sets the declared mutable Text selection and
executes that handler in the **same local transaction**. Reordering or filtering
cannot redirect the action to a different row. A deleted key rejects the action;
a handler error rolls back the selection and local state. External effects retain
the existing separate uncertainty/permission rules; local rollback does not undo
a completed remote write.

## Data and bounds

- Data are `List<Record>`; identity is a record Text field, distinct/nonempty and
  at most128 characters in each current snapshot. Invalid identities reject the
  state transaction, without logging private values.
- Selection is mutable Text. The action is an existing ordinary event; typed
  remote completion handlers cannot be invoked as card actions.
- One to eight distinct Text/Number/Boolean fields; labels1–200 characters.
  At most eight collections per application,12 rendered records per collection
  page and the existing1000-item/data-size/2000-active-view-element budgets.
- Search and bounded pagination operate on the actual collection. Search/page
  state is transient and resets when the authenticated principal changes.
- Optional image fields have type `NativeMedia` or `NativeMedia?` and require
  an already-declared compatible image/native adapter. Only host-owned blob or
  Android owned-media URLs can render; source-provided arbitrary URLs cannot.
  Old-account/deleted/replaced images cannot resolve back into the new UI.
- Data use DOM text nodes, never HTML/eval. Keyboard buttons have distinct names
  containing each card title; semantic list, heading, search, count and pagination
  roles are available. Physical screen-reader/haptic evaluation is separate.

## Studio and distribution

In the existing BIL screen designer open **Kolekcije · kartice, galerije i radnje
po stavci**. Create a new empty collection with real input/add/select/detail
events, or bind an existing typed record collection, identity, selection and
handler. Existing source, algorithms, project identity and stored values remain;
one Undo restores the exact earlier source. The generated code stays editable.

New programs lower to versioned `bil.ui/3` within the existing application ABI.
The JS Core, independent Python validator, package manifest and signatures require
Runtime0.40. Old UI1/UI2 sources keep their exact existing representation and
minimum versions. Older published native binaries cannot run a UI3 package and
must reject it; a new host build must be verified/published separately.

The seven original responsibilities remain active: Core AI Manager schedules the
event; Link Bridge checks types/identity; Expansion Q advertises UI-model3; Adaptive
Recovery protects the local transaction; Holo renders actual data; Fallback uses
the explicit empty/error path; Vision Q records actual source-mapped reads/writes
and failures. None grants networking, camera or AI permission implicitly.

## Verification and limits

`node tests/test_bil_cards.cjs` exercises the actual compiler/Core/Engine/package.
`python -m unittest tests.test_bil_cards -v` independently validates/packages/signs
the same contract. `python tests/browser_bil_cards.py --output /tmp/cards-proof`
drives real visual authoring, keyboard actions, export and independent Runtime.

This feature alone does not finish a production community backend, durable login,
remote push, arbitrary-app neural authoring, OCR or all Master acceptance gates.
Browser proofs must not be relabelled as Windows/Android physical execution.
