# CLEA Depth — Core8 / Runtime0.47

Original WebGL2 presentation host, mesh construction, matrices, shaders and Draw
integration by Brzo i Lokalno. It uses browser WebGL, not Three.js, a renamed
external engine, an Android renderer rewrite or a claim of world-first technology.
The original seven Runtime responsibilities and the same BIL VM remain in place.

Write source, compose with Draw, or review an AI tool proposal. All three paths
use the same parser, typed bindings, source locations, events and runtime state.
An AI proposal has no extra authority. HP neural generation needs the real local
model service; this renderer and authored applications do not need that service.

```bil
BIL "My room".
room pamti turn kao broj 0.
rotate nad room postavlja turn na (turn plus 15) ostatak 360.
pogled home "My room" {
 world "My space" camera [6,4,9] looking [0,0,0] depth 0.5 {
  mesh "My object" geometry "torus" at [0,0,0] size [2,0.6,2] rotation [0,room.turn,0] surface "metal" color "#49c9ac" gestures { tap runs rotate } key myobject
 } key myworld
}.
```

In actual BIL source, keep a mesh declaration and its clauses on one line.
The runnable complete example is `sdk/examples/bil/depth-atlas.bil`.
Geometry: `box`, `sphere`, `cylinder`, `torus`, `prism`. A prism also has `points
[[0,0],[1000,0],[500,1000]]` before `at`; a simple closed contour becomes a solid
with front/back faces and side walls. Self-intersections and degenerate contours
are rejected. The shared `depth.js` contour validator is required for prisms.

`at`, `size`, `rotation`, camera and target are three-dimensional vectors with
literal numbers or typed numeric bindings. Rotation is in degrees. Extents must
remain positive. Coordinates are finite and bounded to ±10000; an invalid dynamic
value reports an error rather than silently moving the object. Camera and target
must differ. A world contains1–96 meshes. There are at most four active worlds.

Surfaces: `matte`, `ceramic`, `metal`, `light`; color is `#RRGGBB`. Directional and
fill illumination, highlights, rim lighting, fog and a1024² depth shadow map are
real shader calculations. This is not full physically based rendering, ray tracing,
a complete3D physics solver, skeletal animation, a multiplayer stack or proof
that arbitrary commercial games can already be generated correctly.

Depth cues include perspective, occlusion, shading and optional motion parallax.
Nintendo3DS XL uses specialized display hardware to present different images to
the two eyes. A normal display does not gain that hardware in software. CLEA Depth
does not claim binocular/autostereoscopic output. Pointer motion works without a
camera; device orientation is an optional user action and respects permission
refusal/unavailability. It only changes presentation; sensor samples are not saved
or sent to a server. Reduced-motion turns parallax off. Camera buttons and keyboard
arrows/Home remain available. Meaningful mesh actions have named HTML buttons.
Canvas picking tests the actual projected triangles and their depth, including
occlusion by meshes without actions. It is not an approximate bounding-box click.

Quality has three bounded mesh levels and pixel-density caps. The host measures
submission cost and continuous-frame intervals; these are not GPU timer-query
measurements or promised FPS. Geometry cache keys include geometry/contour/LOD;
it is owned by one view, capped at24MiB geometry data and192 buffers, and cleaned
when that view closes. A1024² shadow depth texture is separately accounted.
Canvas pixels are capped at1.8million. GPU/driver memory can exceed these data
counts; they are not an operating-system memory limit. Unavailable/lost WebGL
shows a clear fallback and retains named BIL actions. Hidden views stop rendering.

The existing shared tools add:

- `ui.compose`: arbitrary `world`/`mesh` nodes with typed bindings.
- `depth.transform`: edit selected mesh transforms/material without changing logic.
- `depth.from-drawing`: extrude a user's existing closed Draw contour into a world.

This release is verified for the browser host. Old Windows/Android0.42.2 binaries
are not relabelled0.47. A `.clea7` package needs Runtime0.47 for these features;
the browser package is distinct from a native APK/EXE build.

Actual local tests use Chromium SwiftShader software WebGL. Physical Android/iOS,
orientation sensors and blind/deaf users require separate device/human acceptance.
