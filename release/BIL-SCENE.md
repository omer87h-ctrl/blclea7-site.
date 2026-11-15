# BIL Core4: original bounded interactive scenes

BL CLEA7 by Brzo i Lokalno. Runtime0.42.0, application/6+ and existing bil.ui/3.
Older sources retain their old minimum. No arbitrary JS, downloaded plugin or new
language/framework is executed. `sdk/examples/bil/living-scene.bil` is executable.

`import scene` provides the typed `SceneBody` record: id:Text; x,y,width,height,
vx,vy,mass,bounce:Number; solid:Boolean. All operations return fresh values.

| Operation | Result / semantics |
| --- | --- |
| body(id,x,y,width,height,mass) | SceneBody; zero velocity, solid, bounce0; mass0 is static |
| motion(body,vx,vy), solid(body,flag), rebound(body,bounce) | Updated SceneBody |
| item(bodies,id), replace(bodies,body) | Existing identity only; missing/duplicate identities fail |
| step(bodies,delta,gravity,width,height) | List<SceneBody>; integration and axis-aligned collision |
| overlap(a,b), near(a,b,distance) | Boolean; bounds / center distance |
| sample(times,values,time,mode) | Number; linear, smooth or step interpolation |

Scene limits:32 bodies,16 substeps,0..0.1s delta, velocity±2000, bounded dimensions,
unique safe ids, mass0..10000, restitution0..1. Subdivision limits reject excessive
movement instead of silently tunnelling. Pair resolution is deterministic by id;
outputs preserve list order. Work is charged to the existing BIL instruction/time
budget; faults roll back the transaction. This is a simple2D AABB solver, without
rotated bodies, joints, friction, continuous collision guarantees or3D physics.

## Grammar additions

```ebnf
clock = "clock", STRING, "every", NUMBER, "runs", IDENT, decorations ;
pad = "pad", STRING, "left", IDENT, "right", IDENT, "up", IDENT,
      "down", IDENT, "release", IDENT, decorations ;
space = "space", STRING, "size", "[", NUMBER, ",", NUMBER, "]",
        [ "camera", "[", IDENT, ",", IDENT, ",", IDENT, "]" ],
        "{", { drawing }, "}", decorations ;
```

Clock:50–1000ms, one awaited transaction at a time, explicit start/pause, no
background catch-up, pause on hidden document, disposal on navigation/close and
manual resume after10,000 ticks. No timer runs in SHADOW. Timing scheduling is
host-dependent; BIL simulation uses its declared fixed delta, not the wall clock.
Each tick uses the existing persisted transaction; high-frequency games may need
a future explicit transient-state/checkpoint contract, not hidden lossy storage.

The control pad has keyboard arrows/Escape and pointer press/release/cancellation;
it changes ordinary checked BIL state, never device privileges. Camera binds
Number x,y,zoom; zoom0.25–4. Its actual SVG viewBox changes. Reduced-motion users
retain explicit control; no autoplay or decorative movement is required.

Draw's “Dodaj živu2D scenu” and the reviewed `scene.add` model tool invoke the same
source-preserving transformation. It namespaces symbols, retains existing code,
compiles and runs real SHADOW checks before approval. Local finite commands are
labelled non-neural. Scene source, physics, controls and timelines remain editable
BIL. A checked tool schema is not proof that the offline HP9B generated a proposal.

Tests: `node tests/test_bil_scene.cjs`, `node tests/test_studio_operator.cjs`,
`python tests/browser_living_scene.py --output test-evidence/living-scene`.
