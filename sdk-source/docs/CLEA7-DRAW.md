# CLEA7 Draw — functional drawing through BIL

Original authoring code by Brzo i Lokalno. Draw is a mode in the existing Studio,
using the same BIL compiler, Core, Runtime, source history and package format.
It does not use Compose or execute user text as JavaScript. SVG is a documented
platform rendering standard; using it does not establish a world-first claim.

## One drawing, actual behavior

The central model is **drawing + typed state + rule + execution evidence**.
Freehand pointer input produces bounded vector points. Keyboard/form controls can
create the same object without precise drawing. Roles are object, actor, proximity
door and solid obstacle. They generate ordinary, inspectable BIL, not hidden code.

Actors have real bounded movement events. Doors use a checked pure proximity
function and reactive `derive` values; animation reads the actual changed position.
Solid/closed-door axis-aligned bounding boxes block actor movement in the same
screen. Reactions work without an AI model. The interpreter records actual
instructions/state dependencies; the Draw inspector shows the exact BIL rule and
distinguishes a project definition from real execution of that exact source.

`sdk/examples/bil/draw-door.bil` is the source actually authored and exported by
the browser acceptance flow. Open it, run it and move the player right twice.
The door opens. Reset is an explicit BIL action affecting Draw positions only.
Initial-layout changes preserve saved gameplay positions until that action is used.

## Formal UI3 additions

```ebnf
space = "space", text, "size", "[", number, ",", number, "]",
        "{", { drawing }, "}", { decoration };
drawing = "drawing", text, "points", "[", point, { ",", point }, "]",
          [ "role", ("object" | "actor" | "door" | "solid") ],
          [ "closed" ], [ "fill", text ], [ "ink", text ],
          [ "weight", number ], { decoration };
point = "[", number, ",", number, "]";
```

One statement per line/semicolon, with the existing block and decoration rules.
Space dimensions64–4096; only drawings are allowed within a space. Each drawing
has2–256 normalized point pairs in0–1000, a nonempty label up to160 characters
and stroke width1–16. Colours are hexadecimal/transparent/currentColor, never URLs.
At most64 objects/4096 geometry points and the existing VM/view/data budgets apply.
Key, numeric style bindings, bounded motion and declared gestures retain their
existing semantics. Geometry contains numbers, not SVG/XML/HTML program text.

The UI model is `bil.ui/3`; Core/package/native envelope validation require
Runtime0.40. No older supported program is reclassified or rewritten. Older
published native hosts reject a UI3 package rather than pretending to execute it.

## Source and accessibility

Objects have stable source keys. Adding/repositioning an object keeps unrelated
functions, comments, state and project identity. Shared Undo restores the previous
source. A manually modified generated reset/collision declaration is preserved and
reported; it is not silently overwritten. Unrepresentable code remains in BIL.

The editor has labelled keyboard controls, semantic hierarchy, source navigation,
actual zoom, optional freehand creation and an explicit reset. Runtime actor
controls have keyboard/swipe and visible-button alternatives. Reduced motion is
respected by the existing renderer. No sight/hearing/speech condition is required.
Physical assistive-device and human accessibility acceptance remain separate.

One existing CLEA AI conversation can receive an explicitly prepared behavior
request. The Draw button stages text only. It does not send source automatically,
start another model or claim that a model reply is an executed application. The
existing compiler/review/Runtime path still decides whether proposed code is valid.

## Verification and scope

- `node tests/test_clea_draw.cjs`: actual compiler/Core/Engine behavior and denial.
- `python tests/browser_clea_draw.py --output /tmp/draw-proof`: actual freehand
  editing, keyboard behavior, factual explanation, Undo, export, independent Runtime
  execution/restart and390px layout. No neural-inference fixture is used.
- Native Windows and Android receipts must identify their own actual build SHA.

This is functional 2D object authoring with proximity and box collision. Continuous
rigid-body physics, raster sprite frame sequences, game audio, arbitrary runtime
scripting, a completed3D engine and universal arbitrary-app AI are not implied.
Existing Studio timeline/state-machine/UI/media tools remain available in their
supported modes; they are not relabelled as new Draw features without verification.
