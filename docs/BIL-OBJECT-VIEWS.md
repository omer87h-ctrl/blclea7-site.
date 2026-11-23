# BIL owned objects with custom Draw views — Runtime0.45

The original sentence objects are no longer limited to their automatic form.
`pogled` adds an explicit visual projection of the SAME owned fields and actions.
This is part of the existing lexer, checked AST, interpreter and Runtime, not a
second UI language interpreter or generated JavaScript. Existing sentence files
without views retain their exact IR and Runtime0.44 requirement. Classic BIL is
unchanged. Custom views declare the `object.views` feature and require0.45.

```bil
BIL "Moja interaktivna ideja".
orbita pamti ugao kao broj 0.
okreni nad orbita postavlja ugao na (ugao plus 15) ostatak 360.
pogled scena "Moj svijet" {
    shape "diamond" label "Moja oznaka" style { width 90; height 90; rotate orbita.ugao } gestures { tap runs okreni } key oznaka
    input orbita.ugao label "Ugao" key ugao
    button "Okreni" runs okreni key okreni
    show orbita.ugao key rezultat
}.
pocetak scena.
```

Visual clauses must stay on the same component statement; the executable file
`sdk/examples/bil/signal-lab.bil` demonstrates a complete two-view interactive
game/lab. Its target is collected only when the player is near, the score/record
are real reactive state, controls move the player, the user-started clock rotates
the marker and counts the round, and restart preserves the record. The second
view edits the same positions/camera instead of maintaining another data copy.

Each view ends `}.` and may contain existing typed rows/cards, arbitrary normalized
vectors, spaces64–4096, shapes, controls, reactive outputs, camera, clock/pad,
gestures and reduced-motion-aware transitions. Inputs and visual numeric bindings
use `owner.field`; the compiler resolves their exact owned field symbol. Derived
values may drive appearance/output but cannot become writable inputs. Buttons,
gestures and clocks call existing owned actions. Views may navigate between
screens with `button "Details" opens details`.

The maximum is16 explicit views; existing object, component, geometry and event
budgets remain. There are no arbitrary JS, network, hardware or file privileges.
This does not add3D, audio synthesis, sprite assets, native0.45 binaries, general
rigid-body physics or unrestricted code generation. Classic BIL scene/physics
remains available in classic projects; imports/functions do not yet have sentence
equivalents. No world-first claim is made for visual projections.

In Draw, **Sastavi svoj interfejs i prostor → Dodaj slobodni pogled** adds the
projection. Add a layout/space, place custom vectors and choose existing owned
fields and actions. The same `screen.add`, `ui.compose`, style/move/duplicate/remove
tools are available to the approved model operator (revision4). Logic stays in
`object.*`; no classic `let/on` template is appended to a sentence project.
The automatic form remains until an explicit view is created. Data and actions
remain intact when a view changes. Existing persisted project IDs are preserved.

Model-generated tool plans still require real compilation, isolated execution,
source fingerprint verification and review. These tools do not establish the
quality of an offline HP model or replace training/70B evaluation.
