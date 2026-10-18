# Original BIL visual presentation, 0.14

The original compiler and runtime share bil.ui/2. Existing bil.ui/1 applications keep their compatibility contract. New presentation packages require Runtime 0.14 or newer, including signed packages.

Use sdk/examples/bil/motion-scene.bil for an independently authored non-business interactive application. It uses original CSS geometry, system typography, gradients, declared gesture handlers and bounded numeric state. No images, copied templates or online model are needed.

In Studio, open BIL language and a screen-based application. Expand "Izgled i animacija" for a visual component. Choose a registered property and apply a value; @offset binds a numeric property to a declared Number. Empty input removes that property's declaration. The edit is applied to checked source spans; surrounding logic and comments remain. Use BIL undo/redo. Compile/apply and run to update the actual application; visual preview uses isolated trial data.

Closed presentation properties include colours, dimensions, spacing, borders, opacity, transforms, typography enums and layout enums. Colours accept hexadecimal values, transparent or inherit. Gradient colours must be supplied together. Values are checked at compile time; numeric visual bindings are bounded to renderer-safe ranges without changing the logical application value. Arbitrary CSS properties, URL styles and remote fonts are rejected.

Shapes: circle, square, diamond, triangle and ring. Motion: none, fade, slide, move and scale; 0–2000 milliseconds. Animations respect reduced-motion preference. Gestures: tap, swipeLeft, swipeRight and press, wired to declared ordinary zero-argument event handlers. The renderer provides visible and keyboard alternatives. Gesture handlers currently require BIL authoring; the visual style editor is not a full gesture-logic authoring system.

Browser controls, preview styles, source preservation, undo/redo, gesture execution, restart persistence and reduced-motion have real Chrome verification. This document does not claim physical-device coverage or a complete general-purpose Studio benchmark. Native capability and platform results are recorded separately.
